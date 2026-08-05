import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { UniversalResultsScreen } from '../../../components/results/UniversalResultsScreen';
import { useTranslation } from 'react-i18next';

export default function SearchScreen() {
  const { t } = useTranslation();
  const { query, search_tab } = useLocalSearchParams<{
    query?: string;
    search_tab?: string;
  }>();
  const initialSearchTab =
    search_tab === 'members' || search_tab === 'listings' ? search_tab : undefined;

  return (
    <UniversalResultsScreen
      section="search"
      title={t('navigation.search')}
      initialQuery={typeof query === 'string' ? query : undefined}
      initialSearchTab={initialSearchTab}
      showBack={false}
      standaloneSearch
    />
  );
}
