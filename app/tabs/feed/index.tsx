import React from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MOCK_IS_LOADING = false;
const MOCK_ITEMS: string[] = [];

export default function FeedScreen() {
  const isLoading = MOCK_IS_LOADING;
  const items = MOCK_ITEMS;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 8 }}>
          Fil d&apos;annonces
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          La logique métier d&apos;annonces sera implémentée dans un jalon ultérieur.
        </Text>

        {isLoading ? (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: '#6b7280' }}>
              Chargement du feed...
            </Text>
          </View>
        ) : items.length === 0 ? (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
              Aucune annonce pour le moment
            </Text>
            <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
              Le contenu du feed sera alimenté lorsque la logique d&apos;annonces
              sera prête.
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <View
                style={{
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                  marginBottom: 12
                }}
              >
                <Text>{item}</Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

