/**
 * Demo listings for THE EMULATORS ONLY (`npm run seed`, end-to-end tests). Never written to a
 * real project: every writer goes through scripts/emulator.ts, which refuses non-demo projects.
 * Photos are sample images of the Cloudinary account (flowers, mountains, food, a shoe: no
 * people; `cld-sample-3` shows people and is left out), checked to answer 200 on 2 Oct 2026.
 */
export const DEMO_PHOTOS = [
  'sample:864x576',
  'cld-sample-2:1870x1250',
  'cld-sample-4:1870x1250',
  'cld-sample-5:1870x1250',
] as const;

const DAY = 86_400_000;

export interface DemoListingInput {
  uid: string;
  slot?: number;
  pseudo?: string;
  genre?: string;
  citySlug?: string;
  district?: string;
  title?: string;
  description?: string;
  offer?: string;
  /** Age in years at `now` (birth month = this month, that many years ago). */
  age?: number;
  rank?: 0 | 1 | 2;
  /** Days from now (negative = ended); null = unlimited when rank > 0. */
  boostDays?: number | null;
  createdAt?: Date;
  renewedAt?: Date;
  photos?: string[];
  contactMode?: 'message' | 'call_message';
  views?: number;
  likes?: number;
  reportsCount?: number;
  hidden?: boolean;
  status?: 'active' | 'removed';
  verified?: boolean;
  memberSince?: Date;
}

export function listingId(uid: string, slot = 1): string {
  return `${uid}_${slot}`;
}

/** The public listing document, shaped exactly like the publish page writes it. */
export function demoListing(i: DemoListingInput, now = new Date()): Record<string, unknown> {
  const age = i.age ?? 25;
  const createdAt = i.createdAt ?? now;
  const rank = i.rank ?? 0;
  return {
    ownerUid: i.uid,
    pseudo: i.pseudo ?? i.uid,
    profilePhotoUrl: null,
    verified: i.verified ?? false,
    memberSince: i.memberSince ?? new Date(createdAt.getTime() - 30 * DAY),
    birthMonth: new Date(Date.UTC(now.getUTCFullYear() - age, now.getUTCMonth(), 1)),
    genre: i.genre ?? 'femme',
    citySlug: i.citySlug ?? 'douala',
    district: i.district ?? 'Akwa',
    title: i.title ?? 'Annonce de démonstration',
    description: i.description ?? 'Texte de démonstration, visible uniquement dans les émulateurs.',
    offer: i.offer ?? '',
    photos: i.photos ?? [DEMO_PHOTOS[0]],
    contactMode: i.contactMode ?? 'message',
    rank,
    boostUntil: rank > 0 && i.boostDays !== null ? new Date(now.getTime() + (i.boostDays ?? 7) * DAY) : null,
    views: i.views ?? 0,
    likes: i.likes ?? 0,
    reportsCount: i.reportsCount ?? 0,
    hidden: i.hidden ?? false,
    status: i.status ?? 'active',
    removedReason: null,
    createdAt,
    updatedAt: createdAt,
    renewedAt: i.renewedAt ?? createdAt,
  };
}

export function demoContact(whatsapp: string, contactMode: 'message' | 'call_message' = 'message') {
  return { whatsapp, callAllowed: contactMode === 'call_message' };
}

export function demoProfile(pseudo: string, memberSince: Date, verified = false) {
  return { pseudo, photoUrl: null, memberSince, verified };
}

// ── The ~60 listings of `npm run seed` ─────────────────────────────────

const PSEUDOS = [
  'Mireille',
  'Brice',
  'Sandrine',
  'Junior',
  'Carine',
  'Herve',
  'Nadege',
  'Arnaud',
  'Larissa',
  'Franck',
  'Christelle',
  'Patrick',
  'Vanessa',
  'Ludovic',
  'Estelle',
  'Rodrigue',
  'Aicha',
  'Serge',
  'Prisca',
  'Kevin',
];
const GENRES = ['femme', 'homme', 'femme', 'couple', 'gay', 'femme', 'homme', 'lesbienne', 'trans', 'autre'];
const DISTRICTS: Record<string, string[]> = {
  douala: ['Akwa', 'Bonapriso', 'Bonamoussadi', 'Makepe', 'Deido', 'Kotto', 'Logpom', 'Bali'],
  yaounde: ['Bastos', 'Mvog-Mbi', 'Essos', 'Biyem-Assi', 'Omnisport', 'Nlongkak'],
  bafoussam: ['Tamdja', 'Djeleng'],
  kribi: ['Mpangou', 'Dombe'],
  limbe: ['Down Beach', 'Mile 4'],
  garoua: ['Roumde Adjia', 'Plateau'],
  buea: ['Molyko', 'Great Soppo'],
};
const TITLES = [
  'Sortie au bord de mer ce week-end',
  'Cherche compagnie pour les concerts',
  'Rencontre simple et discrète',
  'Envie de nouvelles rencontres',
  'Balade et discussion autour d’un verre',
  'Personne sérieuse et souriante',
  'Amateur de danse et de bonne cuisine',
  'Nouveau dans la ville, envie de sortir',
  'Moments de complicité en toute discrétion',
  'Partage de bons moments',
];
const DESCRIPTIONS = [
  'J’aime les sorties, la musique et les longues discussions. Écrivez-moi sur WhatsApp pour faire connaissance.',
  'Personne calme et respectueuse, je cherche quelqu’un avec qui partager des moments agréables.',
  'Je travaille en semaine, disponible surtout le week-end. Discrétion assurée et demandée.',
  'Fan de football et de grillades, je cherche une rencontre détendue sans prise de tête.',
];
const OFFERS = [
  '',
  'Une sortie au restaurant ou au cinéma.',
  'Des moments de détente et de bonne humeur.',
  '',
];

/** Deterministic pseudo-random numbers: the same seed gives the same demo every time. */
function prng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export interface SeedDoc {
  path: string;
  data: Record<string, unknown>;
}

export function seedDocs(now = new Date()): SeedDoc[] {
  const random = prng(42);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;
  const cities = [
    ...Array<string>(30).fill('douala'),
    ...Array<string>(16).fill('yaounde'),
    ...['bafoussam', 'bafoussam', 'kribi', 'kribi', 'limbe', 'limbe', 'garoua', 'garoua', 'buea', 'buea'],
  ];
  const docs: SeedDoc[] = [];
  const members = new Map<string, { since: Date; verified: boolean; slots: number }>();
  cities.forEach((city, n) => {
    const pseudo = `${PSEUDOS[n % PSEUDOS.length]}${237 + Math.floor(n / PSEUDOS.length)}`;
    const uid = `demo-${pseudo.toLowerCase()}`;
    const member = members.get(uid) ?? {
      since: new Date(now.getTime() - Math.floor(10 + random() * 400) * DAY),
      verified: random() < 0.3,
      slots: 0,
    };
    member.slots += 1;
    members.set(uid, member);
    // Douala and Yaoundé get Premium and Sponsored listings, one Douala boost has just ended.
    const rank =
      n < 4 || (n >= 30 && n < 32) ? 2 : (n >= 4 && n < 8) || (n >= 32 && n < 34) ? 1 : n === 8 ? 1 : 0;
    const contactMode = random() < 0.4 ? 'call_message' : 'message';
    const photoCount = rank === 2 ? 4 : 1 + Math.floor(random() * 3);
    const start = Math.floor(random() * DEMO_PHOTOS.length);
    const id = listingId(uid, member.slots);
    docs.push({
      path: `listings/${id}`,
      data: demoListing(
        {
          uid,
          slot: member.slots,
          pseudo,
          genre: GENRES[n % GENRES.length],
          citySlug: city,
          district: pick(DISTRICTS[city] ?? ['Centre']),
          title: TITLES[n % TITLES.length],
          description: pick(DESCRIPTIONS),
          offer: pick(OFFERS),
          age: 19 + Math.floor(random() * 37),
          rank,
          boostDays: n === 8 ? -1 : 2 + Math.floor(random() * 5),
          createdAt: new Date(now.getTime() - Math.floor(random() * 60 * 24) * 3_600_000),
          photos: Array.from(
            { length: photoCount },
            (_, k) => DEMO_PHOTOS[(start + k) % DEMO_PHOTOS.length] as string,
          ),
          contactMode,
          views: Math.floor(random() * 400),
          likes: Math.floor(random() * 60),
          verified: member.verified,
          memberSince: member.since,
        },
        now,
      ),
    });
    docs.push({
      path: `listings/${id}/private/contact`,
      data: demoContact(`+2376${String(90000000 + n).padStart(8, '0')}`, contactMode),
    });
  });
  for (const [uid, m] of members) {
    const pseudo = docs.find((d) => d.data['ownerUid'] === uid)?.data['pseudo'] as string;
    docs.push({ path: `publicProfiles/${uid}`, data: demoProfile(pseudo, m.since, m.verified) });
  }
  return docs;
}
