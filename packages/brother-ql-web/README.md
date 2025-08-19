# Brother QL Web 🖨️🧾

Print to Brother QL-700 label printers directly from the browser via WebUSB.

## What it does ✨
- Connects to the printer over WebUSB (Chrome/Edge) 🔌
- Builds high-quality previews (resize with pica + Atkinson dither) 🖼️
- Prints color sources (auto-dither) or already-dithered canvases 🏁
- Sends raw 90-byte raster lines for advanced use 📦
- Parses printer status and media info, handles margins and packing 📊

Public API (TypeScript):
- `connect(): Promise<PrinterStatus>`
- `getPreviewImage(src, opts?): Promise<HTMLCanvasElement>`
- `printColorImage(src, opts?): Promise<void>`
- `printDitheredImage(srcOrCanvas, opts?): Promise<void>`
- `printLines(lines: Uint8Array[]): Promise<void>`

## Dependencies 📦
- Runtime:
  - WebUSB-capable browser (Chrome/Edge) over HTTPS or localhost
  - `pica` for high-quality resizing
- Dev/Test:
  - `vitest`, `happy-dom`

Notes 📝
- Linux may require ensuring `usblp` isn’t claiming the interface (the browser will fail to claim if it is).
- Dithering uses a built-in Atkinson error-diffusion pipeline tuned for label printing.

Minimal example:
```ts
import { connect, getPreviewImage, printColorImage } from "@proeftuin/brother-ql-web";

await connect();
const preview = await getPreviewImage(fileBlob, { brightness: 150, contrast: 80 });
// document.body.appendChild(preview);
await printColorImage(fileBlob, { cutAtEnd: true });
```
