/** City chosen on the home page, remembered in this browser (SPEC § 6; Douala by default). */
import { cityBySlug, DEFAULT_CITY_SLUG } from '../data/cities';

const KEY = 'nx-city';

export function rememberedCity(): string {
  try {
    const slug = localStorage.getItem(KEY) ?? '';
    return cityBySlug(slug) ? slug : DEFAULT_CITY_SLUG;
  } catch {
    return DEFAULT_CITY_SLUG;
  }
}

export function rememberCity(slug: string): void {
  try {
    if (cityBySlug(slug)) localStorage.setItem(KEY, slug);
  } catch {
    // Storage blocked (private mode): the choice lasts for this page only.
  }
}
