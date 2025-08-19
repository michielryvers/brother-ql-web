// Brother Raster commands (ported from reference Commands.cs)
// All values are in hex; using Uint8Array for transferOut

import type { PrinterStatus } from "./status";
import { MEDIA_TYPE } from "./status";

export const RequestStatus = new Uint8Array([0x1b, 0x69, 0x53]); // ESC i S
export const Initialize = new Uint8Array([0x1b, 0x40]); // ESC @
export const SwitchToRasterMode = new Uint8Array([0x1b, 0x69, 0x61, 0x01]); // ESC i a 01
export const AutoCut = new Uint8Array([0x1b, 0x69, 0x4d, 0x40]); // ESC i M @
export const CutAtEnd = new Uint8Array([0x1b, 0x69, 0x4b, 0x08]); // ESC i K 08
export const SetMarginAmount = new Uint8Array([0x1b, 0x69, 0x64, 0x23, 0x00]); // ESC i d 0x23 0x00
export const EndOfPage = new Uint8Array([0x0c]);
export const PrintWithFeeding = new Uint8Array([0x1a]);
export const NoCompression = new Uint8Array([0x4d, 0x00]); // M 00
export const AutomaticStatusNotification = new Uint8Array([0x1b, 0x69, 0x21, 0x00]); // ESC i ! 00
export const CutEach1 = new Uint8Array([0x1b, 0x69, 0x41, 0x01]); // ESC i A 01

export function printInformation(status: PrinterStatus, lines: number): Uint8Array {
  const isDieCut = status.mediaType === MEDIA_TYPE.DieCut;

  let n1 = 0;
  n1 |= 0x80; // printer recovery always on (recommended)
  n1 |= 0x02; // KIND valid
  n1 |= 0x04; // WIDTH valid
  if (isDieCut) n1 |= 0x08; // LENGTH valid ONLY for die-cut

  const n2 = status.mediaType & 0xff; // media type
  const n3 = status.mediaWidthMm & 0xff; // width in mm
  const n4 = isDieCut ? status.mediaLengthMm & 0xff : 0x00; // continuous: 0

  return new Uint8Array([
    0x1b,
    0x69,
    0x7a, // 'z'
    n1,
    n2,
    n3,
    n4,
    lines & 0xff,
    (lines >> 8) & 0xff,
    (lines >> 16) & 0xff,
    (lines >> 24) & 0xff, // n5..n8: raster count
    0x00,
    0x00, // n9, n10
  ]);
}

export function rasterData(line: Uint8Array): Uint8Array {
  const cmd = new Uint8Array(3 + line.length);
  cmd[0] = 0x67; // 'g'
  cmd[1] = 0x00; // raster data type
  cmd[2] = 0x5a; // 90 bytes following
  cmd.set(line, 3);
  return cmd;
}
