chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "OFFSCREEN_CLIPBOARD") {
    return false;
  }

  if (message?.type === "READ_CLIPBOARD_TEXT") {
    navigator.clipboard.readText()
      .then((text) => {
        sendResponse({ text: (text || "").trim() });
      })
      .catch(() => {
        sendResponse({ text: "" });
      });

    return true;
  }

  if (message?.type === "SET_CLIPBOARD_TEXT") {
    navigator.clipboard.writeText(typeof message.text === "string" ? message.text : "")
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch(() => {
        sendResponse({ ok: false });
      });

    return true;
  }

  return false;
});
