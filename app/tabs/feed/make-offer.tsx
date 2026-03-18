import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../../../lib/theme';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { AppIcon } from '../../../components/ui/AppIcon';
import { getListingById, createOrGetThreadForListing, sendOfferMessage } from '../../../lib/api';
import type { ListingDetail } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';

const BUYER_PROTECTION_RATE = 0.08;

export default function MakeOfferScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const listingId = typeof params.id === 'string' ? params.id : '';
  const { user } = useAuthStore();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<'10' | '20' | 'other' | null>(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!listingId) {
        setError('Annonce introuvable');
        setLoading(false);
        return;
      }
      try {
        setError(null);
        const { data, error: fetchError } = await getListingById(listingId);
        if (fetchError || !data) {
          setError(fetchError?.message || 'Annonce introuvable');
          setListing(null);
        } else {
          setListing(data);
        }
      } catch {
        setError("Impossible de charger l'annonce.");
        setListing(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [listingId]);

  const originalPrice = listing?.price ?? 0;

  const quickOffers = useMemo(() => {
    if (!listing) {
      return {
        minus10: { price: 0, total: 0 },
        minus20: { price: 0, total: 0 }
      };
    }
    const price10 = +(listing.price * 0.9).toFixed(2);
    const price20 = +(listing.price * 0.8).toFixed(2);
    const total10 = +(price10 * (1 + BUYER_PROTECTION_RATE)).toFixed(0);
    const total20 = +(price20 * (1 + BUYER_PROTECTION_RATE)).toFixed(0);
    return {
      minus10: { price: price10, total: total10 },
      minus20: { price: price20, total: total20 }
    };
  }, [listing]);

  const handleSelectCard = (type: '10' | '20' | 'other') => {
    setSelectedCard(type);
    if (!listing) return;

    if (type === '10') {
      setAmount(quickOffers.minus10.price.toFixed(2));
    } else if (type === '20') {
      setAmount(quickOffers.minus20.price.toFixed(2));
    } else {
      setAmount('');
      // focus sur le champ manuel
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const parsedAmount = useMemo(() => {
    const v = parseFloat(amount.replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? v : null;
  }, [amount]);

  const isValidAmount = parsedAmount !== null;

  const handleBack = () => {
    router.back();
  };

  const handleSubmit = async () => {
    if (!listing || !user || !isValidAmount) return;
    setSubmitting(true);
    try {
      const { data: thread, error: threadError } = await createOrGetThreadForListing(
        listing.id,
        listing.seller_id
      );
      if (threadError || !thread) {
        // eslint-disable-next-line no-console
        console.warn('Erreur thread pour offre:', threadError);
        setError("Impossible d'envoyer l'offre pour le moment.");
        return;
      }

      const { error: msgError } = await sendOfferMessage({
        threadId: thread.id,
        listingId: listing.id,
        amount: parsedAmount!,
        currency: 'CHF'
      });
      if (msgError) {
        // eslint-disable-next-line no-console
        console.warn('Erreur message offre:', msgError);
        setError("Impossible d'envoyer l'offre pour le moment.");
        return;
      }

      router.replace({
        pathname: '/tabs/messages/[id]',
        params: { id: thread.id }
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.container}>
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text variant="captionSm" color="textSecondary" style={styles.loadingText}>
              Chargement de l&apos;offre...
            </Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (!listing) {
    return (
      <>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.container}>
          <View style={styles.center}>
            <Text variant="body" style={styles.errorText}>
              {error || 'Annonce introuvable.'}
            </Text>
            <Button title="Retour" onPress={handleBack} variant="secondary" />
          </View>
        </SafeAreaView>
      </>
    );
  }

  const sellerName = listing.seller_display_name ?? 'Seller';
  const firstPhoto = listing.photos?.[0]?.url ?? null;

  return (
    <>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBack}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <AppIcon name="arrowLeftOutline" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text variant="body" style={styles.headerTitle} numberOfLines={1}>
              {sellerName}
            </Text>
            <TouchableOpacity
              onPress={() => {
                // TODO: afficher un modal d'info si besoin
              }}
              activeOpacity={0.7}
            >
              <Feather name="info" size={18} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Contenu scrollable + bouton sticky */}
          <View style={styles.flex}>
            <ScrollView
              style={styles.content}
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Article card */}
              <View style={styles.listingRow}>
                {firstPhoto ? (
                  <Image source={{ uri: firstPhoto }} style={styles.listingImage} />
                ) : (
                  <View style={[styles.listingImage, styles.listingImagePlaceholder]}>
                    <Feather name="image" size={24} color={theme.colors.textSecondary} />
                  </View>
                )}
                <View style={styles.listingInfo}>
                  <Text
                    variant="body"
                    style={styles.listingTitle}
                    numberOfLines={2}
                  >
                    {listing.title}
                  </Text>
                  <Text variant="body" style={styles.listingPrice}>
                    {originalPrice.toFixed(2)} CHF
                  </Text>
                </View>
              </View>

              {/* Quick offers */}
              <View style={styles.quickOffersRow}>
                {/* -10% */}
                <TouchableOpacity
                  style={[
                    styles.quickCard,
                    selectedCard === '10' && styles.quickCardSelected
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleSelectCard('10')}
                >
                  <Text variant="body" style={styles.quickPrice}>
                    {quickOffers.minus10.price.toFixed(2)}CHF
                  </Text>
                  <Text variant="captionSm" style={styles.quickTotal}>
                    {quickOffers.minus10.total}CHF Total
                  </Text>
                  <Text variant="captionSm" style={styles.quickDiscount}>
                    10% DE RÉDUCTION
                  </Text>
                </TouchableOpacity>

                {/* -20% */}
                <TouchableOpacity
                  style={[
                    styles.quickCard,
                    selectedCard === '20' && styles.quickCardSelected
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleSelectCard('20')}
                >
                  <Text variant="body" style={styles.quickPrice}>
                    {quickOffers.minus20.price.toFixed(2)}CHF
                  </Text>
                  <Text variant="captionSm" style={styles.quickTotal}>
                    {quickOffers.minus20.total}CHF Total
                  </Text>
                  <Text variant="captionSm" style={styles.quickDiscount}>
                    20% DE RÉDUCTION
                  </Text>
                </TouchableOpacity>

                {/* OTHER */}
                <TouchableOpacity
                  style={[
                    styles.quickCard,
                    selectedCard === 'other' && styles.quickCardSelected
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleSelectCard('other')}
                >
                  <Text variant="body" style={styles.quickPrice}>
                    OTHER
                  </Text>
                  <Text variant="captionSm" style={styles.quickTotal}>
                    Other
                  </Text>
                  <Text variant="captionSm" style={styles.quickDiscount}>
                    PROPOSE UN PRIX
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Manual input */}
              <View style={styles.toBlock}>
                <Text variant="body" style={styles.toLabel}>
                  To
                </Text>
                <View
                  style={[
                    styles.toInputWrapper,
                    // simple focus style basé sur amount non vide
                    amount.length > 0 ? styles.toInputFocused : styles.toInputBlurred
                  ]}
                >
                  <TextInput
                    ref={inputRef}
                    style={styles.toInput}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={amount}
                    onChangeText={setAmount}
                    autoFocus
                  />
                  <Text variant="body" style={styles.toCurrency}>
                    CHF
                  </Text>
                </View>
              </View>

              {error && (
                <View style={styles.errorToast}>
                  <Text variant="captionSm" color="danger">
                    {error}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Bottom button */}
            <View
              style={[
                styles.footer,
                { paddingBottom: insets.bottom || 0 }
              ]}
            >
              <Button
                title="Proposer"
                onPress={handleSubmit}
                variant="primary"
                disabled={!isValidAmount || submitting}
                loading={submitting}
                style={styles.submitButton}
                textStyle={styles.submitText}
              />
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  flex: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5'
  },
  headerTitle: {
    ...theme.typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  content: {
    flex: 1
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32
  },
  loadingText: {
    marginTop: 8
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 8
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5'
  },
  listingImage: {
    width: 64,
    height: 64,
    borderRadius: 8
  },
  listingImagePlaceholder: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  listingInfo: {
    flex: 1,
    marginLeft: 12
  },
  listingTitle: {
    fontSize: 16,
    marginBottom: 4
  },
  listingPrice: {
    ...theme.typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  quickOffersRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginVertical: 16,
    columnGap: 8
  },
  quickCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#FFFFFF'
  },
  quickCardSelected: {
    borderColor: '#CCFF00',
    backgroundColor: '#F7FFE0'
  },
  quickPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  quickTotal: {
    fontSize: 12,
    color: '#84CC16',
    marginTop: 2
  },
  quickDiscount: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2
  },
  toBlock: {
    paddingHorizontal: 20,
    marginTop: 8
  },
  toLabel: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginBottom: 4
  },
  toInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8
  },
  toInput: {
    flex: 1,
    ...theme.typography.body,
    fontSize: 16,
    color: theme.colors.textPrimary
  },
  toCurrency: {
    ...theme.typography.body,
    fontSize: 16,
    color: theme.colors.textPrimary
  },
  toInputFocused: {
    borderBottomWidth: 2,
    borderBottomColor: '#CCFF00'
  },
  toInputBlurred: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  errorToast: {
    marginTop: 8,
    paddingHorizontal: 20
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
    backgroundColor: theme.colors.backgroundWhite
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#CCFF00'
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.appleBlack
  }
});

