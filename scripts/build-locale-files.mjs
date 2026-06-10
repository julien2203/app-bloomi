import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { walk } from './locale-maps/translate.mjs';
import { DATA } from './locale-maps/translations-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const en = JSON.parse(fs.readFileSync(path.join(__dirname, 'locales/en.json'), 'utf8'));
const enList = JSON.parse(fs.readFileSync(path.join(__dirname, 'strings-en.json'), 'utf8'));

if (DATA.length !== enList.length) {
  throw new Error(`DATA length ${DATA.length} !== strings-en ${enList.length}`);
}

/** @param {number} col */
function buildMap(col) {
  /** @type {Record<string, string>} */
  const map = {};
  for (let i = 0; i < enList.length; i++) {
    const row = DATA[i];
    if (!row || row[0] !== enList[i]) {
      throw new Error(`Mismatch at index ${i}: expected "${enList[i]}", got "${row?.[0]}"`);
    }
    map[enList[i]] = row[col];
  }
  return map;
}

const frMap = buildMap(1);
const deMap = buildMap(2);
const itMap = buildMap(3);

const localesDir = path.join(root, 'locales');
for (const [name, data] of [
  ['en.json', en],
  ['fr.json', walk(en, frMap)],
  ['de.json', walk(en, deMap)],
  ['it.json', walk(en, itMap)]
]) {
  fs.writeFileSync(path.join(localesDir, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log('Wrote', name);
}
