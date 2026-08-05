/**
 * Audit global : clés i18n utilisées dans l'app vs locales EN/FR (+ catalog).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const SCAN_DIRS = ['app', 'components', 'lib'];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules') walk(p, files);
    else if (/\.(tsx|ts)$/.test(e.name)) files.push(p);
  }
  return files;
}

function extractKeys(content) {
  const keys = new Set();
  const patterns = [
    /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g,
    /\bt\(\s*`([a-zA-Z0-9_.]+)`/g,
    /labelKey:\s*['"]([a-zA-Z0-9_.]+)['"]/g,
    /titleKey:\s*['"]([a-zA-Z0-9_.]+)['"]/g,
    /messageKey:\s*['"]([a-zA-Z0-9_.]+)['"]/g,
    /placeholderKey:\s*['"]([a-zA-Z0-9_.]+)['"]/g,
    /headerKey:\s*['"]([a-zA-Z0-9_.]+)['"]/g
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(content))) keys.add(m[1]);
  }
  // template literals with interpolation → dynamic
  const dynamic = new Set();
  for (const m of content.matchAll(/\bt\(\s*`([^`]*\$\{[^`]*)`/g)) {
    dynamic.add(m[1]);
  }
  return { keys, dynamic };
}

function loadMergedLocale(lang) {
  const base = JSON.parse(fs.readFileSync(path.join(root, 'locales', `${lang}.json`), 'utf8'));
  const catalogPath = path.join(root, 'locales', 'catalog', `${lang}.json`);
  if (fs.existsSync(catalogPath)) {
    base.catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  }
  return base;
}

function hasKey(obj, key) {
  const parts = key.split('.');
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object' || !(p in cur)) return false;
    cur = cur[p];
  }
  return typeof cur === 'string';
}

function resolveDynamicKey(key) {
  // filters.allGenderItems.${gender.toLowerCase()}
  if (key.startsWith('filters.allGenderItems.')) {
    return ['woman', 'men', 'kids', 'baby'].map((g) => `filters.allGenderItems.${g}`);
  }
  if (key.startsWith('filters.${gender}')) {
    return ['woman', 'men', 'kids', 'baby'].map((g) => `filters.${g}`);
  }
  if (key.startsWith('catalog.categories.')) return null;
  if (key.startsWith('catalog.colors.')) return null;
  return null;
}

const en = loadMergedLocale('en');
const fr = loadMergedLocale('fr');

const allKeys = new Set();
const allDynamic = new Set();
const keyFiles = new Map();

for (const dir of SCAN_DIRS) {
  for (const f of walk(path.join(root, dir))) {
    const content = fs.readFileSync(f, 'utf8');
    const { keys, dynamic } = extractKeys(content);
    for (const k of keys) {
      allKeys.add(k);
      if (!keyFiles.has(k)) keyFiles.set(k, []);
      keyFiles.get(k).push(path.relative(root, f));
    }
    for (const d of dynamic) allDynamic.add(d);
  }
}

const missingEn = [];
const missingFr = [];
const expandedKeys = new Set();

for (const k of allKeys) {
  if (k.includes('${')) {
    const resolved = resolveDynamicKey(k);
    if (resolved) resolved.forEach((r) => expandedKeys.add(r));
    continue;
  }
  expandedKeys.add(k);
}

for (const k of [...expandedKeys].sort()) {
  if (!hasKey(en, k)) missingEn.push(k);
  if (!hasKey(fr, k)) missingFr.push(k);
}

console.log('=== AUDIT I18N GLOBAL (app + components + lib) ===');
console.log('Static keys scanned:', allKeys.size);
console.log('After dynamic expansion:', expandedKeys.size);
console.log('Missing EN:', missingEn.length);
console.log('Missing FR:', missingFr.length);

if (missingEn.length) {
  console.log('\n--- MISSING EN ---');
  for (const k of missingEn) {
    console.log(`  ${k}`);
    const files = keyFiles.get(k) ?? [];
    if (files.length) console.log(`    → ${files.slice(0, 3).join(', ')}`);
  }
}

if (missingFr.length) {
  console.log('\n--- MISSING FR ---');
  for (const k of missingFr) {
    console.log(`  ${k}`);
  }
}

// Symmetry EN vs FR (base locales only, flat namespaces)
function flatKeys(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push(key);
    else if (v && typeof v === 'object') out.push(...flatKeys(v, key));
  }
  return out;
}

const enFlat = new Set(flatKeys(en));
const frFlat = new Set(flatKeys(fr));
const onlyEn = [...enFlat].filter((k) => !frFlat.has(k));
const onlyFr = [...frFlat].filter((k) => !enFlat.has(k));

console.log('\n--- LOCALE SYMMETRY ---');
console.log('EN keys:', enFlat.size, '| FR keys:', frFlat.size);
console.log('Only in EN:', onlyEn.length ? onlyEn.join(', ') : '(none)');
console.log('Only in FR:', onlyFr.length ? onlyFr.join(', ') : '(none)');

process.exit(missingEn.length || missingFr.length ? 1 : 0);
