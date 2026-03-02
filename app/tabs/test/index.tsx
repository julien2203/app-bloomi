/**
 * Écran de test pour valider les fonctions API
 * À supprimer ou désactiver en production
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getPublishedListings,
  createListing,
  getMyListings,
  getThreads,
  getMessages,
  sendMessage
} from '../../../lib/api';
import type { ListingInsert } from '../../../lib/types';

export default function TestScreen() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const logResult = (data: any, error?: Error) => {
    if (error) {
      setResult(`❌ Erreur: ${error.message}\n\n${error.stack || ''}`);
    } else {
      setResult(`✅ Succès:\n${JSON.stringify(data, null, 2)}`);
    }
  };

  const testGetPublishedListings = async () => {
    setLoading(true);
    try {
      const data = await getPublishedListings({ page: 1, pageSize: 10 });
      logResult(data);
    } catch (error) {
      logResult(null, error as Error);
    } finally {
      setLoading(false);
    }
  };

  const testCreateListing = async () => {
    setLoading(true);
    try {
      const payload: ListingInsert = {
        seller_id: '', // Sera rempli automatiquement par RLS
        title: 'Test Annonce',
        description: 'Ceci est une annonce de test',
        price: 29.99,
        status: 'draft',
        category: 'test',
        condition: 'new',
        delivery_mode: 'both',
        city: 'Genève',
        country_code: 'CH'
      };
      const data = await createListing(payload);
      logResult(data);
      Alert.alert('Succès', 'Annonce créée avec succès!');
    } catch (error) {
      logResult(null, error as Error);
    } finally {
      setLoading(false);
    }
  };

  const testGetMyListings = async () => {
    setLoading(true);
    try {
      const data = await getMyListings();
      logResult(data);
    } catch (error) {
      logResult(null, error as Error);
    } finally {
      setLoading(false);
    }
  };

  const testGetThreads = async () => {
    setLoading(true);
    try {
      const data = await getThreads();
      logResult(data);
    } catch (error) {
      logResult(null, error as Error);
    } finally {
      setLoading(false);
    }
  };

  const testGetMessages = async () => {
    Alert.prompt(
      'Test Messages',
      'Entrez l\'ID du thread:',
      async (threadId) => {
        if (!threadId) return;
        setLoading(true);
        try {
          const data = await getMessages(threadId);
          logResult(data);
        } catch (error) {
          logResult(null, error as Error);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const testSendMessage = async () => {
    Alert.prompt(
      'Test Send Message',
      'Entrez l\'ID du thread:',
      async (threadId) => {
        if (!threadId) return;
        Alert.prompt(
          'Message',
          'Entrez le message:',
          async (body) => {
            if (!body) return;
            setLoading(true);
            try {
              const data = await sendMessage(threadId, body);
              logResult(data);
              Alert.alert('Succès', 'Message envoyé!');
            } catch (error) {
              logResult(null, error as Error);
            } finally {
              setLoading(false);
            }
          }
        );
      }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧪 Tests API</Text>
        <Text style={styles.subtitle}>Valider les fonctions de la base de données</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Listings</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={testGetPublishedListings}
            disabled={loading}
          >
            <Text style={styles.buttonText}>📋 getPublishedListings()</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={testCreateListing}
            disabled={loading}
          >
            <Text style={styles.buttonText}>➕ createListing()</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={testGetMyListings}
            disabled={loading}
          >
            <Text style={styles.buttonText}>📦 getMyListings()</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Messages</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={testGetThreads}
            disabled={loading}
          >
            <Text style={styles.buttonText}>💬 getThreads()</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={testGetMessages}
            disabled={loading}
          >
            <Text style={styles.buttonText}>📨 getMessages(threadId)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={testSendMessage}
            disabled={loading}
          >
            <Text style={styles.buttonText}>✉️ sendMessage(threadId, body)</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#111827" />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        )}

        {result ? (
          <View style={styles.result}>
            <Text style={styles.resultTitle}>Résultat:</Text>
            <ScrollView style={styles.resultContent}>
              <Text style={styles.resultText}>{result}</Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setResult('')}
            >
              <Text style={styles.clearButtonText}>Effacer</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280'
  },
  scrollView: {
    flex: 1
  },
  content: {
    padding: 16
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12
  },
  button: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center'
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600'
  },
  loading: {
    padding: 24,
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 8,
    color: '#6b7280'
  },
  result: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8
  },
  resultContent: {
    maxHeight: 300,
    marginBottom: 8
  },
  resultText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#374151'
  },
  clearButton: {
    marginTop: 8,
    padding: 8,
    alignItems: 'center'
  },
  clearButtonText: {
    color: '#6b7280',
    fontSize: 14
  }
});
