const GA_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const GA_DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect";
const STORAGE_CLIENT_ID_KEY = "yt-ab-looper-ga-client-id";
const STORAGE_SESSION_KEY = "yt-ab-looper-ga-session";
const STORAGE_ANALYTICS_OPT_OUT_KEY = "yt-ab-looper-ga-opt-out";
const STORAGE_ANALYTICS_CONFIG_KEY = "yt-ab-looper-ga-config";
const SESSION_EXPIRATION_MINUTES = 30;

// Leave these blank in git. Store real values locally via chrome.storage.
const ANALYTICS_CONFIG = {
  measurementId: "",
  apiSecret: "",
  debug: false,
};

async function getAnalyticsConfig() {
  const result = await chrome.storage.local.get(STORAGE_ANALYTICS_CONFIG_KEY);
  const storedConfig = result[STORAGE_ANALYTICS_CONFIG_KEY] || {};

  return {
    measurementId:
      storedConfig.measurementId || ANALYTICS_CONFIG.measurementId || "",
    apiSecret: storedConfig.apiSecret || ANALYTICS_CONFIG.apiSecret || "",
    debug:
      typeof storedConfig.debug === "boolean"
        ? storedConfig.debug
        : ANALYTICS_CONFIG.debug,
  };
}

async function setAnalyticsConfig(config = {}) {
  const currentConfig = await getAnalyticsConfig();
  const nextConfig = {
    measurementId:
      typeof config.measurementId === "string"
        ? config.measurementId.trim()
        : currentConfig.measurementId,
    apiSecret:
      typeof config.apiSecret === "string"
        ? config.apiSecret.trim()
        : currentConfig.apiSecret,
    debug:
      typeof config.debug === "boolean" ? config.debug : currentConfig.debug,
  };

  await chrome.storage.local.set({
    [STORAGE_ANALYTICS_CONFIG_KEY]: nextConfig,
  });

  return nextConfig;
}

async function isAnalyticsEnabled() {
  const config = await getAnalyticsConfig();
  return Boolean(config.measurementId && config.apiSecret);
}

async function isAnalyticsOptedOut() {
  const result = await chrome.storage.local.get(STORAGE_ANALYTICS_OPT_OUT_KEY);
  return Boolean(result[STORAGE_ANALYTICS_OPT_OUT_KEY]);
}

async function setAnalyticsOptOut(optOut) {
  await chrome.storage.local.set({
    [STORAGE_ANALYTICS_OPT_OUT_KEY]: Boolean(optOut),
  });
}

function getRandomDigits(length) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += Math.floor(Math.random() * 10).toString();
  }
  return value;
}

async function getOrCreateClientId() {
  const result = await chrome.storage.local.get(STORAGE_CLIENT_ID_KEY);
  let clientId = result[STORAGE_CLIENT_ID_KEY];

  if (!clientId) {
    const unixTimestampSeconds = Math.floor(Date.now() / 1000);
    clientId = `${getRandomDigits(10)}.${unixTimestampSeconds}`;
    await chrome.storage.local.set({ [STORAGE_CLIENT_ID_KEY]: clientId });
  }

  return clientId;
}

async function getOrCreateSessionId() {
  const result = await chrome.storage.session.get(STORAGE_SESSION_KEY);
  const existingSession = result[STORAGE_SESSION_KEY];
  const now = Date.now();

  if (existingSession?.id && existingSession?.timestamp) {
    const elapsedMinutes = (now - existingSession.timestamp) / 60000;
    if (elapsedMinutes <= SESSION_EXPIRATION_MINUTES) {
      await chrome.storage.session.set({
        [STORAGE_SESSION_KEY]: {
          id: existingSession.id,
          timestamp: now,
        },
      });
      return existingSession.id;
    }
  }

  const sessionId = now.toString();
  await chrome.storage.session.set({
    [STORAGE_SESSION_KEY]: {
      id: sessionId,
      timestamp: now,
    },
  });
  return sessionId;
}

function sanitizeParams(params = {}) {
  const sanitized = {};

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      sanitized[key] = value;
    }
  });

  return sanitized;
}

async function trackAnalyticsEvent(name, params = {}) {
  if (!(await isAnalyticsEnabled())) {
    return { ok: false, skipped: "missing_config" };
  }

  if (await isAnalyticsOptedOut()) {
    return { ok: false, skipped: "opted_out" };
  }

  const analyticsConfig = await getAnalyticsConfig();
  const clientId = await getOrCreateClientId();
  const sessionId = await getOrCreateSessionId();
  const endpoint = analyticsConfig.debug ? GA_DEBUG_ENDPOINT : GA_ENDPOINT;

  const body = {
    client_id: clientId,
    events: [
      {
        name,
        params: {
          session_id: sessionId,
          engagement_time_msec: 100,
          extension_version: chrome.runtime.getManifest().version,
          ...sanitizeParams(params),
        },
      },
    ],
  };

  try {
    const response = await fetch(
      `${endpoint}?measurement_id=${encodeURIComponent(analyticsConfig.measurementId)}&api_secret=${encodeURIComponent(analyticsConfig.apiSecret)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      console.warn("GA4 event request failed", name, response.status);
      return { ok: false, status: response.status };
    }

    if (analyticsConfig.debug) {
      const debugPayload = await response.json().catch(() => ({}));
      if (debugPayload.validationMessages?.length) {
        console.warn("GA4 validation messages", debugPayload.validationMessages);
      }
    }

    return { ok: true };
  } catch (error) {
    console.warn("GA4 event failed", name, error);
    return { ok: false, error: String(error) };
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  trackAnalyticsEvent("extension_installed", {
    install_reason: details.reason,
    previous_version: details.previousVersion || "none",
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "setAnalyticsConfig") {
    setAnalyticsConfig(message.config)
      .then((config) => sendResponse({ ok: true, config }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
  }

  if (message?.type === "getAnalyticsConfig") {
    getAnalyticsConfig()
      .then((config) =>
        sendResponse({
          ok: true,
          config: {
            measurementId: config.measurementId,
            hasApiSecret: Boolean(config.apiSecret),
            debug: config.debug,
          },
        })
      )
      .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
  }

  if (message?.type === "setAnalyticsOptOut") {
    setAnalyticsOptOut(message.optOut)
      .then(() =>
        sendResponse({
          ok: true,
          optedOut: Boolean(message.optOut),
        })
      )
      .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
  }

  if (message?.type === "getAnalyticsOptOut") {
    isAnalyticsOptedOut()
      .then((optedOut) => sendResponse({ ok: true, optedOut }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
  }

  if (message?.type !== "trackAnalyticsEvent" || !message?.eventName) {
    return false;
  }

  trackAnalyticsEvent(message.eventName, message.params)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));

  return true;
});
