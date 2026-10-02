// Compile with the existing TypeScript dependency, without adding a runtime loader.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const output = mkdtempSync(join(tmpdir(), 'nba-provider-archive-'));
try {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', 'scripts/recovery/generate-archive.ts', '--outDir', output, '--module', 'commonjs', '--target', 'es2022', '--moduleResolution', 'node', '--esModuleInterop', '--skipLibCheck', '--strict'], { stdio: 'inherit' });
  execFileSync(process.execPath, [join(output, 'scripts/recovery/generate-archive.js')], { stdio: 'inherit' });
} catch { process.exitCode = 1; }
finally { rmSync(output, { recursive: true, force: true }); }
