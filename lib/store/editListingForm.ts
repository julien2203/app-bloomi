import { create } from 'zustand';
import type {
  ParcelSizeValue,
  SellBrand,
  SellCategory,
  SellCategoryType,
  SellColor,
  SellSize
} from './sellForm';

export type EditListingPhoto = {
  uri: string;
  type?: string;
  name?: string;
  isNew?: boolean;
  id?: string;
  orderIndex?: number;
};

export type EditListingFormState = {
  listingId: string | null;
  category: SellCategory | null;
  categoryGender?: string;
  categoryType?: SellCategoryType;
  brand: SellBrand | null;
  condition?: string;
  size: SellSize | null;
  color: SellColor[];
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

export type HydrateEditListingInput = {
  listingId: string;
  title: string;
  description?: string | null;
  price: number | string;
  city?: string | null;
  photos: EditListingPhoto[];
  category: SellCategory | null;
  categoryGender?: string;
  categoryType?: SellCategoryType;
  brand: SellBrand | null;
  condition?: string;
  size: SellSize | null;
  color: SellColor[];
  delivery_mode: 'pickup' | 'shipping' | 'both';
  parcel_size?: ParcelSizeValue;
};

interface EditListingFormStore {
  values: EditListingFormState;
  setField: <K extends EditListingFieldKey>(key: K, value: EditListingFormState[K]) => void;
  resetForm: () => void;
  hydrateFromListing: (input: HydrateEditListingInput) => void;
}

const defaultValues: EditListingFormState = {
  listingId: null,
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

function cloneDefaultValues(): EditListingFormState {
  return {
    ...defaultValues,
    color: [],
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
  resetForm: () => set({ values: cloneDefaultValues() }),
  hydrateFromListing: (input) => {
    const normalizedPrice = coerceHydratePrice(input.price);
    set({
      values: {
        listingId: input.listingId,
        draftTitle: input.title,
        draftDescription: input.description ?? '',
        draftPriceText:
          normalizedPrice > 0 ? String(normalizedPrice) : String(input.price ?? ''),
        draftCity: input.city ?? '',
        draftPhotos: input.photos,
        category: input.category,
        categoryGender: input.categoryGender,
        categoryType: input.categoryType,
        brand: input.brand,
        condition: input.condition,
        size: input.size,
        color: input.color,
        price: normalizedPrice > 0 ? normalizedPrice : undefined,
        delivery_mode: input.delivery_mode,
        parcel_size: input.parcel_size
      }
    });
  }
}));

function coerceHydratePrice(raw: number | string): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  const parsed = Number(String(raw ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
