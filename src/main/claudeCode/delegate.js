const { spawn } = require('node:child_process');

const TIMEOUT_MS = 120 * 1000;
const MAX_BUFFER_LENGTH = 5 * 1024 * 1024;
const MAX_STDERR_LENGTH = 4000;

// Claude Code CLI only ever authenticates with one credential (the Anthropic
// API key, passed via ANTHROPIC_API_KEY below) - when its own error text
// indicates an auth failure, name that credential explicitly instead of
// surfacing the CLI's generic "401" text with no indication of which key
// is the problem.
function withAuthHint(text) {
  if (!/\b401\b|authenticat/i.test(text)) return text;
  return `Your Anthropic API key appears invalid or missing, sir (used for Claude Code CLI) - ${text}`;
}

// Maps a stream-json event from `claude -p --output-format stream-json` to a short
// human-readable status line for the "thinking" chat bubble. Returns null for events
// that don't have a sensible progress description (e.g. partial text deltas).
function describeProgressEvent(event) {
  if (event.type === 'system' && event.subtype === 'init') return 'Starting Claude Code...';
  if (event.type === 'assistant') {
    const blocks = event.message?.content || [];
    const toolUse = blocks.find((block) => block.type === 'tool_use');
    if (toolUse) return `Running ${toolUse.name}...`;
    if (blocks.some((block) => block.type === 'text')) return 'Thinking...';
  }
  if (event.type === 'user') {
    const blocks = event.message?.content || [];
    if (blocks.some((block) => block.type === 'tool_result')) return 'Reading tool results...';
  }
  return null;
}

function delegateTask({ task, projectPath, spawnImpl = spawn, timeoutMs = TIMEOUT_MS, signal, apiKey, onProgress }) {
  return new Promise((resolve) => {
    const env = apiKey ? { ...process.env, ANTHROPIC_API_KEY: apiKey } : process.env;
    const proc = spawnImpl('claude', ['-p', '--output-format', 'stream-json', '--verbose'], {
      cwd: projectPath,
      env,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    proc.stdin.write(task);
    proc.stdin.end();
    let buffer = '';
    let finalResult = null;
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
      settle({ status: 'error', summary: `Claude Code timed out after ${timeoutSeconds} seconds, sir.` });
    }, timeoutMs);

    if (signal?.aborted) {
      cancel();
      return;
    }
    signal?.addEventListener('abort', cancel, { once: true });

    proc.on('error', () => {
      settle({ status: 'error', summary: "I can't reach Claude Code, sir - is it installed and logged in?" });
    });

    proc.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      if (buffer.length > MAX_BUFFER_LENGTH) {
        buffer = '';
      }
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'result') {
            finalResult = event;
          } else if (onProgress) {
            const description = describeProgressEvent(event);
            if (description) onProgress(description);
          }
        } catch {
          // ignore non-JSON lines
        }
      }
    });

    proc.stderr.on('data', (chunk) => {
      if (stderrBuffer.length >= MAX_STDERR_LENGTH) return;
      stderrBuffer += chunk.toString();
    });

    // `code` is informational only; the `result` event's `subtype` is the
    // authoritative success/failure signal.
    proc.on('close', (code) => {
      if (finalResult && finalResult.subtype === 'success') {
        settle({ status: 'success', summary: finalResult.result });
      } else if (finalResult) {
        const summary = finalResult.result
          ? withAuthHint(finalResult.result)
          : `Claude Code exited with an error (code ${code}).`;
        settle({ status: 'error', summary });
      } else {
        const base = `Claude Code exited unexpectedly (code ${code}).`;
        const summary = withAuthHint(stderrBuffer ? `${base} ${stderrBuffer.trim()}` : base);
        settle({ status: 'error', summary });
      }
    });
  });
}

module.exports = { delegateTask };
