const { spawn } = require('node:child_process');

const TIMEOUT_MS = 120 * 1000;
const MAX_BUFFER_LENGTH = 5 * 1024 * 1024;

function redactHtmlDiffs(text) {
  const lines = text.split(/\r?\n/);
  const result = [];
  const diffLineRe = /^(index [0-9a-f]+\.\.[0-9a-f]+|--- |\+\+\+ |@@ |[+\- ])/;
  let inHtmlDiff = false;
  let suppressedCount = 0;
  for (const line of lines) {
    const diffStart = /^diff --git a\/(\S+\.html) b\/\1/.exec(line);
    if (diffStart) {
      if (inHtmlDiff) result.push(`  ... [${suppressedCount} lines omitted]`);
      inHtmlDiff = true;
      suppressedCount = 0;
      result.push(`diff --git a/${diffStart[1]} b/${diffStart[1]} [content omitted]`);
      continue;
    }
    if (inHtmlDiff) {
      if (diffLineRe.test(line)) {
        suppressedCount++;
        continue;
      }
      inHtmlDiff = false;
      if (suppressedCount) result.push(`  ... [${suppressedCount} lines omitted]`);
    }
    result.push(line);
  }
  if (inHtmlDiff && suppressedCount) result.push(`  ... [${suppressedCount} lines omitted]`);
  return result.join('\n');
}

function lastMeaningfulLine(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : null;
}

function delegateCodexTask({ task, projectPath, spawnImpl = spawn, timeoutMs = TIMEOUT_MS, signal, onProgress }) {
  return new Promise((resolve) => {
    console.log(`[Codex] Spawning: codex exec --skip-git-repo-check (task piped via stdin)`);
    console.log(`[Codex] Working directory: ${projectPath}`);
    const proc = spawnImpl('codex', ['exec', '--skip-git-repo-check', '-c', 'model_reasoning_effort=low', '-'], {
      cwd: projectPath,
      env: process.env,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    proc.stdin.write(task);
    proc.stdin.end();
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
      console.log(`[Codex stdout] ${redactHtmlDiffs(data)}`);
      stdoutBuffer += data;
      hasOutput = true;
      if (stdoutBuffer.length > MAX_BUFFER_LENGTH) stdoutBuffer = stdoutBuffer.slice(-MAX_BUFFER_LENGTH);
      if (onProgress) {
        const line = lastMeaningfulLine(data);
        if (line) onProgress(line);
      }
      if (data.includes('tokens used')) {
        console.log('[Codex] Detected "tokens used" in stdout, waiting for output completion...');
        setTimeout(onDataComplete, 150);
      }
    });

    proc.stderr.on('data', (chunk) => {
      const data = chunk.toString();
      console.log(`[Codex stderr] ${redactHtmlDiffs(data)}`);
      stderrBuffer += data;
      hasOutput = true;
      if (stderrBuffer.length > MAX_BUFFER_LENGTH) stderrBuffer = stderrBuffer.slice(-MAX_BUFFER_LENGTH);
      if (data.includes('tokens used')) {
        console.log('[Codex] Detected "tokens used" in stderr, waiting for output completion...');
        setTimeout(onDataComplete, 150);
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
