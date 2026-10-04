import { CityFeedPage } from '../components/CityFeedPage';
import { cityBySlug, DEFAULT_CITY_SLUG } from '../data/cities';
import { fr } from '../i18n/fr';
import { rememberCity } from '../lib/city-memory';
import { mountPage } from '../shell/mount';

/** /ville/{slug}: the same feed as the home page, for the city of the address. */
const slug = location.pathname.replace(/\/$/, '').split('/').pop() ?? '';
const city = cityBySlug(slug) ?? cityBySlug(DEFAULT_CITY_SLUG);

function choose(next: string) {
  rememberCity(next);
  location.assign(`/ville/${next}`);
}

if (city)
  mountPage(<CityFeedPage heading={fr.cityPage.heading(city.name)} citySlug={city.slug} onCity={choose} />);
