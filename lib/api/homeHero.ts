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
  en: { line1: 'Second hand', line2: 'First choice' }
};

/** Valeurs affichées si la config publiée est absente ou injoignable (français). */
export const DEFAULT_HOME_HERO: HomeHeroContent = {
  headlineLine1: DEFAULT_HEADLINES.fr.line1,
  headlineLine2: DEFAULT_HEADLINES.fr.line2,
  ctaLabel: 'Sell now',
  ctaRoute: '/tabs/sell',
  imageUrl: null
};

export function getDefaultHomeHero(language: AppLanguage): HomeHeroContent {
  const headlines = DEFAULT_HEADLINES[language];
  return {
    headlineLine1: headlines.line1,
    headlineLine2: headlines.line2,
    ctaLabel: 'Sell now',
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
  const fallback = DEFAULT_HEADLINES[language];
  if (language === 'en') {
    return {
      line1: row.headline_line_1_en?.trim() || fallback.line1,
      line2: row.headline_line_2_en?.trim() || fallback.line2
    };
  }
  return {
    line1: row.headline_line_1?.trim() || fallback.line1,
    line2: row.headline_line_2?.trim() || fallback.line2
  };
}

function resolveImageUrl(imagePath: string | null, updatedAt: string | null): string | null {
  if (!imagePath?.trim()) return null;
  const { data } = supabase.storage.from(HOME_HERO_BUCKET).getPublicUrl(imagePath.trim());
  const base = data?.publicUrl ?? null;
  if (!base) return null;
  if (updatedAt) {
    return `${base}?v=${encodeURIComponent(updatedAt)}`;
  }
  return base;
}

function mapRow(row: HomeHeroRow, language: AppLanguage): HomeHeroContent {
  const defaults = getDefaultHomeHero(language);
  const headlines = resolveHeadlines(row, language);
  return {
    headlineLine1: headlines.line1,
    headlineLine2: headlines.line2,
    ctaLabel: row.cta_label?.trim() || defaults.ctaLabel,
    ctaRoute: row.cta_route?.trim() || defaults.ctaRoute,
    imageUrl: resolveImageUrl(row.image_path, row.updated_at)
  };
}

/** Config publiée du héro feed (lecture anon + authentifié). */
export async function getPublishedHomeHero(
  language: AppLanguage = 'en'
): Promise<HomeHeroContent> {
  const { data, error } = await supabase
    .from('home_hero_config')
    .select(
      'headline_line_1, headline_line_2, headline_line_1_en, headline_line_2_en, cta_label, cta_route, image_path, updated_at'
    )
    .eq('id', HOME_HERO_CONFIG_ID)
    .eq('is_published', true)
    .maybeSingle();

  if (error || !data) {
    return getDefaultHomeHero(language);
  }

  return mapRow(data as HomeHeroRow, language);
}
