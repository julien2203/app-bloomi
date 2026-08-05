import React, { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  UniversalResultsScreen,
  type ResultsSection
} from '../../../components/results/UniversalResultsScreen';

export default function ResultsTabScreen() {
  const params = useLocalSearchParams<{ title?: string; section?: string; query?: string }>();

  const section = useMemo(() => {
    const raw = typeof params.section === 'string' ? params.section : undefined;
    const allowed: ResultsSection[] = ['sponsored', 'trending', 'influencer', 'all', 'search'];
    return allowed.includes(raw as any) ? (raw as ResultsSection) : ('all' as ResultsSection);
  }, [params.section]);

  const title = typeof params.title === 'string' ? params.title : undefined;
  const query = typeof params.query === 'string' ? params.query : undefined;

  return (
    <UniversalResultsScreen
      key={section}
      title={title}
      section={section}
      initialQuery={query}
      showBack
    />
  );
}

