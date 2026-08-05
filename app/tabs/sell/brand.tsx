import React from 'react';
import { useRouter } from 'expo-router';
import { BrandPicker } from '../../../components/listing/BrandPicker';
import { useSellFormStore, type SellBrand } from '../../../lib/store/sellForm';

export default function SellBrandScreen() {
  const router = useRouter();
  const { values, setField } = useSellFormStore();
  const gender = values.categoryGender ?? values.category?.gender;
  const type = values.categoryType;

  const handleConfirm = (brand: SellBrand) => {
    setField('brand', brand);
    const canGoBack =
      typeof (router as { canGoBack?: () => boolean }).canGoBack === 'function'
        ? (router as { canGoBack: () => boolean }).canGoBack()
        : true;
    if (canGoBack) {
      router.back();
    } else {
      router.replace('/tabs/sell');
    }
  };

  return (
    <BrandPicker
      initialBrand={values.brand ?? null}
      gender={gender}
      type={type}
      categoryId={values.category?.id}
      onConfirm={handleConfirm}
      onBack={() => router.back()}
    />
  );
}
