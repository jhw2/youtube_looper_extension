const STORAGE_UI_KEY = "yt-ab-looper-ui";

const texts = {
  ko: {
    title: "유튜브 구간 반복을 바로 시작하세요",
    desc: "영상에서 A와 B를 찍고 원하는 구간만 반복하거나 저장할 수 있어요.",
    steps: [
      {
        title: "YouTube 영상 열기",
        copy: "반복하고 싶은 영상을 열면 오른쪽 위에 AB Loop 패널이 나타나요.",
      },
      {
        title: "A와 B 지점 찍기",
        copy: "시작 지점에서 A, 끝 지점에서 B를 눌러 반복 범위를 정하세요.",
      },
      {
        title: "Loop 또는 Save 사용",
        copy: "바로 반복하거나, 자주 보는 구간은 저장해서 다시 불러올 수 있어요.",
      },
    ],
    openYoutube: "YouTube에서 시작하기",
    webDesc: "확장 프로그램을 켜지 않아도 웹 버전에서 같은 흐름으로 바로 써볼 수 있어요.",
    openWeb: "웹 버전 열기",
    shortcutLabel: "빠른 조작",
    shortcuts: "A 시작점, B 끝점, L 루프, S 저장",
  },
  en: {
    title: "Start looping YouTube segments right away",
    desc: "Pick point A and B on a video, then loop or save the exact part you want.",
    steps: [
      {
        title: "Open a YouTube video",
        copy: "The AB Loop panel appears on the top-right of the watch page.",
      },
      {
        title: "Mark point A and B",
        copy: "Press A where the loop should start and B where it should end.",
      },
      {
        title: "Loop or save it",
        copy: "Repeat the segment instantly or save it for later playback.",
      },
    ],
    openYoutube: "Start on YouTube",
    webDesc: "You can also use the same looping flow on the web without the extension.",
    openWeb: "Open Web Version",
    shortcutLabel: "Quick Controls",
    shortcuts: "A start, B end, L loop, S save",
  },
};

chrome.storage.local.get([STORAGE_UI_KEY], (result) => {
  const store = result[STORAGE_UI_KEY] || {};
  const lang = store.lang === "ko" ? "ko" : "en";

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
