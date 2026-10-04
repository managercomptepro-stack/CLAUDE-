/**
 * Cloudinary (ARCHITECTURE § 6): unsigned uploads through the owner's presets, delivery URLs.
 * Cloud name and preset names are public by design (CLAUDE.md § 4.10); the API secret never
 * appears in the client.
 */
import { AVATAR_URL_PATTERN, CLOUDINARY_CLOUD_NAME } from '../data/limits';
import { AppError } from './errors';

export const CLOUDINARY_PRESETS = { listing: 'nioxxer_listing', avatar: 'nioxxer_avatar' } as const;
export type UploadKind = keyof typeof CLOUDINARY_PRESETS;

export const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
const DELIVERY = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/** Only derived size of a profile photo (shown 80 px at most): one variant = fewer credits. */
export const AVATAR_TRANSFORM = 'f_auto,q_auto,w_160';

export interface UploadedImage {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
}

/** Checks the JSON answer of an upload; anything unexpected is an upload failure. */
export function parseUploadResponse(body: unknown): UploadedImage {
  if (typeof body === 'object' && body !== null) {
    const b = body as Record<string, unknown>;
    if (
      typeof b['public_id'] === 'string' &&
      typeof b['secure_url'] === 'string' &&
      typeof b['width'] === 'number' &&
      typeof b['height'] === 'number' &&
      b['secure_url'].startsWith(`${DELIVERY}/`)
    ) {
      return { publicId: b['public_id'], secureUrl: b['secure_url'], width: b['width'], height: b['height'] };
    }
  }
  throw new AppError('nioxxer/upload-failed');
}

export function isAvatarUrl(url: string): boolean {
  return new RegExp(AVATAR_URL_PATTERN).test(url);
}

/** Display URL of a stored profile photo (`secure_url`), or null if it is not one of ours. */
export function avatarDisplayUrl(secureUrl: string | null): string | null {
  if (!secureUrl || !isAvatarUrl(secureUrl)) return null;
  return secureUrl.replace(`${DELIVERY}/`, `${DELIVERY}/${AVATAR_TRANSFORM}/`);
}

/**
 * Unsigned upload with progress (0 → 1). XMLHttpRequest because fetch() reports no upload
 * progress. `signal` cancels it.
 */
export function uploadImage(
  blob: Blob,
  kind: UploadKind,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', UPLOAD_URL);
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      try {
        if (xhr.status < 200 || xhr.status >= 300) throw new AppError('nioxxer/upload-failed');
        resolve(parseUploadResponse(JSON.parse(xhr.responseText)));
      } catch (error) {
        reject(error instanceof AppError ? error : new AppError('nioxxer/upload-failed'));
      }
    };
    xhr.onerror = () => reject(new AppError('nioxxer/upload-failed'));
    xhr.ontimeout = () => reject(new AppError('nioxxer/upload-failed'));
    xhr.onabort = () => reject(new AppError('nioxxer/upload-cancelled'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    const form = new FormData();
    form.append('file', blob, 'photo.jpg');
    form.append('upload_preset', CLOUDINARY_PRESETS[kind]);
    xhr.send(form);
  });
}
