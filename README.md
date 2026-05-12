# Quick Universal Translator

Translate selected text from any language to your chosen target language in Chrome. Source language is detected automatically and the result appears in a floating page popup.

## Features

- Translate selected webpage text from the keyboard
- Translate copied PDF text from the keyboard
- Right-click selected text and translate it from the context menu
- Auto-detect source language
- Choose the target language from the extension popup
- Show or hide the original text below the translation
- Choose popup position: top-left, top-right, bottom-left, or bottom-right
- Copy translated text from the translation popup
- Close the translation popup with a shortcut
- Works without a paid translation API key

## Shortcuts

- Webpage: select text, then press **Ctrl+T**.
- PDF: select text, press **Ctrl+C**, then press **Ctrl+T**.
- Close popup: press **Ctrl+R**.

If Chrome does not trigger a shortcut, open `chrome://extensions/shortcuts` and assign it manually. Some shortcuts may conflict with browser defaults depending on your Chrome setup.

## Install

1. Open Chrome and go to `chrome://extensions/`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. For local PDF files, enable **Allow access to file URLs** for this extension.

## Usage

1. Open the extension popup.
2. Choose your target language.
3. Choose whether to show the original text.
4. Choose the popup position.
5. Use the shortcuts or context menu to translate.

## PDF Usage

Chrome's built-in PDF viewer does not reliably expose selected text to extension scripts. For PDF files, use the clipboard workflow:

1. Select text in the PDF.
2. Press **Ctrl+C**.
3. Press **Ctrl+T** to translate the copied text.

## Translation Service

This extension uses the free public Google Translate endpoint at `translate.googleapis.com`. It does not require a paid API key.

## Limitations

- Internet access is required for translation.
- `chrome://` pages and other restricted browser pages do not allow content scripts.
- PDF translation depends on copying selected PDF text to the clipboard first.
- Browser-reserved shortcuts may need to be changed in `chrome://extensions/shortcuts`.

## Files

- `manifest.json` - Extension configuration, permissions, and commands
- `background-v2.js` - Context menu, shortcuts, settings, clipboard flow, and translation requests
- `content.js` - Selection capture and translation popup rendering
- `styles/bubble.css` - Translation popup styles
- `popup/popup.html` - Settings popup UI
- `popup/popup.js` - Settings popup behavior
- `offscreen/clipboard.html` - Offscreen clipboard document
- `offscreen/clipboard.js` - Clipboard read/write helper
