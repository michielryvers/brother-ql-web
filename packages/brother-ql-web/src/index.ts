// Public API for brother-ql-web
// Exposes: connect, getPreviewImage, printDitheredImage, printColorImage, printLines

import {
  Initialize,
  RequestStatus,
  SwitchToRasterMode,
  NoCompression,
  printInformation,
  rasterData,
  AutoCut,
  CutAtEnd,
  SetMarginAmount,
  PrintWithFeeding,
  AutomaticStatusNotification,
  CutEach1,
} from "./core/commands";
import { parseStatus, type PrinterStatus, STATUS_TYPE } from "./core/status";
import { buildMonoAtWidth, packRasterLines, type ImageSource, type PreviewOptions } from "./core/image";
import { usbTransport } from "./usb/transport";

// Internal cached state after connect()
let cachedStatus: PrinterStatus | null = null;

export async function connect(): Promise<PrinterStatus> {
  await usbTransport.connect();
  // Request an initial status and cache parsed values
  await usbTransport.write(RequestStatus);
  const frame = await usbTransport.readStatusFrame();
  const status = parseStatus(frame);
  cachedStatus = status;
  return status;
}

export async function getPreviewImage(
  src: ImageSource,
  opts?: PreviewOptions
): Promise<HTMLCanvasElement> {
  if (!cachedStatus) throw new Error("Not connected: call connect() first");
  const { preview } = await buildMonoAtWidth(src, cachedStatus.printableDots, opts);
  // preview is already a canvas with mono data applied
  return preview;
}

export async function printDitheredImage(
  src: ImageSource | HTMLCanvasElement,
  opts?: PreviewOptions & { cutAtEnd?: boolean; autoCut?: boolean }
): Promise<void> {
  if (!cachedStatus) throw new Error("Not connected: call connect() first");

  let lines: Uint8Array[];
  if (src instanceof HTMLCanvasElement) {
    // Assume user provides a canvas matching width; if not, rebuild at correct width
    const targetW = cachedStatus.printableDots;
    if (src.width !== targetW) {
      const { mono } = await buildMonoAtWidth(src, targetW, opts);
      lines = packRasterLines(mono, cachedStatus.printableDots, cachedStatus.leftMargin);
    } else {
      const ctx = src.getContext("2d");
      if (!ctx) throw new Error("2D context unavailable");
      const img = ctx.getImageData(0, 0, src.width, src.height);
      lines = packRasterLines(img, cachedStatus.printableDots, cachedStatus.leftMargin);
    }
  } else {
    const { mono } = await buildMonoAtWidth(src, cachedStatus.printableDots, opts);
    lines = packRasterLines(mono, cachedStatus.printableDots, cachedStatus.leftMargin);
  }

  await printLines(lines, opts);
}

export async function printColorImage(
  src: ImageSource,
  opts?: PreviewOptions & { cutAtEnd?: boolean; autoCut?: boolean }
): Promise<void> {
  if (!cachedStatus) throw new Error("Not connected: call connect() first");
  const { mono } = await buildMonoAtWidth(src, cachedStatus.printableDots, opts);
  const lines = packRasterLines(mono, cachedStatus.printableDots, cachedStatus.leftMargin);
  await printLines(lines, opts);
}

export async function printLines(
  lines: Uint8Array[],
  opts?: { cutAtEnd?: boolean; autoCut?: boolean; enableStatusNotifications?: boolean }
): Promise<void> {
  if (!cachedStatus) throw new Error("Not connected: call connect() first");

  // Initialize and switch to raster mode
  await usbTransport.write(Initialize);
  if (opts?.enableStatusNotifications) {
    await usbTransport.write(AutomaticStatusNotification);
  }
  await usbTransport.write(SwitchToRasterMode);
  await usbTransport.write(NoCompression);

  // Send print information with media from cached status
  await usbTransport.write(printInformation(cachedStatus, lines.length));

  // Optional cut behavior
  if (opts?.autoCut) {
    await usbTransport.write(AutoCut);
    // Cut each label (1)
    await usbTransport.write(CutEach1);
  }
  if (opts?.cutAtEnd) {
    await usbTransport.write(CutAtEnd);
  }

  // For continuous media, SetMarginAmount is recommended (already encoded in status margins)
  await usbTransport.write(SetMarginAmount);

  // Stream raster lines
  for (const line of lines) {
    await usbTransport.write(rasterData(line));
  }

  // End / feed
  await usbTransport.write(PrintWithFeeding);

  // Poll status until printing completes
  await waitForPrintComplete();
}

async function waitForPrintComplete(timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const frame = await usbTransport.getStatus(4000);
    const status = parseStatus(frame);
    cachedStatus = status; // keep cache fresh

    if (status.statusType === STATUS_TYPE.ErrorOccurred) {
      throw new Error("Printer reported an error during printing");
    }
    if (status.statusType === STATUS_TYPE.PrintingCompleted) {
      return; // done
    }
    // slight delay to avoid hammering USB
    await delay(150);
  }
  throw new Error("Timeout waiting for printing to complete");
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export type { PrinterStatus } from "./core/status";
export type { PreviewOptions } from "./core/image";
