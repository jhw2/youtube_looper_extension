const STORAGE_UI_KEY = "yt-ab-looper-ui";
const DEFAULT_SHORTCUTS = Object.freeze({
  setPointA: "A",
  setPointB: "B",
  loop: "L",
  save: "S",
  reset: "R",
});
const SHORTCUT_ACTION_ORDER = Object.freeze([
  "setPointA",
  "setPointB",
  "loop",
  "save",
  "reset",
]);
const SHORTCUT_OPTIONS = Object.freeze(
  Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))
);

let currentLang = "en";
let shortcuts = { ...DEFAULT_SHORTCUTS };
let statusTone = "neutral";
let statusMessage = "";

function trackAnalyticsEvent(eventName, params = {}) {
  chrome.runtime.sendMessage({
    type: "trackAnalyticsEvent",
    eventName,
    params,
  });
}

const texts = {
  ko: {
    openYoutube: "YouTube에서 시작하기",
    openWeb: "웹 버전 열기",
    shortcutLabel: "단축키 설정",
    shortcutDesc: "원하는 알파벳을 선택하면 바로 저장돼요.",
    shortcutLoopAll: (shortcut) => `구간 전체 반복: Shift + ${shortcut}`,
    shortcutMeta: "저장 구간 불러오기는 1-9 숫자키를 그대로 사용해요.",
    shortcutReset: "기본값 복원",
    shortcutStatusIdle: "바꾸면 바로 저장됩니다.",
    shortcutStatusSaved: (label, key) => `${label} 단축키를 ${key}(으)로 저장했어요.`,
    shortcutStatusReset: "기본 단축키로 되돌렸어요.",
    shortcutActions: {
      setPointA: "시작점",
      setPointB: "끝점",
      loop: "구간 반복",
      save: "저장",
      reset: "리셋",
    },
  },
  en: {
    openYoutube: "Start on YouTube",
    openWeb: "Open Web Version",
    shortcutLabel: "Shortcut Setup",
    shortcutDesc: "Pick the letter you want and it saves right away.",
    shortcutLoopAll: (shortcut) => `Loop all segments: Shift + ${shortcut}`,
    shortcutMeta: "Loading saved segments still uses the 1-9 number keys.",
    shortcutReset: "Restore defaults",
    shortcutStatusIdle: "Changes are saved right away.",
    shortcutStatusSaved: (label, key) => `Saved ${label} as ${key}.`,
    shortcutStatusReset: "Restored the default shortcuts.",
    shortcutActions: {
      setPointA: "Start point",
      setPointB: "End point",
      loop: "Loop range",
      save: "Save",
      reset: "Reset",
    },
  },
};

function detectDefaultLang() {
  const browserLang =
    chrome.i18n?.getUILanguage?.() ||
    navigator.language ||
    navigator.languages?.[0] ||
    "en";
  return browserLang.toLowerCase().startsWith("ko") ? "ko" : "en";
}

function getUiStore() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_UI_KEY], (result) => {
      resolve(result[STORAGE_UI_KEY] || {});
    });
  });
}

function setUiStore(store) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_UI_KEY]: store }, resolve);
  });
}

function normalizeShortcutValue(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]$/.test(normalized) ? normalized : null;
}

function sanitizeShortcutConfig(config) {
  const next = {};
  const used = new Set();

  SHORTCUT_ACTION_ORDER.forEach((action) => {
    const preferred =
      normalizeShortcutValue(config?.[action]) ||
      normalizeShortcutValue(DEFAULT_SHORTCUTS[action]);

    if (preferred && !used.has(preferred)) {
      next[action] = preferred;
      used.add(preferred);
      return;
    }

    const fallback = SHORTCUT_OPTIONS.find((candidate) => !used.has(candidate));
    next[action] = fallback || DEFAULT_SHORTCUTS[action];
    used.add(next[action]);
  });

  return next;
}

function getActionLabel(action) {
  return texts[currentLang].shortcutActions[action];
}

function setStatus(message, tone = "neutral") {
  statusMessage = message;
  statusTone = tone;
  renderShortcutStatus();
}

function renderShortcutStatus() {
  const statusEl = document.getElementById("popup-shortcut-status");
  statusEl.textContent = statusMessage || texts[currentLang].shortcutStatusIdle;
  statusEl.dataset.tone = statusTone;
}

function getSelectOptions(action) {
  const currentValue = shortcuts[action];
  const usedByOthers = new Set(
    SHORTCUT_ACTION_ORDER
      .filter((candidateAction) => candidateAction !== action)
      .map((candidateAction) => shortcuts[candidateAction])
  );

  return SHORTCUT_OPTIONS.filter(
    (option) => option === currentValue || !usedByOthers.has(option)
  );
}

function renderShortcutEditor() {
  const listEl = document.getElementById("popup-shortcut-list");
  listEl.innerHTML = SHORTCUT_ACTION_ORDER.map((action) => {
    const options = getSelectOptions(action)
      .map((option) => `
        <option value="${option}" ${option === shortcuts[action] ? "selected" : ""}>${option}</option>
      `)
      .join("");

    return `
      <div class="shortcut-row">
        <p class="shortcut-name">${getActionLabel(action)}</p>
        <select class="shortcut-select" data-shortcut-action="${action}">
          ${options}
        </select>
      </div>
    `;
  }).join("");

  document.getElementById("popup-shortcut-loop-all").textContent =
    texts[currentLang].shortcutLoopAll(shortcuts.loop);
  document.getElementById("popup-shortcut-meta").textContent =
    texts[currentLang].shortcutMeta;
  document.getElementById("popup-shortcut-reset").textContent =
    texts[currentLang].shortcutReset;

  listEl.querySelectorAll("[data-shortcut-action]").forEach((select) => {
    select.addEventListener("change", async () => {
      const action = select.dataset.shortcutAction;
      const nextValue = normalizeShortcutValue(select.value);
      if (!action || !nextValue) return;

      await saveShortcuts({
        ...shortcuts,
        [action]: nextValue,
      });

      renderShortcutEditor();
      setStatus(
        texts[currentLang].shortcutStatusSaved(
          getActionLabel(action),
          nextValue
        ),
        "success"
      );
      trackAnalyticsEvent("popup_shortcut_updated", {
        action,
        shortcut: nextValue,
      });
    });
  });

  renderShortcutStatus();
}

async function saveShortcuts(nextShortcuts) {
  const store = await getUiStore();
  store.shortcuts = sanitizeShortcutConfig(nextShortcuts);
  await setUiStore(store);
  shortcuts = store.shortcuts;
}

async function resetShortcuts() {
  await saveShortcuts(DEFAULT_SHORTCUTS);
  renderShortcutEditor();
  setStatus(texts[currentLang].shortcutStatusReset, "success");
  trackAnalyticsEvent("popup_shortcuts_reset");
}

function renderStaticText() {
  const uiText = texts[currentLang];

  document.getElementById("open-youtube").textContent = uiText.openYoutube;
  document.getElementById("open-web").textContent = uiText.openWeb;
  document.getElementById("popup-shortcut-label").textContent = uiText.shortcutLabel;
  document.getElementById("popup-shortcut-desc").textContent = uiText.shortcutDesc;
}

async function initPopup() {
  const store = await getUiStore();

  currentLang =
    store.lang === "ko" || store.lang === "en"
      ? store.lang
      : detectDefaultLang();
  shortcuts = sanitizeShortcutConfig(store.shortcuts);

  renderStaticText();
  renderShortcutEditor();
  setStatus(texts[currentLang].shortcutStatusIdle);

  trackAnalyticsEvent("popup_opened", {
    ui_language: currentLang,
  });
}

document.getElementById("popup-shortcut-reset").addEventListener("click", () => {
  resetShortcuts();
});

document.getElementById("open-youtube").addEventListener("click", () => {
  trackAnalyticsEvent("popup_open_youtube_clicked");
  chrome.tabs.create({ url: "https://www.youtube.com/" });
});

document.getElementById("open-web").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    let webUrl = "https://youtube-looper.vercel.app/";

    if (tab && tab.url && tab.url.includes("youtube.com/watch")) {
      webUrl += "?url=" + encodeURIComponent(tab.url);
    }

    trackAnalyticsEvent("popup_open_web_clicked", {
      has_watch_url_context: Boolean(tab && tab.url && tab.url.includes("youtube.com/watch")),
    });
    chrome.tabs.create({ url: webUrl });
  });
});

initPopup();
