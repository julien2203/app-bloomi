/**
 * Complète en.json / fr.json avec les clés i18n manquantes.
 * Données : scripts/i18n-missing-data.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function deepSet(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function get(obj, keyPath) {
  const parts = keyPath.split('.');
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object' || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'i18n-missing-data.json'), 'utf8')
);

const en = JSON.parse(fs.readFileSync(path.join(root, 'locales/en.json'), 'utf8'));
const fr = JSON.parse(fs.readFileSync(path.join(root, 'locales/fr.json'), 'utf8'));

let addedEn = 0;
let addedFr = 0;

for (const [key, vals] of Object.entries(data)) {
  if (!get(en, key) && vals.en) {
    deepSet(en, key, vals.en);
    addedEn++;
  }
  if (!get(fr, key) && vals.fr) {
    deepSet(fr, key, vals.fr);
    addedFr++;
  }
}

fs.writeFileSync(path.join(root, 'locales/en.json'), `${JSON.stringify(en, null, 2)}\n`);
fs.writeFileSync(path.join(root, 'locales/fr.json'), `${JSON.stringify(fr, null, 2)}\n`);

console.log(`Patched EN: +${addedEn}, FR: +${addedFr}`);
