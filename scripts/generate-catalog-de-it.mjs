/**
 * Génère locales/catalog/de.json et locales/catalog/it.json
 * à partir des catalogues EN/FR existants.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const catalogDir = path.join(root, 'locales', 'catalog');

const en = JSON.parse(fs.readFileSync(path.join(catalogDir, 'en.json'), 'utf8'));
const fr = JSON.parse(fs.readFileSync(path.join(catalogDir, 'fr.json'), 'utf8'));

const COLOR_DE = {
  black: 'Schwarz',
  white: 'Weiss',
  grey: 'Grau',
  beige: 'Beige',
  brown: 'Braun',
  blue: 'Blau',
  red: 'Rot',
  green: 'Grün',
  yellow: 'Gelb',
  orange: 'Orange',
  pink: 'Rosa',
  purple: 'Lila',
  multicolor: 'Mehrfarbig',
  gold: 'Gold',
  silver: 'Silber',
  cream: 'Creme',
  khaki: 'Khaki',
  khaki_green: 'Khakigrün',
  navy: 'Marineblau',
  navy_blue: 'Marineblau',
  burgundy: 'Bordeaux',
  turquoise: 'Türkis',
  coral: 'Koralle',
  mustard: 'Senf',
  olive: 'Olive',
  tan: 'Camel',
  ivory: 'Elfenbein',
  nude: 'Nude',
  copper: 'Kupfer',
  bronze: 'Bronze',
  lavender: 'Lavendel',
  lilac: 'Flieder',
  mint: 'Mint',
  charcoal: 'Anthrazit',
  dark_blue: 'Dunkelblau',
  light_blue: 'Hellblau',
  dark_green: 'Dunkelgrün',
  light_green: 'Hellgrün',
  dark_grey: 'Dunkelgrau',
  light_grey: 'Hellgrau',
  dark_pink: 'Dunkelrosa',
  light_pink: 'Hellrosa',
  dark_brown: 'Dunkelbraun',
  light_brown: 'Hellbraun',
  dark_red: 'Dunkelrot',
  leopard: 'Leopard',
  floral: 'Blumenmuster',
  striped: 'Gestreift',
  polka_dot: 'Tupfen',
  animal_print: 'Animalprint',
  clear: 'Transparent',
  other: 'Andere'
};

const COLOR_IT = {
  black: 'Nero',
  white: 'Bianco',
  grey: 'Grigio',
  beige: 'Beige',
  brown: 'Marrone',
  blue: 'Blu',
  red: 'Rosso',
  green: 'Verde',
  yellow: 'Giallo',
  orange: 'Arancione',
  pink: 'Rosa',
  purple: 'Viola',
  multicolor: 'Multicolore',
  gold: 'Oro',
  silver: 'Argento',
  cream: 'Crema',
  khaki: 'Kaki',
  khaki_green: 'Verde kaki',
  navy: 'Blu navy',
  navy_blue: 'Blu navy',
  burgundy: 'Bordeaux',
  turquoise: 'Turchese',
  coral: 'Corallo',
  mustard: 'Senape',
  olive: 'Oliva',
  tan: 'Cammello',
  ivory: 'Avorio',
  nude: 'Nude',
  copper: 'Rame',
  bronze: 'Bronzo',
  lavender: 'Lavanda',
  lilac: 'Lilla',
  mint: 'Menta',
  charcoal: 'Antracite',
  dark_blue: 'Blu scuro',
  light_blue: 'Azzurro',
  dark_green: 'Verde scuro',
  light_green: 'Verde chiaro',
  dark_grey: 'Grigio scuro',
  light_grey: 'Grigio chiaro',
  dark_pink: 'Rosa scuro',
  light_pink: 'Rosa chiaro',
  dark_brown: 'Marrone scuro',
  light_brown: 'Marrone chiaro',
  dark_red: 'Rosso scuro',
  leopard: 'Leopardato',
  floral: 'Floreale',
  striped: 'A righe',
  polka_dot: 'A pois',
  animal_print: 'Stampa animalier',
  clear: 'Trasparente',
  other: 'Altro'
};

const FR_DE_REPLACEMENTS = [
  ['Vêtements', 'Kleidung'],
  ['Chaussures', 'Schuhe'],
  ['Sacs', 'Taschen'],
  ['Accessoires', 'Accessoires'],
  ['Bébé', 'Baby'],
  ['Enfant', 'Kinder'],
  ['Fille', 'Mädchen'],
  ['Garçon', 'Jungen'],
  ['Robes', 'Kleider'],
  ['Pantalons', 'Hosen'],
  ['Shorts', 'Shorts'],
  ['Jupes', 'Röcke'],
  ['Manteaux', 'Mäntel'],
  ['Vestes', 'Jacken'],
  ['Pulls', 'Pullover'],
  ['Chemises', 'Hemden'],
  ['T-shirts', 'T-Shirts'],
  ['Baskets', 'Sneaker'],
  ['Bottes', 'Stiefel'],
  ['Sandales', 'Sandalen'],
  ['Sacs à main', 'Handtaschen'],
  ['Sacs à dos', 'Rucksäcke'],
  ['Jouets', 'Spielzeug'],
  ['École', 'Schule'],
  ['Divers', 'Sonstiges'],
  ['Non classé', 'Nicht kategorisiert'],
  ['Luxe & créateurs', 'Luxus & Designer'],
  ['Vintage', 'Vintage'],
  [' et ', ' & '],
  [' à ', ' '],
  [' de ', ' '],
  [' d\'', ' '],
  [' l\'', ' ']
];

const FR_IT_REPLACEMENTS = [
  ['Vêtements', 'Abbigliamento'],
  ['Chaussures', 'Scarpe'],
  ['Sacs', 'Borse'],
  ['Accessoires', 'Accessori'],
  ['Bébé', 'Neonato'],
  ['Enfant', 'Bambino'],
  ['Fille', 'Bambina'],
  ['Garçon', 'Bambino'],
  ['Robes', 'Vestiti'],
  ['Pantalons', 'Pantaloni'],
  ['Shorts', 'Short'],
  ['Jupes', 'Gonne'],
  ['Manteaux', 'Cappotti'],
  ['Vestes', 'Giacche'],
  ['Pulls', 'Maglioni'],
  ['Chemises', 'Camicie'],
  ['T-shirts', 'T-shirt'],
  ['Baskets', 'Sneaker'],
  ['Bottes', 'Stivali'],
  ['Sandales', 'Sandali'],
  ['Sacs à main', 'Borse a mano'],
  ['Sacs à dos', 'Zaini'],
  ['Jouets', 'Giochi'],
  ['École', 'Scuola'],
  ['Divers', 'Varie'],
  ['Non classé', 'Non classificato'],
  ['Luxe & créateurs', 'Lusso & designer'],
  ['Vintage', 'Vintage'],
  [' et ', ' e '],
  [' à ', ' a '],
  [' de ', ' '],
  [' d\'', ' '],
  [' l\'', ' ']
];

function transformLabel(label, replacements) {
  let out = label;
  for (const [from, to] of replacements) {
    out = out.split(from).join(to);
  }
  return out.replace(/\s+/g, ' ').trim();
}

const categoriesDe = {};
const categoriesIt = {};
for (const slug of Object.keys(en.categories)) {
  const frLabel = fr.categories[slug] ?? en.categories[slug];
  categoriesDe[slug] = transformLabel(frLabel, FR_DE_REPLACEMENTS);
  categoriesIt[slug] = transformLabel(frLabel, FR_IT_REPLACEMENTS);
}

const colorsDe = {};
const colorsIt = {};
for (const slug of Object.keys(en.colors)) {
  colorsDe[slug] = COLOR_DE[slug] ?? en.colors[slug];
  colorsIt[slug] = COLOR_IT[slug] ?? en.colors[slug];
}

fs.writeFileSync(
  path.join(catalogDir, 'de.json'),
  `${JSON.stringify({ categories: categoriesDe, colors: colorsDe }, null, 2)}\n`
);
fs.writeFileSync(
  path.join(catalogDir, 'it.json'),
  `${JSON.stringify({ categories: categoriesIt, colors: colorsIt }, null, 2)}\n`
);

console.log(`Wrote catalog DE/IT with ${Object.keys(categoriesDe).length} categories`);
