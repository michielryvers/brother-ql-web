import pica from "pica";

const picaInstance = pica();

export type ImageSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap | Blob | string;

export interface PreviewOptions {
  method?: "atkinson"; // future: add other methods
  brightness?: number; // 100 = no change
  contrast?: number; // 100 = no change
}

export async function loadImage(src: ImageSource): Promise<HTMLCanvasElement> {
  if (src instanceof HTMLCanvasElement) return src;
  let bmp: ImageBitmap;
  if (src instanceof HTMLImageElement) {
    bmp = await createImageBitmap(src);
  } else if (src instanceof Blob) {
    bmp = await createImageBitmap(src);
  } else if (typeof src === "string") {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    await img.decode();
    bmp = await createImageBitmap(img);
  } else {
    bmp = src as ImageBitmap;
  }
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  return canvas;
}

export function ensurePortrait(canvas: HTMLCanvasElement): HTMLCanvasElement {
  if (canvas.height >= canvas.width) return canvas;
  const out = document.createElement("canvas");
  out.width = canvas.height;
  out.height = canvas.width;
  const ctx = out.getContext("2d")!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

export async function resizeToWidth(canvas: HTMLCanvasElement, width: number): Promise<HTMLCanvasElement> {
  const scale = width / canvas.width;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = Math.max(1, Math.round(canvas.height * scale));
  await picaInstance.resize(canvas, out);
  return out;
}

export function canvasToImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function adjustBrightnessContrast(image: ImageData, brightness = 100, contrast = 100): ImageData {
  if (brightness === 100 && contrast === 100) return image;
  const out = new ImageData(image.width, image.height);
  const b = brightness / 100;
  // contrast: map 0..200 (100=neutral) to factor
  const c = Math.max(0, contrast) / 100;
  const data = image.data;
  const o = out.data;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] / 255;
    let g = data[i + 1] / 255;
    let bch = data[i + 2] / 255;
    // luminance pre-adjust
    r = ((r - 0.5) * c + 0.5) * b;
    g = ((g - 0.5) * c + 0.5) * b;
    bch = ((bch - 0.5) * c + 0.5) * b;
    o[i] = Math.max(0, Math.min(255, Math.round(r * 255)));
    o[i + 1] = Math.max(0, Math.min(255, Math.round(g * 255)));
    o[i + 2] = Math.max(0, Math.min(255, Math.round(bch * 255)));
    o[i + 3] = data[i + 3];
  }
  return out;
}

export function ditherToMono(image: ImageData, opts?: PreviewOptions): ImageData {
  // Optional brightness/contrast pre-adjustment
  const brightness = opts?.brightness ?? 150; // default per plan
  const contrast = opts?.contrast ?? 80; // default per plan
  const adjusted = brightness !== 100 || contrast !== 100
    ? adjustBrightnessContrast(image, brightness, contrast)
    : image;

  // Convert to grayscale
  const gray = new ImageData(adjusted.width, adjusted.height);
  const src = adjusted.data;
  const dst = gray.data;
  for (let i = 0; i < src.length; i += 4) {
    // Rec.601 luma
    const l = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
    dst[i] = dst[i + 1] = dst[i + 2] = l;
    dst[i + 3] = src[i + 3];
  }

  // Apply Atkinson error-diffusion dithering to grayscale in-place
  // Using neighbors: (x+1,y), (x+2,y), (x-1,y+1), (x,y+1), (x+1,y+1), (x,y+2)
  // Each receives err/8 (6 pixels, but divisor 8 to increase contrast per classic Atkinson)
  const w = gray.width;
  const h = gray.height;
  const data = gray.data; // RGBA
  const threshold = 128;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const old = data[idx];
      const newV = old < threshold ? 0 : 255;
      const err = old - newV; // can be negative
      data[idx] = data[idx + 1] = data[idx + 2] = newV;

      const distribute = (nx: number, ny: number, weight: number) => {
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const j = (ny * w + nx) * 4;
          const v = data[j] + ((err * weight) >> 3); // divide by 8 via shift
          const clamped = v < 0 ? 0 : v > 255 ? 255 : v;
          data[j] = data[j + 1] = data[j + 2] = clamped;
        }
      };

      // weights all = 1
      distribute(x + 1, y, 1);
      distribute(x + 2, y, 1);
      distribute(x - 1, y + 1, 1);
      distribute(x, y + 1, 1);
      distribute(x + 1, y + 1, 1);
      distribute(x, y + 2, 1);
    }
  }

  return gray;
}

export async function buildMonoAtWidth(
  src: ImageSource,
  width: number,
  opts?: PreviewOptions
): Promise<{ mono: ImageData; preview: HTMLCanvasElement }>
{
  const loaded = await loadImage(src);
  const portrait = ensurePortrait(loaded);
  const resized = await resizeToWidth(portrait, width);
  const imgData = canvasToImageData(resized);
  const mono = ditherToMono(imgData, opts);
  const preview = renderPreviewCanvas(mono);
  return { mono, preview };
}

export function packRasterLines(
  mono: ImageData,
  printableDots: number,
  leftMargin: number
): Uint8Array[] {
  if (mono.width !== printableDots) {
    throw new Error("Image width does not match printable dots.");
  }
  const lines: Uint8Array[] = [];
  const data = mono.data;
  const w = mono.width;
  for (let y = 0; y < mono.height; y++) {
    const line = new Uint8Array(90); // 90 bytes = 720 bits
    const rowOff = y * w * 4;
    for (let px = 0; px < printableDots; px++) {
      const v = data[rowOff + px * 4]; // grayscale channel
      if (v > 127) continue; // white pixel
      const bit = leftMargin + px;
      const byteIdx = bit >> 3; // /8
      const bitInByte = 7 - (bit & 7); // MSB-first
      line[byteIdx] |= 1 << bitInByte;
    }
    lines.push(line);
  }
  return lines;
}

export function renderPreviewCanvas(mono: ImageData): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = mono.width;
  c.height = mono.height;
  const ctx = c.getContext("2d")!;
  ctx.putImageData(mono, 0, 0);
  return c;
}
