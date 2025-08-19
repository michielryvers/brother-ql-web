# Brother-QL Web Library – Implementation Plan

This plan describes how to implement a browser-based library (packages/brother-ql-web) to print to Brother QL-700 label printers via WebUSB. It builds on the reference .NET code in the `reference/` folder and replaces LibUsbDotNet with WebUSB. The library will expose a small, ergonomic API and use `pica` for high-quality resizing and `@thi.ng/pixel-dither` for dithering.

## Goals & Non-Goals
- Goals
  - Provide a WebUSB-backed TypeScript library for Brother QL-700.
  - Stable, minimal API:
    - `connect()` → returns status object (and caches connection)
    - `getPreviewImage(input: ImageSource, opts?)` → Promise<HTMLCanvasElement | ImageBitmap> (dithered/monochrome)
    - `printDitheredImage(input: ImageSource | Uint8Array[] | HTMLCanvasElement, opts?)`
    - `printColorImage(input: ImageSource, opts?)` (internal dither)
    - `printLines(lines: Uint8Array[])` (raw 90-byte raster lines)
  - High-quality image scaling (pica) to the number of printable pins determined after connecting.
  - Dithering using `@thi.ng/pixel-dither` (Atkinson or Jarvis as defaults).
  - Command sequencing compatible with Brother Raster Command Reference.
- Non-goals
  - Full coverage of all Brother QL models (initially target QL-700; design for easy extension).
  - Desktop Node.js USB support. Focus is browser-only via WebUSB.

## Constraints & Risks
- WebUSB requirements
  - Must be served over HTTPS or localhost.
  - Requires user gesture to request device and explicit device selection.
  - USB interfaces/endpoints must be claimed; kernel driver must not be active. On Linux, udev rules and detaching `usblp` may be needed; on Chrome this is handled if the interface isn’t in use, but some systems may block claiming. Provide troubleshooting notes.
- Permissions persistence is per-origin and may require re-prompting.
- Endpoint discovery: Infer endpoints (bulk IN/OUT) rather than hardcoding; QL-700 typically uses interface 0, endpoints 0x01 (IN), 0x82 or 0x81, and 0x02 (OUT) but must be detected dynamically from descriptors.
- Timing & buffering: Status frames are 32 bytes; reads must be looped until full frame is received or time out.

## Public API Shape (TypeScript)
- `connect(options?): Promise<PrinterStatus>`
  - Prompts for device via WebUSB, opens/claims interface, selects configuration, caches device & endpoints.
  - Sends Request Status command and parses 32-byte status into `PrinterStatus`.
- `getPreviewImage(src, opts?): Promise<HTMLCanvasElement | ImageBitmap>`
  - Loads/normalizes input image, rotates if needed (longest side height), resizes to `printableDots` width via `pica`, converts to grayscale and dithers to monochrome using `@thi.ng/pixel-dither`.
- `printDitheredImage(srcOrCanvas, opts?): Promise<void>`
  - If canvas/bitmap provided and already monochrome at correct width, pack into raster lines. Otherwise path through `getPreviewImage` then pack.
- `printColorImage(src, opts?): Promise<void>`
  - Calls `getPreviewImage` with source, then prints.
- `printLines(lines: Uint8Array[]): Promise<void>`
  - Sends initialization and raster commands, streams all lines, feeds & waits until printing completes using status polling.

## Data Types
- `PrinterStatus` (JS/TS port of the reference):
  - `headerOk: boolean`
  - `model: ModelCode`
  - `mediaType: MediaType`
  - `mediaWidthMm: number`
  - `mediaLengthMm: number`
  - `error1: ErrorInfo1`
  - `error2: ErrorInfo2`
  - `statusType: StatusType`
  - `phaseType: PhaseType`
  - `phaseNumber: number`
  - `notification: number`
  - `leftMargin: number` `printableDots: number` `rightMargin: number`
  - Derived helpers: `mediaPresent`, `tryMapDkSupply()`
- Enums: `ErrorInfo1`, `ErrorInfo2`, `MediaType`, `StatusType`, `PhaseType`, `ModelCode` (ported 1:1).

## High-Level Architecture
- `usb/transport.ts`
  - WebUSB connection lifecycle: request device, open, select config, claim interface, find endpoints, read/write helpers (bulk transfers), close.
  - Status read: `readStatusFrame(timeoutMs)` ensures exactly 32 bytes.
- `core/status.ts`
  - Status parsing and pin layout tables (ported from reference `PrinterStatus.cs`).
- `core/commands.ts`
  - Command bytes (ported from `Commands.cs`), using typed arrays.
- `core/image.ts`
  - Image I/O helpers: normalize source to canvas/ImageData.
  - Resizing via `pica` to `printableDots` width; rotation logic to ensure “longest side as height”.
  - Grayscale + `@thi.ng/pixel-dither` pipeline to 1bpp-like packed pixels in memory.
  - Line packing (90 bytes per raster line), MSB-first, applying `leftMargin` and bounds checks.
- `index.ts`
  - Public API wrapper exposing required functions and managing internal state (cached status, printableDots, margins, endpoints).

## Implementation Steps

1) Foundations & Types
- [x] Create `src/core/status.ts`: enums (ported as const objects), `PrinterStatus` type, `parseStatus(frame: Uint8Array)` with pin layout tables from .NET reference.
- [x] Create `src/core/commands.ts`: constants and helpers (`printInformation(status, lines)`, `rasterData(line)` etc.).
- [x] Create `src/usb/transport.ts`: transport class with `connect()`, `bulkIn()`, `bulkOut()`, endpoint discovery.

2) Image Pipeline
- [ ] Create `src/core/image.ts`:
  - [ ] `loadImage(src: ImageSource)` where `ImageSource` supports `HTMLImageElement | HTMLCanvasElement | ImageBitmap | Blob | string`.
  - [ ] `ensurePortrait(canvas)` rotate so height >= width.
  - [ ] `resizeToWidth(canvas, width)` via `pica`.
  - [ ] `ditherToMono(imageData, method='atkinson', brightness=150, contrast=80)` using `@thi.ng/pixel-dither`.
  - [ ] `packRasterLines(monoImageData, printableDots, leftMargin): Uint8Array[]` (90 bytes per line).
  - [ ] `renderPreviewCanvas(monoImageData): HTMLCanvasElement` for previews.

3) Public API & Sequencing
- [ ] Create `src/index.ts`:
  - [ ] `connect()`
    - Request WebUSB device with filters: `{ vendorId: 0x04F9 }`.
    - Open, select config 1, claim interface 0 (or probe), find bulk IN/OUT endpoints.
    - Send `RequestStatus` and wait for 32 bytes, parse, cache status.
  - [ ] `getPreviewImage(src, opts)`
    - Load→rotate→resize→dither→return preview canvas/bitmap.
  - [ ] `printDitheredImage(srcOrCanvas, opts)`
    - Convert to packed lines, call `printLines`.
  - [ ] `printColorImage(src, opts)`
    - Calls preview pipeline then `printLines`.
  - [ ] `printLines(lines)`
    - Sequence: `Initialize` → read status → check `WaitingToReceive` → `SwitchToRasterMode` → `NoCompression` → `PrintInformation(status, lines.length)` → `AutoCut` → `Set600DpiAndCut` → `SetMarginAmount` if continuous → stream `RasterData(line)` for each line → `PrintWithFeeding` → poll status until `PrintingCompleted`.

4) Error handling & timeouts
- [ ] Implement read timeouts and retry loops similar to reference `WaitForPrintToFinishAsync`.
- [ ] Throw descriptive errors for common cases: media not present, cover open, system error, cannot feed.

5) Demo & Docs
- [ ] Add a minimal demo page under `packages/brother-ql-web/index.html` to exercise connect, preview, print (usable in HTTPS/localhost).
- [ ] Write README with usage and permission/troubleshooting notes (Linux udev/usblp).

6) Testing Strategy
- [ ] Unit-testable pieces in browser/JS:
  - Status parsing tables and layout mapping.
  - Line packing for sample image rows.
  - Command construction correctness (n1..n10 fields).
- [ ] Manual tests with real device:
  - Connect & status ok, media detection, different DK supplies.
  - Print small bitmap, verify margins and orientation.
  - Long image (many lines) and timeout handling.

## Acceptance Criteria (Matches Requested API)
- `connect()` returns a parsed `PrinterStatus` with `printableDots`, margins, and media info, and caches device endpoints.
- `getPreviewImage()` accepts a color source, returns a correctly dithered, resized preview matching `printableDots` width.
- `printDitheredImage()` prints a preview/dithered image successfully.
- `printColorImage()` prints a color source after internal dither.
- `printLines()` accepts an array of 90-byte lines and prints them correctly.

## Notes & Tips
- Pixel orientation: Brother expects rows as horizontal lines across the page; ensure rotation matches the reference logic: longest side as height before resizing.
- Bit packing: MSB-first within each byte. Left margin added before bit index. 90 bytes = 720 bits; ensure `printableDots <= 696` for most media; the remaining bits are margin area.
- Status notifications: Consider enabling `AutomaticStatusNotification` to reduce polling where supported; still plan for explicit polling.
- Throughput: Use a simple sequential `await` loop for raster lines initially; optimize with chunked `transferOut` batches if necessary.

## Future Enhancements
- Media cache and user-friendly display names via `tryMapDkSupply()`.
- Additional dithering methods/exposed options and brightness/contrast controls.
- Support for other QL models via model code branching and layout tables.
- Optional run-length compression mode.
