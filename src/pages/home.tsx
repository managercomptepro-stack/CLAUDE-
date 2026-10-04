import { useState } from 'preact/hooks';
import { CityFeedPage } from '../components/CityFeedPage';
import { fr } from '../i18n/fr';
import { rememberCity, rememberedCity } from '../lib/city-memory';
import { mountPage } from '../shell/mount';

function HomePage() {
  const [city, setCity] = useState(rememberedCity);
  const choose = (slug: string) => {
    rememberCity(slug);
    setCity(slug);
  };
  return <CityFeedPage heading={fr.headings.home} citySlug={city} onCity={choose} />;
}

mountPage(<HomePage />);
