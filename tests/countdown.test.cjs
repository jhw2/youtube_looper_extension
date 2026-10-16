const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));

function setup() {
  const timers = [];
  const context = vm.createContext({
    countdownMode: '1', countdownRunId: 0, isCountdownActive: false,
    countdownOverlayMessage: '', isLoopRestartPending: false,
    normalizeCountdownMode: (value) => value,
    getVideo: () => ({ pause() {} }), getVideoId: () => 'video-a',
    getCountdownOptionLabel: (value) => value,
    t: (key) => key === 'countdownStartingIn' ? (value) => value : 'Start',
    updateUI() {}, stopWatcher() {}, clearFullscreenPeekTimer() {}, clearVideoZoomStyles() {},
    window: { setTimeout: (callback) => timers.push(callback) },
  });
  for (const key of ['nativeRangeEl', 'nativeMarkerAEl', 'nativeMarkerBEl', 'rootEl',
    'toastEl', 'countdownOverlayEl', 'inlineLauncherEl', 'zoomLauncherEl', 'zoomPopupEl']) {
    context[key] = null;
  }
  vm.runInContext(between('  function showCountdownOverlay(', '  async function restartLoopWithCountdown('), context);
  vm.runInContext(between('  function teardownRoot()', '  // ── Init ──'), context);
  const tick = async () => {
    assert.ok(timers.length, 'a countdown timer should be pending');
    timers.shift()();
    await Promise.resolve();
  };
  return { context, tick };
}

for (const duringStartMessage of [false, true]) {
  test(`navigation cancels countdown ${duringStartMessage ? 'during Start message' : 'during countdown'}`, async () => {
    const { context, tick } = setup();
    const pending = context.runLoopCountdownIfNeeded();
    if (duringStartMessage) await tick();
    context.isLoopRestartPending = true;
    context.teardownRoot();
    await tick();
    assert.equal(await pending, false);
    assert.equal(context.isCountdownActive, false);
    assert.equal(context.countdownOverlayMessage, '');
    assert.equal(context.isLoopRestartPending, false);
  });
}

test('cancelled countdown does not clear a newer countdown', async () => {
  const { context, tick } = setup();
  const old = context.runLoopCountdownIfNeeded();
  context.teardownRoot();
  const current = context.runLoopCountdownIfNeeded();
  await tick();
  assert.equal(await old, false);
  assert.equal(context.isCountdownActive, true);
  assert.equal(context.countdownOverlayMessage, '1');
  await tick();
  await tick();
  assert.equal(await current, true);
  assert.equal(context.isCountdownActive, false);
});

test('URL change cancels playback before delayed page teardown', async () => {
  const { context, tick } = setup();
  const pending = context.runLoopCountdownIfNeeded();
  context.getVideoId = () => 'video-b';
  await tick();
  assert.equal(await pending, false);
});
