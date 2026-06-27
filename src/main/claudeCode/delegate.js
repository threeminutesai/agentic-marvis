const { spawn } = require('node:child_process');

// README documents "up to 10 minutes" for CLI delegation - keep this in sync.
const TIMEOUT_MS = 10 * 60 * 1000;
const WARMUP_TIMEOUT_MS = 15 * 1000;
const MAX_BUFFER_LENGTH = 5 * 1024 * 1024;
const MAX_STDERR_LENGTH = 4000;

function isAuthFailureText(text) {
  return /\b401\b|authenticat/i.test(text);
}

// Claude Code CLI authenticates via its own logged-in session (subscription
// auth from `claude login`), not an API key passed by this app - when its
// own error text indicates an auth failure, name that explicitly instead of
// surfacing the CLI's generic "401" text with no indication of the cause.
function withAuthHint(text) {
  if (!isAuthFailureText(text)) return text;
  return `Your Claude Code CLI session appears to need re-authentication, sir - try running "claude login" in a terminal. ${text}`;
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

function delegateTask({ task, projectPath, spawnImpl = spawn, timeoutMs = TIMEOUT_MS, signal, onProgress }) {
  return new Promise((resolve) => {
    // No ANTHROPIC_API_KEY is injected here - Claude Code CLI uses its own
    // logged-in subscription session (`claude login`), not an app-managed key.
    // This runs fully headless (-p, stdin closed right after the task is
    // written) - there's no terminal for the user to approve an interactive
    // tool-permission prompt in, so it would just hang until the timeout.
    // Pre-approve only what report/code delegation actually needs (file
    // read/write and web research), not the broader --dangerously-skip-permissions.
    const proc = spawnImpl('claude', [
      '-p', '--output-format', 'stream-json', '--verbose',
      '--allowedTools', 'Write,Edit,Read,WebSearch,WebFetch',
    ], {
      cwd: projectPath,
      env: process.env,
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
      if (finalResult && finalResult.subtype === 'success' && isAuthFailureText(finalResult.result || '')) {
        // Claude Code's own session can report a "success" subtype while the
        // actual response content is itself an upstream auth failure (e.g. a
        // tool call inside the session hit a 401) - treat that as the error
        // it actually is rather than displaying it as a normal reply.
        settle({ status: 'error', summary: withAuthHint(finalResult.result) });
      } else if (finalResult && finalResult.subtype === 'success') {
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

function warmupClaudeCode({ projectPath, spawnImpl = spawn, timeoutMs = WARMUP_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const proc = spawnImpl('claude', ['--version'], {
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
      settle({ ok: false, summary: 'Claude Code warm-up timed out.' });
    }, timeoutMs);

    proc.on('error', () => {
      settle({ ok: false, summary: "I can't reach Claude Code, sir - is it installed and logged in?" });
    });

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      const summary = (stdout.trim() || stderr.trim() || 'Claude Code ready.').replace(/\s+/g, ' ');
      if (code === 0) {
        settle({ ok: true, summary });
        return;
      }
      settle({ ok: false, summary: withAuthHint(summary || `Claude Code warm-up failed (code ${code}).`) });
    });
  });
}

module.exports = { delegateTask, warmupClaudeCode };
