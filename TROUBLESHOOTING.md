# CodeType troubleshooting

## The login page appears, but the buttons do nothing

The most common cause is opening `index.html` directly from File Explorer. The app uses JavaScript ES modules and Web Crypto. Browsers block local module imports from a `file://` URL, leaving the styled HTML visible but without working controls.

**Windows:** extract the complete ZIP, then double-click `start-windows.bat`. Keep the black terminal window open. The launcher opens CodeType at <http://127.0.0.1:8000/>.

**macOS / Linux:** run `./start-macos-linux.sh` from the extracted project folder.

**Manual option:** open a terminal in the folder that contains `index.html` and run:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/>.

Do not open `index.html` by double-clicking it. Do not move `index.html` away from `styles.css` or the `src/` folder.

## First-time use

- Click **Create account** to register a new local demo account.
- Or click **Continue as guest** to open the app without creating an account.
- **Log in** only works for an account previously created in the same browser profile. Local demo accounts are not synced between browsers or devices.

## Python says unavailable

The application UI and local account features can run without Pyodide. Python exercises need an internet connection so the browser can download the pinned Pyodide runtime from its CDN. Reload the page after the connection is available.

## Still not working

Open browser Developer Tools (F12), select **Console**, reload the page, and inspect the first red error. Confirm the browser is using `http://localhost:8000/`, not a `file:///...` address.
