const LANGUAGES = [
  { code: "bn", name: "Bangla" },
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "ar", name: "Arabic" },
  { code: "zh", name: "Chinese (Simplified)" },
  { code: "zh-TW", name: "Chinese (Traditional)" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "tr", name: "Turkish" },
  { code: "ur", name: "Urdu" },
  { code: "id", name: "Indonesian" },
  { code: "ms", name: "Malay" },
  { code: "th", name: "Thai" },
  { code: "vi", name: "Vietnamese" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "sv", name: "Swedish" },
  { code: "el", name: "Greek" },
  { code: "he", name: "Hebrew" },
  { code: "fa", name: "Persian" },
  { code: "uk", name: "Ukrainian" },
  { code: "ro", name: "Romanian" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "fi", name: "Finnish" },
  { code: "no", name: "Norwegian" },
  { code: "hu", name: "Hungarian" }
];

const POSITIONS = [
  { code: "bottom-right", name: "Bottom Right" },
  { code: "bottom-left", name: "Bottom Left" },
  { code: "top-right", name: "Top Right" },
  { code: "top-left", name: "Top Left" }
];

const targetSelect = document.getElementById("targetLanguage");
const showOriginalToggle = document.getElementById("showOriginalText");
const bubblePositionSelect = document.getElementById("bubblePosition");
const statusNode = document.getElementById("status");

init().catch(() => {
  setStatus("Failed to load settings.", true);
});

async function init() {
  renderLanguageOptions();
  renderPositionOptions();

  const response = await sendMessage({ type: "GET_SETTINGS" });
  const selectedTarget = response?.settings?.targetLanguage || "bn";
  const showOriginalText = response?.settings?.showOriginalText !== false;
  const bubblePosition = response?.settings?.bubblePosition || "bottom-right";
  targetSelect.value = hasLanguage(selectedTarget) ? selectedTarget : "bn";
  showOriginalToggle.checked = showOriginalText;
  bubblePositionSelect.value = hasPosition(bubblePosition) ? bubblePosition : "bottom-right";

  targetSelect.addEventListener("change", saveSettings);
  showOriginalToggle.addEventListener("change", saveSettings);
  bubblePositionSelect.addEventListener("change", saveSettings);

  document.addEventListener("keydown", handleKeyboardShortcuts);
}

async function saveSettings() {
  setStatus("Saving...");

  await sendMessage({
    type: "SET_SETTINGS",
    settings: {
      targetLanguage: targetSelect.value,
      showOriginalText: showOriginalToggle.checked,
      bubblePosition: bubblePositionSelect.value
    }
  });

  setStatus("Saved.");
}

function renderLanguageOptions() {
  const options = LANGUAGES.map((lang) => {
    const option = document.createElement("option");
    option.value = lang.code;
    option.textContent = `${lang.name} (${lang.code})`;
    return option;
  });

  targetSelect.replaceChildren(...options);
}

function renderPositionOptions() {
  const options = POSITIONS.map((position) => {
    const option = document.createElement("option");
    option.value = position.code;
    option.textContent = position.name;
    return option;
  });

  bubblePositionSelect.replaceChildren(...options);
}

function hasLanguage(code) {
  return LANGUAGES.some((lang) => lang.code === code);
}

function hasPosition(code) {
  return POSITIONS.some((position) => position.code === code);
}

function setStatus(text, isError = false) {
  statusNode.textContent = text;
  statusNode.style.color = isError ? "#8f2d2d" : "#25603f";
}

function sendMessage(message) {
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

function handleKeyboardShortcuts(event) {
  if (!event.ctrlKey) return;

  const key = event.key.toLowerCase();

  // Ctrl+1 to Ctrl+9: Select language
  if (key >= "1" && key <= "9") {
    event.preventDefault();
    const languageIndex = parseInt(key) - 1;
    if (languageIndex < LANGUAGES.length) {
      targetSelect.value = LANGUAGES[languageIndex].code;
      setStatus(`Changed to ${LANGUAGES[languageIndex].name}`);
      saveSettings();
    }
    return;
  }

  // Ctrl+T: Toggle original text
  if (key === "t") {
    event.preventDefault();
    showOriginalToggle.checked = !showOriginalToggle.checked;
    setStatus(`Original text ${showOriginalToggle.checked ? "enabled" : "disabled"}`);
    saveSettings();
    return;
  }

  // Ctrl+L: Bottom Left
  if (key === "l") {
    event.preventDefault();
    bubblePositionSelect.value = "bottom-left";
    setStatus("Position: Bottom Left");
    saveSettings();
    return;
  }

  // Ctrl+R: Bottom Right
  if (key === "r") {
    event.preventDefault();
    bubblePositionSelect.value = "bottom-right";
    setStatus("Position: Bottom Right");
    saveSettings();
    return;
  }

  // Ctrl+K: Top Left
  if (key === "k") {
    event.preventDefault();
    bubblePositionSelect.value = "top-left";
    setStatus("Position: Top Left");
    saveSettings();
    return;
  }

  // Ctrl+U: Top Right
  if (key === "u") {
    event.preventDefault();
    bubblePositionSelect.value = "top-right";
    setStatus("Position: Top Right");
    saveSettings();
    return;
  }
}
