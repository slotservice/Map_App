#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

if (platform() === 'win32') {
  const script = join(repoRoot, '.local-stack', 'stop-stack.ps1');
  const r = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
    { stdio: 'inherit', cwd: repoRoot },
  );
  process.exit(r.status ?? 1);
} else {
  const r = spawnSync(
    'docker',
    ['compose', '-f', join(repoRoot, 'infra', 'docker-compose.yml'), 'down'],
    { stdio: 'inherit', cwd: repoRoot },
  );
  process.exit(r.status ?? 1);
}
