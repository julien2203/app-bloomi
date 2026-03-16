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

export type SellFormFieldKey = 'category' | 'brand' | 'condition' | 'size' | 'price' | 'color';

export type SellFormState = {
  category: SellCategory | null;
  brand: SellBrand | null;
  condition?: string;
  size: SellSize | null;
  color: SellColor | null;
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
  brand: null,
  size: null,
  color: null,
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

