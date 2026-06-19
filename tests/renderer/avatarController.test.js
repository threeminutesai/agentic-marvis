// tests/renderer/avatarController.test.js
const test = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

test('avatarController mounts the rings preset and toggles speaking state', () => {
  const dom = new JSDOM('<div id="mount"></div>');
  global.document = dom.window.document;

  const { createAvatarController } = require('../../src/renderer/avatar/avatarController');
  const mountEl = dom.window.document.getElementById('mount');

  const controller = createAvatarController({ mountEl, style: 'rings' });
  assert.ok(mountEl.querySelector('.ring-stage'), 'rings preset should render a .ring-stage element');

  controller.setState('speaking');
  assert.ok(mountEl.querySelector('.ring-stage').classList.contains('speaking'));

  controller.setState('idle');
  assert.ok(!mountEl.querySelector('.ring-stage').classList.contains('speaking'));

  controller.setState('listening');
  assert.ok(mountEl.querySelector('.ring-stage').classList.contains('listening'));

  controller.setState('idle');
  assert.ok(!mountEl.querySelector('.ring-stage').classList.contains('listening'));

  delete global.document;
});

test('avatarController mounts the brain preset', () => {
  const dom = new JSDOM('<div id="mount"></div>');
  global.document = dom.window.document;

  const { createAvatarController } = require('../../src/renderer/avatar/avatarController');
  const mountEl = dom.window.document.getElementById('mount');

  const controller = createAvatarController({ mountEl, style: 'brain' });
  assert.ok(mountEl.querySelector('.brain-core'), 'brain preset should render a .brain-core element');

  delete global.document;
});

test('avatarController toggles listening state on the brain preset', () => {
  const dom = new JSDOM('<div id="mount"></div>');
  global.document = dom.window.document;

  const { createAvatarController } = require('../../src/renderer/avatar/avatarController');
  const mountEl = dom.window.document.getElementById('mount');

  const controller = createAvatarController({ mountEl, style: 'brain' });
  controller.setState('listening');
  assert.ok(mountEl.querySelector('.brain-core').classList.contains('listening'));

  controller.setState('idle');
  assert.ok(!mountEl.querySelector('.brain-core').classList.contains('listening'));

  delete global.document;
});
