const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const UI_KEY = 'yt-ab-looper-ui';
const SEGMENTS_KEY = 'yt-ab-looper-segments';
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const between = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end));

function harness({ localUi, syncUi, failRead = false, failWrite = false } = {}) {
  const local = localUi ? { [UI_KEY]: structuredClone(localUi) } : {};
  const sync = syncUi ? { [UI_KEY]: structuredClone(syncUi) } : {};
  const runtime = {};
  let writes = 0;
  const complete = (callback, value, fails) => {
    runtime.lastError = fails ? { message: 'Storage unavailable' } : undefined;
    callback(value);
    runtime.lastError = undefined;
  };
  const area = (data, isSync) => ({
    get(keys, callback) {
      const fails = isSync && failRead;
      complete(callback, fails ? undefined : structuredClone(data), fails);
    },
    set(values, callback) {
      const fails = isSync && failWrite;
      if (isSync) writes++;
      if (!fails) Object.assign(data, structuredClone(values));
      complete(callback, undefined, fails);
    },
    remove(keys, callback) {
      for (const key of [].concat(keys)) delete data[key];
      complete(callback);
    },
  });
  const context = vm.createContext({
    chrome: { runtime, storage: { local: area(local, false), sync: area(sync, true) } },
    STORAGE_UI_KEY: UI_KEY,
    STORAGE_SEGMENTS_KEY: SEGMENTS_KEY,
    STORAGE_SEG_PREFIX: 'yt-ab-seg-',
  });
  return { context, local, sync, writes: () => writes };
}

function loadMigration(context) {
  vm.runInContext(between(read('content.js'), '  function getUiStore()', '  async function saveUiState()'), context);
}

for (const failure of ['failRead', 'failWrite']) {
  test(`migration retains original settings after ${failure}`, async () => {
    const h = harness({ localUi: { lang: 'ko' }, [failure]: true });
    loadMigration(h.context);
    await h.context.migrateFromLocalStorage();
    assert.deepEqual(h.local[UI_KEY], { lang: 'ko' });
    assert.equal(h.sync[UI_KEY], undefined);
  });
}

test('migration removes original only after successful transfer', async () => {
  const h = harness({ localUi: { lang: 'ko' } });
  loadMigration(h.context);
  await h.context.migrateFromLocalStorage();
  assert.deepEqual(h.sync[UI_KEY], { lang: 'ko' });
  assert.equal(h.local[UI_KEY], undefined);
});

test('migration keeps synced values and fills missing local settings', async () => {
  const h = harness({ localUi: { lang: 'ko', countdownMode: '3' }, syncUi: { lang: 'en' } });
  loadMigration(h.context);
  await h.context.migrateFromLocalStorage();
  assert.deepEqual(h.sync[UI_KEY], { lang: 'en', countdownMode: '3' });
  assert.equal(h.local[UI_KEY], undefined);
});

test('migration does not rewrite settings already present in sync', async () => {
  const h = harness({ localUi: { lang: 'ko' }, syncUi: { lang: 'en' }, failWrite: true });
  loadMigration(h.context);
  await h.context.migrateFromLocalStorage();
  assert.equal(h.writes(), 0);
  assert.equal(h.sync[UI_KEY].lang, 'en');
  assert.equal(h.local[UI_KEY], undefined);
});

for (const failure of ['failRead', 'failWrite', null]) {
  test(`popup shortcut save handles ${failure || 'success'}`, async () => {
    const h = harness({ syncUi: { lang: 'ko' }, ...(failure ? { [failure]: true } : {}) });
    const statuses = [];
    Object.assign(h.context, {
      shortcuts: { loop: 'L' },
      currentLang: 'en',
      texts: { en: { shortcutStatusFailed: 'failed' } },
      sanitizeShortcutConfig: (value) => value,
      renderShortcutEditor: () => {},
      setStatus: (message) => statuses.push(message),
    });
    const source = read('popup.js');
    vm.runInContext(between(source, 'function getUiStore()', 'function normalizeShortcutValue'), h.context);
    vm.runInContext(between(source, 'async function saveShortcuts(', 'async function resetShortcuts('), h.context);
    const saved = await h.context.saveShortcuts({ loop: 'K' });
    assert.equal(saved, !failure);
    assert.equal(h.context.shortcuts.loop, failure ? 'L' : 'K');
    assert.deepEqual(statuses, failure ? ['failed'] : []);
    assert.equal(h.sync[UI_KEY].lang, 'ko');
    if (failure) assert.equal(h.sync[UI_KEY].shortcuts, undefined);
    else assert.equal(h.sync[UI_KEY].shortcuts.loop, 'K');
  });
}
