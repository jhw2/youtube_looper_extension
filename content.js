(() => {
  if (window.__YT_AB_LOOPER_LOADED__) return;
  window.__YT_AB_LOOPER_LOADED__ = true;

  const STORAGE_SEGMENTS_KEY = "yt-ab-looper-segments";
  const STORAGE_UI_KEY = "yt-ab-looper-ui";
  const LOOP_INTERVAL_MS = 120;
  const MIN_GAP = 0.1;

  let pointA = null;
  let pointB = null;
  let isLooping = false;
  let intervalId = null;
  let currentVideoId = null;

  let isCollapsed = false;
  let isHelpOpen = false;
  let lang = "en";

  let rootEl = null;
  let placementFrame = null;
  let hasWindowListeners = false;

  // ── i18n ──
  const i18n = {
    ko: {
      setA: "A 설정",
      setB: "B 설정",
      loop: "루프",
      looping: "루프 중...",
      save: "저장",
      pause: "일시정지",
      clear: "초기화",
      length: "길이",
      shortcuts: "단축키",
      hideShortcuts: "단축키 숨기기",
      noSegments: "저장된 구간이 없습니다.",
      delete: "삭제",
      editTitle: "이름 수정",
      segmentDefault: (n) => `구간${n}`,
      alertSetAB: "A와 B를 먼저 올바르게 설정해 주세요.",
      alertSetA: "먼저 A 지점을 설정해 주세요.",
      alertNoSegment: "저장할 수 있는 A-B 구간이 없습니다.",
      alertNoActive: "삭제할 활성 구간이 없습니다.",
      alertNoActiveSaved: "현재 활성화된 저장 구간이 없습니다.",
      alertEmptyName: "이름은 비워둘 수 없습니다.",
      promptRename: "구간 이름 수정",
      helpSetA: "A 지점 설정",
      helpSetB: "B 지점 설정",
      helpLoop: "루프 켜기/끄기",
      helpSave: "구간 저장",
      helpLoad: "저장된 구간 불러오기",
      helpDelete: "활성 구간 삭제",
      helpStop: "루프 정지",
      tipA: "단축키: A",
      tipB: "단축키: B",
      tipLoop: "단축키: L",
      tipSave: "단축키: S",
      tipPause: "Esc로 루프 정지",
      tipClear: "A/B 초기화",
      tipSegment: "단축키:",
    },
    en: {
      setA: "Set A",
      setB: "Set B",
      loop: "Loop",
      looping: "Looping...",
      save: "Save",
      pause: "Pause",
      clear: "Clear",
      length: "Length",
      shortcuts: "Shortcuts",
      hideShortcuts: "Hide Shortcuts",
      noSegments: "No saved segments.",
      delete: "Delete",
      editTitle: "Edit name",
      segmentDefault: (n) => `Segment ${n}`,
      alertSetAB: "Please set A and B points first.",
      alertSetA: "Please set point A first.",
      alertNoSegment: "No A-B segment to save.",
      alertNoActive: "No active segment to delete.",
      alertNoActiveSaved: "No active saved segment.",
      alertEmptyName: "Name cannot be empty.",
      promptRename: "Edit segment name",
      helpSetA: "Set A point",
      helpSetB: "Set B point",
      helpLoop: "Toggle loop",
      helpSave: "Save segment",
      helpLoad: "Load segment",
      helpDelete: "Delete active",
      helpStop: "Stop loop",
      tipA: "Shortcut: A",
      tipB: "Shortcut: B",
      tipLoop: "Shortcut: L",
      tipSave: "Shortcut: S",
      tipPause: "Esc to stop loop",
      tipClear: "Reset A/B",
      tipSegment: "Shortcut:",
    },
  };

  function t(key) {
    return i18n[lang][key] || i18n.en[key] || key;
  }

  // ── Utilities ──
  function getVideo() {
    return document.querySelector("video");
  }

  function isWatchPage() {
    try {
      const url = new URL(location.href);
      return url.pathname === "/watch" && !!url.searchParams.get("v");
    } catch {
      return false;
    }
  }

  function getVideoId() {
    try {
      const url = new URL(location.href);
      return url.searchParams.get("v");
    } catch {
      return null;
    }
  }

  function format(seconds) {
    if (typeof seconds !== "number" || Number.isNaN(seconds)) return "-";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function formatPrecise(seconds) {
    if (typeof seconds !== "number" || Number.isNaN(seconds)) return "-";
    return `${seconds.toFixed(1)}s`;
  }

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      target.isContentEditable
    );
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ── Storage ──
  function getSegmentsStore() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_SEGMENTS_KEY], (result) => {
        resolve(result[STORAGE_SEGMENTS_KEY] || {});
      });
    });
  }

  function setSegmentsStore(store) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_SEGMENTS_KEY]: store }, resolve);
    });
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

  async function saveUiState() {
    const store = await getUiStore();
    store.isCollapsed = isCollapsed;
    store.isHelpOpen = isHelpOpen;
    store.lang = lang;
    await setUiStore(store);
  }

  async function loadUiState() {
    const store = await getUiStore();
    isCollapsed = !!store.isCollapsed;
    isHelpOpen = !!store.isHelpOpen;
    lang = store.lang === "ko" ? "ko" : "en";
  }

  async function getCurrentVideoSegments() {
    const videoId = getVideoId();
    if (!videoId) return [];
    const store = await getSegmentsStore();
    return Array.isArray(store[videoId]) ? store[videoId] : [];
  }

  async function saveCurrentVideoSegments(segments) {
    const videoId = getVideoId();
    if (!videoId) return;
    const store = await getSegmentsStore();
    store[videoId] = segments;
    await setSegmentsStore(store);
  }

  // ── Loop Control ──
  function stopLoop() {
    isLooping = false;
    updateUI();
  }

  function clearCurrentSelection() {
    pointA = null;
    pointB = null;
    stopLoop();
  }

  function seekTo(time) {
    const video = getVideo();
    if (!video) return;
    const duration = video.duration || 0;
    const next = Math.max(0, Math.min(time, duration || time));
    video.currentTime = next;
  }

  function toggleLoop() {
    if (
      typeof pointA !== "number" ||
      typeof pointB !== "number" ||
      pointB <= pointA
    ) {
      alert(t("alertSetAB"));
      return;
    }

    isLooping = !isLooping;

    if (isLooping) {
      const video = getVideo();
      if (video && video.currentTime < pointA) {
        video.currentTime = pointA;
      }
      if (video) {
        video.play().catch(() => {});
      }
    }

    updateUI();
  }

  function setPointAToCurrent() {
    const video = getVideo();
    if (!video) return;

    pointA = video.currentTime;
    pointB = null;
    stopLoop();

    updateUI();
    renderSegments();
  }

  function setPointBToCurrent() {
    const video = getVideo();
    if (!video) return;
    if (typeof pointA !== "number") {
      alert(t("alertSetA"));
      return;
    }

    pointB = video.currentTime;

    if (pointB <= pointA) {
      pointB = pointA + MIN_GAP;
    }

    updateUI();
    renderSegments();
  }

  async function saveSegment() {
    if (
      typeof pointA !== "number" ||
      typeof pointB !== "number" ||
      pointB <= pointA
    ) {
      alert(t("alertNoSegment"));
      return;
    }

    const segments = await getCurrentVideoSegments();
    const title = i18n[lang].segmentDefault(segments.length + 1);

    const segment = {
      id: crypto.randomUUID(),
      title,
      start: pointA,
      end: pointB,
    };

    segments.push(segment);
    await saveCurrentVideoSegments(segments);

    await renderSegments();
    updateUI();
  }

  async function deleteSegment(id) {
    const segments = await getCurrentVideoSegments();
    const next = segments.filter((segment) => segment.id !== id);
    await saveCurrentVideoSegments(next);
    await renderSegments();
    updateUI();
  }

  async function deleteActiveSegment() {
    const segments = await getCurrentVideoSegments();

    if (
      typeof pointA !== "number" ||
      typeof pointB !== "number" ||
      pointB <= pointA
    ) {
      alert(t("alertNoActive"));
      return;
    }

    const activeSegment = segments.find(
      (segment) => segment.start === pointA && segment.end === pointB
    );

    if (!activeSegment) {
      alert(t("alertNoActiveSaved"));
      return;
    }

    await deleteSegment(activeSegment.id);
  }

  async function editSegmentTitle(id) {
    const segments = await getCurrentVideoSegments();
    const index = segments.findIndex((segment) => segment.id === id);
    if (index === -1) return;

    const currentTitle = segments[index].title || "";
    const nextTitle = prompt(t("promptRename"), currentTitle);

    if (nextTitle === null) return;

    const trimmed = nextTitle.trim();
    if (!trimmed) {
      alert(t("alertEmptyName"));
      return;
    }

    segments[index] = {
      ...segments[index],
      title: trimmed,
    };

    await saveCurrentVideoSegments(segments);
    await renderSegments();
    updateUI();
  }

  function activateSegment(segment) {
    pointA = segment.start;
    pointB = segment.end;
    seekTo(segment.start);
    stopLoop();
    updateUI();
    renderSegments();
  }

  async function activateSegmentByIndex(index) {
    const segments = await getCurrentVideoSegments();
    const segment = segments[index];
    if (!segment) return;
    activateSegment(segment);
  }

  // ── Render ──
  async function renderSegments() {
    const list = document.getElementById("ytal-segment-list");
    if (!list) return;

    const segments = await getCurrentVideoSegments();

    if (segments.length === 0) {
      list.innerHTML = `<div class="ytal-empty">${t("noSegments")}</div>`;
      return;
    }

    list.innerHTML = "";

    segments.forEach((segment, index) => {
      const item = document.createElement("div");
      item.className = "ytal-item";

      const isActive =
        typeof pointA === "number" &&
        typeof pointB === "number" &&
        pointA === segment.start &&
        pointB === segment.end;

      if (isActive) {
        item.classList.add("active");
      }

      const mainBtn = document.createElement("button");
      mainBtn.className = "ytal-item-main";
      mainBtn.innerHTML = `
        <div class="ytal-item-title-row">
          <div class="ytal-item-title">${index + 1}. ${escapeHtml(segment.title)}</div>
          <button class="ytal-edit-btn" type="button" title="${t("editTitle")}" aria-label="${t("editTitle")}">✎</button>
        </div>
        <div class="ytal-item-time">${format(segment.start)} - ${format(segment.end)}</div>
      `;
      if (index < 9) {
        mainBtn.title = `${t("tipSegment")} ${index + 1}`;
      }
      mainBtn.addEventListener("click", () => activateSegment(segment));

      const editBtn = mainBtn.querySelector(".ytal-edit-btn");
      if (editBtn) {
        editBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await editSegmentTitle(segment.id);
        });
      }

      const actions = document.createElement("div");
      actions.className = "ytal-item-actions";

      const delBtn = document.createElement("button");
      delBtn.className = "ytal-mini-btn delete";
      delBtn.textContent = t("delete");
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSegment(segment.id);
      });

      actions.appendChild(delBtn);
      item.appendChild(mainBtn);
      item.appendChild(actions);
      list.appendChild(item);
    });
  }

  function updateUI() {
    if (!rootEl) return;

    const aValue = document.getElementById("ytal-a-value");
    const bValue = document.getElementById("ytal-b-value");
    const lenValue = document.getElementById("ytal-len-value");
    const loopBtn = document.getElementById("ytal-loop-btn");
    const saveBtn = document.getElementById("ytal-save-btn");
    const helpBtn = document.getElementById("ytal-help-toggle");
    const helpPanel = document.getElementById("ytal-help-panel");
    const langSelect = document.getElementById("ytal-lang-select");

    if (aValue) {
      aValue.textContent =
        typeof pointA === "number" ? formatPrecise(pointA) : "-";
    }

    if (bValue) {
      bValue.textContent =
        typeof pointB === "number" ? formatPrecise(pointB) : "-";
    }

    const canLoop =
      typeof pointA === "number" &&
      typeof pointB === "number" &&
      pointB > pointA;

    if (lenValue) {
      lenValue.textContent = canLoop ? formatPrecise(pointB - pointA) : "-";
    }

    if (loopBtn) {
      loopBtn.textContent = isLooping ? t("looping") : t("loop");
      loopBtn.disabled = !canLoop;
      loopBtn.classList.toggle("active", isLooping);
    }

    if (saveBtn) {
      saveBtn.textContent = t("save");
      saveBtn.disabled = !canLoop;
    }

    // Update button labels
    const setABtn = document.getElementById("ytal-set-a-btn");
    const setBBtn = document.getElementById("ytal-set-b-btn");
    const stopBtn = document.getElementById("ytal-stop-btn");
    const clearBtn = document.getElementById("ytal-clear-btn");
    const lenLabel = document.getElementById("ytal-len-label");

    if (setABtn) { setABtn.textContent = t("setA"); setABtn.title = t("tipA"); }
    if (setBBtn) { setBBtn.textContent = t("setB"); setBBtn.title = t("tipB"); }
    if (stopBtn) { stopBtn.textContent = t("pause"); stopBtn.title = t("tipPause"); }
    if (clearBtn) { clearBtn.textContent = t("clear"); clearBtn.title = t("tipClear"); }
    if (loopBtn) loopBtn.title = t("tipLoop");
    if (saveBtn) saveBtn.title = t("tipSave");
    if (lenLabel) lenLabel.textContent = t("length");

    if (helpBtn) {
      helpBtn.textContent = isHelpOpen ? t("hideShortcuts") : t("shortcuts");
    }

    if (helpPanel) {
      helpPanel.classList.toggle("open", isHelpOpen);
      helpPanel.innerHTML = `
        <div class="ytal-help-row"><kbd>A</kbd> ${t("helpSetA")}</div>
        <div class="ytal-help-row"><kbd>B</kbd> ${t("helpSetB")}</div>
        <div class="ytal-help-row"><kbd>L</kbd> ${t("helpLoop")}</div>
        <div class="ytal-help-row"><kbd>S</kbd> ${t("helpSave")}</div>
        <div class="ytal-help-row"><kbd>1-9</kbd> ${t("helpLoad")}</div>
        <div class="ytal-help-row"><kbd>Del</kbd> ${t("helpDelete")}</div>
        <div class="ytal-help-row"><kbd>Esc</kbd> ${t("helpStop")}</div>
      `;
    }

    if (langSelect) {
      langSelect.value = lang;
    }
  }

  function injectStyles() {
    // styles are loaded from content.css via manifest
  }

  function getPlayerContainer() {
    return (
      document.querySelector("#movie_player") ||
      document.querySelector("#player") ||
      document.querySelector("#player-container-outer")
    );
  }

  function schedulePlacementUpdate() {
    if (placementFrame !== null) return;

    placementFrame = window.requestAnimationFrame(() => {
      placementFrame = null;
      updateRootPlacement();
    });
  }

  function updateRootPlacement() {
    if (!rootEl) return;

    if (!isCollapsed) {
      rootEl.classList.remove("ytal-docked");
      rootEl.style.top = "80px";
      rootEl.style.right = "20px";
      rootEl.style.left = "auto";
      rootEl.style.bottom = "auto";
      return;
    }

    const playerEl = getPlayerContainer();
    if (!playerEl) {
      rootEl.classList.remove("ytal-docked");
      rootEl.style.top = "80px";
      rootEl.style.right = "20px";
      rootEl.style.left = "auto";
      rootEl.style.bottom = "auto";
      return;
    }

    const rect = playerEl.getBoundingClientRect();
    const collapsedWidth = rootEl.offsetWidth || 140;
    const top = Math.max(16, rect.bottom + 12);
    const left = Math.max(16, rect.right - collapsedWidth);

    rootEl.classList.add("ytal-docked");
    rootEl.style.top = `${top}px`;
    rootEl.style.left = `${left}px`;
    rootEl.style.right = "auto";
    rootEl.style.bottom = "auto";
  }

  function bindWindowEvents() {
    if (hasWindowListeners) return;
    hasWindowListeners = true;

    window.addEventListener("resize", schedulePlacementUpdate);
    window.addEventListener("scroll", schedulePlacementUpdate, true);
  }

  function createRoot() {
    const existing = document.getElementById("yt-ab-looper-root");
    if (existing) existing.remove();

    injectStyles();

    rootEl = document.createElement("div");
    rootEl.id = "yt-ab-looper-root";

    if (isCollapsed) {
      rootEl.classList.add("ytal-collapsed");
    }

    rootEl.innerHTML = `
      <div class="ytal-header">
        <div class="ytal-logo">
          <span class="ytal-logo-icon">&#x21bb;</span>
          <span class="ytal-title">AB Loop</span>
        </div>
        <div class="ytal-header-actions">
          <select class="ytal-lang-select" id="ytal-lang-select">
            <option value="ko" ${lang === "ko" ? "selected" : ""}>한국어</option>
            <option value="en" ${lang === "en" ? "selected" : ""}>English</option>
          </select>
          <button class="ytal-collapse-btn" id="ytal-toggle-collapse">
            ${isCollapsed ? "&#x25B2;" : "&#x25BC;"}
          </button>
        </div>
      </div>

      <div class="ytal-body">
        <div class="ytal-time-display">
          <div class="ytal-time-block">
            <div class="ytal-time-label">A</div>
            <div class="ytal-time-value" id="ytal-a-value">-</div>
          </div>
          <div class="ytal-time-arrow">&#x2192;</div>
          <div class="ytal-time-block">
            <div class="ytal-time-label">B</div>
            <div class="ytal-time-value" id="ytal-b-value">-</div>
          </div>
          <div class="ytal-time-block ytal-time-len">
            <div class="ytal-time-label" id="ytal-len-label">${t("length")}</div>
            <div class="ytal-time-value" id="ytal-len-value">-</div>
          </div>
        </div>

        <div class="ytal-btn-row">
          <button class="ytal-btn ytal-btn-a" id="ytal-set-a-btn" title="${t("tipA")}">${t("setA")}</button>
          <button class="ytal-btn ytal-btn-b" id="ytal-set-b-btn" title="${t("tipB")}">${t("setB")}</button>
        </div>

        <div class="ytal-btn-row">
          <button class="ytal-btn ytal-btn-loop" id="ytal-loop-btn" title="${t("tipLoop")}">${t("loop")}</button>
          <button class="ytal-btn ytal-btn-save" id="ytal-save-btn" title="${t("tipSave")}">${t("save")}</button>
        </div>

        <div class="ytal-btn-row">
          <button class="ytal-btn ytal-btn-ghost" id="ytal-stop-btn" title="${t("tipPause")}">${t("pause")}</button>
          <button class="ytal-btn ytal-btn-ghost" id="ytal-clear-btn" title="${t("tipClear")}">${t("clear")}</button>
        </div>

        <div id="ytal-segment-list" class="ytal-list"></div>

        <button class="ytal-help-toggle" id="ytal-help-toggle">
          ${isHelpOpen ? t("hideShortcuts") : t("shortcuts")}
        </button>

        <div id="ytal-help-panel" class="ytal-help-panel ${isHelpOpen ? "open" : ""}">
          <div class="ytal-help-row"><kbd>A</kbd> ${t("helpSetA")}</div>
          <div class="ytal-help-row"><kbd>B</kbd> ${t("helpSetB")}</div>
          <div class="ytal-help-row"><kbd>L</kbd> ${t("helpLoop")}</div>
          <div class="ytal-help-row"><kbd>S</kbd> ${t("helpSave")}</div>
          <div class="ytal-help-row"><kbd>1-9</kbd> ${t("helpLoad")}</div>
          <div class="ytal-help-row"><kbd>Del</kbd> ${t("helpDelete")}</div>
          <div class="ytal-help-row"><kbd>Esc</kbd> ${t("helpStop")}</div>
        </div>

        <div class="ytal-copyright">© 2026 JinHyeWon</div>
      </div>
    `;

    document.body.appendChild(rootEl);
    schedulePlacementUpdate();

    document
      .getElementById("ytal-toggle-collapse")
      .addEventListener("click", async () => {
        isCollapsed = !isCollapsed;
        rootEl.classList.toggle("ytal-collapsed", isCollapsed);
        document.getElementById("ytal-toggle-collapse").innerHTML =
          isCollapsed ? "&#x25B2;" : "&#x25BC;";
        schedulePlacementUpdate();
        await saveUiState();
      });

    document
      .getElementById("ytal-lang-select")
      .addEventListener("change", async (e) => {
        lang = e.target.value;
        await saveUiState();
        updateUI();
        await renderSegments();
      });

    document
      .getElementById("ytal-set-a-btn")
      .addEventListener("click", setPointAToCurrent);

    document
      .getElementById("ytal-set-b-btn")
      .addEventListener("click", setPointBToCurrent);

    document
      .getElementById("ytal-loop-btn")
      .addEventListener("click", toggleLoop);

    document.getElementById("ytal-stop-btn").addEventListener("click", () => {
      const video = getVideo();
      if (!video) return;
      video.pause();
      stopLoop();
    });

    document
      .getElementById("ytal-save-btn")
      .addEventListener("click", saveSegment);

    document.getElementById("ytal-clear-btn").addEventListener("click", () => {
      clearCurrentSelection();
      updateUI();
      renderSegments();
    });

    document
      .getElementById("ytal-help-toggle")
      .addEventListener("click", async () => {
        isHelpOpen = !isHelpOpen;
        updateUI();
        await saveUiState();
      });

    updateUI();
  }

  // ── Keyboard ──
  function bindKeyboard() {
    window.addEventListener(
      "keydown",
      async (e) => {
        if (isTypingTarget(e.target)) return;

        const video = getVideo();
        if (!video) return;

        const code = e.code;

        if (code === "KeyA") {
          e.preventDefault();
          e.stopPropagation();
          setPointAToCurrent();
        } else if (code === "KeyB") {
          e.preventDefault();
          e.stopPropagation();
          setPointBToCurrent();
        } else if (code === "KeyL") {
          e.preventDefault();
          e.stopPropagation();
          toggleLoop();
        } else if (code === "KeyS") {
          e.preventDefault();
          e.stopPropagation();
          saveSegment();
        } else if (code === "Delete" || code === "Backspace") {
          e.preventDefault();
          e.stopPropagation();
          await deleteActiveSegment();
        } else if (code === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          stopLoop();
        } else if (/^Digit[1-9]$/.test(code)) {
          e.preventDefault();
          e.stopPropagation();
          await activateSegmentByIndex(Number(code.replace("Digit", "")) - 1);
        }
      },
      true
    );
  }

  // ── Watcher ──
  function startWatcher() {
    stopWatcher();

    intervalId = window.setInterval(() => {
      const video = getVideo();
      if (!video) return;

      if (
        isLooping &&
        typeof pointA === "number" &&
        typeof pointB === "number" &&
        pointB > pointA &&
        video.currentTime >= pointB
      ) {
        video.currentTime = pointA;
        video.play().catch(() => {});
      }
    }, LOOP_INTERVAL_MS);
  }

  function stopWatcher() {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  }

  function teardownRoot() {
    stopWatcher();
    pointA = null;
    pointB = null;
    isLooping = false;

    if (rootEl) {
      rootEl.remove();
      rootEl = null;
    }
  }

  // ── Init ──
  async function resetForVideoChange() {
    currentVideoId = getVideoId();
    teardownRoot();

    if (!isWatchPage() || !currentVideoId) {
      return;
    }

    await loadUiState();
    createRoot();
    await renderSegments();
    updateUI();
    startWatcher();
  }

  async function init() {
    await loadUiState();
    currentVideoId = getVideoId();
    createRoot();
    await renderSegments();
    updateUI();
    startWatcher();
  }

  function watchUrlChange() {
    let lastUrl = location.href;

    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;

        setTimeout(async () => {
          const nextVideoId = getVideoId();
          if (nextVideoId !== currentVideoId) {
            await resetForVideoChange();
          }
        }, 600);
      }
    });

    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    });
  }

  function waitForVideoAndInit() {
    if (!isWatchPage()) return;

    let tries = 0;

    const timer = setInterval(async () => {
      const video = getVideo();
      tries += 1;

      if (video) {
        clearInterval(timer);
        await init();
      }

      if (tries > 120) {
        clearInterval(timer);
      }
    }, 500);
  }

  bindKeyboard();
  bindWindowEvents();
  watchUrlChange();
  waitForVideoAndInit();
})();
