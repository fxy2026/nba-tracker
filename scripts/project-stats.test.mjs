import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./project-stats.mjs', import.meta.url));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'project-stats-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '--quiet');
  /** @param {string} path @param {string | Buffer} content */
  function put(path, content = '') {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  function run(args = ['--json'], options = {}) {
    return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', timeout: 10000, ...options });
  }
  function stats() {
    const output = run();
    assert.equal(output.status, 0, output.stderr);
    assert.equal(output.stderr, '');
    return JSON.parse(output.stdout);
  }
  return { root, git, put, run, stats, track: () => git('add', '--all', '--force') };
}

test('counts only tracked present files, including ignored paths; never creates generated data', (t) => {
  const f = fixture(t);
  f.put('.gitignore', 'ignored/\n');
  f.put('ignored/資料 with spaces.ts', '// A comment\r\n \t\r\nexport const n = 1;');
  f.put('src/zero.ts', '');
  f.put('src/check.test.ts', '// test\n\n');
  f.put('src/data/snapshot.json.gz', Buffer.from([0, 255, 1, 10]));
  f.track();
  f.put('src/data/generated-duplicate.json', 'not tracked');
  f.put('untracked.test.ts', 'not tracked');
  f.put('.env.local', 'not tracked either');
  const before = readFileSync(join(f.root, 'ignored/資料 with spaces.ts'));
  const index = f.git('ls-files', '-z');
  const result = f.stats();
  assert.equal(result.trackedPaths, 5);
  assert.equal(result.included.files, 5);
  assert.deepEqual(result.code, { files: 3, bytes: before.length + 9, textFiles: 3, totalLines: 5, nonemptyLines: 3, binaryFiles: 0 });
  assert.equal(result.source.files, 2);
  assert.equal(result.tests.files, 1);
  assert.equal(result.tests.totalLines, 2);
  assert.deepEqual(result.data, { files: 1, bytes: 4 });
  assert.equal(result.git.head, null);
  assert.equal(result.git.content, 'working-tree');
  assert.equal(result.git.dirtyState, 'not-inspected');
  assert.equal(result.complete, true);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(readFileSync(join(f.root, 'ignored/資料 with spaces.ts')), before);
  assert.deepEqual(f.git('ls-files', '-z'), index);
  assert.equal(f.run().stdout, f.run().stdout, 'JSON is byte-for-byte deterministic');
  const nested = f.run(['--json'], { cwd: join(f.root, 'src') });
  assert.equal(nested.stdout, f.run().stdout, 'running from a subdirectory still measures the checkout');
});

test('distinguishes source, conventional tests, script sizes, and line endings', (t) => {
  const f = fixture(t);
  for (const [path, content] of Object.entries({
    'src/a.ts': 'one\r\n\r\nthree\r\n',
    'src/b.ts': 'one\n\ntwo',
    'src/c.ts': '\n',
    'src/d.ts': 'one\rtwo\r',
    'src/e\nname.ts': ' \t\r\n',
    'scripts/test_sample.py': '# comment\n',
    'scripts/sample_test.py': 'pass',
    'scripts/check.spec.mjs': 'test();\n',
    'tests/helper.ts': 'helper();',
    'src/__tests__/fixture.ts': '// comment',
    'scripts/job.sh': '#!/bin/sh\necho hi\n',
  })) f.put(path, content);
  f.track();
  const result = f.stats();
  assert.equal(result.code.files, 11);
  assert.equal(result.code.totalLines, 17);
  assert.equal(result.code.nonemptyLines, 13);
  assert.equal(result.tests.files, 5);
  assert.equal(result.tests.totalLines, 5);
  assert.equal(result.source.files, 6);
  assert.equal(result.source.totalLines, 12);
  assert.equal(result.scripts.files, 4);
  assert.equal(result.source.totalLines + result.tests.totalLines, result.code.totalLines);
});

test('counts page, dynamic, API and other handler files, not HTTP methods or exports', (t) => {
  const f = fixture(t);
  for (const path of [
    'src/app/page.tsx',
    'src/app/team/[id]/page.tsx',
    'src/app/(group)/docs/[[...slug]]/page.jsx',
    'app/blog/[...slug]/page.js',
    'src/app/@modal/(.)photo/[id]/page.tsx',
    'src/app/api/games/route.ts',
    'src/app/(group)/api/player/[id]/route.tsx',
    'src/app/shot-archive/[id]/route.ts',
    'src/app/api/games/route.test.ts',
    'src/app/page.test.tsx',
    'src/app/private/_internal/page.tsx',
    'src/app/_lib/api/route.ts',
    'src/app/layout.tsx',
    'src/components/Score.tsx',
    'src/components/Score.test.tsx',
    'src/components/helper.ts',
    'components/Another.jsx',
    'src/app/game/[id]/_components/Box.tsx',
    'src/app/game/[id]/_components/Box.spec.tsx',
    'app/_components/Shared.jsx',
  ]) f.put(path, '// one file, arbitrary number of exports\n');
  f.track();
  const result = f.stats();
  assert.deepEqual(result.routes, { pageFiles: 5, dynamicPageFiles: 4, apiHandlerFiles: 2, otherHandlerFiles: 1, dynamicHandlerFiles: 2 });
  assert.equal(result.components.shared.files, 2);
  assert.equal(result.components.colocated.files, 2);
  assert.equal(result.tests.files, 4);
});

test('excludes tracked credentials and build/dependency artifacts before any file inspection', (t) => {
  const f = fixture(t);
  const secrets = ['.env', '.env.example', '.env.local', '.env.local.example', '.envrc', '.npmrc', 'credentials.json', 'secrets.ts', 'service-account.json', '.aws/config', '.ssh/id_rsa', 'certs/private.key', 'certs/client.pem'];
  const artifacts = ['node_modules/pkg/code.ts', '.next/types/a.ts', 'dist/code.ts', 'build/code.ts', 'out/a.js', 'coverage/a.js', '.vercel/project.json', '.yarn/cache/pkg.zip', '.pnp.cjs', 'tsconfig.tsbuildinfo', 'next-env.d.ts', 'scripts/__pycache__/a.pyc'];
  for (const path of [...secrets, ...artifacts]) f.put(path, 'DO-NOT-EXPOSE-THIS-CONTENT');
  f.put('src/good.ts', 'safe\n');
  f.track();
  // Removing excluded files proves they are classified before lstat/read: no missing warnings.
  for (const path of [...secrets, ...artifacts]) rmSync(join(f.root, path));
  const output = f.run();
  const result = JSON.parse(output.stdout);
  assert.equal(result.excluded.sensitive, secrets.length);
  assert.equal(result.excluded.artifacts, artifacts.length);
  assert.deepEqual(result.included, { files: 1, bytes: 5 });
  assert.equal(result.complete, true);
  assert.equal(result.excluded.missing, 0);
  assert.equal(output.stdout.includes('DO-NOT-EXPOSE'), false);
});

test('counts binary assets by bytes and never decodes binary/invalid UTF-8 code as lines', (t) => {
  const f = fixture(t);
  f.put('src/binary.ts', Buffer.from([97, 0, 10]));
  f.put('src/invalid.ts', Buffer.from([255, 10]));
  f.put('src/control.ts', Buffer.from([97, 1, 10]));
  f.put('src/unicode.ts', 'const 名 = "🏀";\n');
  f.put('src/data/asset.gz', Buffer.from([255, 0, 3]));
  f.track();
  const result = f.stats();
  assert.equal(result.code.files, 4);
  assert.equal(result.code.binaryFiles, 3);
  assert.equal(result.code.textFiles, 1);
  assert.equal(result.code.totalLines, 1);
  assert.equal(result.code.nonemptyLines, 1);
  assert.deepEqual(result.data, { files: 1, bytes: 3 });
});

test('skips leaf and ancestor symlinks, missing paths and nonregular replacements safely', { skip: process.platform === 'win32' }, (t) => {
  const f = fixture(t);
  f.put('outside/sensitive.ts', 'DO-NOT-READ\n');
  f.put('src/replace/file.ts', 'original\n');
  f.put('src/missing.ts', 'gone\n');
  f.put('src/directory.ts', 'file\n');
  symlinkSync('../outside/sensitive.ts', join(f.root, 'src/link.ts'));
  f.git('add', 'src');
  rmSync(join(f.root, 'src/replace'), { recursive: true });
  symlinkSync('../outside', join(f.root, 'src/replace'));
  rmSync(join(f.root, 'src/missing.ts'));
  rmSync(join(f.root, 'src/directory.ts'));
  mkdirSync(join(f.root, 'src/directory.ts'));
  const result = f.stats();
  assert.equal(result.trackedPaths, 4);
  assert.deepEqual(result.included, { files: 0, bytes: 0 });
  assert.equal(result.excluded.symlinks, 2);
  assert.equal(result.excluded.nonregular, 1);
  assert.equal(result.excluded.missing, 1);
  assert.equal(result.complete, false);
  assert.deepEqual(result.warnings.map(({ code, count }) => ({ code, count })), [{ code: 'missing', count: 1 }]);
  assert.match(f.run([]).stdout, /WARNING: 1 missing/);
});

test('skips a tracked file replaced by a FIFO without blocking', { skip: process.platform === 'win32' }, (t) => {
  const f = fixture(t);
  f.put('pipe.ts', 'original');
  f.track();
  rmSync(join(f.root, 'pipe.ts'));
  execFileSync('mkfifo', [join(f.root, 'pipe.ts')]);
  const result = f.stats();
  assert.equal(result.excluded.nonregular, 1);
  assert.equal(result.included.files, 0);
});

test('warns explicitly when tracked code cannot be read', { skip: process.platform === 'win32' || process.getuid?.() === 0 }, (t) => {
  const f = fixture(t);
  f.put('unreadable.ts', 'not readable');
  f.track();
  chmodSync(join(f.root, 'unreadable.ts'), 0);
  const result = f.stats();
  assert.equal(result.excluded.unreadableOrChanged, 1);
  assert.equal(result.included.files, 0);
  assert.equal(result.complete, false);
  assert.equal(result.warnings[0].code, 'unreadableOrChanged');
});

test('uses current working-tree content while reporting HEAD as context only', (t) => {
  const f = fixture(t);
  f.put('src/a.ts', 'initial\n');
  f.track();
  f.git('-c', 'user.name=Statistics fixture', '-c', 'user.email=stats@example.invalid', 'commit', '--quiet', '--no-verify', '-m', 'fixture');
  const head = f.git('rev-parse', 'HEAD').toString().trim();
  f.put('src/a.ts', 'changed\nsecond\n');
  const result = f.stats();
  assert.equal(result.git.head, head);
  assert.equal(result.git.dirtyState, 'not-inspected');
  assert.equal(result.code.totalLines, 2);
  assert.equal(result.included.bytes, 15);
  assert.match(f.run([]).stdout, /counts may differ from HEAD/);
});

test('supports an empty repository and explicit CLI errors without file contents', (t) => {
  const f = fixture(t);
  assert.equal(f.stats().included.files, 0);
  assert.equal(f.stats().complete, true);
  const human = f.run([]);
  assert.equal(human.status, 0);
  assert.match(human.stdout, /Project statistics/);
  assert.match(human.stdout, /not decommented LOC/);
  assert.match(human.stdout, /not test cases or coverage/);
  const help = f.run(['--help'], { env: { ...process.env, PATH: '' } });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage:/);
  const invalid = f.run(['--unknown']);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Unknown arguments/);
  const missingGit = f.run(['--json'], { env: { ...process.env, PATH: '' } });
  assert.equal(missingGit.status, 1);
  assert.equal(missingGit.stdout, '');
  assert.match(missingGit.stderr, /Git is required/);
  rmSync(join(f.root, '.git'), { recursive: true });
  const noRepo = f.run();
  assert.equal(noRepo.status, 1);
  assert.match(noRepo.stderr, /inside a readable Git checkout/);
});
