(() => {
  if (window.__YT_AB_LOOPER_LOADED__) return;
  window.__YT_AB_LOOPER_LOADED__ = true;

  const STORAGE_SEGMENTS_KEY = "yt-ab-looper-segments";
  const STORAGE_UI_KEY = "yt-ab-looper-ui";
  const LOOP_INTERVAL_MS = 120;
  const MIN_GAP = 0.1;
  const PLAYBACK_RATE_STEP = 0.05;
  const PANEL_TRANSITION_MS = 260;
  const FULLSCREEN_PEEK_HIDE_MS = 2400;

  let pointA = null;
  let pointB = null;
  let activeSegmentId = null;
  let isLooping = false;
  let intervalId = null;
  let currentVideoId = null;
  let defaultPlaybackRate = 1;
  let restorePlaybackRate = null;
  let transientStatus = "";
  let transientStatusTone = "neutral";
  let transientStatusTimer = null;
  let toastMessage = "";
  let toastTone = "neutral";
  let toastTimer = null;
  let fullscreenPeekTimer = null;

  let isCollapsed = false;
  let isHelpOpen = false;
  let lang = "en";

  let rootEl = null;
  let toastEl = null;
  let inlineLauncherEl = null;
  let nativeRangeEl = null;
  let nativeMarkerAEl = null;
  let nativeMarkerBEl = null;
  let placementFrame = null;
  let hasWindowListeners = false;
  let dragMode = null; // 'markerA' | 'markerB'
  let rootMountEl = null;
  let isFullscreenPeekVisible = false;

  // ── i18n ──
  const i18n = {
    ko: {
      timelineHint: "마커를 드래그해서 구간 조정",
      timelineStatusEmpty: "A·B 마커를 드래그해서 구간을 설정하세요",
      timelineStatusAwaitEnd: "B 마커를 드래그해서 끝점을 설정하세요",
      timelineStatusReady: "마커를 드래그해서 구간 조정",
      resetSelection: "선택 리셋",
      loop: "반복 하기",
      looping: "반복 중...",
      loopDesc: "선택 구간 바로 재생",
      save: "목록에 저장",
      saveDesc: "나중에 다시 불러오기",
      rangeSummaryPending: "구간을 선택하면 여기에 시작과 끝 시간이 표시됩니다.",
      rangeSummaryReady: (start, end) => `${start} ~ ${end}`,
      savedNotice: "저장됨. 바로 반복하거나 다른 구간을 선택할 수 있어요.",
      toastPointA: (time) => `루프 시작 구간을 찍었어요. A = ${time}`,
      toastPointB: (time) => `루프 끝 구간을 찍었어요. B = ${time}`,
      toastSegmentSaved: (title, start, end, shortcut) =>
        shortcut
          ? `${title} 구간을 저장했어요. ${start} ~ ${end} · 불러오기는 ${shortcut} · 배속은 + / -`
          : `${title} 구간을 저장했어요. ${start} ~ ${end} · 배속은 + / -`,
      toastSegmentExists: (index, title, start, end) =>
        `이미 저장된 구간이에요. ${index}번 ${title} · ${start} ~ ${end}`,
      toastLoopOn: (start, end) => `AB 루프를 시작했어요. ${start} ~ ${end}`,
      toastLoopOff: "AB 루프를 멈췄어요.",
      toastShortcutsIntro: "단축키: A (시작), B (끝), L (루프), S (저장), + / - (구간 배속)",
      savedSegments: "저장한 구간",
      shortcuts: "단축키",
      hideShortcuts: "단축키 숨기기",
      noSegments: "아직 저장한 구간이 없습니다.",
      emptyGuide: "재생바의 A·B 마커를 드래그하거나 키보드 A·B 키로 구간을 설정한 뒤 루프나 저장을 사용해 보세요.",
      delete: "삭제",
      editTitle: "이름 수정",
      speedDown: "배속 낮추기",
      speedUp: "배속 높이기",
      speedValue: (value) => `${value}x`,
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
      helpSpeed: "활성 구간 배속 조절",
      helpDelete: "활성 구간 삭제",
      helpStop: "루프 정지",
      tipLoop: "반복 하기 (L)",
      tipSave: "목록에 저장 (S)",
      tipReset: "선택 리셋",
      tipPanelOpen: "저장 구간 패널 열기",
      tipPanelClose: "패널 숨기기",
      tipList: "저장 구간 보기",
      tipShortcuts: "단축키 보기",
      tipCollapse: "패널 숨기기",
      tipExpand: "패널 열기",
      hiddenTab: "AB 열기",
      hiddenInline: "AB Loop",
      tipSegment: "단축키:",
    },
    en: {
      timelineHint: "Drag markers to adjust range",
      timelineStatusEmpty: "Drag the A·B markers to set your range",
      timelineStatusAwaitEnd: "Drag the B marker to set the end",
      timelineStatusReady: "Drag markers to adjust the range",
      resetSelection: "Reset selection",
      loop: "Play Loop",
      looping: "Looping...",
      loopDesc: "Start looping this range",
      save: "Save to List",
      saveDesc: "Recall it later",
      rangeSummaryPending: "Once you select a range, the start and end times will appear here.",
      rangeSummaryReady: (start, end) => `${start} ~ ${end}`,
      savedNotice: "Saved. Press 'Play Loop' to start looping it.",
      toastPointA: (time) => `Loop start marked. A = ${time}`,
      toastPointB: (time) => `Loop end marked. B = ${time}`,
      toastSegmentSaved: (title, start, end, shortcut) =>
        shortcut
          ? `Saved ${title}. ${start} ~ ${end}. Load: ${shortcut}. Speed: + / -`
          : `Saved ${title}. ${start} ~ ${end}. Speed: + / -`,
      toastSegmentExists: (index, title, start, end) =>
        `This range is already saved as ${index}. ${title} · ${start} ~ ${end}`,
      toastLoopOn: (start, end) => `AB loop started. ${start} ~ ${end}`,
      toastLoopOff: "AB loop stopped.",
      toastShortcutsIntro: "Shortcuts: A (start), B (end), L (loop), S (save), + / - (segment speed)",
      savedSegments: "Saved Segments",
      shortcuts: "Shortcuts",
      hideShortcuts: "Hide Shortcuts",
      noSegments: "No saved segments yet.",
      emptyGuide: "Drag the A·B markers on the timeline, or use the A and B keys, to set your range, then use Loop or Save.",
      delete: "Delete",
      editTitle: "Edit name",
      speedDown: "Decrease speed",
      speedUp: "Increase speed",
      speedValue: (value) => `${value}x`,
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
      helpSpeed: "Adjust active segment speed",
      helpDelete: "Delete active",
      helpStop: "Stop loop",
      tipLoop: "Play Loop (L)",
      tipSave: "Save to List (S)",
      tipReset: "Reset selection",
      tipPanelOpen: "Open saved segments panel",
      tipPanelClose: "Hide panel",
      tipList: "Show saved segments",
      tipShortcuts: "Show shortcuts",
      tipCollapse: "Hide panel",
      tipExpand: "Open panel",
      hiddenTab: "Open AB Loop",
      hiddenInline: "AB Loop",
      tipSegment: "Shortcut:",
    },
  };

  function t(key) {
    return i18n[lang][key] || i18n.en[key] || key;
  }

  function detectDefaultLang() {
    const browserLang =
      chrome.i18n?.getUILanguage?.() ||
      navigator.language ||
      navigator.languages?.[0] ||
      "en";
    return browserLang.toLowerCase().startsWith("ko") ? "ko" : "en";
  }

  function buttonMarkup(label, description) {
    return `
      <span class="ytal-btn-label">${label}</span>
      <span class="ytal-btn-desc">${description}</span>
    `;
  }

  function syncButtonMarkup(button, label, description) {
    if (!button) return;
    if (
      button.dataset.label === label &&
      button.dataset.description === description
    ) {
      return;
    }

    button.dataset.label = label;
    button.dataset.description = description;
    button.innerHTML = buttonMarkup(label, description);
  }

  function getTimelineRatio(time, duration) {
    if (!duration || !Number.isFinite(duration) || duration <= 0) return 0;
    return Math.max(0, Math.min(time / duration, 1));
  }

  function getTimelineStatus() {
    if (transientStatus) return transientStatus;
    if (typeof pointA !== "number") return t("timelineStatusEmpty");
    if (typeof pointB !== "number" || pointB <= pointA) {
      return t("timelineStatusAwaitEnd");
    }
    return t("timelineStatusReady");
  }

  function showTransientStatus(message, tone = "neutral", durationMs = 2400) {
    transientStatus = message;
    transientStatusTone = tone;

    if (transientStatusTimer !== null) {
      window.clearTimeout(transientStatusTimer);
    }

    transientStatusTimer = window.setTimeout(() => {
      transientStatus = "";
      transientStatusTone = "neutral";
      transientStatusTimer = null;
      updateUI();
    }, durationMs);

    updateUI();
  }

  function showToast(message, tone = "neutral", durationMs = 2200) {
    toastMessage = message;
    toastTone = tone;

    if (toastTimer !== null) {
      window.clearTimeout(toastTimer);
    }

    toastTimer = window.setTimeout(() => {
      toastMessage = "";
      toastTone = "neutral";
      toastTimer = null;
      updateUI();
    }, durationMs);

    updateUI();
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

  function normalizePlaybackRate(value) {
    const rate = Number(value);
    if (!Number.isFinite(rate)) return 1;
    return Math.min(16, Math.max(0.05, Math.round(rate / PLAYBACK_RATE_STEP) * PLAYBACK_RATE_STEP));
  }

  function getPlaybackRateLabel(value) {
    return t("speedValue")(normalizePlaybackRate(value).toFixed(2).replace(/\.?0+$/, ""));
  }

  function getSegmentPlaybackRate(segment) {
    return normalizePlaybackRate(segment?.playbackRate ?? 1);
  }

  function isSegmentActive(segment) {
    return (
      !!segment &&
      activeSegmentId === segment.id &&
      typeof pointA === "number" &&
      typeof pointB === "number" &&
      pointA === segment.start &&
      pointB === segment.end
    );
  }

  async function setSegmentPlaybackRate(id, direction) {
    const segments = await getCurrentVideoSegments();
    const index = segments.findIndex((segment) => segment.id === id);
    if (index === -1) return;

    const currentRate = getSegmentPlaybackRate(segments[index]);
    const nextRate = normalizePlaybackRate(currentRate + PLAYBACK_RATE_STEP * direction);

    if (nextRate === currentRate) return;

    segments[index] = {
      ...segments[index],
      playbackRate: nextRate,
    };

    await saveCurrentVideoSegments(segments);

    const isActive =
      typeof pointA === "number" &&
      typeof pointB === "number" &&
      pointA === segments[index].start &&
      pointB === segments[index].end;

    if (isActive) {
      applyPlaybackRate(segments[index].playbackRate);
    }

    await renderSegments();
    updateUI();
  }

  async function setActiveSegmentPlaybackRate(direction) {
    if (
      typeof pointA !== "number" ||
      typeof pointB !== "number" ||
      pointB <= pointA
    ) {
      return;
    }

    const segments = await getCurrentVideoSegments();
    const activeSegment = segments.find(
      (segment) => segment.start === pointA && segment.end === pointB
    );

    if (!activeSegment) return;

    await setSegmentPlaybackRate(activeSegment.id, direction);
  }

  function applyPlaybackRate(rate) {
    const video = getVideo();
    if (!video) return;
    video.playbackRate = normalizePlaybackRate(rate);
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
    lang =
      store.lang === "ko" || store.lang === "en"
        ? store.lang
        : detectDefaultLang();
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
    transientStatus = "";
    transientStatusTone = "neutral";
    const nextPlaybackRate =
      activeSegmentId !== null
        ? restorePlaybackRate ?? defaultPlaybackRate
        : defaultPlaybackRate;
    activeSegmentId = null;
    initDefaultABPoints();
    applyPlaybackRate(nextPlaybackRate);
    defaultPlaybackRate = normalizePlaybackRate(nextPlaybackRate);
    restorePlaybackRate = null;
    stopLoop();
  }

  function seekTo(time) {
    const video = getVideo();
    if (!video) return;
    const duration = video.duration || 0;
    const next = Math.max(0, Math.min(time, duration || time));
    video.currentTime = next;
  }

  function toggleLoop(options = {}) {
    const { showToastOnChange = false } = options;
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

    if (showToastOnChange) {
      showToast(
        isLooping
          ? t("toastLoopOn")(format(pointA), format(pointB))
          : t("toastLoopOff"),
        isLooping ? "success" : "neutral"
      );
    }

    updateUI();
  }

  function setPointAToCurrent(options = {}) {
    const { showToastOnSet = false } = options;
    const video = getVideo();
    if (!video) return;

    transientStatus = "";
    transientStatusTone = "neutral";
    activeSegmentId = null;
    pointA = video.currentTime;
    pointB = null;
    stopLoop();

    updateUI();
    renderSegments();

    if (showToastOnSet) {
      showToast(t("toastPointA")(format(pointA)), "success");
    }
  }

  function setPointBToCurrent(options = {}) {
    const { showToastOnSet = false } = options;
    const video = getVideo();
    if (!video) return;
    if (typeof pointA !== "number") {
      alert(t("alertSetA"));
      return;
    }

    transientStatus = "";
    transientStatusTone = "neutral";
    activeSegmentId = null;
    pointB = video.currentTime;

    if (pointB <= pointA) {
      pointB = pointA + MIN_GAP;
    }

    updateUI();
    renderSegments();

    if (showToastOnSet) {
      showToast(t("toastPointB")(format(pointB)), "success");
    }
  }

  async function saveSegment(options = {}) {
    const { showToastOnSave = false } = options;
    if (
      typeof pointA !== "number" ||
      typeof pointB !== "number" ||
      pointB <= pointA
    ) {
      alert(t("alertNoSegment"));
      return;
    }

    const segments = await getCurrentVideoSegments();
    const existingIndex = segments.findIndex(
      (segment) => segment.start === pointA && segment.end === pointB
    );

    if (existingIndex !== -1) {
      const existingSegment = segments[existingIndex];
      showToast(
        t("toastSegmentExists")(
          existingIndex + 1,
          existingSegment.title,
          format(existingSegment.start),
          format(existingSegment.end)
        ),
        "neutral"
      );
      return;
    }

    const title = i18n[lang].segmentDefault(segments.length + 1);
    const shortcut = segments.length < 9 ? String(segments.length + 1) : null;

    const segment = {
      id: crypto.randomUUID(),
      title,
      start: pointA,
      end: pointB,
      playbackRate: normalizePlaybackRate(getVideo()?.playbackRate ?? 1),
    };

    segments.push(segment);
    await saveCurrentVideoSegments(segments);
    activeSegmentId = segment.id;

    await renderSegments();
    updateUI();
    showTransientStatus(t("savedNotice"), "success");

    if (showToastOnSave) {
      showToast(
        t("toastSegmentSaved")(
          segment.title,
          format(segment.start),
          format(segment.end),
          shortcut
        ),
        "success"
      );
    }
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
    const wasActive = isSegmentActive(segment);

    if (wasActive) {
      clearCurrentSelection();
      renderSegments();
      return;
    }

    const video = getVideo();
    if (activeSegmentId === null && video) {
      restorePlaybackRate = normalizePlaybackRate(video.playbackRate);
      defaultPlaybackRate = restorePlaybackRate;
    }

    activeSegmentId = segment.id;
    pointA = segment.start;
    pointB = segment.end;
    applyPlaybackRate(getSegmentPlaybackRate(segment));
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
      list.innerHTML = `
        <div class="ytal-empty">
          <div class="ytal-empty-title">${t("noSegments")}</div>
          <div class="ytal-empty-copy">${t("emptyGuide")}</div>
        </div>
      `;
      return;
    }

    list.innerHTML = "";

    segments.forEach((segment, index) => {
      const item = document.createElement("div");
      item.className = "ytal-item";

      const isActive = isSegmentActive(segment);

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
        <div class="ytal-item-meta">
          <div class="ytal-item-time">${format(segment.start)} - ${format(segment.end)}</div>
          <div class="ytal-speed-chip" role="group" aria-label="${t("speedValue")(getSegmentPlaybackRate(segment))}">
            <button class="ytal-speed-chip-btn" type="button" title="${t("speedDown")}" aria-label="${t("speedDown")}">-</button>
            <span class="ytal-speed-chip-value">${getPlaybackRateLabel(getSegmentPlaybackRate(segment))}</span>
            <button class="ytal-speed-chip-btn" type="button" title="${t("speedUp")}" aria-label="${t("speedUp")}">+</button>
          </div>
        </div>
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

      const speedDownBtn = mainBtn.querySelector(".ytal-speed-chip-btn:first-child");
      if (speedDownBtn) {
        speedDownBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await setSegmentPlaybackRate(segment.id, -1);
        });
      }

      const speedUpBtn = mainBtn.querySelector(".ytal-speed-chip-btn:last-child");
      if (speedUpBtn) {
        speedUpBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await setSegmentPlaybackRate(segment.id, 1);
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

    schedulePlacementUpdate();
  }

  function updateUI() {
    if (!rootEl) return;
    syncToastMountTarget();

    const loopBtn = document.getElementById("ytal-loop-btn");
    const saveBtn = document.getElementById("ytal-save-btn");
    const helpBtn = document.getElementById("ytal-help-toggle");
    const helpPanel = document.getElementById("ytal-help-panel");
    const langSelect = document.getElementById("ytal-lang-select");
    const timelineFill = document.getElementById("ytal-timeline-fill");
    const timelineRange = document.getElementById("ytal-timeline-range");
    const timelineCurrent = document.getElementById("ytal-timeline-current");
    const timelineMarkerA = document.getElementById("ytal-marker-a");
    const timelineMarkerB = document.getElementById("ytal-marker-b");
    const timelineStatus = document.getElementById("ytal-timeline-status");
    const timelineTrack = document.getElementById("ytal-timeline-track");
    const rangeSummary = document.getElementById("ytal-range-summary");
    const resetBtn = document.getElementById("ytal-reset-selection");
    const collapseBtn = document.getElementById("ytal-toggle-collapse");
    const revealBtn = document.getElementById("ytal-reveal-panel");
    const video = getVideo();
    const duration = video?.duration || 0;
    const currentTime = video?.currentTime || 0;
    const currentRatio = getTimelineRatio(currentTime, duration);
    const pointARatio =
      typeof pointA === "number" ? getTimelineRatio(pointA, duration) : 0;
    const pointBRatio =
      typeof pointB === "number" ? getTimelineRatio(pointB, duration) : 0;

    const canLoop =
      typeof pointA === "number" &&
      typeof pointB === "number" &&
      pointB > pointA;

    if (rangeSummary) {
      rangeSummary.textContent = canLoop
        ? t("rangeSummaryReady")(format(pointA), format(pointB))
        : t("rangeSummaryPending");
    }

    if (toastEl) {
      toastEl.textContent = toastMessage;
      toastEl.dataset.tone = toastTone;
      toastEl.classList.toggle("show", !!toastMessage);
    }

    if (timelineFill) {
      timelineFill.style.width = `${currentRatio * 100}%`;
    }

    if (timelineCurrent) {
      timelineCurrent.style.left = `${currentRatio * 100}%`;
    }

    if (timelineRange) {
      if (canLoop) {
        timelineRange.style.display = "block";
        timelineRange.style.left = `${pointARatio * 100}%`;
        timelineRange.style.width = `${Math.max((pointBRatio - pointARatio) * 100, 0)}%`;
      } else {
        timelineRange.style.display = "none";
      }
    }

    if (timelineMarkerA) {
      timelineMarkerA.style.display = typeof pointA === "number" ? "flex" : "none";
      timelineMarkerA.style.left = `${pointARatio * 100}%`;
    }

    if (timelineMarkerB) {
      timelineMarkerB.style.display = typeof pointB === "number" ? "flex" : "none";
      timelineMarkerB.style.left = `${pointBRatio * 100}%`;
    }

    if (timelineStatus) {
      timelineStatus.textContent = getTimelineStatus();
      timelineStatus.dataset.tone = transientStatus ? transientStatusTone : "neutral";
    }

    if (timelineTrack) {
      timelineTrack.setAttribute("aria-label", t("timelineHint"));
      timelineTrack.setAttribute("aria-valuemin", "0");
      timelineTrack.setAttribute("aria-valuemax", String(Math.round(duration || 0)));
      timelineTrack.setAttribute("aria-valuenow", String(Math.round(currentTime)));
    }

    if (resetBtn) {
      resetBtn.title = t("tipReset");
      resetBtn.setAttribute("aria-label", t("resetSelection"));
      resetBtn.disabled = typeof pointA !== "number" && typeof pointB !== "number";
    }

    if (loopBtn) {
      syncButtonMarkup(
        loopBtn,
        isLooping ? t("looping") : t("loop"),
        t("loopDesc")
      );
      loopBtn.disabled = !canLoop;
      loopBtn.classList.toggle("active", isLooping);
    }

    if (saveBtn) {
      syncButtonMarkup(saveBtn, t("save"), t("saveDesc"));
      saveBtn.disabled = !canLoop;
    }

    updateNativeTimelineOverlay(canLoop, duration);

    if (loopBtn) loopBtn.title = t("tipLoop");
    if (saveBtn) saveBtn.title = t("tipSave");

    if (helpBtn) {
      helpBtn.textContent = isHelpOpen ? t("hideShortcuts") : t("shortcuts");
      helpBtn.title = t("tipShortcuts");
    }

    if (helpPanel) {
      helpPanel.classList.toggle("open", isHelpOpen);
      helpPanel.innerHTML = `
        <div class="ytal-help-row"><kbd>A</kbd> ${t("helpSetA")}</div>
        <div class="ytal-help-row"><kbd>B</kbd> ${t("helpSetB")}</div>
        <div class="ytal-help-row"><kbd>L</kbd> ${t("helpLoop")}</div>
        <div class="ytal-help-row"><kbd>S</kbd> ${t("helpSave")}</div>
        <div class="ytal-help-row"><kbd>1-9</kbd> ${t("helpLoad")}</div>
        <div class="ytal-help-row"><kbd>+ / -</kbd> ${t("helpSpeed")}</div>
        <div class="ytal-help-row"><kbd>Del</kbd> ${t("helpDelete")}</div>
        <div class="ytal-help-row"><kbd>Esc</kbd> ${t("helpStop")}</div>
      `;
    }

    if (langSelect) {
      langSelect.value = lang;
    }

    if (collapseBtn) {
      collapseBtn.innerHTML = "&#x2715;";
      collapseBtn.title = t("tipCollapse");
      collapseBtn.setAttribute("aria-label", t("tipCollapse"));
    }

    if (revealBtn) {
      revealBtn.title = t("tipExpand");
      revealBtn.setAttribute("aria-label", t("tipExpand"));
      revealBtn.innerHTML = `
        <span class="ytal-peek-btn-icon">&#x2922;</span>
        <span class="ytal-peek-btn-text">${t("hiddenTab")}</span>
      `;
    }

    syncInlineLauncher();
    rootEl.classList.toggle(
      "ytal-fullscreen-peek-visible",
      rootMountEl !== document.body && isCollapsed && isFullscreenPeekVisible
    );
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

  function getNativeTimelineHost() {
    return (
      document.querySelector(".ytp-progress-list") ||
      document.querySelector(".ytp-progress-bar-container")
    );
  }

  function getActionButtonsHost() {
    const selectors = [
      "ytd-watch-metadata #top-level-buttons-computed",
      "ytd-watch-flexy #top-level-buttons-computed",
      "#above-the-fold #top-level-buttons-computed",
      "#actions-inner #top-level-buttons-computed",
      "#menu #top-level-buttons-computed",
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }

    return null;
  }

  function getFullscreenHost() {
    return (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      null
    );
  }

  function getRootMountTarget() {
    const fullscreenHost = getFullscreenHost();
    if (fullscreenHost?.contains(getVideo()) || fullscreenHost?.id === "movie_player") {
      return fullscreenHost;
    }
    return document.body;
  }

  function ensureToastElement() {
    if (toastEl?.isConnected) return toastEl;

    toastEl = document.createElement("div");
    toastEl.id = "ytal-toast";
    toastEl.className = "ytal-toast";
    toastEl.setAttribute("aria-live", "polite");
    toastEl.setAttribute("aria-atomic", "true");
    return toastEl;
  }

  function ensureInlineLauncher() {
    if (inlineLauncherEl) return inlineLauncherEl;

    inlineLauncherEl = document.createElement("button");
    inlineLauncherEl.type = "button";
    inlineLauncherEl.id = "ytal-inline-launcher";
    inlineLauncherEl.className = "ytal-inline-launcher";
    inlineLauncherEl.addEventListener("click", animateExpandTransition);

    return inlineLauncherEl;
  }

  function syncInlineLauncher() {
    const shouldUseInlineLauncher =
      !!rootEl &&
      isCollapsed &&
      rootMountEl === document.body &&
      isWatchPage();
    const host = shouldUseInlineLauncher ? getActionButtonsHost() : null;

    if (!shouldUseInlineLauncher || !host) {
      if (inlineLauncherEl?.isConnected) {
        inlineLauncherEl.remove();
      }
      rootEl?.classList.remove("ytal-has-inline-launcher");
      return;
    }

    const launcher = ensureInlineLauncher();
    launcher.title = t("tipExpand");
    launcher.setAttribute("aria-label", t("tipExpand"));
    launcher.innerHTML = `
      <span class="ytal-inline-launcher-label">${t("hiddenInline")}</span>
      <span class="ytal-inline-launcher-icon" aria-hidden="true">&#x2922;</span>
    `;

    if (launcher.parentElement !== host || host.firstElementChild !== launcher) {
      host.insertBefore(launcher, host.firstChild);
    }

    rootEl.classList.add("ytal-has-inline-launcher");
  }

  function clearFullscreenPeekTimer() {
    if (fullscreenPeekTimer !== null) {
      window.clearTimeout(fullscreenPeekTimer);
      fullscreenPeekTimer = null;
    }
  }

  function scheduleFullscreenPeekHide() {
    clearFullscreenPeekTimer();
    fullscreenPeekTimer = window.setTimeout(() => {
      isFullscreenPeekVisible = false;
      fullscreenPeekTimer = null;
      updateUI();
    }, FULLSCREEN_PEEK_HIDE_MS);
  }

  function showFullscreenPeekTemporarily() {
    if (!rootEl || !isCollapsed || rootMountEl === document.body) return;
    isFullscreenPeekVisible = true;
    updateUI();
    scheduleFullscreenPeekHide();
  }

  function syncToastMountTarget() {
    const nextMountEl = getRootMountTarget();
    const nextToastEl = ensureToastElement();

    if (!nextMountEl || !nextToastEl) return;

    if (nextToastEl.parentElement !== nextMountEl) {
      nextMountEl.appendChild(nextToastEl);
    }

    nextToastEl.classList.toggle("ytal-in-fullscreen", nextMountEl !== document.body);
  }

  function syncRootMountTarget() {
    if (!rootEl) return;

    const nextMountEl = getRootMountTarget();
    if (!nextMountEl || rootMountEl === nextMountEl) return;

    nextMountEl.appendChild(rootEl);
    rootMountEl = nextMountEl;
    rootEl.classList.toggle("ytal-in-fullscreen", rootMountEl !== document.body);
    syncToastMountTarget();
    schedulePlacementUpdate();
  }

  function ensureNativeTimelineOverlay() {
    const host = getNativeTimelineHost();
    if (!host) return null;

    if (nativeRangeEl && nativeRangeEl.parentElement !== host) {
      nativeRangeEl.remove();
      nativeRangeEl = null;
      nativeMarkerAEl = null;
      nativeMarkerBEl = null;
    }

    if (!nativeRangeEl) {
      nativeRangeEl = document.createElement("div");
      nativeRangeEl.className = "ytal-native-range";
      host.appendChild(nativeRangeEl);

      nativeMarkerAEl = document.createElement("div");
      nativeMarkerAEl.className = "ytal-native-marker is-a";
      nativeMarkerAEl.setAttribute("aria-hidden", "true");
      host.appendChild(nativeMarkerAEl);

      nativeMarkerBEl = document.createElement("div");
      nativeMarkerBEl.className = "ytal-native-marker is-b";
      nativeMarkerBEl.setAttribute("aria-hidden", "true");
      host.appendChild(nativeMarkerBEl);
    }

    return nativeRangeEl;
  }

  function updateNativeTimelineOverlay(canLoop, duration) {
    if (!duration) {
      if (nativeRangeEl) nativeRangeEl.style.display = "none";
      if (nativeMarkerAEl) nativeMarkerAEl.style.display = "none";
      if (nativeMarkerBEl) nativeMarkerBEl.style.display = "none";
      return;
    }

    const overlay = ensureNativeTimelineOverlay();
    if (!overlay) return;

    const startRatio = getTimelineRatio(pointA, duration);
    const endRatio = getTimelineRatio(pointB, duration);

    if (typeof pointA === "number" && nativeMarkerAEl) {
      nativeMarkerAEl.style.display = "flex";
      nativeMarkerAEl.style.left = `${startRatio * 100}%`;
    } else if (nativeMarkerAEl) {
      nativeMarkerAEl.style.display = "none";
    }

    if (typeof pointB === "number" && nativeMarkerBEl) {
      nativeMarkerBEl.style.display = "flex";
      nativeMarkerBEl.style.left = `${endRatio * 100}%`;
    } else if (nativeMarkerBEl) {
      nativeMarkerBEl.style.display = "none";
    }

    if (!canLoop) {
      overlay.style.display = "none";
      return;
    }

    overlay.style.display = "block";
    overlay.style.left = `${startRatio * 100}%`;
    overlay.style.width = `${Math.max((endRatio - startRatio) * 100, 0)}%`;
  }

  function schedulePlacementUpdate() {
    if (placementFrame !== null) return;

    placementFrame = window.requestAnimationFrame(() => {
      placementFrame = null;
      updateRootPlacement();
    });
  }

  function getLauncherElement() {
    if (rootMountEl !== document.body) {
      return document.getElementById("ytal-reveal-panel");
    }
    if (inlineLauncherEl?.isConnected) {
      return inlineLauncherEl;
    }
    return document.getElementById("ytal-reveal-panel");
  }

  function removeIdsFromClone(node) {
    if (!node) return;
    if (node.removeAttribute) {
      node.removeAttribute("id");
      node.removeAttribute("for");
      node.removeAttribute("aria-controls");
      node.removeAttribute("aria-labelledby");
      node.removeAttribute("aria-describedby");
    }
    if (node.querySelectorAll) {
      node.querySelectorAll("[id],[for],[aria-controls],[aria-labelledby],[aria-describedby]").forEach((el) => {
        el.removeAttribute("id");
        el.removeAttribute("for");
        el.removeAttribute("aria-controls");
        el.removeAttribute("aria-labelledby");
        el.removeAttribute("aria-describedby");
      });
    }
  }

  function createTransitionGhost(sourceEl, rect) {
    const ghost = sourceEl.cloneNode(true);
    removeIdsFromClone(ghost);
    ghost.classList.add("ytal-transition-ghost");
    ghost.style.position = "fixed";
    ghost.style.top = `${rect.top}px`;
    ghost.style.left = `${rect.left}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.margin = "0";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "2147483647";
    ghost.style.transformOrigin = "top left";
    document.body.appendChild(ghost);
    return ghost;
  }

  async function animateCollapseTransition() {
    if (!rootEl || isCollapsed) return;

    const startRect = rootEl.getBoundingClientRect();
    const startRadius = window.getComputedStyle(rootEl).borderRadius;
    const ghost = createTransitionGhost(rootEl, startRect);

    isCollapsed = true;
    isFullscreenPeekVisible = rootMountEl !== document.body;
    rootEl.classList.toggle("ytal-collapsed", true);
    updateRootPlacement();
    updateUI();

    const targetEl = getLauncherElement();
    const endRect = targetEl?.getBoundingClientRect() || rootEl.getBoundingClientRect();
    const endRadius = window.getComputedStyle(targetEl || rootEl).borderRadius;
    const deltaX = endRect.left - startRect.left;
    const deltaY = endRect.top - startRect.top;
    const scaleX = Math.max(endRect.width / Math.max(startRect.width, 1), 0.08);
    const scaleY = Math.max(endRect.height / Math.max(startRect.height, 1), 0.08);

    if (typeof ghost.animate === "function") {
      const animation = ghost.animate(
        [
          {
            transform: "translate(0, 0) scale(1)",
            opacity: 1,
            borderRadius: startRadius,
          },
          {
            transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`,
            opacity: 0.22,
            borderRadius: endRadius,
          },
        ],
        {
          duration: PANEL_TRANSITION_MS,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "forwards",
        }
      );
      await animation.finished.catch(() => {});
    }

    ghost.remove();
    if (rootMountEl !== document.body) {
      scheduleFullscreenPeekHide();
    }
    await saveUiState();
  }

  async function animateExpandTransition() {
    if (!rootEl || !isCollapsed) return;

    const launcherEl = getLauncherElement();
    const startRect = launcherEl?.getBoundingClientRect();
    const startRadius = window.getComputedStyle(launcherEl || rootEl).borderRadius;

    isCollapsed = false;
    isFullscreenPeekVisible = false;
    clearFullscreenPeekTimer();
    rootEl.classList.toggle("ytal-collapsed", false);
    updateRootPlacement();
    updateUI();

    const endRect = rootEl.getBoundingClientRect();
    const endRadius = window.getComputedStyle(rootEl).borderRadius;

    if (startRect && typeof rootEl.animate === "function") {
      const deltaX = startRect.left - endRect.left;
      const deltaY = startRect.top - endRect.top;
      const scaleX = Math.max(startRect.width / Math.max(endRect.width, 1), 0.08);
      const scaleY = Math.max(startRect.height / Math.max(endRect.height, 1), 0.08);

      const animation = rootEl.animate(
        [
          {
            transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`,
            opacity: 0.28,
            borderRadius: startRadius,
          },
          {
            transform: "translate(0, 0) scale(1)",
            opacity: 1,
            borderRadius: endRadius,
          },
        ],
        {
          duration: PANEL_TRANSITION_MS,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "both",
        }
      );
      await animation.finished.catch(() => {});
    }

    await saveUiState();
  }

  function updateRootPlacement() {
    if (!rootEl) return;

    syncRootMountTarget();
    syncInlineLauncher();

    if (rootMountEl && rootMountEl !== document.body) {
      rootEl.classList.remove("ytal-docked");
      rootEl.classList.add("ytal-in-fullscreen");
      rootEl.style.top = isCollapsed ? "12px" : "16px";
      rootEl.style.right = isCollapsed ? "12px" : "16px";
      rootEl.style.left = "auto";
      rootEl.style.bottom = "auto";
      return;
    }

    rootEl.classList.remove("ytal-in-fullscreen");

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
      rootEl.style.top = "96px";
      rootEl.style.right = "12px";
      rootEl.style.left = "auto";
      rootEl.style.bottom = "auto";
      return;
    }

    const rect = playerEl.getBoundingClientRect();
    const collapsedWidth = rootEl.offsetWidth || 132;
    const top = Math.max(16, rect.top + 16);
    const left = Math.max(
      16,
      Math.min(rect.right - collapsedWidth + 10, window.innerWidth - collapsedWidth - 12)
    );

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
    document.addEventListener("mousemove", () => {
      if (rootMountEl !== document.body && isCollapsed) {
        showFullscreenPeekTemporarily();
      }
    }, true);
    document.addEventListener("fullscreenchange", schedulePlacementUpdate);
    document.addEventListener("webkitfullscreenchange", schedulePlacementUpdate);
    document.addEventListener("mozfullscreenchange", schedulePlacementUpdate);
    document.addEventListener("MSFullscreenChange", schedulePlacementUpdate);
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
      <button class="ytal-peek-btn" id="ytal-reveal-panel" type="button" title="${t("tipExpand")}" aria-label="${t("tipExpand")}">
        <span class="ytal-peek-btn-icon">&#x21bb;</span>
        <span class="ytal-peek-btn-text">${t("hiddenTab")}</span>
      </button>
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
          <button class="ytal-collapse-btn" id="ytal-toggle-collapse" title="${t("tipCollapse")}" aria-label="${t("tipCollapse")}">
            &#x2715;
          </button>
        </div>
      </div>

      <div class="ytal-body">
        <div class="ytal-timeline-card">
          <div class="ytal-timeline-topbar">
            <button class="ytal-reset-btn" id="ytal-reset-selection" type="button" title="${t("tipReset")}" aria-label="${t("resetSelection")}">&#x21ba;</button>
          </div>
          <button class="ytal-timeline-track" id="ytal-timeline-track" type="button" aria-label="${t("timelineHint")}" role="slider">
            <span class="ytal-timeline-fill" id="ytal-timeline-fill"></span>
            <span class="ytal-timeline-range" id="ytal-timeline-range"></span>
            <span class="ytal-timeline-current" id="ytal-timeline-current"></span>
            <span class="ytal-timeline-marker is-a" id="ytal-marker-a">A</span>
            <span class="ytal-timeline-marker is-b" id="ytal-marker-b">B</span>
          </button>
          <div class="ytal-timeline-copy">
            <div class="ytal-timeline-status" id="ytal-timeline-status">${getTimelineStatus()}</div>
          </div>
          <div class="ytal-range-summary" id="ytal-range-summary">${t("rangeSummaryPending")}</div>
        </div>

        <div class="ytal-btn-row">
          <button class="ytal-btn ytal-btn-loop" id="ytal-loop-btn" title="${t("tipLoop")}">${t("loop")}</button>
          <button class="ytal-btn ytal-btn-save" id="ytal-save-btn" title="${t("tipSave")}">${t("save")}</button>
        </div>

        <div class="ytal-section-label">${t("savedSegments")}</div>
        <div id="ytal-segment-list" class="ytal-list"></div>

        <button class="ytal-help-toggle" id="ytal-help-toggle" title="${t("tipShortcuts")}">
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

    rootMountEl = getRootMountTarget();
    rootMountEl.appendChild(rootEl);
    rootEl.classList.toggle("ytal-in-fullscreen", rootMountEl !== document.body);
    syncToastMountTarget();
    schedulePlacementUpdate();

    document
      .getElementById("ytal-toggle-collapse")
      .addEventListener("click", animateCollapseTransition);

    document
      .getElementById("ytal-reveal-panel")
      .addEventListener("click", animateExpandTransition);

    document
      .getElementById("ytal-lang-select")
      .addEventListener("change", async (e) => {
        lang = e.target.value;
        await saveUiState();
        updateUI();
        await renderSegments();
      });

    const trackEl = document.getElementById("ytal-timeline-track");
    const markerAEl = document.getElementById("ytal-marker-a");
    const markerBEl = document.getElementById("ytal-marker-b");

    function getTimeFromMouseEvent(e) {
      const rect = trackEl.getBoundingClientRect();
      const ratio = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
      const video = getVideo();
      return ratio * (video?.duration || 0);
    }

    function startDrag(mode, e) {
      dragMode = mode;
      document.body.style.userSelect = "none";
      if (mode === "markerA") markerAEl.classList.add("dragging");
      if (mode === "markerB") markerBEl.classList.add("dragging");
      e.preventDefault();
      e.stopPropagation();
    }

    markerAEl.addEventListener("mousedown", (e) => startDrag("markerA", e));
    markerBEl.addEventListener("mousedown", (e) => startDrag("markerB", e));

    trackEl.addEventListener("mousedown", (e) => {
      if (e.target === markerAEl) return;
      if (e.target === markerBEl) return;
      const video = getVideo();
      if (!video || !video.duration) return;

      const time = getTimeFromMouseEvent(e);
      if (typeof pointA === "number" && typeof pointB === "number") {
        const distA = Math.abs(time - pointA);
        const distB = Math.abs(time - pointB);
        startDrag(distA <= distB ? "markerA" : "markerB", e);
      } else if (typeof pointA !== "number") {
        pointA = time;
        stopLoop();
        updateUI();
        startDrag("markerB", e);
      } else {
        startDrag("markerB", e);
      }
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragMode) return;
      const video = getVideo();
      if (!video || !video.duration) return;

      const time = getTimeFromMouseEvent(e);
      if (dragMode === "markerA") {
        activeSegmentId = null;
        pointA = typeof pointB === "number"
          ? Math.max(0, Math.min(time, pointB - MIN_GAP))
          : Math.max(0, time);
      } else if (dragMode === "markerB") {
        activeSegmentId = null;
        pointB = typeof pointA === "number"
          ? Math.min(video.duration, Math.max(time, pointA + MIN_GAP))
          : Math.min(video.duration, time);
      }
      stopLoop();
      updateUI();
    });

    document.addEventListener("mouseup", () => {
      if (!dragMode) return;
      markerAEl?.classList.remove("dragging");
      markerBEl?.classList.remove("dragging");
      dragMode = null;
      document.body.style.userSelect = "";
      renderSegments();
    });

    document
      .getElementById("ytal-loop-btn")
      .addEventListener("click", toggleLoop);

    document
      .getElementById("ytal-save-btn")
      .addEventListener("click", () => saveSegment({ showToastOnSave: true }));

    document
      .getElementById("ytal-reset-selection")
      .addEventListener("click", () => {
        clearCurrentSelection();
        updateUI();
        renderSegments();
      });

    document
      .getElementById("ytal-help-toggle")
      .addEventListener("click", async () => {
        isHelpOpen = !isHelpOpen;
        updateUI();
        schedulePlacementUpdate();
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
          setPointAToCurrent({ showToastOnSet: true });
        } else if (code === "KeyB") {
          e.preventDefault();
          e.stopPropagation();
          setPointBToCurrent({ showToastOnSet: true });
        } else if (code === "KeyL") {
          e.preventDefault();
          e.stopPropagation();
          toggleLoop({ showToastOnChange: true });
        } else if (code === "KeyS") {
          e.preventDefault();
          e.stopPropagation();
          saveSegment({ showToastOnSave: true });
        } else if (
          code === "Minus" ||
          code === "NumpadSubtract"
        ) {
          e.preventDefault();
          e.stopPropagation();
          await setActiveSegmentPlaybackRate(-1);
        } else if (
          code === "Equal" ||
          code === "NumpadAdd"
        ) {
          e.preventDefault();
          e.stopPropagation();
          await setActiveSegmentPlaybackRate(1);
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
  function initDefaultABPoints() {
    pointA = 0;
    const video = getVideo();
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      pointB = video.duration;
    } else if (video) {
      const onDuration = () => {
        if (Number.isFinite(video.duration) && video.duration > 0 && pointB === null) {
          pointB = video.duration;
          updateUI();
        }
        video.removeEventListener("durationchange", onDuration);
        video.removeEventListener("loadedmetadata", onDuration);
      };
      video.addEventListener("durationchange", onDuration);
      video.addEventListener("loadedmetadata", onDuration);
    }
  }

  function startWatcher() {
    stopWatcher();

    intervalId = window.setInterval(() => {
      const video = getVideo();
      if (!video) return;

      if (activeSegmentId === null) {
        defaultPlaybackRate = normalizePlaybackRate(video.playbackRate);
      }

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

      updateUI();
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
    clearFullscreenPeekTimer();
    activeSegmentId = null;
    pointA = null;
    pointB = null;
    isLooping = false;
    defaultPlaybackRate = 1;
    restorePlaybackRate = null;
    isFullscreenPeekVisible = false;

    if (nativeRangeEl) {
      nativeRangeEl.remove();
      nativeRangeEl = null;
    }
    if (nativeMarkerAEl) {
      nativeMarkerAEl.remove();
      nativeMarkerAEl = null;
    }
    if (nativeMarkerBEl) {
      nativeMarkerBEl.remove();
      nativeMarkerBEl = null;
    }

    if (rootEl) {
      rootEl.remove();
      rootEl = null;
    }

    if (toastEl) {
      toastEl.remove();
      toastEl = null;
    }

    if (inlineLauncherEl) {
      inlineLauncherEl.remove();
      inlineLauncherEl = null;
    }

  }

  // ── Init ──
  async function resetForVideoChange() {
    currentVideoId = getVideoId();
    teardownRoot();

    if (!isWatchPage() || !currentVideoId) {
      return;
    }

    initDefaultABPoints();
    await loadUiState();
    createRoot();
    await renderSegments();
    updateUI();
    startWatcher();
  }

  async function init() {
    await loadUiState();
    currentVideoId = getVideoId();
    initDefaultABPoints();
    createRoot();
    await renderSegments();
    updateUI();
    startWatcher();
    showToast(t("toastShortcutsIntro"));
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
