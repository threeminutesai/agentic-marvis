// tests/main/delegate.test.js
const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { delegateTask } = require('../../src/main/claudeCode/delegate');

function fakeStdin() {
  return { write: () => {}, end: () => {} };
}

function fakeChildProcess(stdoutLines, exitCode = 0) {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = fakeStdin();
  setImmediate(() => {
    for (const line of stdoutLines) proc.stdout.emit('data', Buffer.from(line + '\n'));
    proc.emit('close', exitCode);
  });
  return proc;
}

test('delegateTask spawns claude -p with the task piped via stdin and project cwd', async () => {
  let capturedCmd, capturedArgs, capturedOptions, capturedStdin;
  const fakeSpawn = (cmd, args, options) => {
    capturedCmd = cmd; capturedArgs = args; capturedOptions = options;
    const proc = fakeChildProcess([
      JSON.stringify({ type: 'result', subtype: 'success', result: 'Refactored auth.py successfully.' }),
    ]);
    capturedStdin = [];
    proc.stdin.write = (chunk) => capturedStdin.push(chunk);
    return proc;
  };

  const result = await delegateTask({
    task: 'Refactor auth.py\n\nMulti-line task body.',
    projectPath: '/tmp/myproject',
    spawnImpl: fakeSpawn,
  });

  assert.strictEqual(capturedCmd, 'claude');
  assert.deepStrictEqual(capturedArgs, ['-p', '--output-format', 'stream-json', '--verbose']);
  assert.strictEqual(capturedOptions.cwd, '/tmp/myproject');
  assert.strictEqual(capturedStdin.join(''), 'Refactor auth.py\n\nMulti-line task body.');
  assert.strictEqual(result.status, 'success');
  assert.strictEqual(result.summary, 'Refactored auth.py successfully.');
});

test('delegateTask treats a "success" subtype as an error when its content is itself an auth failure', async () => {
  const fakeSpawn = () => fakeChildProcess([
    JSON.stringify({ type: 'result', subtype: 'success', result: 'Failed to authenticate. API Error: 401 Invalid authentication credentials' }),
  ]);

  const result = await delegateTask({ task: 'Anything', projectPath: '/tmp/x', spawnImpl: fakeSpawn });

  assert.strictEqual(result.status, 'error');
  assert.match(result.summary, /claude code cli session/i);
  assert.match(result.summary, /401 Invalid authentication credentials/);
});

test('delegateTask reports a clear error when claude CLI is missing', async () => {
  const fakeSpawn = () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin = fakeStdin();
    setImmediate(() => proc.emit('error', new Error('spawn claude ENOENT')));
    return proc;
  };

  const result = await delegateTask({ task: 'Anything', projectPath: '/tmp/x', spawnImpl: fakeSpawn });

  assert.strictEqual(result.status, 'error');
  assert.match(result.summary, /can't reach Claude Code/i);
});

test('delegateTask reports error status from a result event with subtype error', async () => {
  const fakeSpawn = () => fakeChildProcess([
    JSON.stringify({ type: 'result', subtype: 'error', result: 'Something went wrong during the task.' }),
  ]);

  const result = await delegateTask({ task: 'Anything', projectPath: '/tmp/x', spawnImpl: fakeSpawn });

  assert.deepStrictEqual(result, { status: 'error', summary: 'Something went wrong during the task.' });
});

test('delegateTask names the Claude Code CLI session when the result event indicates an auth failure', async () => {
  const fakeSpawn = () => fakeChildProcess([
    JSON.stringify({ type: 'result', subtype: 'error', result: 'Failed to authenticate. API Error: 401 Invalid authentication credentials' }),
  ]);

  const result = await delegateTask({ task: 'Anything', projectPath: '/tmp/x', spawnImpl: fakeSpawn });

  assert.strictEqual(result.status, 'error');
  assert.match(result.summary, /claude code cli session/i);
  assert.match(result.summary, /401 Invalid authentication credentials/);
});

test('delegateTask names the Claude Code CLI session when stderr indicates an auth failure with no result event', async () => {
  const fakeSpawn = () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin = fakeStdin();
    setImmediate(() => {
      proc.stderr.emit('data', Buffer.from('Error: 401 authentication failed'));
      proc.emit('close', 1);
    });
    return proc;
  };

  const result = await delegateTask({ task: 'Anything', projectPath: '/tmp/x', spawnImpl: fakeSpawn });

  assert.strictEqual(result.status, 'error');
  assert.match(result.summary, /claude code cli session/i);
});

test('delegateTask reports unexpected exit when no result event is emitted', async () => {
  const fakeSpawn = () => fakeChildProcess([], 0);

  const result = await delegateTask({ task: 'Anything', projectPath: '/tmp/x', spawnImpl: fakeSpawn });

  assert.strictEqual(result.status, 'error');
  assert.match(result.summary, /unexpectedly/i);
});

test('delegateTask surfaces stderr output when no result event is emitted', async () => {
  const fakeSpawn = () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin = fakeStdin();
    setImmediate(() => {
      proc.stderr.emit('data', Buffer.from('some error detail'));
      proc.emit('close', 1);
    });
    return proc;
  };

  const result = await delegateTask({ task: 'Anything', projectPath: '/tmp/x', spawnImpl: fakeSpawn });

  assert.strictEqual(result.status, 'error');
  assert.match(result.summary, /some error detail/);
});

test('delegateTask times out and kills the process when it hangs', async () => {
  let killCalled = false;
  const fakeSpawn = () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin = fakeStdin();
    proc.kill = () => { killCalled = true; };
    return proc;
  };

  const result = await delegateTask({
    task: 'Anything',
    projectPath: '/tmp/x',
    spawnImpl: fakeSpawn,
    timeoutMs: 10,
  });

  assert.deepStrictEqual(result.status, 'error');
  assert.match(result.summary, /timed out/i);
  assert.strictEqual(killCalled, true);
});

test('delegateTask kills the process when aborted', async () => {
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

  const result = await delegateTask({
    task: 'Anything',
    projectPath: '/tmp/x',
    spawnImpl: fakeSpawn,
    signal: controller.signal,
  });

  assert.deepStrictEqual(result, { status: 'cancelled', summary: 'Operation paused, sir.' });
  assert.strictEqual(killCalled, true);
});
