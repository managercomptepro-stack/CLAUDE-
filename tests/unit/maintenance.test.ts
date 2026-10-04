import { describe, expect, it } from 'vitest';
import { avatarId, cloudinaryRest, photoId } from '../../scripts/maintenance';

interface Call {
  url: string;
  method: string;
  auth: string | undefined;
}

function fakeFetch(pages: Record<string, unknown>[], status = 200) {
  const calls: Call[] = [];
  let i = 0;
  const impl = (url: string, init?: { method?: string; headers?: Record<string, string> }) => {
    calls.push({ url, method: init?.method ?? 'GET', auth: init?.headers?.['Authorization'] });
    const body = pages[Math.min(i++, pages.length - 1)] ?? {};
    return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
  };
  return { calls, impl };
}

describe('Cloudinary Admin API client', () => {
  it('lists an asset folder page by page, images only, with Basic auth', async () => {
    const f = fakeFetch([
      {
        resources: [
          { public_id: 'a1', created_at: '2026-09-01T10:00:00Z', resource_type: 'image' },
          { public_id: 'v1', created_at: '2026-09-01T10:00:00Z', resource_type: 'video' },
        ],
        next_cursor: 'c/2',
      },
      { resources: [{ public_id: 'a2', created_at: '2026-09-02T10:00:00Z', resource_type: 'image' }] },
    ]);
    const api = cloudinaryRest('bcxiwwkh', 'key', 'secret', f.impl);
    expect(await api.listFolder('listings')).toEqual([
      { publicId: 'a1', createdAt: new Date('2026-09-01T10:00:00Z') },
      { publicId: 'a2', createdAt: new Date('2026-09-02T10:00:00Z') },
    ]);
    expect(f.calls.map((c) => c.url)).toEqual([
      'https://api.cloudinary.com/v1_1/bcxiwwkh/resources/by_asset_folder?asset_folder=listings&max_results=500',
      'https://api.cloudinary.com/v1_1/bcxiwwkh/resources/by_asset_folder?asset_folder=listings&max_results=500&next_cursor=c%2F2',
    ]);
    expect(f.calls[0]?.auth).toBe(`Basic ${Buffer.from('key:secret').toString('base64')}`);
  });

  it('deletes by 100 public ids per call', async () => {
    const f = fakeFetch([{ deleted: {} }]);
    const ids = Array.from({ length: 205 }, (_, i) => `p${i}`);
    await cloudinaryRest('bcxiwwkh', 'k', 's', f.impl).deleteImages(ids);
    expect(f.calls).toHaveLength(3);
    expect(f.calls.every((c) => c.method === 'DELETE')).toBe(true);
    expect(f.calls[0]?.url).toMatch(
      /^https:\/\/api\.cloudinary\.com\/v1_1\/bcxiwwkh\/resources\/image\/upload\?/,
    );
    expect(f.calls[0]?.url.match(/public_ids\[\]=/g)).toHaveLength(100);
    expect(f.calls[2]?.url).toContain('public_ids[]=p204');
    expect(f.calls[2]?.url.match(/public_ids\[\]=/g)).toHaveLength(5);
  });

  it('fails loudly on an HTTP error (the job then exits with code 1)', async () => {
    const f = fakeFetch([{}], 401);
    await expect(cloudinaryRest('c', 'k', 's', f.impl).listFolder('avatars')).rejects.toThrow(
      'E_CLOUDINARY_401',
    );
  });
});

describe('photo references', () => {
  it('reads the public id of a listing photo and of an avatar URL', () => {
    expect(photoId('Ab_c-1:1600x1200')).toBe('Ab_c-1');
    expect(avatarId('https://res.cloudinary.com/bcxiwwkh/image/upload/v1759400000/xYz_9.jpg')).toBe('xYz_9');
    expect(avatarId(null)).toBeNull();
    expect(avatarId('https://exemple.cm/a.jpg')).toBeNull();
  });
});
