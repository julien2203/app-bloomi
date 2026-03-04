import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TextField } from '../../../../components/ui/TextField';
import { Button } from '../../../../components/ui/Button';
import { theme } from '../../../../lib/theme';
import { getListingById, updateListing, type ListingDetail } from '../../../../lib/api';

export default function EditListingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setError(new Error('ID manquant'));
      setLoading(false);
      return;
    }

    const fetchListing = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error: apiError } = await getListingById(id);

        if (apiError) {
          setError(apiError);
          setListing(null);
          return;
        }

        if (!data) {
          setError(new Error('Annonce introuvable'));
          setListing(null);
          return;
        }

        setListing(data);
        setTitle(data.title);
        setDescription(data.description ?? '');
        setPrice(String(data.price));
        setCity(data.city ?? '');
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erreur inconnue'));
        setListing(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchListing();
  }, [id]);

  const handleSave = async () => {
    if (!id) {
      return;
    }

    const priceNumber = Number(price.replace(/[^0-9.]/g, ''));
    if (Number.isNaN(priceNumber) || priceNumber <= 0) {
      Alert.alert('Erreur', 'Veuillez saisir un prix valide.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data, error: apiError } = await updateListing(id, {
        title: title.trim(),
        description: description.trim() || null,
        price: priceNumber,
        city: city.trim() || null
      });

      if (apiError) {
        setError(apiError);
        Alert.alert('Erreur', apiError.message);
        return;
      }

      if (!data) {
        Alert.alert('Erreur', 'Impossible de mettre à jour l’annonce.');
        return;
      }

      Alert.alert('Succès', 'Annonce mise à jour avec succès.', [
        {
          text: 'OK',
          onPress: () => router.back()
        }
      ]);
    } catch (err) {
      const finalError = err instanceof Error ? err : new Error('Erreur inconnue');
      setError(finalError);
      Alert.alert('Erreur', finalError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Chargement de l&apos;annonce...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (error || !listing) {
    return (
      <>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <Text style={styles.errorTitle}>
              {error?.message || 'Annonce introuvable'}
            </Text>
            <Button
              title="Retour"
              onPress={() => router.back()}
              variant="primary-green"
              style={styles.backButton}
            />
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Modifier l&apos;annonce</Text>
            </View>

            <View style={styles.form}>
              <TextField
                label="Titre"
                value={title}
                onChangeText={setTitle}
                placeholder="Titre de l'annonce"
                maxLength={100}
              />

              <TextField
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Décrivez votre article..."
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                style={styles.descriptionInput}
              />

              <TextField
                label="Prix (CHF)"
                value={price}
                onChangeText={(text) => setPrice(text.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                keyboardType="numeric"
              />

              <TextField
                label="Ville"
                value={city}
                onChangeText={setCity}
                placeholder="Ex: Genève"
                maxLength={50}
              />

              {error && (
                <Text style={styles.inlineError}>
                  {error.message}
                </Text>
              )}

              <Button
                title={saving ? 'Enregistrement...' : 'Save changes'}
                onPress={handleSave}
                variant="primary-green"
                loading={saving}
                disabled={saving}
                style={styles.saveButton}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 16,
    paddingBottom: 32
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.horizontalPadding
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: 16
  },
  errorTitle: {
    ...theme.typography.h2,
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center'
  },
  backButton: {
    marginTop: 16,
    alignSelf: 'center',
    minWidth: 160
  },
  header: {
    marginBottom: 16
  },
  headerTitle: {
    ...theme.typography.h1,
    color: theme.colors.textPrimary
  },
  form: {
    marginTop: 8
  },
  descriptionInput: {
    minHeight: 120,
    paddingTop: 14
  },
  inlineError: {
    ...theme.typography.caption,
    color: '#EF4444',
    marginTop: 4,
    marginBottom: 8
  },
  saveButton: {
    marginTop: 8
  }
});

