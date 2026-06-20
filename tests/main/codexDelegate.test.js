// tests/main/codexDelegate.test.js
const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { delegateCodexTask } = require('../../src/main/codex/delegate');

function fakeStdin() {
  return { write: () => {}, end: () => {} };
}

function fakeChildProcess(stdoutChunks, exitCode = 0) {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = fakeStdin();
  setImmediate(() => {
    for (const chunk of stdoutChunks) proc.stdout.emit('data', Buffer.from(chunk));
    proc.emit('close', exitCode);
  });
  return proc;
}

test('delegateCodexTask spawns codex exec with the task piped via stdin and project cwd', async () => {
  let capturedCmd, capturedArgs, capturedOptions, capturedStdin;
  const fakeSpawn = (cmd, args, options) => {
    capturedCmd = cmd; capturedArgs = args; capturedOptions = options;
    const proc = fakeChildProcess(['Refactored auth.py successfully.\n']);
    capturedStdin = [];
    proc.stdin.write = (chunk) => capturedStdin.push(chunk);
    return proc;
  };

  const result = await delegateCodexTask({
    task: 'Refactor auth.py\n\nMulti-line task body.',
    projectPath: '/tmp/myproject',
    spawnImpl: fakeSpawn,
  });

  assert.strictEqual(capturedCmd, 'codex');
  assert.deepStrictEqual(capturedArgs, ['exec', '--skip-git-repo-check', '-c', 'model_reasoning_effort=low', '-']);
  assert.strictEqual(capturedOptions.cwd, '/tmp/myproject');
  assert.strictEqual(capturedStdin.join(''), 'Refactor auth.py\n\nMulti-line task body.');
  assert.strictEqual(result.status, 'success');
  assert.strictEqual(result.summary, 'Refactored auth.py successfully.');
});

test('delegateCodexTask reports a clear error when codex CLI is missing', async () => {
  const fakeSpawn = () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin = fakeStdin();
    setImmediate(() => proc.emit('error', new Error('spawn codex ENOENT')));
    return proc;
  };

  const result = await delegateCodexTask({ task: 'Anything', projectPath: '/tmp/x', spawnImpl: fakeSpawn });

  assert.strictEqual(result.status, 'error');
  assert.match(result.summary, /can't reach Codex/i);
});

test('delegateCodexTask reports success even with stderr if output exists', async () => {
  const fakeSpawn = () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin = fakeStdin();
    setImmediate(() => {
      proc.stderr.emit('data', Buffer.from('some output detail'));
      proc.emit('close', 1);
    });
    return proc;
  };

  const result = await delegateCodexTask({ task: 'Anything', projectPath: '/tmp/x', spawnImpl: fakeSpawn });

  assert.strictEqual(result.status, 'success');
  assert.match(result.summary, /some output detail/);
});

test('delegateCodexTask reports error with code when no output and non-zero exit', async () => {
  const fakeSpawn = () => fakeChildProcess([], 1);

  const result = await delegateCodexTask({ task: 'Anything', projectPath: '/tmp/x', spawnImpl: fakeSpawn });

  assert.strictEqual(result.status, 'error');
  assert.match(result.summary, /code 1/);
});

test('delegateCodexTask times out and kills the process when it hangs', async () => {
  let killCalled = false;
  const fakeSpawn = () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin = fakeStdin();
    proc.kill = () => { killCalled = true; };
    return proc;
  };

  const result = await delegateCodexTask({
    task: 'Anything',
    projectPath: '/tmp/x',
    spawnImpl: fakeSpawn,
    timeoutMs: 10,
  });

  assert.strictEqual(result.status, 'error');
  assert.match(result.summary, /timed out/i);
  assert.strictEqual(killCalled, true);
});

test('delegateCodexTask kills the process when aborted', async () => {
  let killCalled = false;
  const controller = new AbortController();
  const fakeSpawn = () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin = fakeStdin();
    proc.kill = () => { killCalled = true; };
    setImmediate(() => controller.abort());
    return proc;
  };

  const result = await delegateCodexTask({
    task: 'Anything',
    projectPath: '/tmp/x',
    spawnImpl: fakeSpawn,
    signal: controller.signal,
  });

  assert.deepStrictEqual(result, { status: 'cancelled', summary: 'Operation paused, sir.' });
  assert.strictEqual(killCalled, true);
});
