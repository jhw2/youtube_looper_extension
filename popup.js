const STORAGE_UI_KEY = "yt-ab-looper-ui";

const texts = {
  ko: {
    title: "유튜브 구간 저장과 반복을 바로 시작하세요",
    desc: "A·B 마커로 구간을 정하고 반복하거나 저장할 수 있어요. 악기 연습이나 집중 학습에 특히 잘 맞아요.",
    steps: [
      {
        title: "YouTube 영상 열기",
        copy: "반복하거나 저장하고 싶은 영상을 열면 오른쪽 위에 AB Loop 패널이 나타나요.",
      },
      {
        title: "A·B 마커 드래그하기",
        copy: "재생바의 A·B 마커를 드래그해 원하는 구간을 정확히 잡아보세요. 키보드 A·B 키도 사용할 수 있어요.",
      },
      {
        title: "반복, 저장, 전체 반복",
        copy: "현재 구간을 바로 반복하거나 저장하고, 저장한 구간은 전체 반복으로 순서대로 다시 들을 수 있어요. 악기 연습이나 집중 학습에 특히 유용해요.",
      },
    ],
    openYoutube: "YouTube에서 시작하기",
    webDesc: "확장 프로그램을 켜지 않아도 웹 버전에서 같은 흐름으로 바로 써볼 수 있어요.",
    openWeb: "웹 버전 열기",
    shortcutLabel: "빠른 조작",
    shortcuts: "A 시작점, B 끝점, L 구간 반복, Shift + L 구간 전체 반복, S 저장, R 리셋",
  },
  en: {
    title: "Start saving and looping YouTube segments right away",
    desc: "Use the A·B markers to set a range, loop it, or save it for later. Great for instrument practice and focused study.",
    steps: [
      {
        title: "Open a YouTube video",
        copy: "Open the video you want to loop or save and the AB Loop panel appears on the top-right of the watch page.",
      },
      {
        title: "Drag the A·B markers",
        copy: "Drag A and B on the timeline to capture the exact range you want. You can also use the A and B keys.",
      },
      {
        title: "Loop, save, or loop all",
        copy: "Loop the current range right away, save it, or replay all saved segments in order. Especially useful for instrument practice and focused study.",
      },
    ],
    openYoutube: "Start on YouTube",
    webDesc: "You can also use the same looping flow on the web without the extension.",
    openWeb: "Open Web Version",
    shortcutLabel: "Quick Controls",
    shortcuts: "A start, B end, L loop range, Shift + L loop all segments, S save, R reset",
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

chrome.storage.local.get([STORAGE_UI_KEY], (result) => {
  const store = result[STORAGE_UI_KEY] || {};
  const lang =
    store.lang === "ko" || store.lang === "en"
      ? store.lang
      : detectDefaultLang();

  document.getElementById("popup-title").textContent = texts[lang].title;
  document.getElementById("popup-desc").textContent = texts[lang].desc;
  texts[lang].steps.forEach((step, index) => {
    document.getElementById(`step-${index + 1}-title`).textContent = step.title;
    document.getElementById(`step-${index + 1}-copy`).textContent = step.copy;
  });
  document.getElementById("open-youtube").textContent = texts[lang].openYoutube;
  document.getElementById("popup-web-desc").textContent = texts[lang].webDesc;
  document.getElementById("open-web").textContent = texts[lang].openWeb;
  document.getElementById("popup-shortcut-label").textContent = texts[lang].shortcutLabel;
  document.getElementById("popup-shortcuts").textContent = texts[lang].shortcuts;
});

document.getElementById("open-youtube").addEventListener("click", () => {
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

    chrome.tabs.create({ url: webUrl });
  });
});
