# Stickerbooth SPA – Implementation Plan

## Objective
Build a minimal, friendly single-page React app (apps/stickerbooth) that:
- Lets the user connect to a Brother QL-series label printer via WebUSB using the existing library (`@proeftuin/brother-ql-web`).
- After connecting, shows a live camera preview (front camera on phones when available) with a large red shutter button overlay.
- On shutter press, captures the current camera frame and prints it to the connected label printer.

## Success Criteria
- First screen shows a prominent “Connect Printer” button with a small/cute label printer SVG.
- Clicking the button prompts the WebUSB chooser; after selection, the app transitions to camera view.
- Camera view auto-selects the front/selfie camera on mobile when available (fallback to default camera otherwise).
- The red shutter button captures a frame and successfully initiates a print.
- Reasonable defaults for print (monochrome/dither) and cutting; printing completes without app crash.
- Handles common failure states with clear messages (no device found/denied, camera denied, print error).

## Non-Goals (for the first iteration)
- Advanced image editing (crop/rotate/filters beyond default brightness/contrast tuning the library applies).
- Complex media configuration UI (roll width, margins, etc.).
- Persisting settings across sessions.

## Technical Constraints & Notes
- Browser APIs:
  - WebUSB (secure contexts; localhost qualifies). Desktop Chrome/Edge typically supported. Mobile support varies—Android Chrome may work; iOS Safari does not support WebUSB.
  - Camera (getUserMedia) requires secure context; localhost is allowed in dev.
- Printing pipeline is powered by `@proeftuin/brother-ql-web` which exposes:
  - `connect(): Promise<PrinterStatus>` – performs USB connect and primes cached status.
  - `getPreviewImage(src, opts?)` – returns a mono preview canvas sized to the printer.
  - `printDitheredImage(srcOrCanvas, opts?)` – builds mono at correct width and prints.
  - `printLines(lines, opts?)` – low-level; we’ll avoid it initially.
- `PrinterStatus` includes `printableDots`, margins, etc., and is cached after `connect()`. The library auto-resizes and dithers if the source width doesn’t match the printer width.
- Image handling: The library defaults to Atkinson dithering with light brightness/contrast adjustments; good for camera photos on thermal paper.

## User Flow
1. Load app → “Connect Printer” screen.
2. Press connect → USB chooser. On success, we receive `PrinterStatus` and move to camera view.
3. Camera view starts `getUserMedia` with `{ video: { facingMode: 'user' } }` (fallback if unavailable).
4. User sees preview and a large red floating shutter button.
5. Press shutter → capture the current camera frame to an offscreen canvas.
6. Call `printDitheredImage(canvas, { cutAtEnd: true })`.
7. Optionally show a lightweight in-progress indicator; resolve or show error on completion.

## UI Outline
- View A: ConnectView
  - Centered big button: “Connect printer”
  - Cute inline SVG (simple label printer icon) above or inside the button
  - Secondary small text: “Uses WebUSB. Works best in Chrome on desktop/mobile.”
- View B: CameraView
  - Full-bleed <video> element (contain or cover strategy; see layout below)
  - Overlay: big circular red button (bottom center), a small “Switch camera” optional later
  - Optional text feedback: “Connected to [model/media]”

## Layout & Image Strategy
- Live preview: position the <video> element to fill available area while preserving aspect ratio.
- Capture: draw current video frame to an offscreen canvas at its native resolution; pass the full canvas to `printDitheredImage`. The library will handle filling, width and height, auto-scale to printable width, and dither.
- Orientation: ensure portrait orientation in library is already handled (`ensurePortrait`). For selfies, expect portrait; if landscape, the library rotates when needed.
- Cropping vs fitting:
  - For v1, always send the full capture; no app-side cropping or pre-scaling. The library will handle filling, width, and height for the printable area.

## Error Handling & Edge Cases
- USB connect denied/canceled → show a dismissible banner: “No printer selected. Try again.”
- No WebUSB support → show guidance: “WebUSB not supported in this browser. Try Chrome or Edge on desktop.”
- Camera permission denied/blocked → show: “Camera access is required for live preview.” + link to site settings.
- No front camera available → fall back to default camera without failing.
- Printing error from device status → surface error with retry guidance (check media cover, roll, cutter, etc.).
- Timeouts while printing → show timeout message and invite retry.

## Minimal Contracts
- Inputs:
  - User click → initiate USB connect
  - User click (shutter) → capture current <video> frame
- Outputs:
  - Visual state transitions (connect → camera)
  - Printer activity triggered via `printDitheredImage`
  - Status/error banners
- Error modes:
  - Permission denied (USB/camera), unsupported browser, printer status error, timeout
- Success criteria:
  - End-to-end print completes; UI remains responsive and recoverable upon failures

## Implementation Steps (No code in this plan)
1. Project wiring
   - Ensure `apps/stickerbooth` depends on `@proeftuin/brother-ql-web` via workspace.
   - Confirm Vite dev server runs under secure context (localhost OK for USB/camera).
2. App scaffolding updates
   - App state: `phase: 'disconnected' | 'connecting' | 'connected' | 'camera-ready' | 'printing' | 'error'` and `errorMessage?: string`.
   - Store `printerStatus` after `connect()` for optional display.
3. Views/components (files to create/update)
   - `src/views/ConnectView.tsx` – Big connect button + SVG; triggers `connect()`; set phase.
   - `src/views/CameraView.tsx` – Manages `getUserMedia`, displays <video>, red shutter button, calls `printDitheredImage` on capture.
   - `src/components/BigButton.tsx` – Reusable large button styling.
   - `src/hooks/useCamera.ts` – Starts/stops camera stream; prefers `facingMode: 'user'`, fallback chain.
   - `src/App.tsx` – Route-free view switcher based on `phase` (simple conditional rendering).
   - `src/styles.css` (or module) – basic layout and overlay styles.
4. Camera management
   - On mount: request `getUserMedia({ video: { facingMode: 'user' } })`; if it fails, retry without facingMode; as final fallback, `{ video: true }`.
   - Bind stream to <video> via `srcObject` and `playsInline` on iOS.
   - Provide cleanup on unmount (stop all tracks).
5. Capture & print
  - On shutter: draw current video frame into an offscreen canvas (size equal to videoWidth/videoHeight).
  - Call `printDitheredImage(canvas, { cutAtEnd: true })` with the full canvas; no pre-scaling or cropping needed.
   - Set phase to `printing`; upon resolve, return to `camera-ready` and optionally show a brief “Printed!” toast.
6. UX polish
   - Loading spinners for `connecting` and `printing`.
   - Simple inline error banner with retry buttons.
   - Keep the UI responsive during USB prompts and print waits.

## Testing & Verification
- Local manual tests:
  - Connect flow happy path (printer attached).
  - Cancel USB chooser → remains on connect view with a hint.
  - Camera grant/deny flows.
  - Print completes vs. error (simulate by opening cover or no roll, if feasible).
- Unit/logic tests (lightweight):
  - `useCamera` hook fallback behavior for constraints errors (mocked).
  - Phase transitions for connect/print actions (component tests with mocks).
- Cross-device sanity:
  - Desktop Chrome (Linux/Windows/macOS) with WebUSB.
  - Android Chrome if available (note WebUSB variance).

## Dev and Run
- Dev server from workspace root with pnpm, filtering the app package. Example commands (optional):
  - Install deps at root: `pnpm i`
  - Run stickerbooth app: `pnpm --filter apps/stickerbooth dev`
  - Run tests for library: Tasks already present; app tests optional later.

## Future Enhancements (nice-to-haves)
- Show a preview thumbnail and “Print” confirmation before sending.
- Toggle auto-cut / copies count.
- Simple crop/fit modes with guides.
- Switch camera button (front/back) and torch on supported devices.
- Persist last-used settings in localStorage.

 

## Acceptance Checklist
- [ ] Connect view with big button + printer SVG
- [ ] USB connection via `connect()` and status cached
- [ ] Camera view with live preview (front camera if available)
- [ ] Red shutter button overlays the preview
- [ ] Capture current frame and call `printDitheredImage`
- [ ] Basic loading and error states covered
- [ ] Works on Chrome desktop over localhost
