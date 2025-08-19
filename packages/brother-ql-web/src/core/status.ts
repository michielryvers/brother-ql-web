// Core numeric constants, types, and status parsing for Brother QL-700
// Use const objects instead of enums to satisfy tsconfig (erasableSyntaxOnly, verbatimModuleSyntax)

export const ERROR_INFO1 = {
  None: 0x00,
  NoMediaWhenPrinting: 0x01,
  EndOfMedia_DieCutOnly: 0x02,
  TapeCutterJam: 0x04,
  MainUnitInUse: 0x10, // QL-560/650TD/1050
  FanDoesntWork: 0x80, // QL-1050/1060N
} as const;
export type ErrorInfo1 = typeof ERROR_INFO1[keyof typeof ERROR_INFO1];

export const ERROR_INFO2 = {
  None: 0x00,
  TransmissionError: 0x04,
  CoverOpenedWhilePrinting: 0x10, // except QL-500
  CannotFeed: 0x40,
  SystemError: 0x80,
} as const;
export type ErrorInfo2 = typeof ERROR_INFO2[keyof typeof ERROR_INFO2];

export const MEDIA_TYPE = {
  None: 0x00,
  Continuous: 0x0a,
  DieCut: 0x0b,
} as const;
export type MediaType = typeof MEDIA_TYPE[keyof typeof MEDIA_TYPE];

export const STATUS_TYPE = {
  Reply: 0x00,
  PrintingCompleted: 0x01,
  ErrorOccurred: 0x02,
  Notification: 0x05,
  PhaseChange: 0x06,
} as const;
export type StatusType = typeof STATUS_TYPE[keyof typeof STATUS_TYPE];

export const PHASE_TYPE = {
  WaitingToReceive: 0x00,
  PrintingState: 0x01,
} as const;
export type PhaseType = typeof PHASE_TYPE[keyof typeof PHASE_TYPE];

export const MODEL_CODE = {
  Unknown: 0x00,
  QL500_550: 0x4f, // 'O'
  QL560: 0x31, // '1'
  QL570: 0x32, // '2'
  QL580N: 0x33, // '3'
  QL650TD: 0x51, // 'Q'
  QL700: 0x35, // '5'
  QL1050: 0x50, // 'P'
  QL1060N: 0x34, // '4'
} as const;
export type ModelCode = typeof MODEL_CODE[keyof typeof MODEL_CODE];

export interface PrinterStatus {
  headerOk: boolean;
  model: ModelCode;
  mediaWidthMm: number;
  mediaType: MediaType;
  mediaLengthMm: number;
  error1: ErrorInfo1;
  error2: ErrorInfo2;
  statusType: StatusType;
  phaseType: PhaseType;
  phaseNumber: number;
  notification: number;
  leftMargin: number;
  printableDots: number;
  rightMargin: number;
}

const dkKey = (mt: number, w: number, l: number) => `${mt}|${w}|${l}`;

export const statusHelpers = {
  mediaPresent: (s: PrinterStatus) =>
    s.mediaType !== MEDIA_TYPE.None && (s.error1 & ERROR_INFO1.NoMediaWhenPrinting) === 0,
  tryMapDkSupply: (s: PrinterStatus): string | undefined => {
    const key = dkKey(
      s.mediaType,
      s.mediaWidthMm,
      s.mediaType === MEDIA_TYPE.Continuous ? 0 : s.mediaLengthMm
    );
    return DK_MAP.get(key);
  },
};

// key: (MediaType, width-mm, length-mm(0 for continuous)) -> name
const DK_MAP = new Map<string, string>([
  [dkKey(MEDIA_TYPE.Continuous, 12, 0), "DK-22214 12mm continuous"],
  [dkKey(MEDIA_TYPE.Continuous, 29, 0), "DK-22210 29mm continuous"],
  [dkKey(MEDIA_TYPE.Continuous, 38, 0), "DK-22225 38mm continuous"],
  [dkKey(MEDIA_TYPE.Continuous, 50, 0), "DK-22223 50mm continuous"],
  [dkKey(MEDIA_TYPE.Continuous, 54, 0), "DK-22211 54mm continuous"],
  [dkKey(MEDIA_TYPE.Continuous, 62, 0), "DK-22205 62mm continuous"],
  [dkKey(MEDIA_TYPE.DieCut, 17, 54), "DK-1208 17×54"],
  [dkKey(MEDIA_TYPE.DieCut, 29, 90), "DK-1201 29×90"],
  [dkKey(MEDIA_TYPE.DieCut, 38, 90), "DK-1202 38×90"],
  [dkKey(MEDIA_TYPE.DieCut, 62, 29), "DK-1209 62×29"],
  [dkKey(MEDIA_TYPE.DieCut, 62, 100), "DK-1218 62×100"],
  [dkKey(MEDIA_TYPE.DieCut, 24, 24), "Round Ø24"],
]);

// key: (MediaType, width-mm, length-mm(0 for continuous)) -> (left, printable, right)
const PIN_LAYOUT = new Map<string, [number, number, number]>([
  // Continuous length tape
  [dkKey(MEDIA_TYPE.Continuous, 12, 0), [585, 106, 29]],
  [dkKey(MEDIA_TYPE.Continuous, 29, 0), [408, 306, 6]],
  [dkKey(MEDIA_TYPE.Continuous, 38, 0), [295, 413, 12]],
  [dkKey(MEDIA_TYPE.Continuous, 50, 0), [154, 554, 12]],
  [dkKey(MEDIA_TYPE.Continuous, 54, 0), [130, 590, 0]],
  [dkKey(MEDIA_TYPE.Continuous, 62, 0), [12, 696, 12]],
  // Die-cut labels (WxH mm)
  [dkKey(MEDIA_TYPE.DieCut, 17, 54), [555, 165, 0]],
  [dkKey(MEDIA_TYPE.DieCut, 17, 87), [555, 165, 0]],
  [dkKey(MEDIA_TYPE.DieCut, 23, 23), [442, 236, 42]],
  [dkKey(MEDIA_TYPE.DieCut, 29, 42), [408, 306, 6]],
  [dkKey(MEDIA_TYPE.DieCut, 29, 90), [408, 306, 6]],
  [dkKey(MEDIA_TYPE.DieCut, 38, 90), [295, 413, 12]],
  [dkKey(MEDIA_TYPE.DieCut, 39, 48), [289, 425, 6]],
  [dkKey(MEDIA_TYPE.DieCut, 52, 29), [142, 578, 0]],
  [dkKey(MEDIA_TYPE.DieCut, 54, 29), [59, 602, 59]],
  [dkKey(MEDIA_TYPE.DieCut, 60, 86), [24, 672, 24]],
  [dkKey(MEDIA_TYPE.DieCut, 62, 29), [12, 696, 12]],
  [dkKey(MEDIA_TYPE.DieCut, 62, 100), [12, 696, 12]],
  // Round (Diameter mm => width==length)
  [dkKey(MEDIA_TYPE.DieCut, 12, 12), [513, 94, 113]],
  [dkKey(MEDIA_TYPE.DieCut, 24, 24), [442, 236, 42]],
  [dkKey(MEDIA_TYPE.DieCut, 58, 58), [51, 618, 51]],
]);

function tryGetPinLayout(
  mt: MediaType,
  widthMm: number,
  lengthMm: number
): [number, number, number] | undefined {
  const exact = PIN_LAYOUT.get(dkKey(mt, widthMm, mt === MEDIA_TYPE.Continuous ? 0 : lengthMm));
  if (exact) return exact;

  if (mt === MEDIA_TYPE.DieCut) {
    // Fallback: match by width only
    for (const [k, v] of PIN_LAYOUT.entries()) {
      const [kMt, kW] = [Number(k.split("|")[0]), Number(k.split("|")[1])];
      if (kMt === MEDIA_TYPE.DieCut && kW === widthMm) return v;
    }
  }
  if (mt === MEDIA_TYPE.Continuous) {
    const byWidth = PIN_LAYOUT.get(dkKey(mt, widthMm, 0));
    if (byWidth) return byWidth;
  }
  return undefined;
}

export function parseStatus(frame: ArrayLike<number>): PrinterStatus {
  if (frame.length < 32) throw new Error("Status must be 32 bytes.");
  const s = frame;

  const headerOk = s[0] === 0x80 && s[1] === 0x20 && s[2] === 0x42; // 'B'
  const model = (s[4] as ModelCode) ?? MODEL_CODE.Unknown;
  const mediaWidth = s[10] as number;
  const mediaType = s[11] as MediaType;
  const mediaLength = s[17] as number;

  const err1 = s[8] as ErrorInfo1;
  const err2 = s[9] as ErrorInfo2;

  const statusType = s[18] as StatusType;
  const phaseType = s[19] as PhaseType;
  const phaseNo = ((s[20] as number) << 8) | (s[21] as number);
  const notif = s[22] as number;

  let left = 0,
    printable = 0,
    right = 0;
  const pins = tryGetPinLayout(mediaType, mediaWidth, mediaLength);
  if (pins) {
    [left, printable, right] = pins;
  }

  return {
    headerOk,
    model,
    mediaWidthMm: mediaWidth,
    mediaType,
    mediaLengthMm: mediaLength,
    error1: err1,
    error2: err2,
    statusType,
    phaseType,
    phaseNumber: phaseNo,
    notification: notif,
    leftMargin: left,
    printableDots: printable,
    rightMargin: right,
  };
}
