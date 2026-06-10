import React from 'react';
import { useNavigation } from 'expo-router';
import { HeaderBackButton } from '../ui/HeaderBackButton';

/** Bouton retour pour les headers natifs Stack (flèche seule, même rendu que les écrans profil custom). */
export function StackHeaderBackButton() {
  const navigation = useNavigation();

  if (!navigation.canGoBack()) {
    return null;
  }

  return <HeaderBackButton onPress={() => navigation.goBack()} />;
}
