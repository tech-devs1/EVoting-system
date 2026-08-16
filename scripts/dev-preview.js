/**
 * HTU-Elect full-stack dev orchestrator.
 *
 * Starts both halves of the monorepo for development/preview:
 *   1. Express API backend  — pinned to port 5000 (the frontend's default
 *      `/api` proxy target in next.config.mjs).
 *   2. Next.js frontend     — binds to 0.0.0.0 on the PORT provided by the
 *      environment (Freebuff injects this for previews; locally Next.js
 *      defaults to 3000).
 *
 * Usage: node scripts/dev-preview.js
 */
const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const children = [];
let shuttingDown = false;

function spawnServer(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || rootDir,
    env: { ...process.env, ...(options.env || {}) },
    stdio: 'inherit',
  });
  children.push(child);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(
      `[dev-preview] ${name} exited (code=${code}, signal=${signal}) — stopping all servers`
    );
    shutdown(code === 0 ? 0 : 1);
  });

  child.on('error', (err) => {
    console.error(`[dev-preview] Failed to start ${name}:`, err.message);
    shutdown(1);
  });

  return child;
}

function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
  }
  // Give children a moment to shut down, then force-quit the orchestrator.
  setTimeout(() => process.exit(exitCode), 500).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('SIGHUP', () => shutdown(0));

// API backend — pinned to 5000 because the Next.js proxy defaults to localhost:5000
spawnServer('backend', 'node', ['backend/server.js'], { env: { PORT: '5000' } });

// Frontend — uses the `dev` script (next dev --webpack), which reads PORT from
// the environment and binds to 0.0.0.0 by default.
spawnServer('frontend', 'npm', ['run', 'dev', '--prefix', 'frontend']);
