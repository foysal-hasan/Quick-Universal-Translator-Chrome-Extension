const BUBBLE_ID = "quick-bangla-translator-bubble";
const SELECTION_CACHE_TTL_MS = 20000;
const COPIED_TEXT_CACHE_TTL_MS = 30000;

let lastSelectedText = "";
let lastSelectedAt = 0;
let lastCopiedText = "";
let lastCopiedAt = 0;

// Track selection changes across documents
if (document.addEventListener) {
  document.addEventListener("selectionchange", updateSelectionCache);
  document.addEventListener("mouseup", updateSelectionCache);
  document.addEventListener("keyup", updateSelectionCache);
  document.addEventListener("click", updateSelectionCache);
  document.addEventListener("copy", updateCopiedTextCache, true);
  document.addEventListener("keydown", handleCloseShortcut, true);
}

function updateSelectionCache() {
  const selection = getSelectedText();
  if (selection && selection.length > 0) {
    lastSelectedText = selection;
    lastSelectedAt = Date.now();
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_SELECTION") {
    sendResponse({ text: getSelectedText() });
    return true;
  }

  if (message?.type === "GET_RECENT_COPIED_TEXT") {
    sendResponse({ text: getRecentCopiedText() });
    return true;
  }

  if (message?.type === "SHOW_TRANSLATION") {
    if (!isTopLevelFrame()) {
      sendResponse({ ok: false });
      return false;
    }

    showTranslationBubble(message.payload || {});
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

function updateCopiedTextCache() {
  const copied = getSelectedText();
  if (copied && copied.length > 0) {
    lastCopiedText = copied;
    lastCopiedAt = Date.now();
  }
}

function getRecentCopiedText() {
  if (Date.now() - lastCopiedAt <= COPIED_TEXT_CACHE_TTL_MS && lastCopiedText) {
    return lastCopiedText;
  }

  return "";
}

function getSelectedText() {
  // First, try direct selection
  const selection = (window.getSelection()?.toString() || "").trim();
  if (selection && selection.length > 0) {
    return selection;
  }

  // Check for input/textarea selection
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

  // Use cached selection if still valid (for PDF viewers where selection disappears quickly)
  if (Date.now() - lastSelectedAt <= SELECTION_CACHE_TTL_MS && lastSelectedText) {
    return lastSelectedText;
  }

  return "";
}

function showTranslationBubble(payload) {
  const {
    original = "",
    translated = "",
    isError = false,
    isLoading = false,
    sourceLanguageName = "Auto",
    targetLanguageName = "Target",
    showOriginalText = true,
    bubblePosition = "bottom-right"
  } = payload;
  const bubble = ensureBubble();

  const title = bubble.querySelector(".qbt-title");
  const translatedNode = bubble.querySelector(".qbt-translated");
  const originalNode = bubble.querySelector(".qbt-original");
  const copyButton = bubble.querySelector('[data-action="copy"]');

  if (!title || !translatedNode || !originalNode) {
    return;
  }

  title.textContent = isLoading
    ? "Translating..."
    : isError
    ? "Translation Error"
    : `Translation: ${sourceLanguageName} -> ${targetLanguageName}`;
  
  translatedNode.textContent = translated || "No translation available.";
  originalNode.textContent = showOriginalText && original ? `Original: ${original}` : "";
  originalNode.style.display = showOriginalText ? "block" : "none";
  
  // Disable copy button during loading
  if (copyButton) {
    copyButton.disabled = isLoading;
    copyButton.style.opacity = isLoading ? "0.5" : "1";
  }
  
  applyBubblePositionClass(bubble, bubblePosition);
  bubble.classList.remove("qbt-hidden", "qbt-error");
  bubble.classList.toggle("qbt-error", Boolean(isError));
  bubble.classList.toggle("qbt-loading", Boolean(isLoading));
}

function handleCloseShortcut(event) {
  if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
    return;
  }

  if ((event.key || "").toLowerCase() !== "r") {
    return;
  }

  if (!closeTranslationPopup()) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
}

function closeTranslationPopup() {
  let closed = false;
  const bubble = document.getElementById(BUBBLE_ID);
  if (bubble && !bubble.classList.contains("qbt-hidden")) {
    bubble.classList.add("qbt-hidden");
    closed = true;
  }

  const fallbackBubble = document.getElementById("quick-translator-fallback-bubble");
  if (fallbackBubble) {
    fallbackBubble.remove();
    closed = true;
  }

  return closed;
}

function isTopLevelFrame() {
  return window.top === window;
}

function applyBubblePositionClass(bubble, bubblePosition) {
  const classes = [
    "qbt-pos-bottom-right",
    "qbt-pos-bottom-left",
    "qbt-pos-top-right",
    "qbt-pos-top-left"
  ];
  bubble.classList.remove(...classes);

  const nextClass = `qbt-pos-${bubblePosition}`;
  if (classes.includes(nextClass)) {
    bubble.classList.add(nextClass);
    return;
  }

  bubble.classList.add("qbt-pos-bottom-right");
}

function ensureBubble() {
  let bubble = document.getElementById(BUBBLE_ID);
  if (bubble) {
    return bubble;
  }

  bubble = document.createElement("div");
  bubble.id = BUBBLE_ID;
  bubble.className = "qbt-bubble qbt-hidden qbt-pos-bottom-right";

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
      closeTranslationPopup();
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
