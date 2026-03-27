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

const targetSelect = document.getElementById("targetLanguage");
const showOriginalToggle = document.getElementById("showOriginalText");
const statusNode = document.getElementById("status");

init().catch(() => {
  setStatus("Failed to load settings.", true);
});

async function init() {
  renderLanguageOptions();

  const response = await sendMessage({ type: "GET_SETTINGS" });
  const selectedTarget = response?.settings?.targetLanguage || "bn";
  const showOriginalText = response?.settings?.showOriginalText !== false;
  targetSelect.value = hasLanguage(selectedTarget) ? selectedTarget : "bn";
  showOriginalToggle.checked = showOriginalText;

  targetSelect.addEventListener("change", saveSettings);
  showOriginalToggle.addEventListener("change", saveSettings);
}

async function saveSettings() {
  setStatus("Saving...");

  await sendMessage({
    type: "SET_SETTINGS",
    settings: {
      targetLanguage: targetSelect.value,
      showOriginalText: showOriginalToggle.checked
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

function hasLanguage(code) {
  return LANGUAGES.some((lang) => lang.code === code);
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
