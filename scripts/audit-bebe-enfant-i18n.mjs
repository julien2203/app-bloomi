import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const content = fs.readFileSync(path.join(root, 'lib/categoryI18n.ts'), 'utf8');
const slugs = new Set([
  ...content.match(/const CATEGORY_SLUGS = new Set\(\[([\s\S]*?)\]\)/)[1].matchAll(/'([^']+)'/g)
].map((m) => m[1]));
const aliases = {};
for (const m of content.match(/const ALIASES: Record<string, string> = \{([\s\S]*?)\};/)[1].matchAll(
  /^\s*([a-z0-9_]+):\s*'([^']+)'/gm
)) {
  aliases[m[1]] = m[2];
}

function norm(s) {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const generic = new Set([
  'femme', 'homme', 'enfant', 'bebe', 'woman', 'women', 'man', 'men', 'kids', 'kid', 'baby',
  'clothing', 'vetements', 'shoes', 'chaussures', 'bags', 'sacs', 'accessories', 'accessoires',
  'sport', 'other', 'others', 'jouets', 'puericulture', 'mobilier', 'scolaire', 'autres'
]);

function resolve(name, slug) {
  const fromName = norm(name);
  if (slugs.has(fromName)) return fromName;
  if (aliases[fromName] && slugs.has(aliases[fromName])) return aliases[fromName];
  if (slug) {
    const s = norm(slug);
    if (slugs.has(s)) return s;
    if (aliases[s] && slugs.has(aliases[s])) return aliases[s];
    const parts = s.split('_').filter(Boolean);
    for (let start = 0; start < parts.length; start++) {
      const segment = parts.slice(start).join('_');
      if (generic.has(segment)) continue;
      if (slugs.has(segment)) return segment;
      if (aliases[segment] && slugs.has(aliases[segment])) return aliases[segment];
    }
  }
  return null;
}

const catSql = fs.readFileSync('c:/Users/j.pouchain/Downloads/categories_rows (1).sql', 'utf8');
const re = /\((\d+),\s*'((?:''|[^'])*)',\s*(null|\d+),\s*'([^']+)',\s*'([^']+)'/g;
const cats = [];
let m;
while ((m = re.exec(catSql))) {
  cats.push({
    id: +m[1],
    name: m[2].replace(/''/g, "'"),
    gender: m[4],
    slug: m[5]
  });
}

const en = JSON.parse(fs.readFileSync(path.join(root, 'locales/catalog/en.json'), 'utf8'));
const fr = JSON.parse(fs.readFileSync(path.join(root, 'locales/catalog/fr.json'), 'utf8'));

const bebeEnfant = cats.filter((c) => c.gender === 'bebe' || c.gender === 'enfant');
console.log('=== BEBE + ENFANT I18N AUDIT ===\n');

for (const c of bebeEnfant) {
  const key = resolve(c.name, c.slug);
  const enLabel = key ? en.categories[key] : null;
  const frLabel = key ? fr.categories[key] : null;
  const status = !key
    ? 'MISSING_KEY'
    : !frLabel
      ? 'MISSING_FR'
      : frLabel === enLabel
        ? 'FR=EN'
        : frLabel === c.name
          ? 'FR_RAW'
          : 'OK';
  if (status !== 'OK') {
    console.log(`[${status}] id=${c.id} ${c.gender} slug=${c.slug}`);
    console.log(`  DB name: "${c.name}"`);
    console.log(`  resolved: ${key ?? '—'}`);
    if (key) console.log(`  EN: "${enLabel}" | FR: "${frLabel}"`);
    console.log('');
  }
}

const ok = bebeEnfant.filter((c) => {
  const key = resolve(c.name, c.slug);
  if (!key || !fr.categories[key]) return false;
  return fr.categories[key] !== en.categories[key] && fr.categories[key] !== c.name;
});
console.log(`OK: ${ok.length}/${bebeEnfant.length}`);
