/**
 * Génère locales/catalog/en.json et locales/catalog/fr.json
 * à partir des slugs reconnus dans lib/categoryI18n.ts et lib/colorI18n.ts.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function extractSetFromTs(filePath, setName) {
  const content = fs.readFileSync(path.join(root, filePath), 'utf8');
  const re = new RegExp(`const ${setName} = new Set\\(\\[([\\s\\S]*?)\\]\\)`);
  const match = content.match(re);
  if (!match) throw new Error(`Could not parse ${setName} from ${filePath}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function extractAliasesFromTs(filePath, constName) {
  const content = fs.readFileSync(path.join(root, filePath), 'utf8');
  const re = new RegExp(`const ${constName}: Record<string, string> = \\{([\\s\\S]*?)\\};`);
  const match = content.match(re);
  if (!match) return {};
  const aliases = {};
  for (const m of match[1].matchAll(/^\s*([a-z0-9_]+):\s*'([^']+)'/gm)) {
    aliases[m[1]] = m[2];
  }
  return aliases;
}

const FRENCH_HINT =
  /[àâäéèêëïîôùûüç]|^(robes|chemises|pantalons|jupes|manteaux|vestes|bottes|talons|ballerines|mocassins|chaussures|chaussons|sabots|bijoux|montres|gants|ceintures|chapeaux|bonnets|foulards|echarpes|collants|bodies|peluches|jouets|jeux|poussettes|poussette|landaus|barboteuses|figurines|poupees|livres|berceaux|transats|couffins|bavoirs|gigoteuses|couvertures|lingettes|gourdes|papeterie|lits|chaises|bureaux|rangement|sommeil|bain|banane|cabas|pochettes|bandouliere|deguisements|divers|maille|maillots|culottes|vetements|sacs|accessoires|ecole|scolaire|filles|garcons|uniformes|combinaisons|salopettes|loisirs_creatifs|non_classe|sous_vetements|porte_bebe|sieges_auto|sacs_a_langer|sacs_a_dos|sacs_a_main|sacs_de_voyage|sacs_ceinture|sacs_ecole|lunettes_de_soleil|fournitures_scolaires|mobilier_enfant|meubles_enfant|chaussons_bebe|vert_kaki|bleu_marine|animalier|raye|rayures|pois|fleuri|dore|argent|creme|kaki|marine|bordeaux|corail|moutarde|ivoire|anthracite|camel|autre|gris|noir|blanc|marron|bleu|rouge|vert|jaune|rose|violet|multicolore)$/;

function aliasToFrLabel(alias) {
  const parts = alias.split('_');
  const joined = parts
    .map((p, i) => {
      if (p === 'a' && i > 0) return 'à';
      if (p === 'de' || p === 'et' || p === 'ou') return p;
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(' ')
    .replace(/\bA\b/g, 'à')
    .replace(/Sacs à Dos/g, 'Sacs à dos')
    .replace(/Sacs à Main/g, 'Sacs à main')
    .replace(/Sacs à Langer/g, 'Sacs à langer')
    .replace(/Sacs De Voyage/g, 'Sacs de voyage')
    .replace(/Sacs Ceinture/g, 'Sacs ceinture')
    .replace(/Sacs Ecole/g, 'Sacs école')
    .replace(/Lunettes De Soleil/g, 'Lunettes de soleil')
    .replace(/Sieges Auto/g, 'Sièges auto')
    .replace(/Porte Bebe/g, 'Porte-bébé')
    .replace(/Chaussons Bebe/g, 'Chaussons bébé')
    .replace(/Bleu Marine/g, 'Bleu marine')
    .replace(/Vert Kaki/g, 'Vert kaki')
    .replace(/Loisirs Creatifs/g, 'Loisirs créatifs')
    .replace(/Non Classe/g, 'Non classé')
    .replace(/Sous Vetements/g, 'Sous-vêtements')
    .replace(/Deguisements/g, 'Déguisements')
    .replace(/Echarpes/g, 'Écharpes');
  return joined;
}

const EN_OVERRIDES = {
  clothing: 'Clothing',
  shoes: 'Shoes',
  bags: 'Bags',
  accessories: 'Accessories',
  sport: 'Sport',
  other: 'Other',
  other_items: 'Other items',
  t_shirts: 'T-shirts',
  tops_and_t_shirts: 'Tops & T-shirts',
  shirts_and_blouses: 'Shirts & Blouses',
  sweaters_and_hoodies: 'Sweaters & Hoodies',
  jumpers_and_sweaters: 'Jumpers & Sweaters',
  jackets_and_coats: 'Jackets & Coats',
  coats_and_jackets: 'Coats & Jackets',
  suits_and_blazers: 'Suits & Blazers',
  trousers_shorts_and_dungarees: 'Trousers, Shorts & Dungarees',
  jumpsuits_and_playsuits: 'Jumpsuits & Playsuits',
  socks_and_tights: 'Socks & Tights',
  nightwear_and_underwear: 'Nightwear & Underwear',
  underwear_and_nightwear: 'Underwear & Nightwear',
  fancy_dress_and_costumes: 'Fancy dress & Costumes',
  first_shoes_and_booties: 'First shoes & Booties',
  hats_and_caps: 'Hats & Caps',
  gloves_and_mittens: 'Gloves & Mittens',
  scarves_and_shawls: 'Scarves & Shawls',
  toys_and_games: 'Toys & Games',
  prams_and_pushchairs: 'Prams & Pushchairs',
  books_and_stationery: 'Books & Stationery',
  lunch_boxes_and_water_bottles: 'Lunch boxes & Water bottles',
  beds_and_mattresses: 'Beds & Mattresses',
  chairs_and_seating: 'Chairs & Seating',
  tables_and_desks: 'Tables & Desks',
  storage_and_organisers: 'Storage & Organisers',
  storage_and_organizers: 'Storage & Organizers',
  action_figures_and_dolls: 'Action figures & Dolls',
  games_and_puzzles: 'Games & Puzzles',
  sleep_and_care: 'Sleep & Care',
  nursery_and_furniture: 'Nursery & Furniture',
  bodysuits_and_vests: 'Bodysuits & Vests',
  sleepsuits_and_pyjamas: 'Sleepsuits & Pyjamas',
  baby_socks_and_tights: 'Baby socks & Tights',
  changing_mats_and_covers: 'Changing mats & Covers',
  towels_and_washcloths: 'Towels & Washcloths',
  nappies_and_wipes: 'Nappies & Wipes',
  cots_and_cot_beds: 'Cots & Cot beds',
  bouncers_and_swings: 'Bouncers & Swings',
  mid_calf_boots: 'Mid-calf boots',
  knee_high_boots: 'Knee-high boots',
  ballet_flats: 'Ballet flats',
  polo_shirts: 'Polo shirts',
  trench_coats: 'Trench coats',
  sports_shoes: 'Sports shoes',
  crossbody_bags: 'Crossbody bags',
  travel_bags: 'Travel bags',
  shoulder_bags: 'Shoulder bags',
  bum_bags: 'Bum bags',
  belt_bags: 'Belt bags',
  glasses_and_sunglasses: 'Glasses & Sunglasses',
  hair_accessories: 'Hair accessories',
  tech_accessories: 'Tech accessories',
  baby_clothing: 'Baby clothing',
  baby_shoes: 'Baby shoes',
  baby_accessories: 'Baby accessories',
  kids_clothing: "Kids' clothing",
  girls_clothing: "Girls' clothing",
  boys_clothing: "Boys' clothing",
  school_uniforms: 'School uniforms',
  pants_and_shorts: 'Pants & Shorts',
  influencers_picks: 'Influencer picks',
  all_in_one: 'All-in-one',
  two_piece: 'Two-piece',
  cover_ups: 'Cover-ups',
  cargo_shorts: 'Cargo shorts',
  cargo_trousers: 'Cargo trousers',
  other_baby_clothing: 'Other baby clothing',
  other_baby_shoes: 'Other baby shoes',
  other_baby_accessories: 'Other baby accessories',
  other_sleep_and_care: 'Other sleep & care',
  other_nursery: 'Other nursery',
  other_school_supplies: 'Other school supplies',
  other_furniture: 'Other furniture',
  other_toys: 'Other toys',
  unisex_baby_clothing: 'Unisex baby clothing',
  clothing_bundles: 'Clothing bundles',
  kids_furniture: "Kids' furniture",
  kids_bags: "Kids' bags",
  kids_shoes: "Kids' shoes",
  kids_accessories: "Kids' accessories",
  girls_shoes: "Girls' shoes",
  boys_shoes: "Boys' shoes",
  girls_accessories: "Girls' accessories",
  boys_accessories: "Boys' accessories",
  baby_care: 'Baby care',
  baby_toys: 'Baby toys',
  toys_and_leisure: 'Toys & leisure',
  sweaters_and_cardigans: 'Sweaters & cardigans',
  sets_and_outfits: 'Sets & outfits',
  trousers_and_leggings: 'Trousers & leggings',
  sun_hats: 'Sun hats',
  mattresses: 'Mattresses',
  activity_and_sensory_toys: 'Activity & sensory toys',
  baby_books: 'Baby books',
  newborn_gift_sets: 'Newborn gift sets',
  bags_and_school_bags: 'Bags & school bags',
  board_games: 'Board games',
  childrens_books: "Children's books",
  dress_shoes: 'Dress shoes',
  pumps: 'Pumps',
  heeled_shoes: 'Heeled shoes',
  sweatshirts_and_hoodies: 'Sweatshirts & Hoodies',
  trousers_and_pants: 'Trousers & Pants',
  lingerie_and_nightwear: 'Lingerie & Nightwear',
  sports_accessories: 'Sports accessories',
  messenger_bags: 'Messenger bags',
  sports_bags: 'Sports bags',
  vintage: 'Vintage',
  designer_and_luxury: 'Designer & Luxury',
  jumpsuits_and_rompers: 'Jumpsuits & Rompers',
  booties_and_soft_shoes: 'Booties & Soft shoes',
  slippers_and_soft_shoes: 'Slippers & Soft shoes'
};

const FR_OVERRIDES = {
  clothing: 'Vêtements',
  shoes: 'Chaussures',
  bags: 'Sacs',
  accessories: 'Accessoires',
  sport: 'Sport',
  other: 'Autre',
  other_items: 'Autres articles',
  other_clothing: 'Autres vêtements',
  other_accessories: 'Autres accessoires',
  other_shoes: 'Autres chaussures',
  other_bags: 'Autres sacs',
  fancy_dress: 'Déguisements',
  uncategorized: 'Non classé',
  miscellaneous: 'Divers',
  dresses: 'Robes',
  tops: 'Hauts',
  t_shirts: 'T-shirts',
  shirts: 'Chemises',
  sweaters_and_hoodies: 'Pulls & sweats à capuche',
  sweaters: 'Pulls',
  hoodies: 'Sweats à capuche',
  blazers: 'Blazers',
  coats: 'Manteaux',
  jackets: 'Vestes',
  jeans: 'Jeans',
  trousers: 'Pantalons',
  shorts: 'Shorts',
  skirts: 'Jupes',
  jumpsuits: 'Combinaisons',
  bodysuits: 'Bodies',
  lingerie: 'Lingerie',
  swimwear: 'Maillots de bain',
  nightwear: 'Pyjamas',
  maternity: 'Maternité',
  costumes: 'Costumes',
  activewear: 'Vêtements de sport',
  knitwear: 'Maille',
  suits: 'Costumes',
  blouses: 'Blouses',
  tracksuits: 'Survêtements',
  leggings: 'Leggings',
  cardigans: 'Cardigans',
  polo_shirts: 'Polos',
  vests: 'Gilets sans manches',
  gilets: 'Gilets',
  trench_coats: 'Trenchs',
  onesies: 'Bodies',
  overalls: 'Salopettes',
  jumpers_and_sweaters: 'Pulls & sweats',
  jumpers: 'Pulls',
  jackets_and_coats: 'Vestes & manteaux',
  suits_and_blazers: 'Costumes & blazers',
  sportswear: 'Vêtements de sport',
  underwear: 'Sous-vêtements',
  underwear_and_nightwear: 'Sous-vêtements & pyjamas',
  socks: 'Chaussettes',
  trainers: 'Baskets',
  sneakers: 'Baskets',
  boots: 'Bottes',
  ankle_boots: 'Bottines',
  mid_calf_boots: 'Bottes mi-mollet',
  knee_high_boots: 'Bottes hautes',
  heels: 'Talons',
  courts: 'Escarpins',
  flats: 'Chaussures plates',
  ballet_flats: 'Ballerines',
  loafers: 'Mocassins',
  sandals: 'Sandales',
  espadrilles: 'Espadrilles',
  mules: 'Mules',
  slippers: 'Chaussons',
  clogs: 'Sabots',
  sports_shoes: 'Chaussures de sport',
  handbags: 'Sacs à main',
  crossbody_bags: 'Sacs bandoulière',
  totes: 'Cabas',
  travel_bags: 'Sacs de voyage',
  backpacks: 'Sacs à dos',
  clutches: 'Pochettes',
  wallets: 'Portefeuilles',
  shoulder_bags: 'Sacs à épaule',
  bum_bags: 'Sacs banane',
  belt_bags: 'Sacs ceinture',
  glasses_and_sunglasses: 'Lunettes & lunettes de soleil',
  sunglasses: 'Lunettes de soleil',
  belts: 'Ceintures',
  hats: 'Chapeaux',
  scarves: 'Foulards',
  gloves: 'Gants',
  jewellery: 'Bijoux',
  watches: 'Montres',
  hair_accessories: 'Accessoires cheveux',
  tech_accessories: 'Accessoires tech',
  baby_clothing: 'Vêtements bébé',
  baby_shoes: 'Chaussures bébé',
  baby_accessories: 'Accessoires bébé',
  kids_clothing: 'Vêtements enfant',
  girls_clothing: 'Vêtements fille',
  boys_clothing: 'Vêtements garçon',
  girls: 'Fille',
  boys: 'Garçon',
  unisex: 'Unisexe',
  school_uniforms: 'Uniformes scolaires',
  schoolwear: 'Tenues scolaires',
  outerwear: 'Vêtements d\'extérieur',
  tops_and_t_shirts: 'Hauts & T-shirts',
  coats_and_jackets: 'Manteaux & vestes',
  trousers_shorts_and_dungarees: 'Pantalons, shorts & salopettes',
  jumpsuits_and_playsuits: 'Combinaisons & combishorts',
  playsuits: 'Combishorts',
  dungarees: 'Salopettes',
  socks_and_tights: 'Chaussettes & collants',
  tights: 'Collants',
  nightwear_and_underwear: 'Pyjamas & sous-vêtements',
  fancy_dress_and_costumes: 'Déguisements & costumes',
  clothing_bundles: 'Lots de vêtements',
  baby_grows: 'Bodies',
  sleepsuits: 'Grenouillères',
  bundles: 'Lots',
  first_shoes_and_booties: 'Premières chaussures & chaussons',
  first_shoes: 'Premières chaussures',
  booties: 'Chaussons',
  girls_shoes: 'Chaussures fille',
  boys_shoes: 'Chaussures garçon',
  kids_shoes: 'Chaussures enfant',
  girls_accessories: 'Accessoires fille',
  boys_accessories: 'Accessoires garçon',
  kids_accessories: 'Accessoires enfant',
  hats_and_caps: 'Chapeaux & casquettes',
  gloves_and_mittens: 'Gants & moufles',
  scarves_and_shawls: 'Écharpes & châles',
  kids_bags: 'Sacs enfant',
  toys_and_games: 'Jouets & jeux',
  prams_and_pushchairs: 'Poussettes & landaus',
  toys: 'Jouets',
  books_and_stationery: 'Livres & papeterie',
  kids_furniture: 'Mobilier enfant',
  school: 'École',
  school_supplies: 'Fournitures scolaires',
  school_bags: 'Sacs d\'école',
  lunch_boxes_and_water_bottles: 'Boîtes à lunch & gourdes',
  lunch_boxes: 'Boîtes à lunch',
  water_bottles: 'Gourdes',
  stationery: 'Papeterie',
  other_school_supplies: 'Autres fournitures scolaires',
  beds_and_mattresses: 'Lits & matelas',
  chairs_and_seating: 'Chaises & assises',
  tables_and_desks: 'Tables & bureaux',
  storage_and_organisers: 'Rangement & organisation',
  storage_and_organizers: 'Rangement & organisation',
  other_furniture: 'Autre mobilier',
  action_figures_and_dolls: 'Figurines & poupées',
  building_blocks: 'Jeux de construction',
  outdoor_toys: 'Jeux d\'extérieur',
  soft_toys: 'Peluches',
  educational_toys: 'Jouets éducatifs',
  games_and_puzzles: 'Jeux & puzzles',
  other_toys: 'Autres jouets',
  sleep_and_care: 'Sommeil & soins',
  nursery_and_furniture: 'Chambre bébé & mobilier',
  bodysuits_and_vests: 'Bodies & gilets',
  sleepsuits_and_pyjamas: 'Grenouillères & pyjamas',
  baby_tops: 'Hauts bébé',
  baby_bottoms: 'Bas bébé',
  baby_dresses: 'Robes bébé',
  baby_outerwear: 'Vêtements d\'extérieur bébé',
  baby_swimwear: 'Maillots bébé',
  baby_socks_and_tights: 'Chaussettes & collants bébé',
  other_baby_clothing: 'Autres vêtements bébé',
  crawling_shoes: 'Chaussures d\'éveil',
  other_baby_shoes: 'Autres chaussures bébé',
  bibs: 'Bavoirs',
  baby_hats: 'Chapeaux bébé',
  baby_gloves_and_mittens: 'Gants & moufles bébé',
  baby_socks: 'Chaussettes bébé',
  other_baby_accessories: 'Autres accessoires bébé',
  sleeping_bags: 'Gigoteuses',
  blankets: 'Couvertures',
  changing_mats_and_covers: 'Matelas à langer & housses',
  towels_and_washcloths: 'Serviettes & gants de toilette',
  bathing: 'Bain',
  nappies_and_wipes: 'Couches & lingettes',
  other_sleep_and_care: 'Autres sommeil & soins',
  cots_and_cot_beds: 'Berceaux & lits bébé',
  changing_tables: 'Tables à langer',
  high_chairs: 'Chaises hautes',
  bouncers_and_swings: 'Transats & balancelles',
  moses_baskets: 'Couffins',
  car_seats: 'Sièges auto',
  baby_carriers: 'Porte-bébé',
  other_nursery: 'Autre chambre bébé',
  changing_bags: 'Sacs à langer',
  books: 'Livres',
  games: 'Jeux',
  puzzles: 'Puzzles',
  dolls: 'Poupées',
  rompers: 'Barboteuses',
  musical_toys: 'Jouets musicaux',
  electronic_toys: 'Jouets électroniques',
  arts_and_crafts: 'Loisirs créatifs',
  baby_boys: 'Bébé garçon',
  baby_girls: 'Bébé fille',
  unisex_baby_clothing: 'Vêtements bébé unisexes',
  shirts_and_blouses: 'Chemises & blouses',
  pants_and_shorts: 'Pantalons & shorts',
  influencers_picks: 'Sélection influenceurs',
  all_in_one: 'Une pièce',
  two_piece: 'Deux pièces',
  bikinis: 'Bikinis',
  cover_ups: 'Paréos',
  pyjamas: 'Pyjamas',
  bras: 'Soutiens-gorge',
  panties: 'Culottes',
  chinos: 'Chinos',
  cargo_shorts: 'Shorts cargo',
  cargo_trousers: 'Pantalons cargo',
  all_in_ones_and_bodysuits: 'Bodies & grenouillères',
  pushchairs: 'Poussettes',
  strollers: 'Poussettes',
  baby_care: 'Puériculture',
  baby_toys: 'Jouets bébé',
  toys_and_leisure: 'Jouets & loisirs',
  sweaters_and_cardigans: 'Pulls & gilets',
  sets_and_outfits: 'Ensembles & tenues',
  trousers_and_leggings: 'Pantalons & leggings',
  sun_hats: 'Chapeaux de soleil',
  mattresses: 'Matelas',
  activity_and_sensory_toys: "Jouets d'éveil & sensoriels",
  baby_books: 'Livres bébé',
  newborn_gift_sets: 'Coffrets naissance',
  bags_and_school_bags: 'Sacs & cartables',
  board_games: 'Jeux de société',
  childrens_books: 'Livres enfant',
  dress_shoes: 'Chaussures habillées',
  pumps: 'Escarpins',
  heeled_shoes: 'Chaussures à talons',
  sweatshirts_and_hoodies: 'Sweats & hoodies',
  trousers_and_pants: 'Pantalons',
  lingerie_and_nightwear: 'Lingerie & pyjamas',
  sports_accessories: 'Accessoires de sport',
  messenger_bags: 'Sacs messager',
  sports_bags: 'Sacs de sport',
  vintage: 'Vintage',
  designer_and_luxury: 'Luxe & créateurs',
  jumpsuits_and_rompers: 'Combinaisons & barboteuses',
  booties_and_soft_shoes: 'Chaussons & souples',
  slippers_and_soft_shoes: 'Chaussons & pantoufles'
};

const COLOR_EN = {
  black: 'Black',
  white: 'White',
  grey: 'Grey',
  beige: 'Beige',
  brown: 'Brown',
  blue: 'Blue',
  red: 'Red',
  green: 'Green',
  yellow: 'Yellow',
  orange: 'Orange',
  pink: 'Pink',
  purple: 'Purple',
  multicolor: 'Multicolor',
  gold: 'Gold',
  silver: 'Silver',
  cream: 'Cream',
  khaki: 'Khaki',
  khaki_green: 'Khaki green',
  navy: 'Navy',
  navy_blue: 'Navy blue',
  burgundy: 'Burgundy',
  turquoise: 'Turquoise',
  coral: 'Coral',
  mustard: 'Mustard',
  olive: 'Olive',
  tan: 'Tan',
  ivory: 'Ivory',
  nude: 'Nude',
  copper: 'Copper',
  bronze: 'Bronze',
  lavender: 'Lavender',
  lilac: 'Lilac',
  mint: 'Mint',
  charcoal: 'Charcoal',
  dark_blue: 'Dark blue',
  light_blue: 'Light blue',
  dark_green: 'Dark green',
  light_green: 'Light green',
  dark_grey: 'Dark grey',
  light_grey: 'Light grey',
  dark_pink: 'Dark pink',
  light_pink: 'Light pink',
  dark_brown: 'Dark brown',
  light_brown: 'Light brown',
  dark_red: 'Dark red',
  leopard: 'Leopard',
  floral: 'Floral',
  striped: 'Striped',
  polka_dot: 'Polka dot',
  animal_print: 'Animal print',
  clear: 'Clear',
  other: 'Others'
};

const COLOR_FR = {
  black: 'Noir',
  white: 'Blanc',
  grey: 'Gris',
  beige: 'Beige',
  brown: 'Marron',
  blue: 'Bleu',
  red: 'Rouge',
  green: 'Vert',
  yellow: 'Jaune',
  orange: 'Orange',
  pink: 'Rose',
  purple: 'Violet',
  multicolor: 'Multicolore',
  gold: 'Doré',
  silver: 'Argent',
  cream: 'Crème',
  khaki: 'Kaki',
  khaki_green: 'Vert kaki',
  navy: 'Marine',
  navy_blue: 'Bleu marine',
  burgundy: 'Bordeaux',
  turquoise: 'Turquoise',
  coral: 'Corail',
  mustard: 'Moutarde',
  olive: 'Olive',
  tan: 'Camel',
  ivory: 'Ivoire',
  nude: 'Nude',
  copper: 'Cuivre',
  bronze: 'Bronze',
  lavender: 'Lavande',
  lilac: 'Lilas',
  mint: 'Menthe',
  charcoal: 'Anthracite',
  dark_blue: 'Bleu foncé',
  light_blue: 'Bleu clair',
  dark_green: 'Vert foncé',
  light_green: 'Vert clair',
  dark_grey: 'Gris foncé',
  light_grey: 'Gris clair',
  dark_pink: 'Rose foncé',
  light_pink: 'Rose clair',
  dark_brown: 'Marron foncé',
  light_brown: 'Marron clair',
  dark_red: 'Rouge foncé',
  leopard: 'Léopard',
  floral: 'Fleuri',
  striped: 'Rayé',
  polka_dot: 'À pois',
  animal_print: 'Animalier',
  clear: 'Transparent',
  other: 'Autres'
};

function slugToEn(slug) {
  if (EN_OVERRIDES[slug]) return EN_OVERRIDES[slug];
  return slug
    .split('_')
    .map((w) => {
      if (w === 't' && slug.includes('t_shirts')) return null;
      if (w === 'shirts' && slug === 't_shirts') return null;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .filter(Boolean)
    .join(' ')
    .replace(/ And /g, ' & ')
    .replace(/T Shirts/g, 'T-shirts');
}

function buildFrFromAliases(slugs, aliases) {
  /** @type {Record<string, string>} */
  const fromAlias = {};
  for (const [alias, targetSlug] of Object.entries(aliases)) {
    if (!slugs.includes(targetSlug)) continue;
    if (!FRENCH_HINT.test(alias)) continue;
    const label = aliasToFrLabel(alias);
    if (!fromAlias[targetSlug] || label.length > fromAlias[targetSlug].length) {
      fromAlias[targetSlug] = label;
    }
  }
  return fromAlias;
}

const categorySlugs = extractSetFromTs('lib/categoryI18n.ts', 'CATEGORY_SLUGS');
const colorSlugs = extractSetFromTs('lib/colorI18n.ts', 'COLOR_SLUGS');
const categoryAliases = extractAliasesFromTs('lib/categoryI18n.ts', 'ALIASES');
const frFromAlias = buildFrFromAliases(categorySlugs, categoryAliases);

const categoriesEn = {};
const categoriesFr = {};
const missingFr = [];

for (const slug of categorySlugs.sort()) {
  categoriesEn[slug] = slugToEn(slug);
  const fr = FR_OVERRIDES[slug] ?? frFromAlias[slug] ?? null;
  if (fr) {
    categoriesFr[slug] = fr;
  } else {
    missingFr.push(slug);
    categoriesFr[slug] = categoriesEn[slug];
  }
}

const colorsEn = {};
const colorsFr = {};
for (const slug of colorSlugs.sort()) {
  colorsEn[slug] = COLOR_EN[slug] ?? slugToEn(slug);
  colorsFr[slug] = COLOR_FR[slug] ?? colorsEn[slug];
}

const outDir = path.join(root, 'locales', 'catalog');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'en.json'),
  `${JSON.stringify({ categories: categoriesEn, colors: colorsEn }, null, 2)}\n`
);
fs.writeFileSync(
  path.join(outDir, 'fr.json'),
  `${JSON.stringify({ categories: categoriesFr, colors: colorsFr }, null, 2)}\n`
);

console.log(`Wrote ${categorySlugs.length} categories, ${colorSlugs.length} colors`);
if (missingFr.length) {
  console.warn('FR fallback to EN for slugs:', missingFr.join(', '));
}
