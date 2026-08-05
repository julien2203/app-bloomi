import React from 'react';
import { useRouter } from 'expo-router';
import { BrandPicker } from '../../../../components/listing/BrandPicker';
import { useEditListingFormStore } from '../../../../lib/store/editListingForm';
import type { SellBrand } from '../../../../lib/store/sellForm';

export default function EditListingBrandScreen() {
  const router = useRouter();
  const { values, setField } = useEditListingFormStore();
  const gender = values.categoryGender ?? values.category?.gender;
  const type = values.categoryType;

  const handleConfirm = (brand: SellBrand) => {
    setField('brand', brand);
    router.back();
  };

  return (
    <BrandPicker
      initialBrand={values.brand ?? null}
      gender={gender}
      type={type}
      categoryId={values.category?.id}
      resolveCategoryContext
      onConfirm={handleConfirm}
      onBack={() => router.back()}
    />
  );
}
