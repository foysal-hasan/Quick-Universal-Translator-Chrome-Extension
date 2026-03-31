# Quick Bangla Translator (Chrome Extension)

Translate selected text from any language to your chosen target language using only free services (no paid API key).

## Features

- Right-click selected text -> `Translate to <your target language>`
- Keyboard shortcut: `Alt+T`
- Source language is auto-detected from selected text
- Result shows in a floating bubble on the same page with detected source and target languages
- Copy translated text with one click
- Toggle to show or hide original text below the translation
- Choose bubble position on screen (top-left, top-right, bottom-left, bottom-right)

## Install (Unpacked)

1. Open Chrome and go to `chrome://extensions/`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select this folder:
   - `Translator`

## Usage

1. Open extension popup and choose target language, original-text visibility, and bubble position
2. Select text on any web page
2. Use one of these:
   - Right-click -> **Translate to your selected target language**
   - Press `Alt+T`
3. Read translated output in the page bubble

## PDF Books

- For local PDF files (`file:///...`), open `chrome://extensions`, find this extension, and enable **Allow access to file URLs**.
- In PDF viewers where normal content messaging fails, the extension injects the same style floating bubble directly into the page as fallback.
- When `Alt+T` cannot directly read selection in a PDF viewer, the extension tries a temporary Ctrl+C-style copy fallback, reads that copied text, translates it, and restores your previous clipboard content.

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
