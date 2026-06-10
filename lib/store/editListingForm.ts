import { create } from 'zustand';
import type {
  ParcelSizeValue,
  SellBrand,
  SellCategory,
  SellCategoryType,
  SellSize
} from './sellForm';

export type EditListingPhoto = {
  uri: string;
  type?: string;
  name?: string;
  isNew?: boolean;
};

export type EditListingFormState = {
  listingId: string | null;
  category: SellCategory | null;
  categoryGender?: string;
  categoryType?: SellCategoryType;
  brand: SellBrand | null;
  condition?: string;
  size: SellSize | null;
  price?: number;
  delivery_mode?: 'pickup' | 'shipping' | 'both';
  parcel_size?: ParcelSizeValue;
  draftTitle: string;
  draftDescription: string;
  draftCity: string;
  draftPriceText: string;
  draftPhotos: EditListingPhoto[];
};

export type EditListingFieldKey = keyof EditListingFormState;

type EditFieldValue = EditListingFormState[EditListingFieldKey];

interface EditListingFormStore {
  values: EditListingFormState;
  setField: <K extends EditListingFieldKey>(key: K, value: EditListingFormState[K]) => void;
  resetForm: () => void;
}

const defaultValues: EditListingFormState = {
  listingId: null,
  category: null,
  categoryGender: undefined,
  categoryType: undefined,
  brand: null,
  size: null,
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

function cloneDefaultValues(): EditListingFormState {
  return {
    ...defaultValues,
    draftPhotos: []
  };
}

export const useEditListingFormStore = create<EditListingFormStore>((set) => ({
  values: cloneDefaultValues(),
  setField: (key, value) =>
    set((state) => ({
      values: {
        ...state.values,
        [key]: value
      }
    })),
  resetForm: () => set({ values: cloneDefaultValues() })
}));
