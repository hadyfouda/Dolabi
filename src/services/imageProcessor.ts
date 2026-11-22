/**
 * Image cutout & auto-tight-crop pipeline.
 *
 *  1. Pre-resize phone photo (max 1024px, EXIF-orientation aware) — keeps Safari's WASM heap safe.
 *  2. @imgly/background-removal (isnet_quint8, 100% local, model cached by the service worker).
 *  3. Scan alpha channel (alpha > 20) for the garment's tight bounding box.
 *  4. Crop with uniform 5% padding, downscale to max 800px, export WebP (PNG fallback).
 *  5. Dominant color from the centre of the garment → closest menswear color name.
 */
import type { Config } from '@imgly/background-removal';
import { extractDominantColor, type PaletteColor } from './colorUtils';

export const INPUT_MAX_DIMENSION = 1024;
export const OUTPUT_MAX_DIMENSION = 800;
export const ALPHA_THRESHOLD = 20;
export const PADDING_RATIO = 0.05;

export type ProcessingStage = 'resizing' | 'loading-model' | 'removing-bg' | 'cropping' | 'done';

export interface ProcessingProgress {
  stage: ProcessingStage;
  /** 0..1 within the current stage (when known) */
  ratio: number;
  messageAr: string;
}

export interface ProcessedImage {
  blob: Blob;
  colorHex: string;
  color: PaletteColor;
  width: number;
  height: number;
  backgroundRemoved: boolean;
}

export const STAGE_MESSAGES: Record<ProcessingStage, string> = {
  resizing: 'جاري تجهيز الصورة...',
  'loading-model': 'جاري تحميل نموذج القص...',
  'removing-bg': 'جاري تفريغ الخلفية...',
  cropping: 'جاري قص القطعة بدقة...',
  done: 'تم ✓',
};

type ProgressFn = (p: ProcessingProgress) => void;

// ---------- canvas helpers ----------

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D غير مدعوم على المتصفح ده');
  return ctx;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

interface Drawable {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function loadDrawable(blob: Blob): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      // fall through to <img> (older Safari, SVG blobs, HEIC handled by the OS picker)
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw new Error('مش قادرين نقرا الصورة دي — جرّب صورة JPG أو PNG', { cause: err });
  }
}

/** Export as WebP; falls back to PNG on browsers that silently ignore WebP encoding (older iOS). */
async function exportCompressed(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await canvasToBlob(canvas, 'image/webp', 0.86);
  if (webp && webp.type === 'image/webp') return webp;
  const png = await canvasToBlob(canvas, 'image/png');
  if (!png) throw new Error('فشل حفظ الصورة');
  return png;
}

// ---------- step 1: pre-resize ----------

export async function resizeImage(file: Blob, maxDim = INPUT_MAX_DIMENSION): Promise<Blob> {
  const d = await loadDrawable(file);
  try {
    const scale = Math.min(1, maxDim / Math.max(d.width, d.height));
    const canvas = createCanvas(d.width * scale, d.height * scale);
    const ctx = get2d(canvas);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(d.source, 0, 0, canvas.width, canvas.height);
    // JPEG is the fastest input format for the segmentation decoder; alpha is irrelevant here.
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
    if (!blob) throw new Error('فشل تصغير الصورة');
    return blob;
  } finally {
    d.release();
  }
}

// ---------- step 2: background removal ----------

let modelReady = false;

/**
 * Optional self-hosting: set VITE_IMGLY_PUBLIC_PATH (e.g. "/imgly/") to serve the model + onnx
 * wasm from your own origin instead of IMG.LY's CDN. Unset = official versioned CDN.
 */
const IMGLY_PUBLIC_PATH: string | undefined = import.meta.env.VITE_IMGLY_PUBLIC_PATH || undefined;

function imglyConfig(onProgress?: ProgressFn): Config {
  return {
    ...(IMGLY_PUBLIC_PATH ? { publicPath: new URL(IMGLY_PUBLIC_PATH, window.location.href).href } : {}),
    model: 'isnet_quint8', // lightweight quantized model: avoids Safari WASM memory ceiling
    device: 'cpu',
    output: { format: 'image/png', quality: 1 },
    progress: (key: string, current: number, total: number) => {
      if (!onProgress) return;
      const ratio = total > 0 ? current / total : 0;
      if (key.startsWith('fetch:')) {
        onProgress({ stage: 'loading-model', ratio, messageAr: STAGE_MESSAGES['loading-model'] });
      } else {
        onProgress({ stage: 'removing-bg', ratio, messageAr: STAGE_MESSAGES['removing-bg'] });
      }
    },
  };
}

export async function removeImageBackground(input: Blob, onProgress?: ProgressFn): Promise<Blob> {
  onProgress?.({
    stage: modelReady ? 'removing-bg' : 'loading-model',
    ratio: 0,
    messageAr: modelReady ? STAGE_MESSAGES['removing-bg'] : STAGE_MESSAGES['loading-model'],
  });
  // Lazy-load: the library (and onnxruntime) is only downloaded when the user actually uploads.
  const { removeBackground } = await import('@imgly/background-removal');
  const result = await removeBackground(input, imglyConfig(onProgress));
  modelReady = true;
  return result;
}

// ---------- step 3+4: tight crop ----------

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Tight bounding box of pixels with alpha > threshold. Returns null for an empty cutout. */
export function findAlphaBoundingBox(data: ImageData, threshold = ALPHA_THRESHOLD): BoundingBox | null {
  const { width, height } = data;
  const px = data.data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (px[row + x * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || maxY < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export async function tightCrop(cutout: Blob): Promise<{ canvas: HTMLCanvasElement; box: BoundingBox }> {
  const d = await loadDrawable(cutout);
  try {
    const src = createCanvas(d.width, d.height);
    const sctx = get2d(src);
    sctx.drawImage(d.source, 0, 0);
    const data = sctx.getImageData(0, 0, src.width, src.height);
    const box = findAlphaBoundingBox(data);
    if (!box || box.width < 8 || box.height < 8) {
      throw new Error('مقدرناش نلاقي القطعة في الصورة — صوّرها على خلفية سادة وبإضاءة كويسة');
    }

    // Uniform padding: 5% of the garment's longest side, identical on all four edges.
    const pad = Math.round(Math.max(box.width, box.height) * PADDING_RATIO);
    const cropW = box.width + pad * 2;
    const cropH = box.height + pad * 2;
    const scale = Math.min(1, OUTPUT_MAX_DIMENSION / Math.max(cropW, cropH));

    const out = createCanvas(cropW * scale, cropH * scale);
    const octx = get2d(out);
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(src, box.x, box.y, box.width, box.height, pad * scale, pad * scale, box.width * scale, box.height * scale);
    return { canvas: out, box };
  } finally {
    d.release();
  }
}

// ---------- full pipeline ----------

export interface ProcessOptions {
  removeBackground?: boolean;
  onProgress?: ProgressFn;
}

export async function processGarmentImage(file: Blob, opts: ProcessOptions = {}): Promise<ProcessedImage> {
  const { removeBackground: shouldRemove = true, onProgress } = opts;

  onProgress?.({ stage: 'resizing', ratio: 0, messageAr: STAGE_MESSAGES.resizing });
  const resized = await resizeImage(file, INPUT_MAX_DIMENSION);

  let canvas: HTMLCanvasElement;
  if (shouldRemove) {
    const cutout = await removeImageBackground(resized, onProgress);
    onProgress?.({ stage: 'cropping', ratio: 0, messageAr: STAGE_MESSAGES.cropping });
    canvas = (await tightCrop(cutout)).canvas;
  } else {
    // Fallback path (model unavailable offline on first run): keep the photo, just downscale.
    onProgress?.({ stage: 'cropping', ratio: 0, messageAr: STAGE_MESSAGES.cropping });
    const d = await loadDrawable(resized);
    try {
      const scale = Math.min(1, OUTPUT_MAX_DIMENSION / Math.max(d.width, d.height));
      canvas = createCanvas(d.width * scale, d.height * scale);
      get2d(canvas).drawImage(d.source, 0, 0, canvas.width, canvas.height);
    } finally {
      d.release();
    }
  }

  const ctx = get2d(canvas);
  const { hex, color } = extractDominantColor(ctx.getImageData(0, 0, canvas.width, canvas.height));
  const blob = await exportCompressed(canvas);
  onProgress?.({ stage: 'done', ratio: 1, messageAr: STAGE_MESSAGES.done });

  return { blob, colorHex: hex, color, width: canvas.width, height: canvas.height, backgroundRemoved: shouldRemove };
}

export function describeProcessingError(err: unknown): string {
  if (!navigator.onLine && !modelReady) {
    return 'أول مرة محتاجين نت عشان ننزّل نموذج القص (مرة واحدة بس). تقدر تحفظ الصورة من غير تفريغ دلوقتي.';
  }
  if (err instanceof Error && /[؀-ۿ]/.test(err.message)) return err.message;
  if (err instanceof Error && /memory|allocation|OOM/i.test(err.message)) {
    return 'الصورة تقيلة على ذاكرة الموبايل — جرّب صورة أصغر أو اقفل تابات تانية.';
  }
  return 'حصلت مشكلة في تفريغ الخلفية. تقدر تحفظ الصورة من غير تفريغ.';
}
