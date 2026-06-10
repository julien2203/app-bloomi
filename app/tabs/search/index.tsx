import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { UniversalResultsScreen } from '../../../components/results/UniversalResultsScreen';
import { useSearchFiltersStore } from '../../../lib/store/searchFilters';
import { useTranslation } from 'react-i18next';

export default function SearchScreen() {
  const { t } = useTranslation();
  const { query } = useLocalSearchParams<{ query?: string }>();
  const [focusReloadNonce, setFocusReloadNonce] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void useSearchFiltersStore.getState().filters;
      setFocusReloadNonce((n) => n + 1);
    }, [])
  );

  return (
    <UniversalResultsScreen
      section="search"
      title={t('navigation.search')}
      initialQuery={typeof query === 'string' ? query : undefined}
      showBack={false}
      reloadOnFocus
      standaloneSearch
      searchFocusReloadNonce={focusReloadNonce}
    />
  );
}
