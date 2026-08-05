/**
 * Génère la migration complète à partir du SQL client (INSERT ids 743–1831).
 * Usage: node scripts/build-brands-migration.mjs [chemin-source.sql]
 * Par défaut: docs/brands_luxury_source.sql
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const sourcePath = process.argv[2] ?? path.join(root, 'docs', 'brands_luxury_source.sql');
const outPath = path.join(root, 'supabase', 'migrations', '20260613120000_add_catalog_brands.sql');

const source = fs.readFileSync(sourcePath, 'utf8');

const fixed = source
  .replace(/,\s*'enfant',\s*'puericulture'/g, ", 'bebe', 'puericulture'")
  .trim();

const header = `-- ============================================================
-- Bloomi — Ajout marques catalogue luxe + enfants (ids 743..1831)
-- Généré par scripts/build-brands-migration.mjs
-- Correction: puériculture → gender 'bebe' (aligné categories.bebe-puericulture)
-- ============================================================

-- ETAPE 1 : étendre la contrainte de type sur la table brands
ALTER TABLE public.brands DROP CONSTRAINT IF EXISTS brands_type_check;
ALTER TABLE public.brands ADD CONSTRAINT brands_type_check
  CHECK (type IN (
    'vetements', 'chaussures', 'sacs', 'accessoires',
    'jouets', 'puericulture', 'mobilier', 'scolaire', 'all'
  ));

-- ETAPE 2 : insertion de 1089 marques (doublons exclus sur name+gender+type existants)
`;

const footer = `
-- ETAPE 3 : resync de la séquence
SELECT setval('brands_id_seq', (SELECT MAX(id) FROM public.brands), true);
`;

let body = fixed;
if (!body.toUpperCase().startsWith('INSERT')) {
  body = `INSERT INTO public.brands (id, name, gender, type) VALUES\n${body}`;
}
if (body.endsWith(',')) {
  body = body.slice(0, -1) + ';';
} else if (!body.endsWith(';')) {
  body += ';';
}

fs.writeFileSync(outPath, header + body + footer, 'utf8');
console.log('Written:', outPath);
