#!/usr/bin/env node
// Read-only working-tree statistics. Git's index decides which paths exist in scope.
import { execFileSync } from 'node:child_process';
import { isUtf8 } from 'node:buffer';
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const codeExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts', '.css', '.scss', '.sass', '.py', '.sql', '.sh']);
const artifactDirectories = new Set(['.git', 'node_modules', '.next', 'out', 'build', 'dist', 'coverage', '.turbo', '.cache', '.vercel', '.venv', 'venv', '__pycache__']);
const credentialDirectories = new Set(['.aws', '.ssh', '.gnupg', '.secrets', 'secrets', 'credentials']);
const size = () => ({ files: 0, bytes: 0 });
const codeSize = () => ({ ...size(), textFiles: 0, totalLines: 0, nonemptyLines: 0, binaryFiles: 0 });

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('Git is required. Install Git and run this command inside a Git working tree.');
    throw new Error('Could not read the Git working tree/index. Run this command inside a readable Git checkout.');
  }
}

function exclusion(path) {
  const parts = path.toLowerCase().split('/');
  const name = parts.at(-1);
  if (parts.some((part) => credentialDirectories.has(part)) ||
      name.startsWith('.env') ||
      /^(?:\.npmrc|\.netrc|\.pypirc|\.git-credentials|id_rsa|id_dsa|id_ecdsa|id_ed25519)(?:\.|$)/.test(name) ||
      /^(?:credentials?|secrets?|service[-_]?account)(?:[._-]|$)/.test(name) ||
      /\.(?:pem|key|p12|pfx|keystore)$/.test(name)) return 'sensitive';
  if (parts.some((part) => artifactDirectories.has(part)) ||
      parts.includes('.yarn') || /^\.pnp(?:\.|$)/.test(name) ||
      name.endsWith('.tsbuildinfo') || name.endsWith('.pyc') || name === 'next-env.d.ts') return 'artifacts';
  return null;
}

function isTest(path) {
  const name = path.split('/').at(-1);
  return /\.(?:test|spec)\.[^.]+$/.test(name) || /^test_.+\.py$/.test(name) ||
    /_test\.py$/.test(name) || path.split('/').some((part) => ['test', 'tests', '__tests__'].includes(part));
}

// Check every ancestor: lstat on the final path alone would follow a symlinked directory.
function inspect(root, path) {
  const parts = path.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..') || path.startsWith('/')) return { skip: 'nonregular' };
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index]);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) return { skip: 'symlinks' };
    if (index < parts.length - 1 && !stat.isDirectory()) return { skip: 'nonregular' };
    if (index === parts.length - 1) return stat.isFile() ? { stat, absolute: current } : { skip: 'nonregular' };
  }
}

function readCode(absolute, stat) {
  // No following leaf links or blocking on a FIFO if a path changes after lstat.
  const fd = openSync(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size !== stat.size) {
      throw new Error('File changed during measurement.');
    }
    const bytes = readFileSync(fd);
    if (bytes.length !== stat.size || fstatSync(fd).mtimeMs !== opened.mtimeMs) throw new Error('File changed during measurement.');
    // Never decode non-code assets, NUL/control-byte content, or invalid UTF-8.
    if (!isUtf8(bytes) || bytes.some((byte) => byte < 32 && ![9, 10, 12, 13].includes(byte))) return null;
    if (bytes.length === 0) return { totalLines: 0, nonemptyLines: 0 };
    const lines = bytes.toString('utf8').split(/\r\n|\n|\r/);
    if (lines.at(-1) === '') lines.pop();
    return { totalLines: lines.length, nonemptyLines: lines.filter((line) => line.trim().length > 0).length };
  } finally {
    closeSync(fd);
  }
}

function addSize(target, bytes) {
  target.files += 1;
  target.bytes += bytes;
}

function addCode(target, bytes, lines) {
  addSize(target, bytes);
  if (lines === null) target.binaryFiles += 1;
  else {
    target.textFiles += 1;
    target.totalLines += lines.totalLines;
    target.nonemptyLines += lines.nonemptyLines;
  }
}

function countRoutes(target, path) {
  const match = /^(?:src\/)?app\/(.*)\/(page|route)\.(?:[jt]sx?)$/.exec(path) ||
    /^(?:src\/)?app\/()(page|route)\.(?:[jt]sx?)$/.exec(path);
  if (!match) return;
  const segments = match[1].split('/').filter(Boolean);
  if (segments.some((part) => part.startsWith('_'))) return;
  const dynamic = segments.some((part) => /\[[^\]]+\]/.test(part));
  if (match[2] === 'page') {
    target.pageFiles += 1;
    if (dynamic) target.dynamicPageFiles += 1;
  } else {
    const urlSegments = segments.filter((part) => !/^\([^)]*\)$/.test(part) && !part.startsWith('@'));
    const category = urlSegments[0] === 'api' ? 'apiHandlerFiles' : 'otherHandlerFiles';
    target[category] += 1;
    if (dynamic) target.dynamicHandlerFiles += 1;
  }
}

function collectStats() {
  const root = git(['rev-parse', '--show-toplevel'], process.cwd()).toString('utf8').replace(/\r?\n$/, '');
  let head = null;
  try { head = git(['rev-parse', '--verify', 'HEAD'], root).toString('utf8').trim(); } catch { /* An unborn Git repository has no HEAD. */ }
  const paths = [...new Set(git(['ls-files', '--cached', '--full-name', '-z'], root).toString('utf8').split('\0').filter(Boolean))].sort();
  const result = {
    schemaVersion: 1,
    git: { head, content: 'working-tree', dirtyState: 'not-inspected' },
    basis: 'Unique git ls-files --cached --full-name -z paths; present regular working-tree files, including tracked-ignored files. No untracked files, Git objects, timestamps, or absolute paths.',
    definitions: {
      revision: 'HEAD is context only; counts use current tracked working-tree contents, which may contain staged or unstaged changes. Dirty state is not inspected, to avoid opening excluded files.',
      bytes: 'Logical file bytes, not disk usage, bundle size, or deployed size. Groups overlap.',
      exclusions: 'Dependency/build/cache directories, generated next-env.d.ts and compiler caches, .env names (including examples), and conventional credential/key names. Name-based protection is not a secret scanner. Symlinks are never followed.',
      code: `Files ending in ${[...codeExtensions].join(', ')}. Source excludes test files; code = source + tests. Configs, scripts, styles and SQL are included.`,
      tests: '*.test.* / *.spec.* code files, Python test_*.py / *_test.py, and code under test, tests or __tests__ directories. File counts only; no tests are executed and no coverage is measured.',
      lines: 'Physical lines: LF, CRLF or CR delimiters; a final delimiter adds no extra line; an empty file has 0 lines. Nonempty lines have non-whitespace text. Comments are included; these are not decommented LOC. Only UTF-8 code without binary control bytes is decoded; binaryFiles are excluded from line totals.',
      routes: 'App Router page/route.[jt]s(x) convention files in app/ or src/app/, excluding private _directories. Dynamic files have bracketed segments. API handlers have api as the first URL segment after route groups/slots. Counts are files, not unique/expanded URLs or HTTP methods; no build or config evaluation.',
      components: 'Non-test .tsx/.jsx files in components/ or src/components/ (shared), or app/ and src/app/ _components directories (colocated). Files, not component exports.',
      data: 'All included files under src/data/ or data/; includes compressed assets without decompression.',
    },
    trackedPaths: paths.length,
    included: size(),
    excluded: { sensitive: 0, artifacts: 0, symlinks: 0, nonregular: 0, missing: 0, unreadableOrChanged: 0 },
    code: codeSize(),
    source: codeSize(),
    tests: codeSize(),
    routes: { pageFiles: 0, dynamicPageFiles: 0, apiHandlerFiles: 0, otherHandlerFiles: 0, dynamicHandlerFiles: 0 },
    components: { shared: size(), colocated: size() },
    scripts: size(),
    data: size(),
    topLevel: {},
    warnings: [],
    complete: true,
  };
  const groups = new Map();
  for (const path of paths) {
    const excluded = exclusion(path);
    if (excluded) { result.excluded[excluded] += 1; continue; }
    let file;
    let lines;
    const code = codeExtensions.has(extname(path).toLowerCase());
    try {
      file = inspect(root, path);
      if (file.skip) { result.excluded[file.skip] += 1; continue; }
      if (code) lines = readCode(file.absolute, file.stat);
    } catch (error) {
      result.excluded[error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 'missing' : 'unreadableOrChanged'] += 1;
      continue;
    }
    const bytes = file.stat.size;
    addSize(result.included, bytes);
    const group = path.includes('/') ? `${path.split('/')[0]}/` : '(root files)';
    if (!groups.has(group)) groups.set(group, size());
    addSize(groups.get(group), bytes);
    if (path.startsWith('scripts/')) addSize(result.scripts, bytes);
    if (/^(?:src\/)?data\//.test(path)) addSize(result.data, bytes);
    const test = code && isTest(path);
    if (code) {
      addCode(result.code, bytes, lines);
      addCode(test ? result.tests : result.source, bytes, lines);
    }
    if (!test && /\.[jt]sx$/.test(path)) {
      if (/^(?:src\/)?components\//.test(path)) addSize(result.components.shared, bytes);
      else if (/^(?:src\/)?app\/(?:.*\/)?_components\//.test(path)) addSize(result.components.colocated, bytes);
    }
    countRoutes(result.routes, path);
  }
  result.topLevel = Object.fromEntries([...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  for (const [code, message] of [
    ['missing', 'Tracked paths are absent from the working tree; excluded from all file, byte and line totals.'],
    ['unreadableOrChanged', 'Tracked files could not be safely read or changed during measurement; excluded from totals.'],
  ]) {
    if (result.excluded[code]) result.warnings.push({ code, count: result.excluded[code], message });
  }
  result.complete = result.warnings.length === 0;
  return result;
}

function human(stats) {
  const sized = (value) => `${value.files} files, ${value.bytes} bytes (${(value.bytes / 1024 / 1024).toFixed(2)} MiB)`;
  const lined = (value) => `${sized(value)}, ${value.totalLines} physical / ${value.nonemptyLines} nonempty lines`;
  return [
    'Project statistics (tracked working-tree files)',
    `HEAD: ${stats.git.head ?? '(no commit)'}; dirty state not inspected; counts may differ from HEAD`,
    `Included: ${sized(stats.included)}; ${stats.trackedPaths} tracked paths before exclusions`,
    `Code: ${lined(stats.code)}`,
    `Source (non-test code): ${lined(stats.source)}`,
    `Tests: ${lined(stats.tests)}`,
    `Pages: ${stats.routes.pageFiles} files (${stats.routes.dynamicPageFiles} dynamic)`,
    `Route handlers: ${stats.routes.apiHandlerFiles} API + ${stats.routes.otherHandlerFiles} other files (${stats.routes.dynamicHandlerFiles} dynamic)`,
    `Components: ${stats.components.shared.files} shared + ${stats.components.colocated.files} colocated files`,
    `Scripts directory: ${sized(stats.scripts)}`,
    `Data directories: ${sized(stats.data)}`,
    `Excluded paths: ${Object.entries(stats.excluded).map(([key, value]) => `${key}=${value}`).join(', ')}`,
    `Binary code files excluded from line totals: ${stats.code.binaryFiles}`,
    'Lines include comments; nonempty is not decommented LOC. Test files are not test cases or coverage.',
    'Counts use the Git index and current file contents, include tracked-ignored files, and never execute project code.',
    'Use --json for definitions and top-level file/byte groups. No data generation, build, or network access.',
    ...stats.warnings.map((warning) => `WARNING: ${warning.count} ${warning.code}: ${warning.message}`),
  ].join('\n');
}

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Usage: node scripts/project-stats.mjs [--json]\nRead-only statistics for tracked files in the current Git checkout. --json prints deterministic JSON.');
  } else if (args.length > 1 || (args.length === 1 && args[0] !== '--json')) {
    throw new Error('Unknown arguments. Usage: node scripts/project-stats.mjs [--json]');
  } else {
    const stats = collectStats();
    console.log(args.includes('--json') ? JSON.stringify(stats, null, 2) : human(stats));
  }
} catch (error) {
  console.error(`project:stats: ${error.message}`);
  process.exitCode = 1;
}
