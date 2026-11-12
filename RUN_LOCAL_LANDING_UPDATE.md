# PortSync cinematic landing-page update

## What changed

This update aligns the actual public landing page with the supplied 27-second cinematic PortSync reference while keeping the operator dashboard and backend untouched.

- Added the supplied cinematic port video as the hero background (`frontend/public/videos/portsync-cinematic-port.mp4`). It retains the source 1344×768 dimensions and 24 FPS, with optimized H.264 encoding for web delivery.
- Uses the same ship video again in the closing CTA section, with the existing still image as a fallback/poster.
- Reordered the rendered landing page to match the reference sequence: hero, connected-terminal model panel, animated terminal schematic, ten-module grid, digital-twin showcase, what-if simulation comparison, closing CTA, and footer.
- Updated the top navigation to Platform, Solutions, Features, Digital Twin, Operations, Log in, and Get started, with working in-page anchors.
- Replaced the earlier static-photo panels in the connected-terminal and port-systems sections with real HTML/SVG operational panels and a schematic that includes moving route paths and markers.
- Changed the ten-module grid to a compact five-column desktop layout closer to the reference video.
- Scoped all added visual styles to the landing page. Dashboard theme tokens, light/dark mode, theme persistence, existing card effects, authentication, routes, API logic, and backend files are unchanged.
- Added reduced-motion handling for the new SVG motion details and closing video.

The page uses real React/HTML/CSS/SVG elements. The reference MP4 itself is not embedded as a full-page video, and diagram cards are not screenshots.

## Run the frontend on Windows

1. Extract this ZIP into a folder writable by your Windows user, preferably a simple path such as `C:\Projects\portsync` rather than inside a restricted profile path used by another runtime.
2. Ensure Node.js 20+ and npm are installed.
3. Double-click `run-frontend-windows.cmd`, or run these commands from PowerShell:

   ```powershell
   cd frontend
   npm install
   npm run dev -- --host 127.0.0.1 --port 5173
   ```

4. Open `http://localhost:5173`.

The public landing page can be previewed without the backend. Login and API-dependent workspace features need the backend on port 8010.

## Run the backend (optional)

In a separate PowerShell window:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8010
```

## Validation performed here

- Parsed all 43 TypeScript/TSX source files with the TypeScript transpiler; no syntax diagnostics were reported.
- Parsed `frontend/src/index.css` with a CSS parser; no parse errors were reported.
- Verified the optimized hero MP4 decodes at 1344×768, 24 FPS, approximately 10.1 seconds.
- A full Vite type-check, production build, and browser-level visual test could not be run in this preparation environment because project dependencies are not installed here and the npm registry was not reachable earlier. Run `npm install` in a network-enabled environment before starting the dev server.
