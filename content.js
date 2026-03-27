const BUBBLE_ID = "quick-bangla-translator-bubble";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_SELECTION") {
    sendResponse({ text: getSelectedText() });
    return true;
  }

  if (message?.type === "SHOW_TRANSLATION") {
    showTranslationBubble(message.payload || {});
  }

  return false;
});

function getSelectedText() {
  const selection = (window.getSelection()?.toString() || "").trim();
  if (selection) {
    return selection;
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

function showTranslationBubble(payload) {
  const {
    original = "",
    translated = "",
    isError = false,
    sourceLanguageName = "Auto",
    targetLanguageName = "Target",
    showOriginalText = true
  } = payload;
  const bubble = ensureBubble();

  const title = bubble.querySelector(".qbt-title");
  const translatedNode = bubble.querySelector(".qbt-translated");
  const originalNode = bubble.querySelector(".qbt-original");

  if (!title || !translatedNode || !originalNode) {
    return;
  }

  title.textContent = isError
    ? "Translation Error"
    : `Translation: ${sourceLanguageName} -> ${targetLanguageName}`;
  translatedNode.textContent = translated || "No translation available.";
  originalNode.textContent = showOriginalText && original ? `Original: ${original}` : "";
  originalNode.style.display = showOriginalText ? "block" : "none";
  bubble.classList.remove("qbt-hidden", "qbt-error");
  bubble.classList.toggle("qbt-error", Boolean(isError));
}

function ensureBubble() {
  let bubble = document.getElementById(BUBBLE_ID);
  if (bubble) {
    return bubble;
  }

  bubble = document.createElement("div");
  bubble.id = BUBBLE_ID;
  bubble.className = "qbt-bubble qbt-hidden";

  bubble.innerHTML = `
    <div class="qbt-header">
      <div class="qbt-title">Translation</div>
      <div class="qbt-actions">
        <button class="qbt-btn" data-action="copy" title="Copy translated text">Copy</button>
        <button class="qbt-btn" data-action="close" title="Close">Close</button>
      </div>
    </div>
    <div class="qbt-translated"></div>
    <div class="qbt-original"></div>
  `;

  bubble.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const action = target.getAttribute("data-action");
    if (action === "close") {
      bubble.classList.add("qbt-hidden");
      return;
    }

    if (action === "copy") {
      const text = bubble.querySelector(".qbt-translated")?.textContent || "";
      if (!text) {
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        target.textContent = "Copied";
        setTimeout(() => {
          target.textContent = "Copy";
        }, 900);
      } catch {
        target.textContent = "Blocked";
        setTimeout(() => {
          target.textContent = "Copy";
        }, 900);
      }
    }
  });

  document.documentElement.appendChild(bubble);
  return bubble;
}
