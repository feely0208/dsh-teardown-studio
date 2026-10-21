/**
 * @deepwhale-cn/dsh-teardown-studio — host half
 * Starts the local Studio server (fixed port 17899). No Chromium/ffmpeg bundled;
 * renderer uses the host's Chrome/Edge + ffmpeg, detected at runtime.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'teardown-studio';
export const inject = ['profileContext'];

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const PORT = 17899;

export function apply(ctx) {
  const base = ctx?.profileContext?.dir || path.join(os.homedir(), '.dsh-teardown-studio');
  const DATA = path.join(base, 'teardown-studio-data');
  fs.mkdirSync(DATA, { recursive: true });
  let child = null;
  try {
    child = spawn(process.execPath, [path.join(HERE, 'server.mjs')], {
      cwd: ROOT,
      env: { ...process.env, DWH_ROOT: ROOT, DWH_DATA: DATA, PORT: String(PORT) },
      stdio: 'ignore',
      detached: false,
    });
  } catch {
    child = null;
  }
  ctx.effect(() => () => {
    if (child && !child.killed) {
      try { child.kill('SIGTERM'); } catch { /* ignore */ }
    }
  });
}
