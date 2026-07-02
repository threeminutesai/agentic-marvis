const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const {
  delegateCodexTask,
  redactHtmlDiffs,
  createHtmlDiffRedactor,
  shouldHideCliRawLine,
} = require('../src/main/codex/delegate');

test('redactHtmlDiffs collapses full html diffs in one block', () => {
  const output = redactHtmlDiffs([
    'diff --git a/data/html-panels/_template.html b/data/html-panels/_template.html',
    'deleted file mode 100644',
    'index abcdef1..0000000',
    '--- a/data/html-panels/_template.html',
    '+++ /dev/null',
    '@@ -1,3 +0,0 @@',
    '-<!doctype html>',
    '-<html>',
    '-</html>',
    'Done.',
  ].join('\n'));

  assert.match(output, /\[content omitted\]/);
  assert.match(output, /\[\d+ lines omitted\]/);
  assert.ok(!output.includes('<!doctype html>'));
  assert.ok(output.includes('Done.'));
});

test('createHtmlDiffRedactor keeps html diff content hidden across chunk boundaries', () => {
  const redactor = createHtmlDiffRedactor();
  const first = redactor.push('diff --git a/data/html-panels/_template.html b/data/html-panels/_template.html\ndeleted file mode 100644\n');
  const second = redactor.push('index abcdef1..0000000\n--- a/data/html-panels/_template.html\n+++ /dev/null\n@@ -1,2 +0,0 @@\n-<!doctype html>\n-<html>\n');
  const third = redactor.push('-</html>\nnext visible line\n');
  const flushed = redactor.flush();
  const combined = [first, second, third, flushed].filter(Boolean).join('\n');

  assert.match(combined, /\[content omitted\]/);
  assert.match(combined, /\[\d+ lines omitted\]/);
  assert.ok(!combined.includes('<!doctype html>'));
  assert.ok(combined.includes('next visible line'));
});

test('createHtmlDiffRedactor collapses html file reads and their body output', () => {
  const redactor = createHtmlDiffRedactor();
  const first = redactor.push('exec\n');
  const second = redactor.push('"C:\\\\Windows\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe" -Command "Get-Content data\\\\html-panels\\\\20260630-report-5.html -TotalCount 260" in C:\\\\L_Center\\\\AI_devp\\\\jarvis succeeded in 560ms:\n');
  const third = redactor.push('<!doctype html>\n<html lang="zh-CN">\n<head>\n  <meta charset="utf-8">\n  <style>\n');
  const fourth = redactor.push('    :root {\n      --paper: #f4efe7;\n    }\nDone.\n');
  const combined = [first, second, third, fourth, redactor.flush()].filter(Boolean).join('\n');

  assert.ok(combined.includes('exec'));
  assert.match(combined, /HTML file content omitted: .*20260630-report-5\.html/);
  assert.match(combined, /\[\d+ lines omitted\]/);
  assert.ok(!combined.includes('<!doctype html>'));
  assert.ok(!combined.includes('--paper: #f4efe7;'));
  assert.ok(combined.includes('Done.'));
});

test('shouldHideCliRawLine filters helper chatter but keeps meaningful summaries', () => {
  assert.equal(shouldHideCliRawLine('exec'), true);
  assert.equal(shouldHideCliRawLine('OpenAI Codex v0.141.0'), true);
  assert.equal(shouldHideCliRawLine('--------'), true);
  assert.equal(shouldHideCliRawLine('workdir: C:\\L_Center\\AI_devp\\jarvis'), true);
  assert.equal(shouldHideCliRawLine('tokens used'), true);
  assert.equal(shouldHideCliRawLine('[voice]'), true);
  assert.equal(shouldHideCliRawLine('"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content data\\html-panels\\_template.html -TotalCount 260"'), true);
  assert.equal(shouldHideCliRawLine('"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content data\\html-panels\\20260630-report-5.html -TotalCount 260" in C:\\L_Center\\AI_devp\\jarvis succeeded in 560ms:'), true);
  assert.equal(shouldHideCliRawLine('HTML file content omitted: data\\html-panels\\20260630-report-5.html'), false);
  assert.equal(shouldHideCliRawLine('  ... [8 lines omitted]'), false);
  assert.equal(shouldHideCliRawLine('Done.'), false);
});

test('delegateCodexTask waits for late stdout after a tokens-used hint before settling', async () => {
  function spawnImpl() {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin = {
      write() {},
      end() {},
    };
    proc.kill = () => {
      setTimeout(() => proc.emit('close', 0), 0);
    };

    setTimeout(() => proc.stderr.emit('data', Buffer.from('tokens used\n')), 10);
    setTimeout(() => proc.stdout.emit('data', Buffer.from('[voice]\nThe report is ready, sir.\n')), 250);
    setTimeout(() => proc.stdout.emit('data', Buffer.from('[html]\nC:\\reports\\malaysia-election-report.html\n')), 500);
    setTimeout(() => proc.emit('close', 0), 520);
    return proc;
  }

  const result = await delegateCodexTask({
    task: 'Generate a report.',
    projectPath: 'C:\\L_Center\\AI_devp\\jarvis',
    spawnImpl,
    timeoutMs: 5000,
  });

  assert.equal(result.status, 'success');
  assert.match(result.summary, /\[voice\]/);
  assert.match(result.summary, /The report is ready, sir\./);
  assert.match(result.summary, /\[html\]/);
  assert.match(result.summary, /malaysia-election-report\.html/);
});
