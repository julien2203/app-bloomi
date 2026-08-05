import { SUPABASE_URL } from '../env';
import { supabase } from '../supabase';
import type { AppLanguage } from '../i18n';

export const HOME_HERO_BUCKET = 'home-hero';
export const HOME_HERO_CONFIG_ID = 'default';

export type HomeHeroContent = {
  headlineLine1: string;
  headlineLine2: string;
  ctaLabel: string;
  ctaRoute: string;
  imageUrl: string | null;
};

const DEFAULT_HEADLINES: Record<AppLanguage, { line1: string; line2: string }> = {
  fr: { line1: 'Seconde main', line2: 'Premier choix' },
  en: { line1: 'Second hand', line2: 'First choice' },
  de: { line1: 'Secondhand', line2: 'Erste Wahl' },
  it: { line1: 'Seconda mano', line2: 'Prima scelta' }
};

const DEFAULT_CTA_LABEL: Record<AppLanguage, string> = {
  fr: 'Vendre maintenant',
  en: 'Sell now',
  de: 'Jetzt verkaufen',
  it: 'Vendi ora'
};

/** Valeurs de repli locales (hors flux admin publié). */
export const DEFAULT_HOME_HERO: HomeHeroContent = {
  headlineLine1: DEFAULT_HEADLINES.fr.line1,
  headlineLine2: DEFAULT_HEADLINES.fr.line2,
  ctaLabel: DEFAULT_CTA_LABEL.fr,
  ctaRoute: '/tabs/sell',
  imageUrl: null
};

export function getDefaultHomeHero(language: AppLanguage): HomeHeroContent {
  const headlines = DEFAULT_HEADLINES[language];
  return {
    headlineLine1: headlines.line1,
    headlineLine2: headlines.line2,
    ctaLabel: DEFAULT_CTA_LABEL[language],
    ctaRoute: '/tabs/sell',
    imageUrl: null
  };
}

type HomeHeroRow = {
  headline_line_1: string;
  headline_line_2: string;
  headline_line_1_en?: string | null;
  headline_line_2_en?: string | null;
  cta_label: string;
  cta_route: string;
  image_path: string | null;
  updated_at: string;
};

function resolveHeadlines(row: HomeHeroRow, language: AppLanguage): { line1: string; line2: string } {
  if (language === 'en') {
    return {
      line1: row.headline_line_1_en != null ? row.headline_line_1_en : (row.headline_line_1 ?? ''),
      line2: row.headline_line_2_en != null ? row.headline_line_2_en : (row.headline_line_2 ?? '')
    };
  }
  return {
    line1: row.headline_line_1 ?? '',
    line2: row.headline_line_2 ?? ''
  };
}

function resolveImageUrl(imagePath: string | null, updatedAt: string | null): string | null {
  if (!imagePath?.trim()) return null;
  const path = imagePath.trim().replace(/^\/+/, '');
  const base = `${SUPABASE_URL}/storage/v1/object/public/${HOME_HERO_BUCKET}/${path}`;
  if (updatedAt) {
    return `${base}?v=${encodeURIComponent(updatedAt)}`;
  }
  return base;
}

function mapRow(row: HomeHeroRow, language: AppLanguage): HomeHeroContent {
  const headlines = resolveHeadlines(row, language);
  return {
    headlineLine1: headlines.line1,
    headlineLine2: headlines.line2,
    ctaLabel: row.cta_label ?? '',
    ctaRoute: row.cta_route?.trim() || '/tabs/sell',
    imageUrl: resolveImageUrl(row.image_path, row.updated_at)
  };
}

export function hasUsefulHomeHeroContent(config: HomeHeroContent): boolean {
  return Boolean(
    config.imageUrl ||
      config.headlineLine1.trim() ||
      config.headlineLine2.trim() ||
      config.ctaLabel.trim()
  );
}

/** Config publiée du héro feed — null si absent, non publié ou sans contenu affichable. */
export async function getPublishedHomeHero(
  language: AppLanguage = 'fr'
): Promise<HomeHeroContent | null> {
  const { data, error } = await supabase
    .from('home_hero_config')
    .select('*')
    .eq('id', HOME_HERO_CONFIG_ID)
    .eq('is_published', true)
    .maybeSingle();

  if (error) {
    if (__DEV__) {
      console.warn('[homeHero] fetch failed:', error.message);
    }
    return null;
  }

  if (!data) {
    return null;
  }

  const config = mapRow(data as HomeHeroRow, language);
  return hasUsefulHomeHeroContent(config) ? config : null;
}
