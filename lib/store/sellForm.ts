import { create } from 'zustand';

export type SellCategory = {
  id: number;
  name: string;
  gender: string;
};

export type SellBrand = {
  id: number;
  name: string;
};

export type SellSize = {
  id: number;
  label: string;
};

export type SellColor = {
  id: number;
  name: string;
};

export type SellCategoryType = 'chaussures' | 'pantalons' | 'chemises' | 'vetements';

export type ParcelSizeValue = 'small' | 'large' | 'xlarge';

export type SellFormFieldKey =
  | 'category'
  | 'brand'
  | 'condition'
  | 'size'
  | 'price'
  | 'color'
  | 'categoryGender'
  | 'categoryType'
  | 'delivery_mode'
  | 'parcel_size'
  | 'draftTitle'
  | 'draftDescription'
  | 'draftCity'
  | 'draftPriceText'
  | 'draftPhotos';

export type SellFormState = {
  category: SellCategory | null;
  /** Contexte de la catégorie sélectionnée (utile pour les sous-pages) */
  categoryGender?: string;
  categoryType?: SellCategoryType;
  brand: SellBrand | null;
  condition?: string;
  size: SellSize | null;
  color: SellColor[];
  price?: number;
  delivery_mode?: 'pickup' | 'shipping' | 'both';
  parcel_size?: ParcelSizeValue;
  /** Champs locaux de l'écran Sell, persistés pour éviter les pertes au retour */
  draftTitle?: string;
  draftDescription?: string;
  draftCity?: string;
  draftPriceText?: string;
  draftPhotos?: Array<{ uri: string; type?: string; name?: string }>;
};

type SellFieldValue =
  | SellCategory
  | SellBrand
  | SellSize
  | SellColor
  | string
  | number
  | null
  | undefined;

interface SellFormStore {
  values: SellFormState;
  setField: (key: SellFormFieldKey, value: SellFieldValue) => void;
  resetForm: () => void;
}

const defaultValues: SellFormState = {
  category: null,
  categoryGender: undefined,
  categoryType: undefined,
  brand: null,
  size: null,
  color: [],
  condition: undefined,
  price: undefined,
  delivery_mode: 'both',
  parcel_size: undefined,
  draftTitle: '',
  draftDescription: '',
  draftCity: '',
  draftPriceText: '',
  draftPhotos: []
};

function cloneDefaultValues(): SellFormState {
  return {
    ...defaultValues,
    color: [],
    draftPhotos: []
  };
}

export const useSellFormStore = create<SellFormStore>((set) => ({
  values: cloneDefaultValues(),
  setField: (key, value) =>
    set((state) => ({
      values: {
        ...state.values,
        [key]: value as SellFieldValue
      } as SellFormState
    })),
  resetForm: () => set({ values: cloneDefaultValues() })
}));

