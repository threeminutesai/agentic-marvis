const { spawn } = require('node:child_process');

// README documents "up to 10 minutes" for CLI delegation - keep this in sync.
const TIMEOUT_MS = 10 * 60 * 1000;
const WARMUP_TIMEOUT_MS = 15 * 1000;
const MAX_BUFFER_LENGTH = 5 * 1024 * 1024;

function redactHtmlDiffs(text) {
  const redactor = createHtmlDiffRedactor();
  return [redactor.push(text), redactor.flush()].filter(Boolean).join('\n');
}

function createHtmlDiffRedactor() {
  const diffLineRe = /^(index [0-9a-f]+\.\.[0-9a-f]+|new file mode \d+|deleted file mode \d+|similarity index \d+%|rename from |rename to |--- |\+\+\+ |@@ |[+\- ])/;
  const htmlReadCommandRe = /\b(?:Get-Content|cat|type)\b[\s"]+(.+?\.html)\b/i;
  const controlLineRe = /^(exec|diff --git |".*?"\s+-Command |[A-Za-z]:\\|tokens used\b|done\.?$|applied\b|updated\b|created\b|deleted\b|error:|warning:)/i;
  let inHtmlDiff = false;
  let inHtmlRead = false;
  let suppressedCount = 0;
  let pendingLine = '';

  const flushSuppressed = (result) => {
    if (suppressedCount) {
      result.push(`  ... [${suppressedCount} lines omitted]`);
      suppressedCount = 0;
    }
  };

  const formatHtmlReadSummary = (line) => {
    const match = String(line || '').match(htmlReadCommandRe);
    const filePath = (match?.[1] || '.html')
      .replace(/^"+|"+$/g, '')
      .trim();
    return `HTML file content omitted: ${filePath}`;
  };

  const lineLooksLikeHtmlContent = (line) => {
    const trimmed = String(line || '').trim();
    if (!trimmed) return false;
    if (/^<!doctype\s+html>/i.test(trimmed)) return true;
    if (/^<\/?(html|head|body|main|header|section|article|style|title|meta|link|script)\b/i.test(trimmed)) return true;
    if (/^[:.#@a-zA-Z0-9_-]+\s*\{$/.test(trimmed)) return true;
    if (/^--[a-z-]+\s*:/.test(trimmed)) return true;
    if (/^[a-z-]+\s*:\s*[^:]+;?$/.test(trimmed)) return true;
    if (/^[{}]$/.test(trimmed)) return true;
    return false;
  };

  return {
    push(text) {
      const combined = pendingLine + String(text || '');
      const lines = combined.split(/\r?\n/);
      pendingLine = lines.pop() || '';
      const result = [];
      for (const line of lines) {
        const diffStart = /^diff --git a\/(\S+\.html) b\/(?:\S+\.html|dev\/null)$/.exec(line);
        if (diffStart) {
          flushSuppressed(result);
          inHtmlDiff = true;
          inHtmlRead = false;
          result.push(`diff --git a/${diffStart[1]} b/${diffStart[1]} [content omitted]`);
          continue;
        }
        if (inHtmlDiff) {
          if (diffLineRe.test(line)) {
            suppressedCount += 1;
            continue;
          }
          inHtmlDiff = false;
          flushSuppressed(result);
        }
        if (inHtmlRead) {
          if (controlLineRe.test(line) && !lineLooksLikeHtmlContent(line)) {
            inHtmlRead = false;
            flushSuppressed(result);
          } else {
            suppressedCount += 1;
            continue;
          }
        }
        if (htmlReadCommandRe.test(line)) {
          flushSuppressed(result);
          inHtmlRead = true;
          result.push(formatHtmlReadSummary(line));
          continue;
        }
        if (lineLooksLikeHtmlContent(line)) {
          flushSuppressed(result);
          inHtmlRead = true;
          result.push('HTML content omitted');
          suppressedCount += 1;
          continue;
        }
        result.push(line);
      }
      return result.join('\n');
    },
    flush() {
      const result = [];
      if (pendingLine) {
        const trailing = pendingLine;
        pendingLine = '';
        result.push(this.push(`${trailing}\n`));
      }
      if (inHtmlDiff) {
        inHtmlDiff = false;
        flushSuppressed(result);
      }
      if (inHtmlRead) {
        inHtmlRead = false;
        flushSuppressed(result);
      }
      return result.filter(Boolean).join('\n');
    },
  };
}

function lastMeaningfulLine(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : null;
}

function shouldHideCliRawLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return true;
  if (/^exec$/i.test(trimmed)) return true;
  if (/^resume$/i.test(trimmed)) return true;
  if (/^".*powershell\.exe"\s+-Command\s+/i.test(trimmed)) return true;
  if (/^".*cmd\.exe"\s+\/c\s+/i.test(trimmed)) return true;
  if (/^".*bash(?:\.exe)?"\s+-lc\s+/i.test(trimmed)) return true;
  if (/^".*?(?:powershell|cmd|bash|sh)(?:\.exe)?"\b.*\bsucceeded in \d+ms:?\s*$/i.test(trimmed)) return true;
  return false;
}

// Codex CLI prints its own auth-failure text to stdout/stderr like any other
// output, so the "any output = success" check below would otherwise treat a
// 401 as a normal completed response. Codex authenticates itself externally
// (e.g. `codex login`), not via a Marvis-managed API key, so this can't
// point at a specific Settings field - it just needs to be flagged as an
// error and named as Codex's own auth, rather than silently shown as a reply.
function isAuthFailureText(text) {
  return /\b401\b|authenticat/i.test(text);
}

function extractSessionId(text) {
  const match = String(text || '').match(/\bsession id:\s*([0-9a-f]{8}-[0-9a-f-]{27,})/i);
  return match?.[1] || null;
}

function buildCodexExecArgs({ resumeSessionId } = {}) {
  const commonArgs = ['--skip-git-repo-check', '-c', 'model_reasoning_effort=low'];
  if (resumeSessionId) {
    return ['exec', 'resume', ...commonArgs, resumeSessionId, '-'];
  }
  return ['exec', ...commonArgs, '-'];
}

function delegateCodexTask({ task, projectPath, resumeSessionId, spawnImpl = spawn, timeoutMs = TIMEOUT_MS, signal, onProgress, onRawOutput }) {
  return new Promise((resolve) => {
    const args = buildCodexExecArgs({ resumeSessionId });
    console.log(`[Codex] Spawning: codex ${args.slice(0, -1).join(' ')} (task piped via stdin)`);
    console.log(`[Codex] Working directory: ${projectPath}`);
    if (resumeSessionId) console.log(`[Codex] Resuming session: ${resumeSessionId}`);
    const proc = spawnImpl('codex', args, {
      cwd: projectPath,
      env: process.env,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    proc.stdin.write(task);
    proc.stdin.end();
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let stdoutLineBuffer = '';
    let stderrLineBuffer = '';
    const stdoutRedactor = createHtmlDiffRedactor();
    const stderrRedactor = createHtmlDiffRedactor();
    let settled = false;

    const emitRawLines = (streamName, chunkText, carryBuffer) => {
      if (!onRawOutput) return carryBuffer + chunkText;
      const combined = carryBuffer + chunkText;
      const lines = combined.split(/\r?\n/);
      const nextCarry = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trimEnd();
        if (!trimmed) continue;
        if (shouldHideCliRawLine(trimmed)) continue;
        onRawOutput(`[Codex ${streamName}] ${trimmed}`);
      }
      return nextCarry;
    };

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
      const sessionId = extractSessionId(`${stdoutBuffer}\n${stderrBuffer}`) || resumeSessionId || null;
      console.log('[Codex] Data complete with output (killed process)');
      settle({ status: 'success', summary: output, sessionId });
    };

    proc.stdout.on('data', (chunk) => {
      const data = chunk.toString();
      const redacted = stdoutRedactor.push(data);
      console.log(`[Codex stdout] ${redacted}`);
      stdoutBuffer += redacted;
      stdoutLineBuffer = emitRawLines('stdout', redacted, stdoutLineBuffer);
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
      const redacted = stderrRedactor.push(data);
      console.log(`[Codex stderr] ${redacted}`);
      stderrBuffer += redacted;
      stderrLineBuffer = emitRawLines('stderr', redacted, stderrLineBuffer);
      hasOutput = true;
      if (stderrBuffer.length > MAX_BUFFER_LENGTH) stderrBuffer = stderrBuffer.slice(-MAX_BUFFER_LENGTH);
      if (data.includes('tokens used')) {
        console.log('[Codex] Detected "tokens used" in stderr, waiting for output completion...');
        setTimeout(onDataComplete, 150);
      }
    });

    proc.on('close', (code) => {
      const trailingStdout = stdoutRedactor.flush();
      const trailingStderr = stderrRedactor.flush();
      if (trailingStdout) {
        stdoutBuffer += trailingStdout;
        stdoutLineBuffer = emitRawLines('stdout', trailingStdout, stdoutLineBuffer);
      }
      if (trailingStderr) {
        stderrBuffer += trailingStderr;
        stderrLineBuffer = emitRawLines('stderr', trailingStderr, stderrLineBuffer);
      }
      if (onRawOutput) {
        const pendingStdout = stdoutLineBuffer.trim();
        const pendingStderr = stderrLineBuffer.trim();
        if (pendingStdout && !shouldHideCliRawLine(pendingStdout)) onRawOutput(`[Codex stdout] ${pendingStdout}`);
        if (pendingStderr && !shouldHideCliRawLine(pendingStderr)) onRawOutput(`[Codex stderr] ${pendingStderr}`);
      }
      const output = stdoutBuffer.trim() || stderrBuffer.trim();
      console.log(`[Codex] Process exited with code ${code}`);
      console.log(`[Codex] Output: ${output.slice(0, 200)}...`);
      if (output && isAuthFailureText(output)) {
        settle({ status: 'error', summary: `Codex authentication failed, sir - try running "codex login" in a terminal. ${output}` });
      } else if (output) {
        settle({
          status: 'success',
          summary: output,
          sessionId: extractSessionId(`${stdoutBuffer}\n${stderrBuffer}`) || resumeSessionId || null,
        });
      } else if (code === 0) {
        settle({ status: 'success', summary: 'Codex finished, sir.', sessionId: resumeSessionId || null });
      } else {
        settle({ status: 'error', summary: `Codex exited with code ${code}.` });
      }
    });
  });
}

function warmupCodex({ projectPath, spawnImpl = spawn, timeoutMs = WARMUP_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const proc = spawnImpl('codex', ['--version'], {
      cwd: projectPath || process.cwd(),
      env: process.env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      proc.kill();
      settle({ ok: false, summary: 'Codex warm-up timed out.' });
    }, timeoutMs);

    proc.on('error', (err) => {
      settle({ ok: false, summary: `I can't reach Codex, sir - ${err.message}` });
    });

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      const summary = (stdout.trim() || stderr.trim() || 'Codex ready.').replace(/\s+/g, ' ');
      if (code === 0) {
        settle({ ok: true, summary });
        return;
      }
      if (summary && isAuthFailureText(summary)) {
        settle({ ok: false, summary: `Codex authentication failed, sir - try running "codex login" in a terminal. ${summary}` });
        return;
      }
      settle({ ok: false, summary: summary || `Codex warm-up failed (code ${code}).` });
    });
  });
}

module.exports = {
  delegateCodexTask,
  warmupCodex,
  buildCodexExecArgs,
  extractSessionId,
  redactHtmlDiffs,
  createHtmlDiffRedactor,
  shouldHideCliRawLine,
};
