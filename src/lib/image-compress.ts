/**
 * Client-side compression before any upload (ARCHITECTURE § 6): resize on a canvas, re-encode as
 * JPEG. Re-encoding drops every metadata block of the original (EXIF, GPS position of the photo,
 * camera…), which never leaves the phone.
 */
import { AppError } from './errors';

/** Size fitting inside a `max`×`max` box, keeping the ratio, never enlarging. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
}

export async function compressImage(file: Blob, maxSide: number, quality = 0.85): Promise<CompressedImage> {
  let bitmap: ImageBitmap;
  try {
    // 'from-image': portrait photos stay upright (EXIF orientation applied, then dropped).
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // e.g. HEIC on Android: the browser cannot read it.
    throw new AppError('nioxxer/image-unreadable');
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AppError('nioxxer/image-unreadable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new AppError('nioxxer/image-unreadable');
  return { blob, width, height };
}

/**
 * Size/quality steps tried in turn for a payment screenshot or an ID photo stored as a data URL
 * (ARCHITECTURE § 6): the first that fits is kept, so the text stays as sharp as allowed.
 */
export const DATA_URL_STEPS: readonly { maxSide: number; quality: number }[] = [
  { maxSide: 1600, quality: 0.8 },
  { maxSide: 1400, quality: 0.72 },
  { maxSide: 1200, quality: 0.66 },
  { maxSide: 1000, quality: 0.6 },
  { maxSide: 800, quality: 0.55 },
];

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new AppError('nioxxer/image-unreadable'));
    reader.readAsDataURL(blob);
  });
}

/** JPEG data URL of at most `maxChars` characters (EXIF dropped as for any upload). */
export async function compressToDataUrl(file: Blob, maxChars: number): Promise<string> {
  for (const step of DATA_URL_STEPS) {
    const { blob } = await compressImage(file, step.maxSide, step.quality);
    const url = await blobToDataUrl(blob);
    if (url.length <= maxChars && url.startsWith('data:image/jpeg;base64,')) return url;
  }
  throw new AppError('nioxxer/image-too-large');
}
