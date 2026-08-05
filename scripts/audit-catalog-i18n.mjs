/**
 * Vérifie que chaque slug catalogue a une traduction EN et FR distincte de la clé brute.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const en = JSON.parse(fs.readFileSync(path.join(root, 'locales/catalog/en.json'), 'utf8'));
const fr = JSON.parse(fs.readFileSync(path.join(root, 'locales/catalog/fr.json'), 'utf8'));

const missingEn = [];
const missingFr = [];
const frSameAsEn = [];
const frIsKey = [];

for (const slug of Object.keys(en.categories).sort()) {
  if (!en.categories[slug]) missingEn.push(slug);
  if (!fr.categories[slug]) missingFr.push(slug);
  else if (fr.categories[slug] === en.categories[slug]) frSameAsEn.push(slug);
}

for (const slug of Object.keys(en.colors).sort()) {
  if (!en.colors[slug]) missingEn.push(`color:${slug}`);
  if (!fr.colors[slug]) missingFr.push(`color:${slug}`);
}

console.log('=== AUDIT CATALOG I18N ===');
console.log('Categories:', Object.keys(en.categories).length);
console.log('Colors:', Object.keys(en.colors).length);
console.log('Missing EN:', missingEn.length ? missingEn.join(', ') : '(none)');
console.log('Missing FR:', missingFr.length ? missingFr.join(', ') : '(none)');
console.log('FR identical to EN:', frSameAsEn.length, frSameAsEn.length ? `(${frSameAsEn.slice(0, 10).join(', ')}${frSameAsEn.length > 10 ? '…' : ''})` : '');

/** Exemples fil d'Ariane femme → vêtements → sous-catégories */
const WOMAN_CLOTHING_TREE = [
  ['clothing', 'dresses', 'tops_and_t_shirts', 't_shirts', 'shirts_and_blouses', 'jeans', 'skirts'],
  ['shoes', 'sneakers', 'ankle_boots', 'heels', 'ballet_flats'],
  ['bags', 'handbags', 'crossbody_bags', 'totes'],
  ['accessories', 'jewellery', 'belts', 'sunglasses']
];

console.log('\n=== EXEMPLE FEMME (racines → sous-catégories) ===');
for (const branch of WOMAN_CLOTHING_TREE) {
  const [rootSlug, ...children] = branch;
  console.log(`\n[${rootSlug}] EN: ${en.categories[rootSlug]} | FR: ${fr.categories[rootSlug]}`);
  for (const slug of children) {
    console.log(`  └ ${slug}: EN "${en.categories[slug]}" | FR "${fr.categories[slug]}"`);
  }
}
