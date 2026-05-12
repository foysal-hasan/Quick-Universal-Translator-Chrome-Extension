const MENU_ID = "translate-selection";

const DEFAULT_SETTINGS = {
  targetLanguage: "bn"
};

const LANGUAGE_NAMES = {
  auto: "Auto Detect",
  en: "English",
  bn: "Bangla",
  hi: "Hindi",
  ar: "Arabic",
  zh: "Chinese (Simplified)",
  "zh-TW": "Chinese (Traditional)",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  tr: "Turkish",
  ur: "Urdu",
  id: "Indonesian",
  ms: "Malay",
  th: "Thai",
  vi: "Vietnamese",
  nl: "Dutch",
  pl: "Polish",
  sv: "Swedish",
  el: "Greek",
  he: "Hebrew",
  fa: "Persian",
  uk: "Ukrainian",
  ro: "Romanian",
  cs: "Czech",
  da: "Danish",
  fi: "Finnish",
  no: "Norwegian",
  hu: "Hungarian"
};

chrome.runtime.onInstalled.addListener(async () => {
  await bootstrap();
});

chrome.runtime.onStartup.addListener(async () => {
  await bootstrap();
});

bootstrap().catch(() => {
  // Ignore boot failures here; runtime handlers will retry initialization paths.
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  if (changes.targetLanguage) {
    await syncContextMenuTitle();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_SETTINGS") {
    getSettings().then((settings) => sendResponse({ settings }));
    return true;
  }

  if (message?.type === "SET_SETTINGS") {
    const targetLanguage = normalizeLanguage(message?.settings?.targetLanguage);
    chrome.storage.sync.set({ targetLanguage }).then(async () => {
      await syncContextMenuTitle();
      sendResponse({ ok: true, settings: { targetLanguage } });
    });
    return true;
  }

  return false;
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) {
    return;
  }

  const selectedText = (info.selectionText || "").trim();
  if (!selectedText) {
    await sendResult(tab.id, {
      original: "",
      translated: "No text selected.",
      isError: true,
      sourceLanguageName: "",
      targetLanguageName: ""
    });
    return;
  }

  await translateAndSend(tab.id, selectedText);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "translate-selection") {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return;
  }

  const selectedText = await getSelectionFromTab(tab.id);
  if (!selectedText) {
    await sendResult(tab.id, {
      original: "",
      translated: "No text selected. On PDF pages, use right-click on selected text.",
      isError: true,
      sourceLanguageName: "",
      targetLanguageName: ""
    });
    return;
  }

  await translateAndSend(tab.id, selectedText);
});

async function ensureDefaultSettings() {
  const current = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const next = {};

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (!current[key]) {
      next[key] = DEFAULT_SETTINGS[key];
    }
  }

  if (Object.keys(next).length > 0) {
    await chrome.storage.sync.set(next);
  }
}

async function syncContextMenuTitle() {
  const { targetLanguage } = await getSettings();
  const targetName = getLanguageName(targetLanguage);
  await rebuildSelectionContextMenu(`Translate to ${targetName}`);
}

function rebuildSelectionContextMenu(title = "Translate selection") {
  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: MENU_ID,
        title,
        contexts: ["selection"]
      }, () => {
        // Suppress duplicate creation noise during extension reload races.
        void chrome.runtime.lastError;
        resolve();
      });
    });
  });
}

async function bootstrap() {
  await ensureDefaultSettings();
  await syncContextMenuTitle();
}

async function getSettings() {
  const data = await chrome.storage.sync.get(["targetLanguage"]);
  return {
    targetLanguage: normalizeLanguage(data.targetLanguage)
  };
}

async function translateAndSend(tabId, text) {
  const { targetLanguage } = await getSettings();

  try {
    const result = await translateText(text, targetLanguage);
    await sendResult(tabId, {
      original: text,
      translated: result.translated,
      isError: false,
      sourceLanguageName: getLanguageName(result.detectedSourceLanguage),
      targetLanguageName: getLanguageName(targetLanguage)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed.";
    await sendResult(tabId, {
      original: text,
      translated: message,
      isError: true,
      sourceLanguageName: "",
      targetLanguageName: getLanguageName(targetLanguage)
    });
  }
}

async function translateText(text, targetLanguage) {
  const endpoint =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl=" +
    encodeURIComponent(targetLanguage) +
    "&q=" +
    encodeURIComponent(text);

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Translation service error: ${response.status}`);
  }

  const data = await response.json();
  const translatedParts = Array.isArray(data?.[0]) ? data[0] : [];
  const translated = translatedParts.map((item) => item?.[0] || "").join("").trim();
  const detectedSourceLanguage = typeof data?.[2] === "string" ? data[2] : "auto";

  if (!translated) {
    throw new Error("No translated text returned.");
  }

  return {
    translated,
    detectedSourceLanguage
  };
}

function getSelectionFromTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "GET_SELECTION" }, (response) => {
      if (chrome.runtime.lastError) {
        getSelectionViaScript(tabId).then(resolve);
        return;
      }

      resolve((response?.text || "").trim());
    });
  });
}

async function getSelectionViaScript(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => (window.getSelection()?.toString() || "").trim()
    });

    return (result?.result || "").trim();
  } catch {
    return "";
  }
}

async function sendResult(tabId, payload) {
  const delivered = await sendMessageToContent(tabId, payload);
  if (!delivered) {
    await showFallbackBubble(tabId, payload);
  }
}

function sendMessageToContent(tabId, payload) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, {
      type: "SHOW_TRANSLATION",
      payload
    }, () => {
      resolve(!chrome.runtime.lastError);
    });
  });
}

async function showFallbackBubble(tabId, payload) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      args: [payload],
      func: (injectedPayload) => {
        const bubbleId = "quick-translator-fallback-bubble";
        let bubble = document.getElementById(bubbleId);

        if (!bubble) {
          bubble = document.createElement("div");
          bubble.id = bubbleId;
          bubble.style.position = "fixed";
          bubble.style.right = "16px";
          bubble.style.bottom = "16px";
          bubble.style.width = "min(420px, calc(100vw - 24px))";
          bubble.style.maxHeight = "60vh";
          bubble.style.overflow = "auto";
          bubble.style.zIndex = "2147483647";
          bubble.style.color = "#11293b";
          bubble.style.background = "linear-gradient(145deg, #f6fbff, #e9f5ff)";
          bubble.style.border = "1px solid #8dbfe6";
          bubble.style.borderRadius = "12px";
          bubble.style.boxShadow = "0 16px 30px rgba(0, 45, 89, 0.24)";
          bubble.style.font = "14px/1.45 Segoe UI, Tahoma, sans-serif";
          bubble.style.padding = "12px";

          const header = document.createElement("div");
          header.style.display = "flex";
          header.style.alignItems = "center";
          header.style.justifyContent = "space-between";

          const title = document.createElement("div");
          title.className = "qbt-fallback-title";
          title.style.fontWeight = "700";

          const actions = document.createElement("div");
          actions.style.display = "flex";
          actions.style.gap = "8px";

          const copyBtn = document.createElement("button");
          copyBtn.textContent = "Copy";
          copyBtn.style.border = "1px solid #8dbfe6";
          copyBtn.style.background = "#ffffff";
          copyBtn.style.color = "#0b3e64";
          copyBtn.style.borderRadius = "8px";
          copyBtn.style.padding = "4px 8px";
          copyBtn.style.cursor = "pointer";

          const closeBtn = document.createElement("button");
          closeBtn.textContent = "Close";
          closeBtn.style.border = "1px solid #8dbfe6";
          closeBtn.style.background = "#ffffff";
          closeBtn.style.color = "#0b3e64";
          closeBtn.style.borderRadius = "8px";
          closeBtn.style.padding = "4px 8px";
          closeBtn.style.cursor = "pointer";

          const translatedNode = document.createElement("div");
          translatedNode.className = "qbt-fallback-translated";
          translatedNode.style.marginTop = "10px";
          translatedNode.style.padding = "10px";
          translatedNode.style.borderRadius = "8px";
          translatedNode.style.background = "#ffffff";
          translatedNode.style.whiteSpace = "pre-wrap";

          const originalNode = document.createElement("div");
          originalNode.className = "qbt-fallback-original";
          originalNode.style.marginTop = "8px";
          originalNode.style.color = "#4b6377";
          originalNode.style.fontSize = "12px";

          copyBtn.addEventListener("click", async () => {
            const text = translatedNode.textContent || "";
            if (!text) {
              return;
            }
            try {
              await navigator.clipboard.writeText(text);
              copyBtn.textContent = "Copied";
            } catch {
              copyBtn.textContent = "Blocked";
            }
            setTimeout(() => {
              copyBtn.textContent = "Copy";
            }, 900);
          });

          closeBtn.addEventListener("click", () => {
            bubble.style.display = "none";
          });

          actions.appendChild(copyBtn);
          actions.appendChild(closeBtn);
          header.appendChild(title);
          header.appendChild(actions);
          bubble.appendChild(header);
          bubble.appendChild(translatedNode);
          bubble.appendChild(originalNode);

          document.documentElement.appendChild(bubble);
        }

        const titleNode = bubble.querySelector(".qbt-fallback-title");
        const translatedNode = bubble.querySelector(".qbt-fallback-translated");
        const originalNode = bubble.querySelector(".qbt-fallback-original");

        if (!titleNode || !translatedNode || !originalNode) {
          return;
        }

        const sourceName = injectedPayload.sourceLanguageName || "Auto";
        const targetName = injectedPayload.targetLanguageName || "Target";

        titleNode.textContent = injectedPayload.isError
          ? "Translation Error"
          : `Translation: ${sourceName} -> ${targetName}`;
        translatedNode.textContent = injectedPayload.translated || "No translation available.";
        originalNode.textContent = injectedPayload.original ? `Original: ${injectedPayload.original}` : "";
        bubble.style.display = "block";
      }
    });
  } catch {
    // Do nothing when script injection is blocked on restricted pages.
  }
}

function normalizeLanguage(languageCode) {
  if (typeof languageCode !== "string") {
    return DEFAULT_SETTINGS.targetLanguage;
  }

  const normalized = languageCode.trim();
  if (!normalized) {
    return DEFAULT_SETTINGS.targetLanguage;
  }

  return LANGUAGE_NAMES[normalized] ? normalized : DEFAULT_SETTINGS.targetLanguage;
}

function getLanguageName(languageCode) {
  return LANGUAGE_NAMES[languageCode] || languageCode || "Unknown";
}


async function logClipboardText() {
  try {
    // Request text from clipboard
    const text = await navigator?.clipboard?.readText();
    console.log("Last copied text:", text);
  } catch (err) {
    console.log("Failed to read clipboard contents: ", err);
  }
}

// Trigger the function
logClipboardText();