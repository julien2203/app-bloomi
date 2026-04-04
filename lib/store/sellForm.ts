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

export type SellFormFieldKey =
  | 'category'
  | 'brand'
  | 'condition'
  | 'size'
  | 'price'
  | 'color'
  | 'categoryGender'
  | 'categoryType';

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
  price: undefined
};

export const useSellFormStore = create<SellFormStore>((set) => ({
  values: defaultValues,
  setField: (key, value) =>
    set((state) => ({
      values: {
        ...state.values,
        [key]: value as SellFieldValue
      } as SellFormState
    })),
  resetForm: () => set({ values: defaultValues })
}));

