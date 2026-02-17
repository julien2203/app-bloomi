import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SellScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 8 }}>
          Vendre un article
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          L&apos;écran de création d&apos;annonce sera implémenté dans un prochain jalon.
        </Text>

        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
            À venir
          </Text>
          <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
            Ici vous pourrez bientôt créer et gérer vos annonces Bloomi.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

