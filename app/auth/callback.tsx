import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    access_token?: string;
    refresh_token?: string;
    type?: string;
    token?: string;
    email?: string;
    rawUrl?: string;
  }>();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // 0) Essayer de récupérer les tokens dans le fragment (#) de l'URL profonde
        const rawUrlParam = typeof params.rawUrl === 'string' ? params.rawUrl : null;
        const initialUrl = rawUrlParam || (await Linking.getInitialURL());

        if (initialUrl && initialUrl.includes('#')) {
          const [, hashPart] = initialUrl.split('#');
          const search = new URLSearchParams(hashPart);
          const fragmentAccessToken = search.get('access_token');
          const fragmentRefreshToken = search.get('refresh_token');

          if (fragmentAccessToken && fragmentRefreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: fragmentAccessToken,
              refresh_token: fragmentRefreshToken
            });

            if (!error && data.session) {
              router.replace('/auth/verify-phone');
              return;
            }
          }
        }

        const typeParam = typeof params.type === 'string' ? params.type : null;
        const accessToken = typeof params.access_token === 'string' ? params.access_token : null;
        const refreshToken =
          typeof params.refresh_token === 'string' ? params.refresh_token : null;

        // 1) Cas : Supabase renvoie directement access/refresh token dans l'URL
        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (!error && data.session) {
            router.replace('/auth/verify-phone');
            return;
          }
        }

        // 2) Cas classique : lien d'email avec token + type=signup, on vérifie nous-mêmes
        const email = typeof params.email === 'string' ? params.email : null;
        const emailToken = typeof params.token === 'string' ? params.token : null;
        if (typeParam === 'signup' && email && emailToken) {
          const { data, error } = await supabase.auth.verifyOtp({
            email,
            token: emailToken,
            type: 'signup'
          });

          if (!error && data.session) {
            router.replace('/auth/verify-phone');
            return;
          }
        }

        // 3) Fallback : essayer de récupérer une éventuelle session existante
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace('/auth/verify-phone');
          return;
        }

        // Fallback final : dans tous les cas, on envoie l'utilisateur
        // vers la vérification du téléphone, pas vers login.
        router.replace('/auth/verify-phone');
      } catch {
        // En cas d'erreur inattendue, même stratégie :
        // on emmène l'utilisateur sur verify-phone pour continuer le flow.
        router.replace('/auth/verify-phone');
      }
    };

    void handleCallback();
  }, [
    router,
    params.access_token,
    params.refresh_token,
    params.email,
    params.token,
    params.type,
    params.rawUrl
  ]);

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={theme.colors.textPrimary} />
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});

