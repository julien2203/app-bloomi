import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const enKeys = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'i18n-missing-en-flat.json'), 'utf8')
);
const frKeys = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'i18n-missing-fr-flat.json'), 'utf8')
);

const data = {};
for (const key of Object.keys(enKeys)) {
  data[key] = { en: enKeys[key], fr: frKeys[key] ?? enKeys[key] };
}

fs.writeFileSync(
  path.join(__dirname, 'i18n-missing-data.json'),
  JSON.stringify(data, null, 2) + '\n'
);
console.log('Wrote', Object.keys(data).length, 'entries');
