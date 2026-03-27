# Quick Bangla Translator (Chrome Extension)

Translate selected text from any language to your chosen target language using only free services (no paid API key).

## Features

- Right-click selected text -> `Translate to <your target language>`
- Keyboard shortcut: `Ctrl+Shift+B` (`Command+Shift+B` on macOS)
- Source language is auto-detected from selected text
- Result shows in a floating bubble on the same page with detected source and target languages
- Copy translated text with one click
- Toggle to show or hide original text below the translation

## Install (Unpacked)

1. Open Chrome and go to `chrome://extensions/`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select this folder:
   - `Translator`

## Usage

1. Open extension popup and choose your target language and original-text visibility
2. Select text on any web page
2. Use one of these:
   - Right-click -> **Translate to your selected target language**
   - Press `Ctrl+Shift+B`
3. Read translated output in the page bubble

## PDF Books

- For local PDF files (`file:///...`), open `chrome://extensions`, find this extension, and enable **Allow access to file URLs**.
- In PDF viewers where normal content messaging fails, the extension injects the same style floating bubble directly into the page as fallback.
- If keyboard shortcut cannot read selection in a PDF viewer, use right-click on selected text and choose the translate menu item.

## Free Service Note

This extension uses a free public translation endpoint from Google Translate (`translate.googleapis.com`) and does not require a paid account or API key.

## Current Limitation

- Internet is required for translation requests in this version.
- `chrome://` pages and some extension/system pages do not allow content scripts.

## Files

- `manifest.json` - Extension config
- `background-v2.js` - Menu/shortcut logic, language settings, and translation request
- `content.js` - Selection capture and bubble rendering
- `styles/bubble.css` - Bubble UI styles
- `popup/popup.html` - Language settings UI
- `popup/popup.js` - Target language selection logic
