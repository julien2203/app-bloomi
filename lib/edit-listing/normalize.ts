export function normalizeEditCategory(value: unknown): { id?: number; name?: string } | null {
  if (value && typeof value === 'object') {
    const raw = value as { id?: unknown; name?: unknown };
    const idNum =
      typeof raw.id === 'number'
        ? raw.id
        : typeof raw.id === 'string' && raw.id.trim().length > 0
          ? Number(raw.id)
          : undefined;
    const name =
      typeof raw.name === 'string' && raw.name.trim().length > 0 ? raw.name.trim() : undefined;
    if ((typeof idNum === 'number' && Number.isFinite(idNum)) || name) {
      return {
        ...(typeof idNum === 'number' && Number.isFinite(idNum) ? { id: idNum } : {}),
        ...(name ? { name } : {})
      };
    }
  }
  return null;
}

import {
  BRAND_OTHER_CANONICAL_NAME,
  brandSelectionToStorageName,
  isBlockedBrandName,
  isCanonicalOtherBrandName
} from '../brandConstants';

export function normalizeEditBrand(value: unknown): string | null {
  if (typeof value === 'string') {
    const v = value.trim().replace(/\s+/g, ' ');
    if (!v) return null;
    if (isBlockedBrandName(v)) return null;
    return v;
  }
  if (value && typeof value === 'object') {
    const raw = value as { id?: unknown; name?: unknown };
    if (raw.id === -1) {
      const name =
        typeof raw.name === 'string' ? raw.name.trim().replace(/\s+/g, ' ') : '';
      if (isBlockedBrandName(name)) return null;
      if (!name || isCanonicalOtherBrandName(name)) {
        return BRAND_OTHER_CANONICAL_NAME;
      }
      return name;
    }
    return brandSelectionToStorageName({
      id: typeof raw.id === 'number' ? raw.id : undefined,
      name: typeof raw.name === 'string' ? raw.name : undefined
    });
  }
  return null;
}

export function normalizeEditSize(value: unknown): string | null {
  if (typeof value === 'string') {
    const v = value.trim();
    return v.length > 0 ? v : null;
  }
  if (value && typeof value === 'object') {
    const label = (value as { label?: unknown }).label;
    if (typeof label === 'string') {
      const v = label.trim();
      return v.length > 0 ? v : null;
    }
  }
  return null;
}

export function resolveListingId(raw: string | string[] | undefined): string | null {
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim().length > 0) {
    return raw[0].trim();
  }
  return null;
}

/** Parse le champ `color` d'une annonce (noms séparés par des virgules). */
export function parseListingColorField(
  raw: string | null | undefined
): { id: number; name: string }[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((name) => ({ id: 0, name }));
}

export function serializeListingColors(
  colors: { name: string }[] | null | undefined
): string | null {
  if (!colors?.length) return null;
  const names = colors.map((c) => c.name.trim()).filter(Boolean);
  return names.length > 0 ? names.join(', ') : null;
}
