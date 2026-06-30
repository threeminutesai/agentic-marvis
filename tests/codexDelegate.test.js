const test = require('node:test');
const assert = require('node:assert/strict');

const {
  redactHtmlDiffs,
  createHtmlDiffRedactor,
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
