import { describe, expect, it } from 'vitest';
import { AVATAR_URL_PATTERN, PHOTO_REF } from '../../src/data/limits';
import {
  avatarDisplayUrl,
  CLOUDINARY_PRESETS,
  isAvatarUrl,
  parseUploadResponse,
  UPLOAD_URL,
} from '../../src/lib/cloudinary';
import { AppError } from '../../src/lib/errors';
import { fitWithin } from '../../src/lib/image-compress';

/** Answer of the real `nioxxer_avatar` upload test (2 Oct 2026), trimmed. */
const AVATAR_RESPONSE = {
  public_id: 'j0jjvgfilrtqchvyoqes',
  width: 400,
  height: 400,
  format: 'jpg',
  bytes: 2421,
  secure_url: 'https://res.cloudinary.com/bcxiwwkh/image/upload/v1790960020/j0jjvgfilrtqchvyoqes.jpg',
  asset_folder: 'avatars',
};

describe('cloudinary', () => {
  it('uploads to the owner cloud with the unsigned presets', () => {
    expect(UPLOAD_URL).toBe('https://api.cloudinary.com/v1_1/bcxiwwkh/image/upload');
    expect(CLOUDINARY_PRESETS).toEqual({ listing: 'nioxxer_listing', avatar: 'nioxxer_avatar' });
  });

  it('reads a real upload answer', () => {
    expect(parseUploadResponse(AVATAR_RESPONSE)).toEqual({
      publicId: 'j0jjvgfilrtqchvyoqes',
      secureUrl: AVATAR_RESPONSE.secure_url,
      width: 400,
      height: 400,
    });
  });

  it('refuses an error answer or an image of another cloud', () => {
    expect(() => parseUploadResponse({ error: { message: 'Upload preset not found' } })).toThrow(AppError);
    expect(() =>
      parseUploadResponse({
        ...AVATAR_RESPONSE,
        secure_url: 'https://res.cloudinary.com/other/image/upload/v1/x.jpg',
      }),
    ).toThrow(AppError);
    expect(() => parseUploadResponse(null)).toThrow(AppError);
  });

  it('accepts only the raw versioned URL as a profile photo', () => {
    expect(isAvatarUrl(AVATAR_RESPONSE.secure_url)).toBe(true);
    expect(isAvatarUrl('https://res.cloudinary.com/bcxiwwkh/image/upload/l_text:Arial_80:x/v1/abc.jpg')).toBe(
      false,
    );
    expect(isAvatarUrl('https://res.cloudinary.com/bcxiwwkh/image/upload/abc.jpg')).toBe(false);
    expect(isAvatarUrl('http://res.cloudinary.com/bcxiwwkh/image/upload/v1/abc.jpg')).toBe(false);
    expect(new RegExp(AVATAR_URL_PATTERN).test(AVATAR_RESPONSE.secure_url)).toBe(true);
  });

  it('adds the single avatar transformation at display time', () => {
    expect(avatarDisplayUrl(AVATAR_RESPONSE.secure_url)).toBe(
      'https://res.cloudinary.com/bcxiwwkh/image/upload/f_auto,q_auto,w_160/v1790960020/j0jjvgfilrtqchvyoqes.jpg',
    );
    expect(avatarDisplayUrl(null)).toBeNull();
    expect(avatarDisplayUrl('https://evil.example/x.jpg')).toBeNull();
  });

  it('listing photo references carry the public id without folder', () => {
    const re = new RegExp(`^${PHOTO_REF}$`);
    expect(re.test('mpb0pn6ouv10s41qzqdk:1600x1200')).toBe(true);
    expect(re.test('listings/mpb0pn6ouv10s41qzqdk:1600x1200')).toBe(false);
    expect(re.test('mpb0pn6ouv10s41qzqdk:0x1200')).toBe(false);
  });
});

describe('fitWithin', () => {
  it.each([
    [4000, 3000, 1600, 1600, 1200],
    [3000, 4000, 1600, 1200, 1600],
    [800, 600, 1600, 800, 600],
    [1600, 1600, 800, 800, 800],
    [5000, 10, 1600, 1600, 3],
  ])('%i×%i in %i → %i×%i', (w, h, max, ew, eh) => {
    expect(fitWithin(w, h, max)).toEqual({ width: ew, height: eh });
  });
});
