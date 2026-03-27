const MENU_ID = "translate-to-bangla";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Translate to Bangla",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) {
    return;
  }

  const selectedText = (info.selectionText || "").trim();
  if (!selectedText) {
    await sendResult(tab.id, "", "No text selected.", true);
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
    await sendResult(tab.id, "", "No text selected. On PDF pages, use right-click on selected text.", true);
    return;
  }

  await translateAndSend(tab.id, selectedText);
});

async function translateAndSend(tabId, text) {
  try {
    const translated = await translateToBangla(text);
    await sendResult(tabId, text, translated, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed.";
    await sendResult(tabId, text, message, true);
  }
}

async function translateToBangla(text) {
  const endpoint =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=bn&dt=t&q=" +
    encodeURIComponent(text);

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Translation service error: ${response.status}`);
  }

  const data = await response.json();
  const parts = Array.isArray(data?.[0]) ? data[0] : [];
  const translated = parts.map((entry) => entry?.[0] || "").join("").trim();

  if (!translated) {
    throw new Error("No translated text returned.");
  }

  return translated;
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

async function sendResult(tabId, original, translated, isError) {
  const payload = {
    original,
    translated,
    isError
  };

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
        const bubbleId = "quick-bangla-translator-fallback-bubble";
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

        titleNode.textContent = injectedPayload.isError ? "Translation Error" : "Bangla Translation";
        translatedNode.textContent = injectedPayload.translated || "No translation available.";
        originalNode.textContent = injectedPayload.original ? `Original: ${injectedPayload.original}` : "";
        bubble.style.display = "block";
      }
    });
  } catch {
    // Do nothing when even script injection is blocked (for example, restricted system pages).
  }
}
