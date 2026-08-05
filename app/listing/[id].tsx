import { Redirect, useLocalSearchParams } from 'expo-router';

/** Fallback route pour les liens `https://bloomi.ch/listing/{id}`. */
export default function ListingUniversalLinkScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const listingId = typeof id === 'string' ? id.trim() : '';

  if (!listingId) {
    return <Redirect href="/tabs/feed" />;
  }

  return <Redirect href={{ pathname: '/tabs/feed/[id]', params: { id: listingId } }} />;
}
