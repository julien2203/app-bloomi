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

export function normalizeEditBrand(value: unknown): string | null {
  if (typeof value === 'string') {
    const v = value.trim();
    return v.length > 0 ? v : null;
  }
  if (value && typeof value === 'object') {
    const name = (value as { name?: unknown }).name;
    if (typeof name === 'string') {
      const v = name.trim();
      return v.length > 0 ? v : null;
    }
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
