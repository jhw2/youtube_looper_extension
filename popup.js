const STORAGE_UI_KEY = "yt-ab-looper-ui";

const texts = {
  ko: {
    desc: "유튜브 영상 페이지에서 우측 상단 패널로 A-B 구간 반복을 설정하세요.",
    openYoutube: "YouTube 열기",
    webDesc: "확장 프로그램 없이 웹에서도 AB 구간 반복을 사용해 보세요!",
    openWeb: "웹 버전 사용하기 →",
  },
  en: {
    desc: "Use the panel on the top-right of YouTube to set A-B loop sections.",
    openYoutube: "Open YouTube",
    webDesc: "Try AB looping on the web — no extension needed!",
    openWeb: "Try Web Version →",
  },
};

chrome.storage.local.get([STORAGE_UI_KEY], (result) => {
  const store = result[STORAGE_UI_KEY] || {};
  const lang = store.lang === "ko" ? "ko" : "en";

  document.getElementById("popup-desc").textContent = texts[lang].desc;
  document.getElementById("open-youtube").textContent = texts[lang].openYoutube;
  document.getElementById("popup-web-desc").textContent = texts[lang].webDesc;
  document.getElementById("open-web").textContent = texts[lang].openWeb;
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
