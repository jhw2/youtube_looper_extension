(() => {
  if (window.__YT_AB_LOOPER_LOADED__) return;
  window.__YT_AB_LOOPER_LOADED__ = true;

  const STORAGE_SEGMENTS_KEY = "yt-ab-looper-segments";
  const STORAGE_UI_KEY = "yt-ab-looper-ui";
  const STORAGE_SEG_PREFIX = "yt-ab-seg-";
  const LOOP_INTERVAL_MS = 120;
  const LOOP_END_BUFFER_MIN_SECONDS = 0.18;
  const MIN_GAP = 0.1;
  const PLAYBACK_RATE_STEP = 0.05;
  const PANEL_TRANSITION_MS = 260;
  const FULLSCREEN_PEEK_HIDE_MS = 2400;
  const VIDEO_ZOOM_STEP = 0.1;
  const VIDEO_ZOOM_MIN = 1;
  const VIDEO_ZOOM_MAX = 3;
  const VIDEO_PAN_STEP = 6;
  const COUNTDOWN_OPTIONS = Object.freeze(["off", "1", "2", "3"]);
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

  let pointA = null;
  let pointB = null;
  let activeSegmentId = null;
  let activeSegmentTitle = "";
  let isLooping = false;
  let isPlaylistLooping = false;
  let isPlaylistAdvancing = false;
  let draggedSegmentId = null;
  let segmentsRendering = false;
  let intervalId = null;
  let boundVideoEl = null;
  let currentVideoId = null;
  let defaultPlaybackRate = 1;
  let restorePlaybackRate = null;
  let editingSegmentId = null;
  let transientStatus = "";
  let transientStatusTone = "neutral";
  let transientStatusTimer = null;
  let toastMessage = "";
  let toastTone = "neutral";
  let toastTimer = null;
  let fullscreenPeekTimer = null;
  let countdownMode = "off";
  let countdownRunId = 0;
  let isCountdownActive = false;
  let countdownOverlayMessage = "";
  let isLoopRestartPending = false;

  let isCollapsed = false;
  let isHelpOpen = false;
  let isZoomOpen = false;
  let lang = "en";
  let videoZoom = 1;
  let videoPanX = 0;
  let videoPanY = 0;
  let shortcuts = { ...DEFAULT_SHORTCUTS };

  let rootEl = null;
  let toastEl = null;
  let countdownOverlayEl = null;
  let inlineLauncherEl = null;
  let zoomLauncherEl = null;
  let zoomPopupEl = null;
  let nativeRangeEl = null;
  let nativeMarkerAEl = null;
  let nativeMarkerBEl = null;
  let placementFrame = null;
  let hasWindowListeners = false;
  let dragMode = null; // 'markerA' | 'markerB'
  let rootMountEl = null;
  let isFullscreenPeekVisible = false;
  let hasTrackedPageView = false;

  // ── i18n ──
  const i18n = {
    ko: {
      timelineHint: "마커를 드래그해서 구간 조정",
      timelineStatusEmpty: "A·B 마커를 드래그해서 구간을 설정하세요",
      timelineStatusAwaitEnd: "B 마커를 드래그해서 끝점을 설정하세요",
      timelineStatusReady: "마커를 드래그해서 구간 조정",
      resetSelection: "선택 리셋",
      resetSelectionDesc: "현재 A-B 구간 지우기",
      loop: "반복 하기",
      loopCurrent: "구간 반복",
      loopSelected: (title) => `${title} 반복`,
      loopingCurrent: "구간 반복중...",
      loopingSelected: (title) => `${title} 반복중...`,
      loopDesc: "지금 설정한 구간을 반복 재생",
      loopCurrentDesc: "지금 설정한 구간만 반복",
      loopSelectedDesc: (title) => `${title} 구간만 반복`,
      save: "목록에 저장",
      saveDesc: "나중에 다시 불러오기",
      rangeSummaryPending: "구간을 선택하면 여기에 시작과 끝 시간이 표시됩니다.",
      rangeSummaryReady: (start, end) => `${start} ~ ${end}`,
      toastRangeUpdated: (start, end) => `구간 시간을 수정했어요. ${start} ~ ${end}`,
      toastRangeInvalid: "시간 형식이 올바르지 않습니다. 12.5 또는 1:23.4처럼 입력해 주세요.",
      savedNotice: "저장됨. 바로 반복하거나 다른 구간을 선택할 수 있어요.",
      toastPointA: (time) => `루프 시작 구간을 찍었어요. A = ${time}`,
      toastPointB: (time) => `루프 끝 구간을 찍었어요. B = ${time}`,
      toastSegmentSaved: (title, start, end, shortcut) =>
        shortcut
          ? `${title} 구간을 저장했어요. ${start} ~ ${end} · 불러오기는 ${shortcut}번 · 순서를 바꾸면 숫자 단축키도 함께 바뀌어요 · 배속은 + / -`
          : `${title} 구간을 저장했어요. ${start} ~ ${end} · 배속은 + / -`,
      toastSegmentExists: (index, title, start, end) =>
        `이미 저장된 구간이에요. ${index}번 ${title} · ${start} ~ ${end}`,
      toastLoopOn: (start, end) => `AB 루프를 시작했어요. ${start} ~ ${end}`,
      toastLoopOff: "AB 루프를 멈췄어요.",
      playlistLoop: "구간 전체 반복",
      playlistLooping: "구간 전체 반복중...",
      playlistLoopDesc: "저장한 구간을 처음부터 순서대로 반복",
      playlistEmpty: "저장한 구간이 있어야 구간 전체 반복을 시작할 수 있어요.",
      toastPlaylistLoopOn: "저장한 구간 전체 반복을 시작했어요.",
      toastPlaylistLoopOff: "구간 전체 반복을 멈췄어요.",
      toastPlaylistToLoopOn: (start, end) =>
        `구간 전체 반복을 끝내고 현재 구간 반복으로 전환했어요. ${start} ~ ${end}`,
      toastShortcutsIntro: (setA, setB, loop, loopAll, save, reset) =>
        `단축키: ${setA} (시작), ${setB} (끝), ${loop} (구간 반복), ${loopAll} (구간 전체 반복), ${save} (저장), 1-9 (현재 목록 순서대로 불러오기), ${reset} (리셋), + / - (구간 배속), Alt + = / - / Arrow / 0 (확대)`,
      savedSegments: "저장한 구간",
      shortcuts: "단축키",
      hideShortcuts: "단축키 숨기기",
      zoomSection: "보기 보조",
      zoomToggle: "Zoom",
      zoomHide: "Zoom 닫기",
      zoomLabel: "영상 확대",
      zoomViewportLabel: "현재 보는 위치",
      zoomViewportEmpty: "확대하면 전체 프레임 안에서 보고 있는 위치가 여기 표시됩니다.",
      zoomViewportHint: "전체 프레임 기준",
      zoomViewportZoom: (value) => `${Math.round(value * 100)}% 확대`,
      zoomViewportGuide: "미니맵을 클릭하거나 드래그해서 위치 이동",
      countdownLabel: "Count",
      countdownOff: "Off",
      countdownSeconds: (value) => `${value}s`,
      countdownStartingIn: (value) => `${value} 후 시작`,
      countdownStartingNow: "시작",
      zoomIn: "확대",
      zoomOut: "축소",
      zoomReset: "초기화",
      zoomResetDesc: "배율과 위치 리셋",
      zoomPosition: "방향 이동",
      panUp: "위로",
      panDown: "아래로",
      panLeft: "왼쪽",
      panRight: "오른쪽",
      zoomValue: (value) => `${Math.round(value * 100)}%`,
      noSegments: "아직 저장한 구간이 없습니다.",
      emptyGuide: "재생바의 A·B 마커를 드래그하거나 키보드 A·B 키로 구간을 설정한 뒤 루프나 저장을 사용해 보세요.",
      delete: "삭제",
      editTitle: "이름 수정",
      editTitlePlaceholder: "구간 이름",
      toastSetAB: "A와 B를 먼저 올바르게 설정해 주세요.",
      toastSetA: "먼저 A 지점을 설정해 주세요.",
      toastNoSegment: "저장할 수 있는 A-B 구간이 없습니다.",
      toastNoActive: "삭제할 활성 구간이 없습니다.",
      toastNoActiveSaved: "현재 활성화된 저장 구간이 없습니다.",
      toastEmptyName: "이름은 비워둘 수 없습니다.",
      toastTitleUpdated: "구간 이름을 바꿨어요.",
      speedDown: "배속 낮추기",
      speedUp: "배속 높이기",
      speedInput: "배속 직접 입력",
      reorder: "순서 바꾸기",
      speedValue: (value) => `${value}x`,
      segmentDefault: (n) => `구간${n}`,
      toastSegmentsReordered: "저장한 구간 순서를 바꿨어요.",
      toastSpeedInvalid: "배속은 0.05에서 16 사이 숫자로 입력해 주세요.",
      toastSpeedUpdated: (value) => `배속을 ${value}x로 바꿨어요.`,
      helpSetA: "A 지점 설정",
      helpSetB: "B 지점 설정",
      helpLoop: "구간 반복 켜기/끄기",
      helpPlaylistLoop: "구간 전체 반복 켜기/끄기",
      helpReset: "선택 리셋",
      helpSave: "구간 저장",
      helpLoad: "저장된 구간 불러오기 (현재 목록 순서)",
      helpSpeed: "활성 구간 배속 조절",
      helpDelete: "활성 구간 삭제",
      helpStop: "루프 정지",
      helpZoom: "영상 확대/축소",
      helpPan: "확대 영상 이동",
      helpZoomReset: "영상 확대 초기화",
      tipLoop: (shortcut) => `반복 하기 (${shortcut})`,
      tipSave: (shortcut) => `목록에 저장 (${shortcut})`,
      tipReset: (shortcut) => `선택 리셋 (${shortcut})`,
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
      resetSelectionDesc: "Clear the current A-B range",
      loop: "Play Loop",
      loopCurrent: "Loop Range",
      loopSelected: (title) => `Loop ${title}`,
      loopingCurrent: "Looping Range...",
      loopingSelected: (title) => `Looping ${title}...`,
      loopDesc: "Repeat the range you just set",
      loopCurrentDesc: "Loop only the range you just set",
      loopSelectedDesc: (title) => `Loop only ${title}`,
      save: "Save to List",
      saveDesc: "Recall it later",
      rangeSummaryPending: "Once you select a range, the start and end times will appear here.",
      rangeSummaryReady: (start, end) => `${start} ~ ${end}`,
      toastRangeUpdated: (start, end) => `Segment time updated. ${start} ~ ${end}`,
      toastRangeInvalid: "Invalid time format. Try 12.5 or 1:23.4.",
      savedNotice: "Saved. Press 'Play Loop' to start looping it.",
      toastPointA: (time) => `Loop start marked. A = ${time}`,
      toastPointB: (time) => `Loop end marked. B = ${time}`,
      toastSegmentSaved: (title, start, end, shortcut) =>
        shortcut
          ? `Saved ${title}. ${start} ~ ${end}. Load: ${shortcut}. Number shortcuts follow the current list order. Speed: + / -`
          : `Saved ${title}. ${start} ~ ${end}. Speed: + / -`,
      toastSegmentExists: (index, title, start, end) =>
        `This range is already saved as ${index}. ${title} · ${start} ~ ${end}`,
      toastLoopOn: (start, end) => `AB loop started. ${start} ~ ${end}`,
      toastLoopOff: "AB loop stopped.",
      playlistLoop: "Loop All Segments",
      playlistLooping: "Looping All Segments...",
      playlistLoopDesc: "Loop saved segments from the beginning in order",
      playlistEmpty: "Save at least one segment to start looping all segments.",
      toastPlaylistLoopOn: "Looping all saved segments started.",
      toastPlaylistLoopOff: "Looping all segments stopped.",
      toastPlaylistToLoopOn: (start, end) =>
        `Looping all segments ended and AB loop started for the current range. ${start} ~ ${end}`,
      toastShortcutsIntro: (setA, setB, loop, loopAll, save, reset) =>
        `Shortcuts: ${setA} (start), ${setB} (end), ${loop} (loop range), ${loopAll} (loop all segments), ${save} (save), 1-9 (load by current list order), ${reset} (reset), + / - (segment speed), Alt + = / - / Arrow / 0 (zoom)`,
      savedSegments: "Saved Segments",
      shortcuts: "Shortcuts",
      hideShortcuts: "Hide Shortcuts",
      zoomSection: "View Helper",
      zoomToggle: "Zoom",
      zoomHide: "Hide Zoom",
      zoomLabel: "Video Zoom",
      zoomViewportLabel: "Current View",
      zoomViewportEmpty: "When zoomed in, this shows where you are inside the full frame.",
      zoomViewportHint: "Full-frame reference",
      zoomViewportZoom: (value) => `${Math.round(value * 100)}% zoom`,
      zoomViewportGuide: "Click or drag the minimap to move the view",
      countdownLabel: "Count",
      countdownOff: "Off",
      countdownSeconds: (value) => `${value}s`,
      countdownStartingIn: (value) => `Starting in ${value}`,
      countdownStartingNow: "Start",
      zoomIn: "Zoom In",
      zoomOut: "Zoom Out",
      zoomReset: "Reset",
      zoomResetDesc: "Reset zoom and position",
      zoomPosition: "Move Frame",
      panUp: "Up",
      panDown: "Down",
      panLeft: "Left",
      panRight: "Right",
      zoomValue: (value) => `${Math.round(value * 100)}%`,
      noSegments: "No saved segments yet.",
      emptyGuide: "Drag the A·B markers on the timeline, or use the A and B keys, to set your range, then use Loop or Save.",
      delete: "Delete",
      editTitle: "Edit name",
      editTitlePlaceholder: "Segment name",
      toastSetAB: "Please set A and B points first.",
      toastSetA: "Please set point A first.",
      toastNoSegment: "No A-B segment to save.",
      toastNoActive: "No active segment to delete.",
      toastNoActiveSaved: "No active saved segment.",
      toastEmptyName: "Name cannot be empty.",
      toastTitleUpdated: "Segment name updated.",
      speedDown: "Decrease speed",
      speedUp: "Increase speed",
      speedInput: "Type playback speed",
      reorder: "Reorder",
      speedValue: (value) => `${value}x`,
      segmentDefault: (n) => `Segment ${n}`,
      toastSegmentsReordered: "Saved segments reordered.",
      toastSpeedInvalid: "Enter a playback rate between 0.05 and 16.",
      toastSpeedUpdated: (value) => `Playback speed set to ${value}x.`,
      helpSetA: "Set A point",
      helpSetB: "Set B point",
      helpLoop: "Toggle range loop",
      helpPlaylistLoop: "Toggle loop all segments",
      helpReset: "Reset selection",
      helpSave: "Save segment",
      helpLoad: "Load segment (current list order)",
      helpSpeed: "Adjust active segment speed",
      helpDelete: "Delete active",
      helpStop: "Stop loop",
      helpZoom: "Zoom video in or out",
      helpPan: "Pan the zoomed video",
      helpZoomReset: "Reset video zoom",
      tipLoop: (shortcut) => `Play Loop (${shortcut})`,
      tipSave: (shortcut) => `Save to List (${shortcut})`,
      tipReset: (shortcut) => `Reset selection (${shortcut})`,
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

  function normalizeShortcutValue(value) {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toUpperCase();
    return /^[A-Z]$/.test(normalized) ? normalized : null;
  }

  function sanitizeShortcutConfig(config) {
    const next = {};
    const used = new Set();
    const fallbackValues = SHORTCUT_ACTION_ORDER.map((action) =>
      normalizeShortcutValue(DEFAULT_SHORTCUTS[action])
    );

    SHORTCUT_ACTION_ORDER.forEach((action) => {
      const preferred =
        normalizeShortcutValue(config?.[action]) ||
        normalizeShortcutValue(DEFAULT_SHORTCUTS[action]);

      if (preferred && !used.has(preferred)) {
        next[action] = preferred;
        used.add(preferred);
        return;
      }

      const fallback = fallbackValues.find((candidate) => candidate && !used.has(candidate));
      next[action] = fallback || normalizeShortcutValue(DEFAULT_SHORTCUTS[action]);
      used.add(next[action]);
    });

    return next;
  }

  function getShortcutValue(action) {
    return shortcuts[action] || DEFAULT_SHORTCUTS[action];
  }

  function formatShortcutLabel(action, options = {}) {
    const { shift = false } = options;
    const value = getShortcutValue(action);
    return shift ? `Shift + ${value}` : value;
  }

  function getShortcutToastText() {
    return t("toastShortcutsIntro")(
      formatShortcutLabel("setPointA"),
      formatShortcutLabel("setPointB"),
      formatShortcutLabel("loop"),
      formatShortcutLabel("loop", { shift: true }),
      formatShortcutLabel("save"),
      formatShortcutLabel("reset")
    );
  }

  function getShortcutEventValue(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return null;
    const match = /^Key([A-Z])$/.exec(event.code || "");
    return match ? match[1] : null;
  }

  function matchesShortcut(event, action, options = {}) {
    const { shift = false } = options;
    if (event.shiftKey !== shift) return false;
    return getShortcutEventValue(event) === getShortcutValue(action);
  }

  function buttonMarkup(label, description) {
    return `
      <span class="ytal-btn-label">${label}</span>
      <span class="ytal-btn-desc">${description}</span>
    `;
  }

  function resetButtonMarkup(label) {
    return `
      <span class="ytal-reset-btn-icon" aria-hidden="true">&#x21ba;</span>
      <span class="ytal-reset-btn-text">${label}</span>
    `;
  }

  function getActiveSegmentDisplayTitle() {
    return activeSegmentTitle || t("savedSegments");
  }

  function getLoopButtonLabel(canLoop) {
    if (!canLoop) return t("loop");
    if (activeSegmentId !== null) {
      const title = getActiveSegmentDisplayTitle();
      return isLooping ? t("loopingSelected")(title) : t("loopSelected")(title);
    }
    return isLooping ? t("loopingCurrent") : t("loopCurrent");
  }

  function getLoopButtonDescription(canLoop) {
    if (!canLoop) return t("loopDesc");
    if (activeSegmentId !== null) {
      return t("loopSelectedDesc")(getActiveSegmentDisplayTitle());
    }
    return t("loopCurrentDesc");
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

  function trackAnalyticsEvent(eventName, params = {}) {
    try {
      chrome.runtime.sendMessage({
        type: "trackAnalyticsEvent",
        eventName,
        params,
      });
    } catch (_error) {
      // Ignore analytics failures so the core extension flow stays unaffected.
    }
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

  function isAdShowing() {
    const player = document.querySelector("#movie_player");
    if (player?.classList.contains("ad-showing")) {
      return true;
    }

    return Boolean(
      document.querySelector(
        [
          ".video-ads.ytp-ad-module",
          ".ytp-ad-player-overlay",
          ".ytp-ad-preview-container",
          ".ytp-ad-text",
        ].join(", ")
      )
    );
  }

  function getLoopEndBuffer(video) {
    const playbackRate = normalizePlaybackRate(video?.playbackRate ?? 1);
    return Math.max(LOOP_INTERVAL_MS / 1000, LOOP_END_BUFFER_MIN_SECONDS) * Math.max(playbackRate, 1);
  }

  function shouldTriggerLoopBoundary(video) {
    if (
      !video ||
      typeof pointA !== "number" ||
      typeof pointB !== "number" ||
      pointB <= pointA
    ) {
      return false;
    }

    const loopEndBuffer = Math.min(getLoopEndBuffer(video), Math.max((pointB - pointA) / 2, MIN_GAP));
    return video.currentTime + loopEndBuffer >= pointB;
  }

  function handleLoopBoundary(video) {
    if (isCountdownActive || isLoopRestartPending) return false;
    if (isAdShowing()) return false;
    if (!shouldTriggerLoopBoundary(video)) return false;

    if (isPlaylistLooping) {
      advancePlaylistLoop();
      return true;
    }

    if (isLooping) {
      restartLoopWithCountdown(video);
      return true;
    }

    return false;
  }

  function handleVideoEnded() {
    const video = getVideo();
    if (!video) return;
    handleLoopBoundary(video);
  }

  function bindVideoLoopEvents() {
    const video = getVideo();
    if (boundVideoEl === video) return;

    if (boundVideoEl) {
      boundVideoEl.removeEventListener("ended", handleVideoEnded);
    }

    boundVideoEl = video;

    if (boundVideoEl) {
      boundVideoEl.addEventListener("ended", handleVideoEnded);
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

  function formatEditableTime(seconds) {
    if (typeof seconds !== "number" || Number.isNaN(seconds)) return "";
    return seconds.toFixed(1).replace(/\.0$/, "");
  }

  function parseTimeInput(value) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return null;

    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
      const seconds = Number(trimmed);
      return Number.isFinite(seconds) ? seconds : null;
    }

    const parts = trimmed.split(":");
    if (parts.length < 2 || parts.length > 3) return null;

    const numbers = parts.map((part) => Number(part.trim()));
    if (numbers.some((part) => !Number.isFinite(part) || part < 0)) {
      return null;
    }

    if (parts.length === 2) {
      return numbers[0] * 60 + numbers[1];
    }

    return numbers[0] * 3600 + numbers[1] * 60 + numbers[2];
  }

  function normalizePlaybackRate(value) {
    const rate = Number(value);
    if (!Number.isFinite(rate)) return 1;
    return Math.min(16, Math.max(0.05, Math.round(rate * 100) / 100));
  }

  function getPlaybackRateLabel(value) {
    return t("speedValue")(normalizePlaybackRate(value).toFixed(2).replace(/\.?0+$/, ""));
  }

  function formatEditablePlaybackRate(value) {
    return normalizePlaybackRate(value).toFixed(2);
  }

  function parsePlaybackRateInput(value) {
    const trimmed = String(value ?? "")
      .trim()
      .replace(/x$/i, "");
    if (!trimmed) return null;
    if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;

    const rate = Number(trimmed);
    if (!Number.isFinite(rate) || rate < 0.05 || rate > 16) {
      return null;
    }

    return normalizePlaybackRate(rate);
  }

  function normalizeVideoZoom(value) {
    const zoom = Number(value);
    if (!Number.isFinite(zoom)) return VIDEO_ZOOM_MIN;
    return Math.min(
      VIDEO_ZOOM_MAX,
      Math.max(VIDEO_ZOOM_MIN, Math.round(zoom / VIDEO_ZOOM_STEP) * VIDEO_ZOOM_STEP)
    );
  }

  function getVideoPanLimit(zoom = videoZoom) {
    if (zoom <= 1) return 0;
    return Math.max(0, Math.round((zoom - 1) * 50));
  }

  function normalizeVideoPan(value, zoom = videoZoom) {
    const pan = Number(value);
    if (!Number.isFinite(pan)) return 0;
    const limit = getVideoPanLimit(zoom);
    return Math.min(limit, Math.max(-limit, Math.round(pan)));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getZoomViewportSnapshot(video) {
    if (!video) {
      return null;
    }

    const aspectWidth = Math.max(video.videoWidth || 16, 1);
    const aspectHeight = Math.max(video.videoHeight || 9, 1);
    const viewportWidth = clamp(1 / videoZoom, 0, 1);
    const viewportHeight = clamp(1 / videoZoom, 0, 1);
    const panLimit = getVideoPanLimit(videoZoom);

    if (videoZoom <= 1 || panLimit <= 0) {
      return {
        aspectWidth,
        aspectHeight,
        left: 0,
        top: 0,
        width: 1,
        height: 1,
      };
    }

    const maxCenterOffset = (1 - viewportWidth) / 2;
    const centerX = 0.5 - (videoPanX / panLimit) * maxCenterOffset;
    const centerY = 0.5 - (videoPanY / panLimit) * maxCenterOffset;
    const left = clamp(centerX - viewportWidth / 2, 0, 1 - viewportWidth);
    const top = clamp(centerY - viewportHeight / 2, 0, 1 - viewportHeight);

    return {
      aspectWidth,
      aspectHeight,
      left,
      top,
      width: viewportWidth,
      height: viewportHeight,
    };
  }

  function setVideoPanFromViewportCenter(centerX, centerY) {
    if (videoZoom <= 1) {
      videoPanX = 0;
      videoPanY = 0;
      return;
    }

    const panLimit = getVideoPanLimit(videoZoom);
    const viewportWidth = clamp(1 / videoZoom, 0, 1);
    const viewportHeight = clamp(1 / videoZoom, 0, 1);
    const maxCenterOffsetX = (1 - viewportWidth) / 2;
    const maxCenterOffsetY = (1 - viewportHeight) / 2;

    if (panLimit <= 0 || maxCenterOffsetX <= 0 || maxCenterOffsetY <= 0) {
      videoPanX = 0;
      videoPanY = 0;
      return;
    }

    const boundedCenterX = clamp(centerX, viewportWidth / 2, 1 - viewportWidth / 2);
    const boundedCenterY = clamp(centerY, viewportHeight / 2, 1 - viewportHeight / 2);

    videoPanX = normalizeVideoPan(
      ((0.5 - boundedCenterX) / maxCenterOffsetX) * panLimit,
      videoZoom
    );
    videoPanY = normalizeVideoPan(
      ((0.5 - boundedCenterY) / maxCenterOffsetY) * panLimit,
      videoZoom
    );
  }

  async function persistZoomViewport() {
    trackAnalyticsEvent("zoom_panned", getZoomAnalyticsParams({
      source: "minimap",
    }));
    await saveUiState();
  }

  function setZoomControlButtonMarkup(button, icon, label) {
    if (!button) return;
    button.innerHTML = `
      <span class="ytal-zoom-chip-icon" aria-hidden="true">${icon}</span>
      <span class="ytal-zoom-chip-label">${label}</span>
    `;
  }

  function bindZoomViewportInteractions(frameEl) {
    if (!frameEl || frameEl.dataset.bound === "true") return;
    frameEl.dataset.bound = "true";

    let isDragging = false;

    const moveViewportFromPointer = (event) => {
      const rect = frameEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const ratioX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const ratioY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      setVideoPanFromViewportCenter(ratioX, ratioY);
      applyVideoZoom();
      updateUI();
    };

    frameEl.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      if (videoZoom <= 1) return;

      isDragging = true;
      frameEl.classList.add("dragging");
      moveViewportFromPointer(event);
      event.preventDefault();

      const handlePointerMove = (moveEvent) => {
        if (!isDragging) return;
        moveViewportFromPointer(moveEvent);
      };

      const handlePointerUp = async () => {
        if (!isDragging) return;
        isDragging = false;
        frameEl.classList.remove("dragging");
        document.removeEventListener("mousemove", handlePointerMove);
        document.removeEventListener("mouseup", handlePointerUp);
        await persistZoomViewport();
      };

      document.addEventListener("mousemove", handlePointerMove);
      document.addEventListener("mouseup", handlePointerUp, { once: true });
    });
  }

  function getZoomAnalyticsParams(extra = {}) {
    return {
      video_id: getVideoId() || "unknown",
      zoom_level: Number(videoZoom.toFixed(2)),
      pan_x: videoPanX,
      pan_y: videoPanY,
      ...extra,
    };
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

  async function updateSegmentPlaybackRate(id, nextRate) {
    const segments = await getCurrentVideoSegments();
    const index = segments.findIndex((segment) => segment.id === id);
    if (index === -1) return "missing";

    const currentRate = getSegmentPlaybackRate(segments[index]);
    const normalizedRate = normalizePlaybackRate(nextRate);
    if (normalizedRate === currentRate) {
      return "unchanged";
    }

    segments[index] = {
      ...segments[index],
      playbackRate: normalizedRate,
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
    return "updated";
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
    if (!(target instanceof Element)) return false;

    const editableRoot = target.closest(
      [
        "input",
        "textarea",
        "select",
        "[contenteditable='']",
        "[contenteditable='true']",
        "[role='textbox']",
        "[role='searchbox']",
      ].join(", ")
    );

    return Boolean(editableRoot) || target.isContentEditable;
  }

  function shouldIgnoreKeyboardShortcut(event) {
    return (
      isTypingTarget(event.target) ||
      isTypingTarget(document.activeElement)
    );
  }

  function getHelpPanelMarkup() {
    return `
      <div class="ytal-help-row"><kbd>${formatShortcutLabel("setPointA")}</kbd> ${t("helpSetA")}</div>
      <div class="ytal-help-row"><kbd>${formatShortcutLabel("setPointB")}</kbd> ${t("helpSetB")}</div>
      <div class="ytal-help-row"><kbd>${formatShortcutLabel("loop")}</kbd> ${t("helpLoop")}</div>
      <div class="ytal-help-row"><kbd>${formatShortcutLabel("loop", { shift: true })}</kbd> ${t("helpPlaylistLoop")}</div>
      <div class="ytal-help-row"><kbd>${formatShortcutLabel("save")}</kbd> ${t("helpSave")}</div>
      <div class="ytal-help-row"><kbd>${formatShortcutLabel("reset")}</kbd> ${t("helpReset")}</div>
      <div class="ytal-help-row"><kbd>1-9</kbd> ${t("helpLoad")}</div>
      <div class="ytal-help-row"><kbd>+ / -</kbd> ${t("helpSpeed")}</div>
      <div class="ytal-help-row"><kbd>Del</kbd> ${t("helpDelete")}</div>
      <div class="ytal-help-row"><kbd>Esc</kbd> ${t("helpStop")}</div>
      <div class="ytal-help-row"><kbd>Alt + = / -</kbd> ${t("helpZoom")}</div>
      <div class="ytal-help-row"><kbd>Alt + Arrow</kbd> ${t("helpPan")}</div>
      <div class="ytal-help-row"><kbd>Alt + 0</kbd> ${t("helpZoomReset")}</div>
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeCountdownMode(value) {
    const next = String(value ?? "off");
    return COUNTDOWN_OPTIONS.includes(next) ? next : "off";
  }

  function getCountdownOptionLabel(value) {
    const mode = normalizeCountdownMode(value);
    return mode === "off" ? t("countdownOff") : t("countdownSeconds")(mode);
  }

  // ── Storage ──
  function getUiStore() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([STORAGE_UI_KEY], (result) => {
        resolve(result[STORAGE_UI_KEY] || {});
      });
    });
  }

  function setUiStore(store) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [STORAGE_UI_KEY]: store }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  }

  async function migrateFromLocalStorage() {
    const local = await new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_SEGMENTS_KEY, STORAGE_UI_KEY], resolve);
    });

    const keysToRemove = [];

    if (local[STORAGE_UI_KEY]) {
      const syncUi = await getUiStore();
      if (!Object.keys(syncUi).length) {
        try {
          await setUiStore(local[STORAGE_UI_KEY]);
        } catch {
          // ignore quota errors during migration
        }
      }
      keysToRemove.push(STORAGE_UI_KEY);
    }

    const segmentsStore = local[STORAGE_SEGMENTS_KEY];
    if (segmentsStore && typeof segmentsStore === "object") {
      let allMigrated = true;
      for (const [videoId, segments] of Object.entries(segmentsStore)) {
        if (!Array.isArray(segments) || segments.length === 0) continue;
        const syncKey = STORAGE_SEG_PREFIX + videoId;
        const existing = await new Promise((resolve) =>
          chrome.storage.sync.get([syncKey], (result) => resolve(result[syncKey]))
        );
        if (!existing?.length) {
          try {
            await new Promise((resolve, reject) =>
              chrome.storage.sync.set({ [syncKey]: segments.map(serializeSegment) }, () => {
                if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                else resolve();
              })
            );
          } catch {
            // quota exceeded — leave this video in local storage
            allMigrated = false;
          }
        }
      }
      if (allMigrated) {
        keysToRemove.push(STORAGE_SEGMENTS_KEY);
      }
    }

    if (keysToRemove.length) {
      await new Promise((resolve) => chrome.storage.local.remove(keysToRemove, resolve));
    }
  }

  async function saveUiState() {
    const store = await getUiStore();
    store.isCollapsed = isCollapsed;
    store.isHelpOpen = isHelpOpen;
    store.isZoomOpen = isZoomOpen;
    store.lang = lang;
    store.videoZoom = videoZoom;
    store.videoPanX = videoPanX;
    store.videoPanY = videoPanY;
    store.countdownMode = countdownMode;
    await setUiStore(store);
  }

  async function loadUiState() {
    const store = await getUiStore();
    isCollapsed = !!store.isCollapsed;
    isHelpOpen = !!store.isHelpOpen;
    isZoomOpen = !!store.isZoomOpen;
    lang =
      store.lang === "ko" || store.lang === "en"
        ? store.lang
        : detectDefaultLang();
    videoZoom = normalizeVideoZoom(store.videoZoom);
    videoPanX = normalizeVideoPan(store.videoPanX, videoZoom);
    videoPanY = normalizeVideoPan(store.videoPanY, videoZoom);
    countdownMode = normalizeCountdownMode(store.countdownMode);
    shortcuts = sanitizeShortcutConfig(store.shortcuts);
  }

  function handleUiStoreChange(nextStore) {
    const previousShortcuts = JSON.stringify(shortcuts);
    shortcuts = sanitizeShortcutConfig(nextStore?.shortcuts);

    if (rootEl && previousShortcuts !== JSON.stringify(shortcuts)) {
      updateUI();
    }
  }

  function clearVideoZoomStyles() {
    const video = getVideo();
    if (!video) return;
    video.style.transform = "";
    video.style.transformOrigin = "";
    video.style.willChange = "";
  }

  function applyVideoZoom() {
    const video = getVideo();
    if (!video) return;

    if (videoZoom <= 1) {
      clearVideoZoomStyles();
      return;
    }

    video.style.transformOrigin = "center center";
    video.style.transform = `translate(${videoPanX}%, ${videoPanY}%) scale(${videoZoom})`;
    video.style.willChange = "transform";
  }

  async function updateVideoZoom(delta) {
    const nextZoom = normalizeVideoZoom(videoZoom + delta);
    if (nextZoom === videoZoom) return;
    videoZoom = nextZoom;
    videoPanX = normalizeVideoPan(videoPanX, videoZoom);
    videoPanY = normalizeVideoPan(videoPanY, videoZoom);
    applyVideoZoom();
    updateUI();
    trackAnalyticsEvent("zoom_level_changed", getZoomAnalyticsParams({
      action: delta > 0 ? "increase" : "decrease",
    }));
    await saveUiState();
  }

  async function nudgeVideoPan(axis, delta) {
    if (videoZoom <= 1) {
      videoZoom = normalizeVideoZoom(VIDEO_ZOOM_MIN + VIDEO_ZOOM_STEP);
    }

    if (axis === "x") {
      const nextX = normalizeVideoPan(videoPanX + delta, videoZoom);
      if (nextX === videoPanX) return;
      videoPanX = nextX;
    } else {
      const nextY = normalizeVideoPan(videoPanY + delta, videoZoom);
      if (nextY === videoPanY) return;
      videoPanY = nextY;
    }

    applyVideoZoom();
    updateUI();
    trackAnalyticsEvent("zoom_panned", getZoomAnalyticsParams({
      axis,
      step: delta,
    }));
    await saveUiState();
  }

  async function resetVideoZoom() {
    if (videoZoom === 1 && videoPanX === 0 && videoPanY === 0) return;
    videoZoom = 1;
    videoPanX = 0;
    videoPanY = 0;
    clearVideoZoomStyles();
    updateUI();
    trackAnalyticsEvent("zoom_reset", getZoomAnalyticsParams({
      action: "reset",
    }));
    await saveUiState();
  }

  function generateSegmentId() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function serializeSegment(seg) {
    const compact = {
      i: seg.id,
      t: seg.title,
      s: Math.round((seg.start ?? 0) * 10) / 10,
      e: Math.round((seg.end ?? 0) * 10) / 10,
    };
    const rate = normalizePlaybackRate(seg.playbackRate ?? 1);
    if (rate !== 1) compact.r = rate;
    return compact;
  }

  function deserializeSegment(data) {
    return {
      id: data.i ?? data.id ?? generateSegmentId(),
      title: data.t ?? data.title ?? "",
      start: data.s ?? data.start ?? 0,
      end: data.e ?? data.end ?? 0,
      playbackRate: normalizePlaybackRate(data.r ?? data.playbackRate ?? 1),
    };
  }

  async function getCurrentVideoSegments() {
    const videoId = getVideoId();
    if (!videoId) return [];
    return new Promise((resolve) => {
      chrome.storage.sync.get([STORAGE_SEG_PREFIX + videoId], (result) => {
        const raw = result[STORAGE_SEG_PREFIX + videoId];
        resolve(Array.isArray(raw) ? raw.map(deserializeSegment) : []);
      });
    });
  }

  async function saveCurrentVideoSegments(segments) {
    const videoId = getVideoId();
    if (!videoId) return;
    const compact = segments.map(serializeSegment);
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.sync.set({ [STORAGE_SEG_PREFIX + videoId]: compact }, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
      });
    } catch {
      // Sync quota exceeded — persist locally so data isn't lost
      const store = await new Promise((resolve) =>
        chrome.storage.local.get([STORAGE_SEGMENTS_KEY], (result) =>
          resolve(result[STORAGE_SEGMENTS_KEY] || {})
        )
      );
      store[videoId] = compact;
      await new Promise((resolve) =>
        chrome.storage.local.set({ [STORAGE_SEGMENTS_KEY]: store }, resolve)
      );
      showToast(
        lang === "ko"
          ? "동기화 용량이 꽉 찼습니다. 이 기기에만 저장됩니다."
          : "Sync quota exceeded. Saved locally only.",
        "neutral",
        4000
      );
    }
  }

  // ── Loop Control ──
  function stopLoop() {
    countdownRunId += 1;
    isCountdownActive = false;
    countdownOverlayMessage = "";
    isLoopRestartPending = false;
    isLooping = false;
    updateUI();
  }

  function stopPlaylistLoop(options = {}) {
    const { showToastOnChange = false } = options;
    if (!isPlaylistLooping) return;
    countdownRunId += 1;
    isCountdownActive = false;
    countdownOverlayMessage = "";
    isPlaylistLooping = false;
    isPlaylistAdvancing = false;
    if (showToastOnChange) {
      showToast(t("toastPlaylistLoopOff"), "neutral");
    }
    updateUI();
    renderSegments();
  }

  function clearCurrentSelection() {
    transientStatus = "";
    transientStatusTone = "neutral";
    stopPlaylistLoop();
    const nextPlaybackRate =
      activeSegmentId !== null
        ? restorePlaybackRate ?? defaultPlaybackRate
        : defaultPlaybackRate;
    activeSegmentId = null;
    activeSegmentTitle = "";
    initDefaultABPoints();
    applyPlaybackRate(nextPlaybackRate);
    defaultPlaybackRate = normalizePlaybackRate(nextPlaybackRate);
    restorePlaybackRate = null;
    stopLoop();
  }

  function showCountdownOverlay(message) {
    countdownOverlayMessage = message;
    updateUI();
  }

  async function runLoopCountdownIfNeeded() {
    const seconds = Number(normalizeCountdownMode(countdownMode));
    if (!seconds) return true;

    const video = getVideo();
    const runId = ++countdownRunId;
    isCountdownActive = true;
    showCountdownOverlay("");
    updateUI();
    video?.pause();

    for (let value = seconds; value >= 1; value -= 1) {
      showCountdownOverlay(t("countdownStartingIn")(getCountdownOptionLabel(String(value))));
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      if (runId !== countdownRunId) {
        isCountdownActive = false;
        countdownOverlayMessage = "";
        updateUI();
        return false;
      }
    }

    showCountdownOverlay(t("countdownStartingNow"));
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    isCountdownActive = false;
    countdownOverlayMessage = "";
    updateUI();
    return runId === countdownRunId;
  }

  async function restartLoopWithCountdown(video) {
    if (isLoopRestartPending) return;
    isLoopRestartPending = true;

    try {
      if (video) {
        video.pause();
        video.currentTime = pointA;
      }
      const canStart = await runLoopCountdownIfNeeded();
      if (!canStart || !isLooping) return;
      video?.play().catch(() => {});
    } finally {
      isLoopRestartPending = false;
    }
  }

  async function updateSegmentRange(id, startRawValue, endRawValue) {
    const nextStart = parseTimeInput(startRawValue);
    const nextEnd = parseTimeInput(endRawValue);

    if (nextStart === null || nextEnd === null) {
      showToast(t("toastRangeInvalid"), "neutral");
      return;
    }

    const segments = await getCurrentVideoSegments();
    const index = segments.findIndex((segment) => segment.id === id);
    if (index === -1) return;

    const video = getVideo();
    const duration =
      Number.isFinite(video?.duration) && video.duration > 0
        ? video.duration
        : Number.POSITIVE_INFINITY;

    const clampedStart = Math.round(Math.max(0, Math.min(nextStart, duration)) * 10) / 10;
    const clampedEnd = Math.round(Math.min(duration, Math.max(nextEnd, clampedStart + MIN_GAP)) * 10) / 10;
    const didChange =
      clampedStart !== segments[index].start ||
      clampedEnd !== segments[index].end;
    if (!didChange) {
      return;
    }

    segments[index] = {
      ...segments[index],
      start: clampedStart,
      end: clampedEnd,
    };
    await saveCurrentVideoSegments(segments);

    if (activeSegmentId === id) {
      transientStatus = "";
      transientStatusTone = "neutral";
      pointA = clampedStart;
      pointB = clampedEnd;
      stopLoop();
    }

    updateUI();
    await renderSegments();

    showToast(
      t("toastRangeUpdated")(format(clampedStart), format(clampedEnd)),
      "success",
      1600
    );
  }

  function seekTo(time) {
    const video = getVideo();
    if (!video) return;
    const duration = video.duration || 0;
    const next = Math.max(0, Math.min(time, duration || time));
    video.currentTime = next;
  }

  async function toggleLoop(options = {}) {
    const { showToastOnChange = false } = options;
    if (
      typeof pointA !== "number" ||
      typeof pointB !== "number" ||
      pointB <= pointA
    ) {
      showToast(t("toastSetAB"), "neutral");
      return;
    }

    const wasPlaylistLooping = isPlaylistLooping;
    if (wasPlaylistLooping) {
      stopPlaylistLoop();
    }

    isLooping = !isLooping;

    if (!isLooping) {
      countdownRunId += 1;
      isCountdownActive = false;
      countdownOverlayMessage = "";
      isLoopRestartPending = false;
    }

    if (isLooping) {
      const video = getVideo();
      if (video) {
        video.currentTime = pointA;
      }
      const canStart = await runLoopCountdownIfNeeded();
      if (!canStart) {
        isLooping = false;
        updateUI();
        return;
      }
      if (video) {
        video.play().catch(() => {});
      }
    }

    if (showToastOnChange) {
      showToast(
        isLooping
          ? wasPlaylistLooping
            ? t("toastPlaylistToLoopOn")(format(pointA), format(pointB))
            : t("toastLoopOn")(format(pointA), format(pointB))
          : t("toastLoopOff"),
        isLooping ? "success" : "neutral"
      );
    }

    if (isLooping) {
      trackAnalyticsEvent("loop_started", {
        source: wasPlaylistLooping ? "playlist_to_single" : "single_loop",
        start_seconds: Number(pointA.toFixed(3)),
        end_seconds: Number(pointB.toFixed(3)),
        has_saved_segment: activeSegmentId !== null,
      });
    }

    updateUI();
  }

  function setPointAToCurrent(options = {}) {
    const { showToastOnSet = false } = options;
    const video = getVideo();
    if (!video) return;

    transientStatus = "";
    transientStatusTone = "neutral";
    stopPlaylistLoop();
    activeSegmentId = null;
    activeSegmentTitle = "";
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
      showToast(t("toastSetA"), "neutral");
      return;
    }

    transientStatus = "";
    transientStatusTone = "neutral";
    stopPlaylistLoop();
    activeSegmentId = null;
    activeSegmentTitle = "";
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
      showToast(t("toastNoSegment"), "neutral");
      return;
    }

    // Round to storage precision (0.1s) so isSegmentActive and duplicate checks stay consistent
    pointA = Math.round(pointA * 10) / 10;
    pointB = Math.round(pointB * 10) / 10;

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
      id: generateSegmentId(),
      title,
      start: pointA,
      end: pointB,
      playbackRate: normalizePlaybackRate(getVideo()?.playbackRate ?? 1),
    };

    segments.push(segment);
    await saveCurrentVideoSegments(segments);
    activeSegmentId = segment.id;
    activeSegmentTitle = segment.title;

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

    trackAnalyticsEvent("segment_saved", {
      video_id: getVideoId() || "unknown",
      start_seconds: Number(segment.start.toFixed(3)),
      end_seconds: Number(segment.end.toFixed(3)),
      saved_segments_count: segments.length,
      playback_rate: segment.playbackRate,
    });
  }

  async function deleteSegment(id) {
    const wasActivePlaylistSegment = isPlaylistLooping && activeSegmentId === id;
    const segments = await getCurrentVideoSegments();
    const next = segments.filter((segment) => segment.id !== id);
    await saveCurrentVideoSegments(next);
    if (wasActivePlaylistSegment || next.length === 0) {
      stopPlaylistLoop();
    }
    if (activeSegmentId === id) {
      activeSegmentId = null;
      activeSegmentTitle = "";
    }
    await renderSegments();
    updateUI();
  }

  async function reorderSegments(sourceId, targetId, insertAfter = false) {
    if (!sourceId || !targetId || sourceId === targetId) return;

    const segments = await getCurrentVideoSegments();
    const sourceIndex = segments.findIndex((segment) => segment.id === sourceId);
    const targetIndex = segments.findIndex((segment) => segment.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const [movedSegment] = segments.splice(sourceIndex, 1);
    let nextIndex = targetIndex;

    if (sourceIndex < targetIndex) {
      nextIndex -= 1;
    }
    if (insertAfter) {
      nextIndex += 1;
    }

    nextIndex = Math.max(0, Math.min(nextIndex, segments.length));
    segments.splice(nextIndex, 0, movedSegment);

    await saveCurrentVideoSegments(segments);
    await renderSegments();
    updateUI();
    showToast(t("toastSegmentsReordered"), "success", 1600);
  }

  async function deleteActiveSegment() {
    const segments = await getCurrentVideoSegments();

    if (
      typeof pointA !== "number" ||
      typeof pointB !== "number" ||
      pointB <= pointA
    ) {
      showToast(t("toastNoActive"), "neutral");
      return;
    }

    const activeSegment = segments.find(
      (segment) => segment.start === pointA && segment.end === pointB
    );

    if (!activeSegment) {
      showToast(t("toastNoActiveSaved"), "neutral");
      return;
    }

    await deleteSegment(activeSegment.id);
  }

  async function updateSegmentTitle(id, nextTitle, options = {}) {
    const { showToastOnSave = false } = options;
    const trimmed = nextTitle.trim();
    if (!trimmed) {
      showToast(t("toastEmptyName"), "neutral");
      return "invalid";
    }

    const segments = await getCurrentVideoSegments();
    const index = segments.findIndex((segment) => segment.id === id);
    if (index === -1) return "missing";

    if (segments[index].title === trimmed) {
      return "unchanged";
    }

    segments[index] = {
      ...segments[index],
      title: trimmed,
    };

    await saveCurrentVideoSegments(segments);
    if (activeSegmentId === id) {
      activeSegmentTitle = trimmed;
    }
    await renderSegments();
    updateUI();
    if (showToastOnSave) {
      showToast(t("toastTitleUpdated"), "success", 1600);
    }
    return "updated";
  }

  function activateSegment(segment, options = {}) {
    const { fromPlaylist = false } = options;
    if (!fromPlaylist) {
      stopPlaylistLoop();
      stopLoop();
    }
    const video = getVideo();
    if (activeSegmentId === null && video) {
      restorePlaybackRate = normalizePlaybackRate(video.playbackRate);
      defaultPlaybackRate = restorePlaybackRate;
    }

    activeSegmentId = segment.id;
    activeSegmentTitle = segment.title;
    pointA = segment.start;
    pointB = segment.end;
    applyPlaybackRate(getSegmentPlaybackRate(segment));
    seekTo(segment.start);
    if (fromPlaylist && video) {
      video.play().catch(() => {});
    }
    updateUI();
    renderSegments();
  }

  async function activateSegmentByIndex(index) {
    const segments = await getCurrentVideoSegments();
    const segment = segments[index];
    if (!segment) return;
    activateSegment(segment);
  }

  async function startPlaylistLoop() {
    const segments = await getCurrentVideoSegments();
    if (segments.length === 0) {
      showToast(t("playlistEmpty"), "neutral");
      return;
    }

    stopLoop();
    const canStart = await runLoopCountdownIfNeeded();
    if (!canStart) {
      return;
    }
    isPlaylistLooping = true;
    activateSegment(segments[0], { fromPlaylist: true });
    showToast(t("toastPlaylistLoopOn"), "success");
    trackAnalyticsEvent("playlist_loop_started", {
      video_id: getVideoId() || "unknown",
      saved_segments_count: segments.length,
    });
    updateUI();
  }

  async function togglePlaylistLoop() {
    if (isPlaylistLooping) {
      stopPlaylistLoop({ showToastOnChange: true });
      return;
    }
    await startPlaylistLoop();
  }

  async function advancePlaylistLoop() {
    if (isPlaylistAdvancing) return;
    isPlaylistAdvancing = true;

    try {
      const segments = await getCurrentVideoSegments();
      if (segments.length === 0) {
        stopPlaylistLoop();
        return;
      }

      const currentIndex = segments.findIndex((segment) => segment.id === activeSegmentId);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % segments.length : 0;
      activateSegment(segments[nextIndex], { fromPlaylist: true });
    } finally {
      isPlaylistAdvancing = false;
    }
  }

  // ── Render ──
  async function renderSegments() {
    if (segmentsRendering) return;
    segmentsRendering = true;
    try {
    const list = document.getElementById("ytal-segment-list");
    const toolbar = document.getElementById("ytal-segment-toolbar");
    if (!list) return;

    const segments = await getCurrentVideoSegments();

    if (segments.length === 0) {
      if (toolbar) {
        toolbar.innerHTML = "";
        toolbar.hidden = true;
      }
      list.innerHTML = `
        <div class="ytal-empty">
          <div class="ytal-empty-title">${t("noSegments")}</div>
          <div class="ytal-empty-copy">${t("emptyGuide")}</div>
        </div>
      `;
      return;
    }

    if (toolbar) {
      toolbar.hidden = false;
      toolbar.innerHTML = `
        <button class="ytal-section-chip${isPlaylistLooping ? " active" : ""}" id="ytal-playlist-loop-btn" type="button" title="${escapeHtml(t("playlistLoopDesc"))}">
          ${escapeHtml(isPlaylistLooping ? t("playlistLooping") : t("playlistLoop"))}
        </button>
      `;

      toolbar
        .querySelector("#ytal-playlist-loop-btn")
        ?.addEventListener("click", () => {
          togglePlaylistLoop();
        });
    }

    list.innerHTML = "";

    const clearDragState = () => {
      list.querySelectorAll(".ytal-item").forEach((node) => {
        node.classList.remove("dragging", "drag-over-before", "drag-over-after");
      });
    };

    segments.forEach((segment, index) => {
      const item = document.createElement("div");
      item.className = "ytal-item";
      item.dataset.segmentId = segment.id;

      const isActive = isSegmentActive(segment);

      if (isActive) {
        item.classList.add("active");
      }

      const mainBtn = document.createElement("div");
      mainBtn.className = "ytal-item-main";
      mainBtn.setAttribute("role", "button");
      mainBtn.tabIndex = 0;
      const dragHandle = document.createElement("button");
      dragHandle.className = "ytal-mini-btn ytal-drag-handle";
      dragHandle.type = "button";
      dragHandle.draggable = true;
      dragHandle.title = t("reorder");
      dragHandle.setAttribute("aria-label", t("reorder"));
      dragHandle.innerHTML = `
        <svg class="ytal-drag-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2v20" />
          <path d="M2 12h20" />
          <path d="m9 5 3-3 3 3" />
          <path d="m9 19 3 3 3-3" />
          <path d="m5 9-3 3 3 3" />
          <path d="m19 9 3 3-3 3" />
        </svg>
      `;
      dragHandle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      mainBtn.innerHTML = `
        <div class="ytal-item-title-row">
          <div class="ytal-item-title-group">
            <label class="ytal-item-title-label">
              <span class="ytal-item-title-index">${index + 1}.</span>
              <input
                class="ytal-item-title-input"
                type="text"
                value="${escapeHtml(segment.title)}"
                aria-label="${escapeHtml(t("editTitle"))}"
                placeholder="${escapeHtml(t("editTitlePlaceholder"))}"
                data-segment-id="${segment.id}"
              >
              <span class="ytal-item-title-edit-indicator" aria-hidden="true">✎</span>
            </label>
          </div>
        </div>
        <div class="ytal-item-meta">
          <div class="ytal-item-time-editor">
            <input class="ytal-item-time-input" type="text" inputmode="decimal" aria-label="Segment start time" value="${escapeHtml(formatEditableTime(segment.start))}">
            <span class="ytal-item-time-separator">-</span>
            <input class="ytal-item-time-input" type="text" inputmode="decimal" aria-label="Segment end time" value="${escapeHtml(formatEditableTime(segment.end))}">
          </div>
          <div class="ytal-speed-chip" role="group" aria-label="${t("speedValue")(getSegmentPlaybackRate(segment))}">
            <button class="ytal-speed-chip-btn" type="button" title="${t("speedDown")}" aria-label="${t("speedDown")}">-</button>
            <input
              class="ytal-speed-chip-input"
              type="number"
              min="0.05"
              max="16"
              step="0.1"
              aria-label="${escapeHtml(t("speedInput"))}"
              value="${escapeHtml(formatEditablePlaybackRate(getSegmentPlaybackRate(segment)))}"
            >
            <span class="ytal-speed-chip-suffix" aria-hidden="true">x</span>
            <button class="ytal-speed-chip-btn" type="button" title="${t("speedUp")}" aria-label="${t("speedUp")}">+</button>
          </div>
        </div>
      `;
      mainBtn.querySelector(".ytal-item-title-group")?.prepend(dragHandle);
      if (index < 9) {
        mainBtn.title = `${t("tipSegment")} ${index + 1}`;
      }
      mainBtn.addEventListener("click", () => activateSegment(segment));
      mainBtn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activateSegment(segment);
        }
      });

      const titleInput = mainBtn.querySelector(".ytal-item-title-input");
      if (titleInput) {
        if (editingSegmentId === segment.id) {
          window.requestAnimationFrame(() => {
            titleInput.focus();
            titleInput.select();
          });
        }

        const restoreTitle = () => {
          titleInput.value = segment.title;
        };

        const commitTitleChange = async () => {
          const result = await updateSegmentTitle(segment.id, titleInput.value, {
            showToastOnSave: true,
          });

          if (result === "invalid" || result === "missing") {
            editingSegmentId = null;
            restoreTitle();
            return;
          }

          editingSegmentId = null;
        };

        titleInput.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        titleInput.addEventListener("focus", (e) => {
          e.stopPropagation();
          editingSegmentId = segment.id;
          titleInput.select();
        });
        titleInput.addEventListener("keydown", async (e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            await commitTitleChange();
            titleInput.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            restoreTitle();
            editingSegmentId = null;
            titleInput.blur();
          }
        });
        titleInput.addEventListener("blur", async () => {
          await commitTitleChange();
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

      const speedInput = mainBtn.querySelector(".ytal-speed-chip-input");
      if (speedInput) {
        const currentSegmentRate = () => getSegmentPlaybackRate(segment);

        const restorePlaybackRateInput = () => {
          speedInput.value = formatEditablePlaybackRate(currentSegmentRate());
        };

        const commitPlaybackRateChange = async () => {
          const parsedRate = parsePlaybackRateInput(speedInput.value);
          if (parsedRate === null) {
            showToast(t("toastSpeedInvalid"), "neutral");
            restorePlaybackRateInput();
            return;
          }

          const result = await updateSegmentPlaybackRate(segment.id, parsedRate);
          if (result === "missing") {
            restorePlaybackRateInput();
            return;
          }

          speedInput.value = formatEditablePlaybackRate(parsedRate);
          if (result === "updated") {
            showToast(
              t("toastSpeedUpdated")(formatEditablePlaybackRate(parsedRate)),
              "success",
              1600
            );
          }
        };

        speedInput.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        speedInput.addEventListener("focus", (e) => {
          e.stopPropagation();
          speedInput.select();
        });
        speedInput.addEventListener("keydown", async (e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            await commitPlaybackRateChange();
            speedInput.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            restorePlaybackRateInput();
            speedInput.blur();
          }
        });
        speedInput.addEventListener("blur", async () => {
          await commitPlaybackRateChange();
        });
      }

      const timeInputs = mainBtn.querySelectorAll(".ytal-item-time-input");
      const [startInput, endInput] = timeInputs;

      const commitTimeChange = async () => {
        if (!startInput || !endInput) return;
        await updateSegmentRange(segment.id, startInput.value, endInput.value);
      };

      timeInputs.forEach((input) => {
        input.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        input.addEventListener("focus", (e) => {
          e.stopPropagation();
        });
        input.addEventListener("keydown", async (e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            await commitTimeChange();
            input.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            input.value = input === startInput
              ? formatEditableTime(segment.start)
              : formatEditableTime(segment.end);
            input.blur();
          }
        });
        input.addEventListener("blur", async () => {
          await commitTimeChange();
        });
      });

      const actions = document.createElement("div");
      actions.className = "ytal-item-actions";

      const delBtn = document.createElement("button");
      delBtn.className = "ytal-mini-btn delete";
      delBtn.textContent = t("delete");
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSegment(segment.id);
      });

      dragHandle.addEventListener("dragstart", (e) => {
        draggedSegmentId = segment.id;
        item.classList.add("dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", segment.id);
        }
      });

      item.addEventListener("dragover", (e) => {
        if (!draggedSegmentId || draggedSegmentId === segment.id) return;
        e.preventDefault();

        const rect = item.getBoundingClientRect();
        const insertAfter = e.clientY - rect.top > rect.height / 2;
        item.classList.toggle("drag-over-before", !insertAfter);
        item.classList.toggle("drag-over-after", insertAfter);
      });

      item.addEventListener("dragleave", (e) => {
        if (!item.contains(e.relatedTarget)) {
          item.classList.remove("drag-over-before", "drag-over-after");
        }
      });

      item.addEventListener("drop", async (e) => {
        if (!draggedSegmentId || draggedSegmentId === segment.id) return;
        e.preventDefault();

        const rect = item.getBoundingClientRect();
        const insertAfter = e.clientY - rect.top > rect.height / 2;
        clearDragState();
        const sourceId = draggedSegmentId;
        draggedSegmentId = null;
        await reorderSegments(sourceId, segment.id, insertAfter);
      });

      dragHandle.addEventListener("dragend", () => {
        draggedSegmentId = null;
        clearDragState();
      });

      actions.appendChild(delBtn);
      item.appendChild(mainBtn);
      item.appendChild(actions);
      list.appendChild(item);
    });

    schedulePlacementUpdate();
    } finally {
      segmentsRendering = false;
    }
  }

  function updateUI() {
    if (!rootEl) return;
    syncToastMountTarget();
    syncCountdownMountTarget();
    updateCountdownOverlayPlacement();

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
    const countdownLabel = document.getElementById("ytal-countdown-label");
    const countdownSelect = document.getElementById("ytal-countdown-select");
    const collapseBtn = document.getElementById("ytal-toggle-collapse");
    const revealBtn = document.getElementById("ytal-reveal-panel");
    const zoomOutBtn = document.getElementById("ytal-zoom-out");
    const zoomInBtn = document.getElementById("ytal-zoom-in");
    const zoomResetBtn = document.getElementById("ytal-zoom-reset");
    const zoomViewportLabel = document.getElementById("ytal-zoom-viewport-label");
    const zoomViewportMeta = document.getElementById("ytal-zoom-viewport-meta");
    const zoomViewportHint = document.getElementById("ytal-zoom-viewport-hint");
    const zoomViewportFrame = document.getElementById("ytal-zoom-viewport-frame");
    const zoomViewportBox = document.getElementById("ytal-zoom-viewport-box");
    const zoomViewportGuide = document.getElementById("ytal-zoom-viewport-guide");
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
    const hasSelection =
      typeof pointA === "number" || typeof pointB === "number";
    const zoomViewport = getZoomViewportSnapshot(video);

    if (rangeSummary) {
      rangeSummary.textContent = canLoop
        ? t("rangeSummaryReady")(format(pointA), format(pointB))
        : t("rangeSummaryPending");
    }

    applyVideoZoom();

    if (toastEl) {
      toastEl.textContent = toastMessage;
      toastEl.dataset.tone = toastTone;
      toastEl.classList.toggle("show", !!toastMessage);
    }

    if (countdownOverlayEl) {
      countdownOverlayEl.classList.toggle("show", isCountdownActive && !!countdownOverlayMessage);
      countdownOverlayEl.textContent = isCountdownActive ? countdownOverlayMessage : "";
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
      const resetLabel = t("resetSelection");
      if (resetBtn.dataset.label !== resetLabel) {
        resetBtn.dataset.label = resetLabel;
        resetBtn.innerHTML = resetButtonMarkup(resetLabel);
      }
      resetBtn.title = t("tipReset")(formatShortcutLabel("reset"));
      resetBtn.setAttribute("aria-label", t("resetSelection"));
      resetBtn.disabled = !hasSelection;
      resetBtn.classList.toggle("active", hasSelection);
    }

    if (countdownLabel) {
      countdownLabel.textContent = t("countdownLabel");
    }

    if (countdownSelect) {
      const nextValue = normalizeCountdownMode(countdownMode);
      if (countdownSelect.value !== nextValue) {
        countdownSelect.value = nextValue;
      }
      Array.from(countdownSelect.options).forEach((option) => {
        const nextLabel = getCountdownOptionLabel(option.value);
        if (option.textContent !== nextLabel) {
          option.textContent = nextLabel;
        }
      });
      countdownSelect.setAttribute("aria-label", t("countdownLabel"));
    }

    if (loopBtn) {
      syncButtonMarkup(
        loopBtn,
        getLoopButtonLabel(canLoop),
        getLoopButtonDescription(canLoop)
      );
      loopBtn.disabled = !canLoop;
      loopBtn.classList.toggle("active", isLooping && !isPlaylistLooping);
    }

    if (saveBtn) {
      syncButtonMarkup(saveBtn, t("save"), t("saveDesc"));
      saveBtn.disabled = !canLoop;
    }

    updateNativeTimelineOverlay(canLoop, duration);

    if (loopBtn) loopBtn.title = t("tipLoop")(formatShortcutLabel("loop"));
    if (saveBtn) saveBtn.title = t("tipSave")(formatShortcutLabel("save"));

    if (helpBtn) {
      helpBtn.textContent = isHelpOpen ? t("hideShortcuts") : t("shortcuts");
      helpBtn.title = t("tipShortcuts");
    }

    if (zoomLauncherEl) {
      zoomLauncherEl.title = isZoomOpen ? t("zoomHide") : t("zoomToggle");
      zoomLauncherEl.setAttribute("aria-label", isZoomOpen ? t("zoomHide") : t("zoomToggle"));
      zoomLauncherEl.classList.toggle("active", isZoomOpen);
      zoomLauncherEl.innerHTML = `
        <span class="ytal-zoom-launcher-label">${t("zoomToggle")}</span>
        <span class="ytal-zoom-launcher-icon" aria-hidden="true">&#x26f6;</span>
      `;
    }

    if (helpPanel) {
      helpPanel.classList.toggle("open", isHelpOpen);
      helpPanel.innerHTML = getHelpPanelMarkup();
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

    if (zoomViewportLabel) {
      zoomViewportLabel.textContent = t("zoomViewportLabel");
    }

    if (zoomViewportMeta) {
      zoomViewportMeta.textContent = zoomViewport
        ? t("zoomViewportZoom")(videoZoom)
        : t("zoomViewportEmpty");
    }

    if (zoomViewportHint) {
      zoomViewportHint.textContent = t("zoomViewportHint");
    }

    if (zoomViewportGuide) {
      zoomViewportGuide.textContent = t("zoomViewportGuide");
    }

    if (zoomViewportFrame && zoomViewport) {
      zoomViewportFrame.style.aspectRatio = `${zoomViewport.aspectWidth} / ${zoomViewport.aspectHeight}`;
    }

    if (zoomViewportBox) {
      const left = (zoomViewport?.left || 0) * 100;
      const top = (zoomViewport?.top || 0) * 100;
      const width = (zoomViewport?.width || 1) * 100;
      const height = (zoomViewport?.height || 1) * 100;
      zoomViewportBox.style.left = `${left}%`;
      zoomViewportBox.style.top = `${top}%`;
      zoomViewportBox.style.width = `${width}%`;
      zoomViewportBox.style.height = `${height}%`;
    }

    if (zoomOutBtn) {
      setZoomControlButtonMarkup(zoomOutBtn, "−", t("zoomOut"));
      zoomOutBtn.disabled = videoZoom <= VIDEO_ZOOM_MIN;
    }

    if (zoomInBtn) {
      setZoomControlButtonMarkup(zoomInBtn, "+", t("zoomIn"));
      zoomInBtn.disabled = videoZoom >= VIDEO_ZOOM_MAX;
    }

    if (zoomResetBtn) {
      zoomResetBtn.textContent = t("zoomReset");
      zoomResetBtn.title = t("zoomResetDesc");
      zoomResetBtn.disabled = videoZoom === 1 && videoPanX === 0 && videoPanY === 0;
    }

    syncInlineLauncher();
    syncZoomLauncher();
    updateZoomPopupPlacement();
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

  function getSubscribeButtonAnchor() {
    const selectors = [
      "ytd-watch-metadata ytd-subscribe-button-renderer",
      "ytd-watch-flexy ytd-subscribe-button-renderer",
      "#subscribe-button ytd-subscribe-button-renderer",
      "#subscribe-button",
      "ytd-button-renderer.ytd-subscribe-button-renderer",
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }

    return null;
  }

  function getPlayerControlsHost() {
    return (
      document.querySelector(".ytp-right-controls") ||
      document.querySelector(".ytp-left-controls") ||
      null
    );
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

  function ensureCountdownOverlay() {
    if (countdownOverlayEl?.isConnected) return countdownOverlayEl;

    countdownOverlayEl = document.createElement("div");
    countdownOverlayEl.id = "ytal-countdown-overlay";
    countdownOverlayEl.className = "ytal-countdown-overlay";
    countdownOverlayEl.setAttribute("aria-live", "assertive");
    countdownOverlayEl.setAttribute("aria-atomic", "true");
    return countdownOverlayEl;
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

  function ensureZoomLauncher() {
    if (zoomLauncherEl) return zoomLauncherEl;

    zoomLauncherEl = document.createElement("button");
    zoomLauncherEl.type = "button";
    zoomLauncherEl.id = "ytal-zoom-launcher";
    zoomLauncherEl.className = "ytal-zoom-launcher";
    zoomLauncherEl.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      isZoomOpen = !isZoomOpen;
      updateUI();
      schedulePlacementUpdate();
      trackAnalyticsEvent("zoom_panel_toggled", getZoomAnalyticsParams({
        is_open: isZoomOpen,
      }));
      await saveUiState();
    });

    return zoomLauncherEl;
  }

  function ensureZoomPopup() {
    if (zoomPopupEl) return zoomPopupEl;

    zoomPopupEl = document.createElement("div");
    zoomPopupEl.id = "ytal-zoom-popup";
    zoomPopupEl.className = "ytal-zoom-card";
    zoomPopupEl.innerHTML = `
      <div class="ytal-zoom-viewport-card">
        <div class="ytal-zoom-viewport-head">
          <div class="ytal-zoom-viewport-label" id="ytal-zoom-viewport-label">${t("zoomViewportLabel")}</div>
          <div class="ytal-zoom-viewport-hint" id="ytal-zoom-viewport-hint">${t("zoomViewportHint")}</div>
        </div>
        <div class="ytal-zoom-viewport-meta" id="ytal-zoom-viewport-meta">${t("zoomViewportEmpty")}</div>
        <div class="ytal-zoom-viewport-frame" id="ytal-zoom-viewport-frame" aria-hidden="true">
          <span class="ytal-zoom-viewport-grid"></span>
          <span class="ytal-zoom-viewport-center"></span>
          <span class="ytal-zoom-viewport-box" id="ytal-zoom-viewport-box"></span>
        </div>
        <div class="ytal-zoom-viewport-guide" id="ytal-zoom-viewport-guide">${t("zoomViewportGuide")}</div>
      </div>
      <div class="ytal-zoom-controls">
        <button class="ytal-section-chip ytal-section-chip-out" id="ytal-zoom-out" type="button"></button>
        <button class="ytal-section-chip ytal-section-chip-in" id="ytal-zoom-in" type="button"></button>
        <button class="ytal-section-chip ytal-section-chip-reset ytal-section-chip-reset-full" id="ytal-zoom-reset" type="button" title="${t("zoomResetDesc")}">${t("zoomReset")}</button>
      </div>
    `;
    document.body.appendChild(zoomPopupEl);

    document
      .getElementById("ytal-zoom-out")
      .addEventListener("click", () => updateVideoZoom(-VIDEO_ZOOM_STEP));

    document
      .getElementById("ytal-zoom-in")
      .addEventListener("click", () => updateVideoZoom(VIDEO_ZOOM_STEP));

    document
      .getElementById("ytal-zoom-reset")
      .addEventListener("click", resetVideoZoom);

    bindZoomViewportInteractions(document.getElementById("ytal-zoom-viewport-frame"));

    return zoomPopupEl;
  }

  function syncZoomLauncher() {
    const shouldShow = isWatchPage();
    const host = shouldShow ? getPlayerControlsHost() : null;

    if (!shouldShow || !host) {
      if (zoomLauncherEl?.isConnected) zoomLauncherEl.remove();
      if (zoomPopupEl?.isConnected) zoomPopupEl.classList.remove("open");
      return;
    }

    const launcher = ensureZoomLauncher();
    launcher.title = isZoomOpen ? t("zoomHide") : t("zoomToggle");
    launcher.setAttribute("aria-label", isZoomOpen ? t("zoomHide") : t("zoomToggle"));
    launcher.innerHTML = `
      <span class="ytal-zoom-launcher-label">${t("zoomToggle")}</span>
      <span class="ytal-zoom-launcher-icon" aria-hidden="true">&#x26f6;</span>
    `;

    if (launcher.parentElement !== host || host.firstChild !== launcher) {
      host.insertBefore(launcher, host.firstChild);
    }

    ensureZoomPopup();
    updateZoomPopupPlacement();
  }

  function updateZoomPopupPlacement() {
    if (!zoomPopupEl) return;

    const shouldShow = isZoomOpen && zoomLauncherEl?.isConnected;
    zoomPopupEl.classList.toggle("open", !!shouldShow);

    if (!shouldShow) return;

    const rect = zoomLauncherEl.getBoundingClientRect();
    const popupWidth = Math.min(300, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.right - popupWidth, window.innerWidth - popupWidth - 12));
    const popupHeight = Math.max(zoomPopupEl.offsetHeight || 0, 214);
    const top = Math.max(12, rect.top - popupHeight - 10);

    zoomPopupEl.style.position = "fixed";
    zoomPopupEl.style.top = `${top}px`;
    zoomPopupEl.style.left = `${left}px`;
    zoomPopupEl.style.right = "auto";
    zoomPopupEl.style.width = `${popupWidth}px`;
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

    const zoomSibling =
      zoomLauncherEl?.isConnected && zoomLauncherEl.parentElement === host
        ? zoomLauncherEl.nextSibling
        : host.firstChild;

    if (launcher.parentElement !== host || launcher !== zoomSibling) {
      host.insertBefore(launcher, zoomSibling);
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

  function syncCountdownMountTarget() {
    const nextMountEl = getRootMountTarget();
    const nextOverlayEl = ensureCountdownOverlay();

    if (!nextMountEl || !nextOverlayEl) return;

    if (nextOverlayEl.parentElement !== nextMountEl) {
      nextMountEl.appendChild(nextOverlayEl);
    }

    nextOverlayEl.classList.toggle("ytal-in-fullscreen", nextMountEl !== document.body);
  }

  function updateCountdownOverlayPlacement() {
    if (!countdownOverlayEl) return;

    const mountTarget = getRootMountTarget();
    if (mountTarget !== document.body) {
      countdownOverlayEl.style.position = "absolute";
      countdownOverlayEl.style.top = "50%";
      countdownOverlayEl.style.left = "50%";
      countdownOverlayEl.style.right = "auto";
      countdownOverlayEl.style.bottom = "auto";
      return;
    }

    const playerEl = getPlayerContainer() || getVideo();
    const rect = playerEl?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) {
      countdownOverlayEl.style.position = "fixed";
      countdownOverlayEl.style.top = "50%";
      countdownOverlayEl.style.left = "50%";
      countdownOverlayEl.style.right = "auto";
      countdownOverlayEl.style.bottom = "auto";
      return;
    }

    countdownOverlayEl.style.position = "fixed";
    countdownOverlayEl.style.top = `${rect.top + rect.height / 2}px`;
    countdownOverlayEl.style.left = `${rect.left + rect.width / 2}px`;
    countdownOverlayEl.style.right = "auto";
    countdownOverlayEl.style.bottom = "auto";
  }

  function syncRootMountTarget() {
    if (!rootEl) return;

    const nextMountEl = getRootMountTarget();
    if (!nextMountEl || rootMountEl === nextMountEl) return;

    nextMountEl.appendChild(rootEl);
    rootMountEl = nextMountEl;
    rootEl.classList.toggle("ytal-in-fullscreen", rootMountEl !== document.body);
    syncToastMountTarget();
    syncCountdownMountTarget();
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
    syncZoomLauncher();
    updateZoomPopupPlacement();

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
    document.addEventListener("click", async (e) => {
      if (!isZoomOpen) return;
      if (zoomLauncherEl?.contains(e.target) || zoomPopupEl?.contains(e.target)) return;
      isZoomOpen = false;
      updateUI();
      await saveUiState();
    });
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
            <label class="ytal-countdown-control" for="ytal-countdown-select">
              <span class="ytal-countdown-label" id="ytal-countdown-label">${t("countdownLabel")}</span>
              <select class="ytal-countdown-select" id="ytal-countdown-select">
                <option value="off">${t("countdownOff")}</option>
                <option value="1">${t("countdownSeconds")("1")}</option>
                <option value="2">${t("countdownSeconds")("2")}</option>
                <option value="3">${t("countdownSeconds")("3")}</option>
              </select>
            </label>
            <button class="ytal-reset-btn" id="ytal-reset-selection" type="button" title="${t("tipReset")(formatShortcutLabel("reset"))}" aria-label="${t("resetSelection")}">${resetButtonMarkup(t("resetSelection"))}</button>
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
          <button class="ytal-btn ytal-btn-loop" id="ytal-loop-btn" title="${t("tipLoop")(formatShortcutLabel("loop"))}">${t("loop")}</button>
          <button class="ytal-btn ytal-btn-save" id="ytal-save-btn" title="${t("tipSave")(formatShortcutLabel("save"))}">${t("save")}</button>
        </div>

        <div class="ytal-section-row">
          <div class="ytal-section-label">${t("savedSegments")}</div>
          <div class="ytal-segment-toolbar" id="ytal-segment-toolbar" hidden></div>
        </div>
        <div id="ytal-segment-list" class="ytal-list"></div>

        <button class="ytal-help-toggle" id="ytal-help-toggle" title="${t("tipShortcuts")}">
          ${isHelpOpen ? t("hideShortcuts") : t("shortcuts")}
        </button>

        <div id="ytal-help-panel" class="ytal-help-panel ${isHelpOpen ? "open" : ""}">
          ${getHelpPanelMarkup()}
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
      .getElementById("ytal-countdown-select")
      .addEventListener("change", async (e) => {
        countdownMode = normalizeCountdownMode(e.target.value);
        await saveUiState();
        updateUI();
      });

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
        stopPlaylistLoop();
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
        stopPlaylistLoop();
        activeSegmentId = null;
        pointA = typeof pointB === "number"
          ? Math.max(0, Math.min(time, pointB - MIN_GAP))
          : Math.max(0, time);
      } else if (dragMode === "markerB") {
        stopPlaylistLoop();
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
        if (shouldIgnoreKeyboardShortcut(e)) return;

        const video = getVideo();
        if (!video) return;

        const code = e.code;

        if (matchesShortcut(e, "setPointA")) {
          e.preventDefault();
          e.stopPropagation();
          setPointAToCurrent({ showToastOnSet: true });
        } else if (matchesShortcut(e, "setPointB")) {
          e.preventDefault();
          e.stopPropagation();
          setPointBToCurrent({ showToastOnSet: true });
        } else if (matchesShortcut(e, "loop", { shift: true })) {
          e.preventDefault();
          e.stopPropagation();
          await togglePlaylistLoop();
        } else if (matchesShortcut(e, "loop")) {
          e.preventDefault();
          e.stopPropagation();
          toggleLoop({ showToastOnChange: true });
        } else if (matchesShortcut(e, "save")) {
          e.preventDefault();
          e.stopPropagation();
          saveSegment({ showToastOnSave: true });
        } else if (matchesShortcut(e, "reset")) {
          e.preventDefault();
          e.stopPropagation();
          clearCurrentSelection();
          updateUI();
          renderSegments();
        } else if (e.altKey && (code === "Equal" || code === "NumpadAdd")) {
          e.preventDefault();
          e.stopPropagation();
          await updateVideoZoom(VIDEO_ZOOM_STEP);
        } else if (e.altKey && (code === "Minus" || code === "NumpadSubtract")) {
          e.preventDefault();
          e.stopPropagation();
          await updateVideoZoom(-VIDEO_ZOOM_STEP);
        } else if (e.altKey && code === "Digit0") {
          e.preventDefault();
          e.stopPropagation();
          await resetVideoZoom();
        } else if (e.altKey && code === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          await nudgeVideoPan("y", VIDEO_PAN_STEP);
        } else if (e.altKey && code === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          await nudgeVideoPan("y", -VIDEO_PAN_STEP);
        } else if (e.altKey && code === "ArrowLeft") {
          e.preventDefault();
          e.stopPropagation();
          await nudgeVideoPan("x", VIDEO_PAN_STEP);
        } else if (e.altKey && code === "ArrowRight") {
          e.preventDefault();
          e.stopPropagation();
          await nudgeVideoPan("x", -VIDEO_PAN_STEP);
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
          stopPlaylistLoop({ showToastOnChange: true });
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
    bindVideoLoopEvents();

    intervalId = window.setInterval(() => {
      const video = getVideo();
      if (!video) return;

      if (boundVideoEl !== video) {
        bindVideoLoopEvents();
      }

      if (activeSegmentId === null) {
        defaultPlaybackRate = normalizePlaybackRate(video.playbackRate);
      }

      if (handleLoopBoundary(video)) {
        updateUI();
        return;
      }

      updateUI();
    }, LOOP_INTERVAL_MS);
  }

  function stopWatcher() {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }

    if (boundVideoEl) {
      boundVideoEl.removeEventListener("ended", handleVideoEnded);
      boundVideoEl = null;
    }
  }

  function teardownRoot() {
    stopWatcher();
    clearFullscreenPeekTimer();
    activeSegmentId = null;
    activeSegmentTitle = "";
    pointA = null;
    pointB = null;
    isLooping = false;
    isPlaylistLooping = false;
    isPlaylistAdvancing = false;
    defaultPlaybackRate = 1;
    restorePlaybackRate = null;
    isFullscreenPeekVisible = false;
    clearVideoZoomStyles();

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

    if (countdownOverlayEl) {
      countdownOverlayEl.remove();
      countdownOverlayEl = null;
    }

    if (inlineLauncherEl) {
      inlineLauncherEl.remove();
      inlineLauncherEl = null;
    }

    if (zoomLauncherEl) {
      zoomLauncherEl.remove();
      zoomLauncherEl = null;
    }

    if (zoomPopupEl) {
      zoomPopupEl.remove();
      zoomPopupEl = null;
    }

  }

  // ── Init ──
  async function resetForVideoChange() {
    currentVideoId = getVideoId();
    hasTrackedPageView = false;
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
    trackCurrentPageView();
  }

  async function init() {
    await migrateFromLocalStorage();
    await loadUiState();
    currentVideoId = getVideoId();
    initDefaultABPoints();
    createRoot();
    await renderSegments();
    updateUI();
    startWatcher();
    trackCurrentPageView();
    showToast(getShortcutToastText());
  }

  function trackCurrentPageView() {
    if (hasTrackedPageView || !currentVideoId) {
      return;
    }

    hasTrackedPageView = true;
    trackAnalyticsEvent("youtube_page_loaded", {
      video_id: currentVideoId,
      page_language: document.documentElement?.lang || lang,
    });
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

  function bindStorageEvents() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") return;

      if (changes[STORAGE_UI_KEY]) {
        handleUiStoreChange(changes[STORAGE_UI_KEY].newValue || {});
      }

      const videoId = getVideoId();
      if (videoId && changes[STORAGE_SEG_PREFIX + videoId]) {
        renderSegments();
        updateUI();
      }
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
  bindStorageEvents();
  bindWindowEvents();
  watchUrlChange();
  waitForVideoAndInit();
})();
