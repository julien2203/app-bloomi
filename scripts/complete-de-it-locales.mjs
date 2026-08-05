/**
 * Complète locales/de.json et locales/it.json avec les clés manquantes.
 * Données : scripts/locale-gap-de-it.json
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

const gap = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'locale-gap-de-it.json'), 'utf8'),
);

const de = JSON.parse(fs.readFileSync(path.join(root, 'locales/de.json'), 'utf8'));
const it = JSON.parse(fs.readFileSync(path.join(root, 'locales/it.json'), 'utf8'));

let addedDe = 0;
let addedIt = 0;

for (const [key, vals] of Object.entries(gap)) {
  if (!get(de, key) && vals.de) {
    deepSet(de, key, vals.de);
    addedDe++;
  }
  if (!get(it, key) && vals.it) {
    deepSet(it, key, vals.it);
    addedIt++;
  }
}

fs.writeFileSync(path.join(root, 'locales/de.json'), `${JSON.stringify(de, null, 2)}\n`);
fs.writeFileSync(path.join(root, 'locales/it.json'), `${JSON.stringify(it, null, 2)}\n`);

console.log(`Patched DE: +${addedDe}, IT: +${addedIt}`);
