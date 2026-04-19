import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { UniversalResultsScreen } from '../../../components/results/UniversalResultsScreen';
import { useSearchFiltersStore } from '../../../lib/store/searchFilters';

export default function SearchScreen() {
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
      title="Search"
      showBack={false}
      reloadOnFocus
      standaloneSearch
      searchFocusReloadNonce={focusReloadNonce}
    />
  );
}
