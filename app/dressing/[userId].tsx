import { useEffect } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { queueSharedDressing } from '../../lib/navigation/pendingShareDeepLinkNav';

/**
 * Point d'entrée deep link `bloomi://dressing/{userId}` / `https://bloomi.ch/dressing/{userId}`.
 * Redirect synchrone (comme `/listing/[id]`) — plus fiable que InteractionManager au cold start.
 * File d'attente en backup si le Redirect ne bascule pas (AuthGate flush ~700ms).
 */
export default function DressingDeepLinkScreen() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const id = typeof userId === 'string' ? userId.trim() : '';

  useEffect(() => {
    if (id) queueSharedDressing(id);
  }, [id]);

  if (!id) {
    return <Redirect href="/tabs/feed" />;
  }

  return (
    <Redirect
      href={{
        pathname: '/tabs/public-profile',
        params: { user_id: id }
      }}
    />
  );
}
