import fs from 'fs';
import path from 'path';

const roots = ['app', 'components', 'screens'];
const skipDirs = new Set(['node_modules', '.expo']);

const patterns = [
  { re: />([^<>{}\\n]+)</g },
  { re: /title=["']([^"']+)["']/g },
  { re: /placeholder=["']([^"']+)["']/g },
  { re: /label=["']([^"']+)["']/g },
  { re: /label:\s*["']([^"']+)["']/g },
  { re: /Alert\.alert\(\s*["']([^"']+)["']/g },
  { re: /accessibilityLabel=["']([^"']+)["']/g },
  { re: /headerTitle:\s*["']([^"']+)["']/g },
  { re: /title:\s*["']([^"']+)["']/g },
  { re: /message:\s*["']([^"']+)["']/g },
  { re: /buttonText=["']([^"']+)["']/g },
  { re: /text:\s*["']([^"']+)["']/g },
  { re: /subtitle=["']([^"']+)["']/g },
  { re: /headerBackTitle:\s*["']([^"']+)["']/g },
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (ent.name.endsWith('.tsx')) files.push(p);
  }
  return files;
}

function isUserString(s) {
  s = s.trim().replace(/\s+/g, ' ');
  if (!s || s.length < 2) return false;
  if (/^[\d\s.,:;!?€$£%+×\-–—…•]+$/u.test(s)) return false;
  if (/^[{}\/]|^\$|^bloomi:|^#|^rgba|^http|^\/tabs|^\/auth|^expo-/i.test(s)) return false;
  if (
    /^(true|false|null|undefined|flex|row|column|center|contain|cover|dark|light|primary|secondary|destructive|cancel|hidden|visible|auto|none|solid|relative|absolute|modal|slide_from_bottom|body|h2|h3|caption|captionSm|button)$/i.test(
      s
    )
  )
    return false;
  if (/^(en|fr|de|it|CH|FR|DE|IT|OK|id|px|ms|sm|md|lg|xl|feed|profile)$/i.test(s)) return false;
  if (/^[a-z_]+$/.test(s) && s.length < 5 && !/[A-ZÀ-ÿ]/.test(s)) return false;
  if (/^\{/.test(s) || /\$\{/.test(s)) return false;
  return /[A-Za-zÀ-ÿ]/.test(s);
}

const byFile = {};

for (const root of roots) {
  const full = path.join(process.cwd(), root);
  if (!fs.existsSync(full)) continue;
  for (const file of walk(full)) {
    const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const found = new Set();

    for (const { re } of patterns) {
      const r = new RegExp(re.source, re.flags);
      let m;
      while ((m = r.exec(content))) {
        const s = m[1].trim().replace(/\s+/g, ' ');
        if (isUserString(s)) found.add(s);
      }
    }

    const alert2 = /Alert\.alert\([^,]+,\s*["']([^"']+)["']/g;
    let m2;
    while ((m2 = alert2.exec(content))) {
      const s = m2[1].trim();
      if (isUserString(s)) found.add(s);
    }

    if (found.size) byFile[rel] = [...found].sort((a, b) => a.localeCompare(b));
  }
}

const out = path.join(process.cwd(), '.i18n-audit.json');
fs.writeFileSync(out, JSON.stringify(byFile, null, 2), 'utf8');
console.log('Files:', Object.keys(byFile).length);
console.log('Strings:', Object.values(byFile).reduce((n, a) => n + a.length, 0));
console.log('Written:', out);
