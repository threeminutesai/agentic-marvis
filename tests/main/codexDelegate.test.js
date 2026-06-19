// tests/main/codexDelegate.test.js
const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { delegateCodexTask } = require('../../src/main/codex/delegate');

function fakeChildProcess(stdoutChunks, exitCode = 0) {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  setImmediate(() => {
    for (const chunk of stdoutChunks) proc.stdout.emit('data', Buffer.from(chunk));
    proc.emit('close', exitCode);
  });
  return proc;
}

test('delegateCodexTask spawns codex exec with the task and project cwd', async () => {
  let capturedCmd, capturedArgs, capturedOptions;
  const fakeSpawn = (cmd, args, options) => {
    capturedCmd = cmd; capturedArgs = args; capturedOptions = options;
    return fakeChildProcess(['Refactored auth.py successfully.\n']);
  };

  const result = await delegateCodexTask({
    task: 'Refactor auth.py',
    projectPath: '/tmp/myproject',
    spawnImpl: fakeSpawn,
  });

  assert.strictEqual(capturedCmd, 'codex');
  assert.deepStrictEqual(capturedArgs, ['exec', '--skip-git-repo-check', '"Refactor auth.py"']);
  assert.strictEqual(capturedOptions.cwd, '/tmp/myproject');
  assert.strictEqual(result.status, 'success');
  assert.strictEqual(result.summary, 'Refactored auth.py successfully.');
});

test('delegateCodexTask reports a clear error when codex CLI is missing', async () => {
  const fakeSpawn = () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
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
