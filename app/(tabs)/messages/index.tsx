import React from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MOCK_IS_LOADING = false;
const MOCK_CONVERSATIONS: string[] = [];

export default function MessagesScreen() {
  const isLoading = MOCK_IS_LOADING;
  const conversations = MOCK_CONVERSATIONS;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 8 }}>
          Messages
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          La messagerie sera branchée dans un jalon ultérieur.
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
              Chargement de vos conversations...
            </Text>
          </View>
        ) : conversations.length === 0 ? (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
              Aucun message pour le moment
            </Text>
            <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
              Vos conversations apparaîtront ici lorsque la messagerie sera active.
            </Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <View
                style={{
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: '#e5e7eb'
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

