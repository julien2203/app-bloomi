import type { ImageSourcePropType } from 'react-native';

/** Aligné sur `ResultsSection` (écrans Results / View all). */
export type SearchCollectionResultsSection =
  | 'sponsored'
  | 'trending'
  | 'influencer'
  | 'all'
  | 'search';

export type SearchCollectionId =
  | 'new_in'
  | 'trending'
  | 'influencers'
  | 'brands'
  | 'deals'
  | 'bloomi_picks';

export type SearchCollectionAction =
  | { type: 'results'; section: SearchCollectionResultsSection }
  | { type: 'brand_filter' }
  | { type: 'deals'; priceMax: number };

export type SearchCollection = {
  id: SearchCollectionId;
  titleKey: string;
  subtitleKey: string;
  image: ImageSourcePropType;
  action: SearchCollectionAction;
};

/** Cartes éditoriales sous les suggestions (Search active). */
export const SEARCH_COLLECTIONS: SearchCollection[] = [
  {
    id: 'new_in',
    titleKey: 'filters.searchCollections.newIn.title',
    subtitleKey: 'filters.searchCollections.newIn.subtitle',
    image: require('../../assets/img-search/menu-recherche-bloomi-1.jpg'),
    action: { type: 'results', section: 'all' }
  },
  {
    id: 'trending',
    titleKey: 'filters.searchCollections.trending.title',
    subtitleKey: 'filters.searchCollections.trending.subtitle',
    image: require('../../assets/img-search/menu-recherche-bloomi-2.jpg'),
    action: { type: 'results', section: 'trending' }
  },
  {
    id: 'influencers',
    titleKey: 'filters.searchCollections.influencers.title',
    subtitleKey: 'filters.searchCollections.influencers.subtitle',
    image: require('../../assets/img-search/menu-recherche-bloomi-3.jpg'),
    action: { type: 'results', section: 'influencer' }
  },
  {
    id: 'brands',
    titleKey: 'filters.searchCollections.brands.title',
    subtitleKey: 'filters.searchCollections.brands.subtitle',
    image: require('../../assets/img-search/menu-recherche-bloomi-4.jpg'),
    action: { type: 'brand_filter' }
  },
  {
    id: 'deals',
    titleKey: 'filters.searchCollections.deals.title',
    subtitleKey: 'filters.searchCollections.deals.subtitle',
    image: require('../../assets/img-search/menu-recherche-bloomi-5.jpg'),
    action: { type: 'deals', priceMax: 50 }
  },
  {
    id: 'bloomi_picks',
    titleKey: 'filters.searchCollections.bloomiPicks.title',
    subtitleKey: 'filters.searchCollections.bloomiPicks.subtitle',
    image: require('../../assets/img-search/menu-recherche-bloomi-6.jpg'),
    action: { type: 'results', section: 'sponsored' }
  }
];
