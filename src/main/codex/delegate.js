const { spawn } = require('node:child_process');

const TIMEOUT_MS = 120 * 1000;
const MAX_BUFFER_LENGTH = 5 * 1024 * 1024;

function delegateCodexTask({ task, projectPath, spawnImpl = spawn, timeoutMs = TIMEOUT_MS, signal }) {
  return new Promise((resolve) => {
    console.log(`[Codex] Spawning: codex exec --skip-git-repo-check "${task}"`);
    console.log(`[Codex] Working directory: ${projectPath}`);
    const escapedTask = task.replace(/"/g, '\\"');
    const proc = spawnImpl('codex', ['exec', '--skip-git-repo-check', `"${escapedTask}"`], {
      cwd: projectPath,
      env: process.env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let settled = false;

    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      resolve(result);
    };

    const cancel = () => {
      if (settled) return;
      proc.kill();
      settle({ status: 'cancelled', summary: 'Operation paused, sir.' });
    };

    const timer = setTimeout(() => {
      if (settled) return;
      proc.kill();
      const timeoutSeconds = Math.round(timeoutMs / 1000);
      settle({ status: 'error', summary: `Codex timed out after ${timeoutSeconds} seconds, sir.` });
    }, timeoutMs);

    if (signal?.aborted) {
      cancel();
      return;
    }
    signal?.addEventListener('abort', cancel, { once: true });

    proc.on('error', (err) => {
      console.log(`[Codex] Spawn error: ${err.message}`);
      settle({ status: 'error', summary: `I can't reach Codex, sir - ${err.message}` });
    });

    let hasOutput = false;
    const onDataComplete = () => {
      if (settled || !hasOutput) return;
      proc.kill();
      const output = stdoutBuffer.trim() || stderrBuffer.trim();
      console.log('[Codex] Data complete with output (killed process)');
      settle({ status: 'success', summary: output });
    };

    proc.stdout.on('data', (chunk) => {
      const data = chunk.toString();
      console.log(`[Codex stdout] ${data}`);
      stdoutBuffer += data;
      hasOutput = true;
      if (stdoutBuffer.length > MAX_BUFFER_LENGTH) stdoutBuffer = stdoutBuffer.slice(-MAX_BUFFER_LENGTH);
      if (data.includes('tokens used')) {
        console.log('[Codex] Detected "tokens used" in stdout, waiting for output completion...');
        setTimeout(onDataComplete, 500);
      }
    });

    proc.stderr.on('data', (chunk) => {
      const data = chunk.toString();
      console.log(`[Codex stderr] ${data}`);
      stderrBuffer += data;
      hasOutput = true;
      if (stderrBuffer.length > MAX_BUFFER_LENGTH) stderrBuffer = stderrBuffer.slice(-MAX_BUFFER_LENGTH);
      if (data.includes('tokens used')) {
        console.log('[Codex] Detected "tokens used" in stderr, waiting for output completion...');
        setTimeout(onDataComplete, 500);
      }
    });

    proc.on('close', (code) => {
      const output = stdoutBuffer.trim() || stderrBuffer.trim();
      console.log(`[Codex] Process exited with code ${code}`);
      console.log(`[Codex] Output: ${output.slice(0, 200)}...`);
      if (output) {
        settle({ status: 'success', summary: output });
      } else if (code === 0) {
        settle({ status: 'success', summary: 'Codex finished, sir.' });
      } else {
        settle({ status: 'error', summary: `Codex exited with code ${code}.` });
      }
    });
  });
}

module.exports = { delegateCodexTask };
