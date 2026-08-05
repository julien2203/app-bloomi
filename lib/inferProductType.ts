/** Aligné sur `brands.type` / `categories` slugs racine. */
export type BrandProductType =
  | 'vetements'
  | 'chaussures'
  | 'pantalons'
  | 'chemises'
  | 'sacs'
  | 'accessoires'
  | 'jouets'
  | 'puericulture'
  | 'mobilier'
  | 'scolaire';

/**
 * Déduit le type produit depuis slug(s) catégorie (feuille → racine).
 * Ordre : du plus spécifique (puériculture, jouets…) au générique (vêtements).
 */
export function inferProductTypeFromCategorySlugs(
  slugs: string[]
): BrandProductType | null {
  const blob = slugs
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())
    .join(' ');
  if (!blob.trim()) return null;

  const rules: [RegExp, BrandProductType][] = [
    [/puericulture|baby.?care|poussette|siege.?auto|porte.?bebe|transat|chaise.?haute/i, 'puericulture'],
    [/jouet|toy|leisure|peluche|eveil/i, 'jouets'],
    [/mobilier|furniture|enfant-mobilier|lit|bureau|rangement/i, 'mobilier'],
    [/scolaire|school|fourniture|cartable/i, 'scolaire'],
    [/chaussure|shoe|sneaker|basket|heel|trainer|boot|sandale|bottine|escarpin|mocassin|ballerine/i, 'chaussures'],
    [/pant|jean|trouser|cargo|short(?!age)/i, 'pantalons'],
    [/chemise|shirt|chemisier|blouse|polo/i, 'chemises'],
    [/sac|bag|handbag|backpack|cabas|bandouliere|pochette/i, 'sacs'],
    [/accessoire|accessory|belt|ceinture|jewel|bijou|hat|bonnet|scarf|foulard|montre|watch|lunette|portefeuille/i, 'accessoires'],
    [/sport|running|fitness|yoga/i, 'vetements'],
    [/robe|dress|jupe|skirt|top|pull|knit|coat|manteau|jacket|gilet|swim|maillot|vetement|clothing|vetements|apparel|lingerie|body|pyjama|combinaison/i, 'vetements']
  ];

  for (const [re, t] of rules) {
    if (re.test(blob)) return t;
  }
  return null;
}

/** Type pour marques / tailles à partir du slug de la catégorie parente (écran détail catégorie). */
export function inferTypeFromParentSlug(parentSlug?: string | null): BrandProductType {
  return inferProductTypeFromCategorySlugs(parentSlug ? [parentSlug] : []) ?? 'vetements';
}

export type BrandSegment = {
  labelKey: string;
  gender: string;
  type: BrandProductType;
};

/** Segments marque par genre — filtres + vente. */
export function getBrandSegmentsForGender(gender: string): BrandSegment[] {
  switch (gender) {
    case 'femme':
      return [
        { labelKey: 'filters.segment.womenClothing', gender: 'femme', type: 'vetements' },
        { labelKey: 'filters.segment.womenShoes', gender: 'femme', type: 'chaussures' },
        { labelKey: 'filters.segment.womenBags', gender: 'femme', type: 'sacs' },
        { labelKey: 'filters.segment.womenAccessories', gender: 'femme', type: 'accessoires' }
      ];
    case 'homme':
      return [
        { labelKey: 'filters.segment.menClothing', gender: 'homme', type: 'vetements' },
        { labelKey: 'filters.segment.menShoes', gender: 'homme', type: 'chaussures' },
        { labelKey: 'filters.segment.menBags', gender: 'homme', type: 'sacs' },
        { labelKey: 'filters.segment.menAccessories', gender: 'homme', type: 'accessoires' }
      ];
    case 'enfant':
      return [
        { labelKey: 'filters.segment.kidsClothing', gender: 'enfant', type: 'vetements' },
        { labelKey: 'filters.segment.kidsShoes', gender: 'enfant', type: 'chaussures' },
        { labelKey: 'filters.segment.kidsBags', gender: 'enfant', type: 'sacs' },
        { labelKey: 'filters.segment.kidsAccessories', gender: 'enfant', type: 'accessoires' },
        { labelKey: 'filters.segment.kidsToys', gender: 'enfant', type: 'jouets' },
        { labelKey: 'filters.segment.kidsFurniture', gender: 'enfant', type: 'mobilier' },
        { labelKey: 'filters.segment.kidsSchool', gender: 'enfant', type: 'scolaire' }
      ];
    case 'bebe':
      return [
        { labelKey: 'filters.segment.babyClothing', gender: 'bebe', type: 'vetements' },
        { labelKey: 'filters.segment.babyShoes', gender: 'bebe', type: 'chaussures' },
        { labelKey: 'filters.segment.babyAccessories', gender: 'bebe', type: 'accessoires' },
        { labelKey: 'filters.segment.babyCare', gender: 'bebe', type: 'puericulture' },
        { labelKey: 'filters.segment.babyToys', gender: 'bebe', type: 'jouets' }
      ];
    default:
      return [];
  }
}
