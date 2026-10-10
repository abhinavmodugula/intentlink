# Safety-net snapshots

If live Amazon misbehaves during the demo (CAPTCHA, A/B layout, Wi-Fi), fall back to a saved page:

1. On a real Amazon search results page for one of your rehearsed demo prompts, `Cmd+S` →
   save as **"Webpage, Complete"**. Save the `.html` file (and its `_files/` folder) into this
   directory.
2. Serve this directory: `python3 -m http.server 8000` (run from inside `snapshots/`).
3. Open `http://localhost:8000/<saved-file>.html#ll-intent=<your rehearsed prompt, encoded>` —
   the extension's content script matches `localhost`, so it reshapes exactly like live Amazon.
4. Keep this tab open in a background tab during the demo as an instant fallback.

Nothing in this folder is loaded automatically — these are manual backup pages only.
