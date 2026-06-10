/** @typedef {Record<string, string>} StringMap */

/** @param {string} s @param {StringMap} map */
export function tr(s, map) {
  if (s === 'TODO') return 'TODO';
  return map[s] ?? s;
}

/** @param {unknown} obj @param {StringMap} map */
export function walk(obj, map) {
  if (typeof obj === 'string') return tr(obj, map);
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = walk(v, map);
    }
    return out;
  }
  return obj;
}
