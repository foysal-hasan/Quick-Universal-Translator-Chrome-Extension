const MENU_ID = "translate-selection";
const OFFSCREEN_CLIPBOARD_PATH = "offscreen/clipboard.html";
const OFFSCREEN_CLIPBOARD_TARGET = "OFFSCREEN_CLIPBOARD";

const DEFAULT_SETTINGS = {
  targetLanguage: "bn",
  showOriginalText: true,
  bubblePosition: "top-right"
};
const CLIPBOARD_FALLBACK_WAIT_MS = 150;

const BUBBLE_POSITIONS = new Set([
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left"
]);

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
    const showOriginalText = normalizeShowOriginalText(message?.settings?.showOriginalText);
    const bubblePosition = normalizeBubblePosition(message?.settings?.bubblePosition);
    chrome.storage.sync.set({ targetLanguage, showOriginalText, bubblePosition }).then(async () => {
      await syncContextMenuTitle();
      sendResponse({ ok: true, settings: { targetLanguage, showOriginalText, bubblePosition } });
    });
    return true;
  }

  return false;
});

// This function runs inside the webpage context
// function triggerCopy() {
//   const selectedText = window.getSelection().toString();

//   console.log("triggerCopy called with selected text:", selectedText);
//   if (selectedText) {
//     document.execCommand('copy');
//     console.log("Alt+C triggered copy for:", selectedText);
//   }
// }

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "close-translation-popup") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return;
    }

    await closeTranslationPopup(tab.id);
    return;
  }

  // if (command === "print-clipboard-text") {

  //   chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  //     if (tabs[0]) {
  //       chrome.scripting.executeScript({
  //         target: { tabId: tabs[0].id },
  //         func: triggerCopy
  //       });
  //     }
  //   });

  //   console.log("[QBT] Alt+C triggered for clipboard read");

  //   return


  //   const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  //   if (!tab?.id) {
  //     console.log("[QBT] No active tab for clipboard read");
  //     return;
  //   }

  //   const isPDF = isLikelyPdfTab(tab);
  //   if (isPDF) {
  //     console.log("[QBT] Alt+C PDF copy started", {
  //       tabId: tab.id,
  //       url: tab.url || "",
  //       title: tab.title || ""
  //     });
  //   }

  //   let text = "";

  //   if (isPDF) {
  //     text = await getSelectionFromTab(tab.id);

  //     if (!text) {
  //       text = await extractFromPDFViewer(tab.id);
  //     }

  //     if (!text) {
  //       text = await getPdfSelectionViaViewerMessaging(tab.id);
  //     }

  //     if (text) {
  //       const copied = await writeClipboardTextFromActiveTab(tab.id, text);
  //       if (!copied) {
  //         await writeClipboardTextViaOffscreen(text);
  //       }
  //     }
  //   } else {
  //     await tryCopySelection(tab.id);
  //     await wait(CLIPBOARD_FALLBACK_WAIT_MS);
  //     text = await readClipboardTextFromActiveTab(tab.id);
  //   }

  //   if (!text) {
  //     await tryCopySelection(tab.id);
  //     await wait(CLIPBOARD_FALLBACK_WAIT_MS);
  //     text = await readClipboardTextFromActiveTab(tab.id);
  //   }

  //   if (!text) {
  //     text = await readClipboardTextViaOffscreen();
  //   }

  //   console.log("[QBT] Last copied text!!!:", text);
  //   return;
  // }

  if (command !== "translate-selection") {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return;
  }

  // console.log("[QBT] Alt+T triggered", {
  //   tabId: tab.id,
  //   url: tab.url || "",
  //   title: tab.title || ""
  // });

  const isPDF = isLikelyPdfTab(tab);

  let selectedText = "";
  let selectedTextSource = "";
  if (isPDF) {
    selectedText = await readClipboardTextFromActiveTab(tab.id);
    if (selectedText) {
      selectedTextSource = "clipboard";
      // console.log("[QBT] PDF translation using last copied clipboard text", {
      //   length: selectedText.length
      // });
    }
  }

  if (!selectedText) {
    selectedText = await getSelectionFromTab(tab.id);
    if (selectedText) {
      selectedTextSource = "content message";
    }
  }

  if (selectedText && selectedTextSource === "content message") {
    // console.log("[QBT] Selection found via content message", { length: selectedText.length });
  }

  // Try PDF specific extraction when regular selection is unavailable.
  if (!selectedText && isPDF) {
    selectedText = await extractFromPDFViewer(tab.id);
    if (selectedText) {
      // console.log("[QBT] Selection found via PDF viewer extraction", { length: selectedText.length });
    }
  }

  if (!selectedText && isPDF) {
    selectedText = await getPdfSelectionViaViewerMessaging(tab.id);
    if (selectedText) {
      // console.log("[QBT] Selection found via PDF viewer messaging", { length: selectedText.length });
    }
  }

  // Last-resort PDF fallback: copy selection and read it from clipboard.
  if (!selectedText && isPDF) {
    selectedText = await getRecentCopiedTextFromTab(tab.id);
    if (selectedText) {
      // console.log("[QBT] Selection found via recent Ctrl+C cache", { length: selectedText.length });
    }
  }

  // Last-resort PDF fallback: copy selection and read it from clipboard.
  if (!selectedText && isPDF) {
    selectedText = await getPdfSelectionViaClipboard(tab.id);
    if (selectedText) {
      // console.log("[QBT] Selection found via clipboard fallback", { length: selectedText.length });
    }
  }

  if (!selectedText) {
    selectedText = await getClipboardTextForTranslation(tab.id, { attemptCopy: isPDF });
    if (selectedText) {
      // console.log("[QBT] Selection found via direct clipboard read", { length: selectedText.length, isPDF });
    }
  }

  const normalizedText = normalizeSelectedText(selectedText, { isPDF });
  if (selectedText && !normalizedText) {
    // console.log("[QBT] Selected text became empty after normalization", {
    //   tabId: tab.id,
    //   isPDF
    // });
  }

  if (!normalizedText) {
    const { targetLanguage, showOriginalText, bubblePosition } = await getSettings();
    const message = getNoTextMessage(isPDF);
    
    await sendResult(tab.id, {
      original: "",
      translated: message,
      isError: true,
      sourceLanguageName: "",
      targetLanguageName: getLanguageName(targetLanguage),
      showOriginalText,
      bubblePosition
    });
    return;
  }

  await translateAndSend(tab.id, normalizedText);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) {
    return;
  }

  const isPDF = isLikelyPdfTab(tab);
  const normalizedText = normalizeSelectedText(info.selectionText || "", { isPDF });
  if (!normalizedText) {
    const { targetLanguage, showOriginalText, bubblePosition } = await getSettings();
    await sendResult(tab.id, {
      original: "",
      translated: getNoTextMessage(isPDF),
      isError: true,
      sourceLanguageName: "",
      targetLanguageName: getLanguageName(targetLanguage),
      showOriginalText,
      bubblePosition
    });
    return;
  }

  await translateAndSend(tab.id, normalizedText);
});

async function ensureDefaultSettings() {
  const current = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));
  const next = {};

  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (typeof current[key] === "undefined") {
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
  const data = await chrome.storage.sync.get(["targetLanguage", "showOriginalText", "bubblePosition"]);
  return {
    targetLanguage: normalizeLanguage(data.targetLanguage),
    showOriginalText: normalizeShowOriginalText(data.showOriginalText),
    bubblePosition: normalizeBubblePosition(data.bubblePosition)
  };
}

async function translateAndSend(tabId, text) {
  const { targetLanguage, showOriginalText, bubblePosition } = await getSettings();
  const targetLanguageName = getLanguageName(targetLanguage);

  // Show loading state
  await sendResult(tabId, {
    original: text,
    translated: "Translating...",
    isError: false,
    isLoading: true,
    sourceLanguageName: "",
    targetLanguageName,
    showOriginalText,
    bubblePosition
  });

  try {
    const result = await translateText(text, targetLanguage);
    await sendResult(tabId, {
      original: text,
      translated: result.translated,
      isError: false,
      isLoading: false,
      sourceLanguageName: getLanguageName(result.detectedSourceLanguage),
      targetLanguageName,
      showOriginalText,
      bubblePosition
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed.";
    await sendResult(tabId, {
      original: text,
      translated: message,
      isError: true,
      isLoading: false,
      sourceLanguageName: "",
      targetLanguageName,
      showOriginalText,
      bubblePosition
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

async function tryClipboardFallback(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: "MAIN",
      func: () => {
        try {
          const isMac = navigator.platform.toLowerCase().includes("mac");
          const target = document.activeElement || document.body || document.documentElement;
          if (target && typeof target.focus === "function") {
            target.focus();
          }

          // Fire synthetic Ctrl/Cmd+C sequence for viewers that handle keyboard shortcuts internally.
          const downEvent = new KeyboardEvent("keydown", {
            key: "c",
            code: "KeyC",
            keyCode: 67,
            which: 67,
            ctrlKey: !isMac,
            metaKey: isMac,
            bubbles: true,
            cancelable: true
          });
          const upEvent = new KeyboardEvent("keyup", {
            key: "c",
            code: "KeyC",
            keyCode: 67,
            which: 67,
            ctrlKey: !isMac,
            metaKey: isMac,
            bubbles: true,
            cancelable: true
          });

          target?.dispatchEvent?.(downEvent);
          document.dispatchEvent(downEvent);
          document.execCommand("copy");
          target?.dispatchEvent?.(upEvent);
          document.dispatchEvent(upEvent);
        } catch {
          // Ignore errors
        }
      }
    });

    // Some pages respond better in isolated world; attempt there too.
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        try {
          document.execCommand("copy");
        } catch {
          // Ignore errors
        }
      }
    });
  } catch {
    // Ignore
  }
}

function tryCopySelection(tabId) {
  return tryClipboardFallback(tabId);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLikelyPdfTab(tab) {
  const url = (tab?.url || "").toLowerCase();
  const title = (tab?.title || "").toLowerCase();
  return (
    url.startsWith("file://") ||
    url.startsWith("blob:") ||
    url.includes(".pdf") ||
    url.includes("pdf") ||
    title.includes(".pdf")
  );
}

let offscreenDocumentCreation;

async function ensureOffscreenClipboardDocument() {
  if (!chrome.offscreen?.createDocument) {
    throw new Error("Offscreen API is unavailable.");
  }

  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_CLIPBOARD_PATH);
  const alreadyCreated = await hasOffscreenDocument(offscreenUrl);
  if (alreadyCreated) {
    return;
  }

  if (offscreenDocumentCreation) {
    await offscreenDocumentCreation;
    return;
  }

  offscreenDocumentCreation = chrome.offscreen.createDocument({
    url: OFFSCREEN_CLIPBOARD_PATH,
    reasons: ["CLIPBOARD"],
    justification: "Read and restore clipboard around PDF copy fallback for Alt+T translation."
  });

  try {
    await offscreenDocumentCreation;
  } finally {
    offscreenDocumentCreation = undefined;
  }
}

async function hasOffscreenDocument(offscreenUrl) {
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl]
    });
    return contexts.length > 0;
  }

  if (self.clients?.matchAll) {
    const matchedClients = await self.clients.matchAll();
    return matchedClients.some((client) => client.url === offscreenUrl);
  }

  return false;
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

async function readClipboardTextViaOffscreen() {
  try {
    // console.log("[QBT] Starting clipboard read via offscreen...");
    await ensureOffscreenClipboardDocument();
    // console.log("[QBT] Offscreen document ready, sending READ_CLIPBOARD_TEXT message...");
    
    const response = await sendRuntimeMessage({
      target: OFFSCREEN_CLIPBOARD_TARGET,
      type: "READ_CLIPBOARD_TEXT"
    });
    
    const text = typeof response?.text === "string" ? response.text : "";
    // console.log("[QBT] Clipboard read response:", { text, textLength: text.length, response });
    return text;
  } catch (error) {
    console.error("[QBT] Error reading clipboard via offscreen:", error);
    return "";
  }
}

async function readClipboardTextFromActiveTab(tabId) {
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        try {
          return {
            ok: true,
            text: await navigator.clipboard.readText()
          };
        } catch (error) {
          return {
            ok: false,
            error: `${error.name}: ${error.message}`
          };
        }
      }
    });

    if (!result?.ok) {
      console.error("[QBT] Active tab clipboard read failed:", result?.error || "Unknown error");
      return "";
    }

    return typeof result.text === "string" ? result.text.trim() : "";
  } catch (error) {
    console.error("[QBT] Clipboard read script failed:", error);
    return "";
  }
}

async function writeClipboardTextFromActiveTab(tabId, text) {
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (textToWrite) => {
        try {
          await navigator.clipboard.writeText(textToWrite);
          return {
            ok: true
          };
        } catch (error) {
          return {
            ok: false,
            error: `${error.name}: ${error.message}`
          };
        }
      },
      args: [typeof text === "string" ? text : ""]
    });

    if (!result?.ok) {
      console.error("[QBT] Active tab clipboard write failed:", result?.error || "Unknown error");
      return false;
    }

    return true;
  } catch (error) {
    console.error("[QBT] Clipboard write script failed:", error);
    return false;
  }
}

async function writeClipboardTextViaOffscreen(text) {
  try {
    await ensureOffscreenClipboardDocument();
    const response = await sendRuntimeMessage({
      target: OFFSCREEN_CLIPBOARD_TARGET,
      type: "SET_CLIPBOARD_TEXT",
      text: typeof text === "string" ? text : ""
    });
    return response?.ok === true;
  } catch {
    return false;
  }
}

async function getPdfSelectionViaClipboard(tabId) {
  // console.log("[QBT] PDF clipboard fallback started (clipboard-only)", { tabId });

  try {
    await tryCopySelection(tabId);
    await wait(CLIPBOARD_FALLBACK_WAIT_MS);

    const clipboardText = await readClipboardTextViaOffscreen();
    const trimmedText = clipboardText.trim();

    // console.log("[QBT] Clipboard text read", {
    //   tabId,
    //   length: trimmedText.length,
    //   preview: trimmedText.slice(0, 80)
    // });

    return trimmedText;
  } catch (error) {
    console.error("[QBT] Error reading clipboard", { tabId, error });
    return "";
  }
}

async function getClipboardTextForTranslation(tabId, options = {}) {
  const attemptCopy = options?.attemptCopy === true;

  try {
    if (attemptCopy && tabId) {
      await tryCopySelection(tabId);
      await wait(CLIPBOARD_FALLBACK_WAIT_MS);
    }

    const clipboardText = await readClipboardTextViaOffscreen();
    const trimmedText = clipboardText.trim();

    console.log("[QBT] Direct clipboard read", {
      tabId,
      attemptCopy,
      length: trimmedText.length,
      preview: trimmedText.slice(0, 80)
    });

    return trimmedText;
  } catch (error) {
    console.error("[QBT] Direct clipboard read failed", { tabId, attemptCopy, error });
    return "";
  }
}

async function getPdfSelectionViaViewerMessaging(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: "MAIN",
      func: () => {
        return new Promise((resolve) => {
          const viewerOrigin = "chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai";
          const timeoutMs = 1200;

          function findPdfViewerTarget(root) {
            if (!root || typeof root.querySelector !== "function") {
              return null;
            }

            const viewerFrame = root.querySelector(`iframe[src*="${viewerOrigin}"]`);
            if (viewerFrame?.contentWindow && typeof viewerFrame.contentWindow.postMessage === "function") {
              return { type: "iframe", node: viewerFrame };
            }

            const embeds = root.querySelectorAll("embed");
            for (const embed of embeds) {
              if (typeof embed?.postMessage === "function") {
                return { type: "embed", node: embed };
              }
            }

            const elements = root.querySelectorAll("*");
            for (const element of elements) {
              if (!element?.shadowRoot) {
                continue;
              }

              const nestedTarget = findPdfViewerTarget(element.shadowRoot);
              if (nestedTarget) {
                return nestedTarget;
              }
            }

            return null;
          }

          const target = findPdfViewerTarget(document);
          if (!target) {
            resolve({
              text: "",
              debug: {
                locationHref: window.location.href,
                targetType: "none"
              }
            });
            return;
          }

          let settled = false;

          const finish = (text) => {
            if (settled) {
              return;
            }
            settled = true;
            window.removeEventListener("message", onMessage, true);
            clearTimeout(timerId);
            resolve({
              text: typeof text === "string" ? text.trim() : "",
              debug: {
                locationHref: window.location.href,
                targetType: target.type
              }
            });
          };

          const onMessage = (event) => {
            const data = event.data;
            const origin = typeof event.origin === "string" ? event.origin : "";

            if (!data || data.type !== "getSelectedTextReply") {
              return;
            }

            if (origin && origin !== viewerOrigin && origin !== window.location.origin) {
              return;
            }

            finish(data.selectedText || "");
          };

          const timerId = window.setTimeout(() => finish(""), timeoutMs);
          window.addEventListener("message", onMessage, true);

          try {
            if (target.type === "embed") {
              target.node.postMessage({ type: "getSelectedText" });
            } else {
              target.node.contentWindow.postMessage({ type: "getSelectedText" }, viewerOrigin);
            }
          } catch (error) {
            console.warn("[QBT] PDF viewer message dispatch failed in page context", {
              error: error instanceof Error ? error.message : String(error),
              locationHref: window.location.href,
              targetType: target.type
            });
            finish("");
          }
        });
      }
    });

    for (const result of results) {
      const injectedResult = result.result || {};
      const text = typeof injectedResult.text === "string" ? injectedResult.text.trim() : "";
      // console.log("[QBT] PDF viewer messaging probe", {
      //   tabId,
      //   frameId: result.frameId,
      //   ...injectedResult.debug,
      //   textLength: text.length
      // });

      if (text) {
        return text;
      }
    }

    return "";
  } catch (error) {
    console.warn("[QBT] PDF viewer messaging failed", { tabId, error });
    return "";
  }
}

async function extractFromPDFViewer(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: "MAIN",
      func: () => {
        // Try to extract from Chrome's built-in PDF viewer
        const candidates = [];

        // Method 1: Standard window.getSelection()
        const selection = window.getSelection()?.toString?.()?.trim() || "";
        if (selection) {
          candidates.push(selection);
        }

        // Method 2: Check for selected elements in PDF text layers
        const textLayers = document.querySelectorAll(".textLayer");
        for (const layer of textLayers) {
          const text = layer.innerText?.trim() || "";
          if (text && text.length > 0 && text.length < 5000) {
            candidates.push(text);
          }
        }

        // Method 3: Check shadow DOM for PDF elements
        const allElements = document.querySelectorAll("*");
        for (const el of allElements) {
          if (el.shadowRoot) {
            try {
              const shadowText = el.shadowRoot.getSelection?.()?.toString?.()?.trim() || "";
              if (shadowText) {
                candidates.push(shadowText);
              }
            } catch (e) {
              // Ignore shadow DOM errors
            }
          }
        }

        // Return longest non-empty candidate
        return candidates
          .filter(c => c && c.length > 0)
          .sort((a, b) => b.length - a.length)[0] || "";
      }
    });

    // Collect results from all frames
    for (const result of results) {
      const text = (result.result || "").trim();
      if (text && text.length > 2) {
        return text;
      }
    }

    return "";
  } catch {
    return "";
  }
}

function getSelectionFromTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "GET_SELECTION" }, (response) => {
      if (chrome.runtime.lastError) {
        getSelectionViaScript(tabId).then(resolve);
        return;
      }

      const contentSelection = (response?.text || "").trim();
      if (contentSelection) {
        resolve(contentSelection);
        return;
      }

      getSelectionViaScript(tabId).then(resolve);
    });
  });
}

function getRecentCopiedTextFromTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "GET_RECENT_COPIED_TEXT" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve("");
        return;
      }

      resolve((response?.text || "").trim());
    });
  });
}

async function getSelectionViaScript(tabId) {
  try {
    // Try all frames since PDFs might have content in iframes
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        const directSelection = (window.getSelection?.()?.toString?.() || "").trim();
        if (directSelection) {
          return directSelection;
        }

        const active = document.activeElement;
        if (
          active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLInputElement && /^(text|search|url|tel|password)$/i.test(active.type))
        ) {
          const start = active.selectionStart || 0;
          const end = active.selectionEnd || 0;
          if (end > start) {
            return (active.value || "").slice(start, end).trim();
          }
        }

        return "";
      }
    });

    // Collect and return longest selection found
    let longestText = "";
    for (const result of results) {
      const text = (result.result || "").trim();
      if (text && text.length > longestText.length) {
        longestText = text;
      }
    }

    return longestText;
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

async function closeTranslationPopup(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const contentBubble = document.getElementById("quick-bangla-translator-bubble");
        if (contentBubble) {
          contentBubble.classList.add("qbt-hidden");
        }

        const fallbackBubble = document.getElementById("quick-translator-fallback-bubble");
        if (fallbackBubble) {
          fallbackBubble.remove();
        }
      }
    });
  } catch (error) {
    console.error("[QBT] Close popup failed:", error);
  }
}

function sendMessageToContent(tabId, payload) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, {
      type: "SHOW_TRANSLATION",
      payload
    }, {
      frameId: 0
    }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }

      resolve(response?.ok === true);
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
        const showOriginalText = injectedPayload.showOriginalText !== false;
        const bubblePosition =
          typeof injectedPayload.bubblePosition === "string"
            ? injectedPayload.bubblePosition
            : "bottom-right";

        applyPosition(bubble, bubblePosition);

        titleNode.textContent = injectedPayload.isError
          ? "Translation Error"
          : `Translation: ${sourceName} -> ${targetName}`;
        translatedNode.textContent = injectedPayload.translated || "No translation available.";
        originalNode.textContent = showOriginalText && injectedPayload.original
          ? `Original: ${injectedPayload.original}`
          : "";
        originalNode.style.display = showOriginalText ? "block" : "none";
        bubble.style.display = "block";

        function applyPosition(node, position) {
          node.style.top = "";
          node.style.right = "";
          node.style.bottom = "";
          node.style.left = "";

          if (position === "top-left") {
            node.style.top = "16px";
            node.style.left = "16px";
            return;
          }

          if (position === "top-right") {
            node.style.top = "16px";
            node.style.right = "16px";
            return;
          }

          if (position === "bottom-left") {
            node.style.bottom = "16px";
            node.style.left = "16px";
            return;
          }

          node.style.bottom = "16px";
          node.style.right = "16px";
        }
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

function normalizeSelectedText(text, options = {}) {
  if (typeof text !== "string") {
    return "";
  }

  const isPDF = options?.isPDF === true;
  let normalized = text
    .replace(/\u00ad/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n");

  if (isPDF) {
    // Join words split by PDF line wrapping: "pro-\ngram" -> "program".
    normalized = normalized.replace(/([A-Za-z0-9])\-\s*\n\s*([A-Za-z0-9])/g, "$1$2");
  }

  normalized = normalized
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return normalized;
}

function getNoTextMessage(isPDF) {
  return "Webpage: select text, then press ALT+T.\nPDF: select text, press Ctrl+C, then press ALT+T.\nClose popup: press ALT+R.";
}

function getLanguageName(languageCode) {
  return LANGUAGE_NAMES[languageCode] || languageCode || "Unknown";
}

function normalizeShowOriginalText(value) {
  return typeof value === "boolean" ? value : DEFAULT_SETTINGS.showOriginalText;
}

function normalizeBubblePosition(value) {
  return typeof value === "string" && BUBBLE_POSITIONS.has(value)
    ? value
    : DEFAULT_SETTINGS.bubblePosition;
}

async function logClipboardText() {
  try {
    // Request text from clipboard
    const text = await navigator?.clipboard?.readText();
    // console.log("Last copied text:", text);
  } catch (err) {
    console.log("Failed to read clipboard contents: ", err);
  }
}

// Trigger the function
// logClipboardText();



