import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { getSafeBottomInset } from '../../../lib/safeArea';
import { theme } from '../../../lib/theme';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import {
  cloneListingDetail,
  getListingById,
  createOrGetThreadForListing,
  sendOfferMessage
} from '../../../lib/api';
import type { ListingDetail } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';
import { openGuestAuthPrompt } from '../../../lib/guestAuthPrompt';
import { computeBuyerFinalPriceChf, formatCatalogPriceChf, formatChf } from '../../../lib/formatBuyerPrice';
import { BuyerFinalPriceRow } from '../../../components/pricing/BuyerFinalPriceRow';
import { supabase } from '../../../lib/supabase';
import { navigateToThread } from '../../../lib/navigation/navigateInTabs';
import { getBuyerListingOfferGate, type BuyerListingOfferGate } from '../../../lib/listingOffers';
import { buildOfferPresetAmounts, formatOfferDiscountLabel } from '../../../lib/offerPresets';

export default function MakeOfferScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safeBottom = getSafeBottomInset(insets.bottom);
  const params = useLocalSearchParams<{ id?: string }>();
  const listingId = typeof params.id === 'string' ? params.id : '';
  const { user } = useAuthStore();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<'p0' | 'p1' | 'p2' | 'other' | null>(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sellerVacationMode, setSellerVacationMode] = useState(false);
  const [offerGate, setOfferGate] = useState<BuyerListingOfferGate | null>(null);

  const inputRef = useRef<TextInput | null>(null);
  const submitLockRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      if (!listingId) {
        setError(t('feed.listingDetail.notFound'));
        setLoading(false);
        return;
      }
      try {
        setError(null);
        const { data, error: fetchError } = await getListingById(listingId);
        if (fetchError || !data) {
          setError(fetchError?.message || t('feed.listingDetail.notFound'));
          setListing(null);
        } else {
          setListing(cloneListingDetail(data));
        }
      } catch {
        setError(t('feed.makeOffer.unableLoad'));
        setListing(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [listingId, t]);

  useEffect(() => {
    if (!listing?.seller_id) {
      setSellerVacationMode(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('vacation_mode')
        .eq('id', listing.seller_id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setSellerVacationMode(false);
        return;
      }
      const row = data as { vacation_mode?: boolean | null };
      setSellerVacationMode(Boolean(row.vacation_mode));
    })();
    return () => {
      cancelled = true;
    };
  }, [listing?.seller_id]);

  useEffect(() => {
    if (!listing?.id || !user?.id) {
      setOfferGate(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await getBuyerListingOfferGate(listing.id);
      if (!cancelled) setOfferGate(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [listing?.id, user?.id]);

  const showOfferBlockedAlert = useCallback(
    (gate: Extract<BuyerListingOfferGate, { canOffer: false }>) => {
      Alert.alert(
        t('feed.makeOffer.blockedTitle'),
        gate.reason === 'pending'
          ? t('feed.makeOffer.pendingBlocked')
          : t('feed.makeOffer.acceptedBlocked'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('feed.makeOffer.viewConversation'),
            onPress: () => navigateToThread(router, gate.threadId)
          }
        ]
      );
    },
    [router, t]
  );

  const quickOffers = useMemo(() => {
    if (!listing) return [] as Array<{ amount: number; discountChf: number; total: number }>;
    return buildOfferPresetAmounts(listing.price).map((preset) => ({
      ...preset,
      total: computeBuyerFinalPriceChf(preset.amount)
    }));
  }, [listing]);

  const handleSelectPreset = (index: number) => {
    const preset = quickOffers[index];
    if (!preset) return;
    setSelectedCard(index === 0 ? 'p0' : index === 1 ? 'p1' : 'p2');
    setAmount(preset.amount.toFixed(2));
  };

  const handleSelectOther = () => {
    setSelectedCard('other');
    setAmount('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const parsedAmount = useMemo(() => {
    const v = parseFloat(amount.replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? v : null;
  }, [amount]);

  const manualOfferBuyerTotal = useMemo(() => {
    if (parsedAmount == null) return null;
    return computeBuyerFinalPriceChf(parsedAmount);
  }, [parsedAmount]);

  const isValidAmount = parsedAmount !== null;

  const handleBack = () => {
    router.back();
  };

  const handleSubmit = async () => {
    if (!listing || !isValidAmount || submitting || submitLockRef.current) return;
    if (offerGate && !offerGate.canOffer) {
      showOfferBlockedAlert(offerGate);
      return;
    }
    if (!user) {
      openGuestAuthPrompt();
      return;
    }
    if (sellerVacationMode) {
      setError(t('feed.listingDetail.sellerVacationMessage'));
      return;
    }
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const { data: thread, error: threadError } = await createOrGetThreadForListing(
        listing.id,
        listing.seller_id
      );
      if (threadError || !thread) {
        // eslint-disable-next-line no-console
        console.warn('Erreur thread pour offre:', threadError);
        setError(t('feed.makeOffer.unableSend'));
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
        if (msgError === 'OFFER_ALREADY_PENDING' || msgError === 'OFFER_ALREADY_ACCEPTED') {
          const { data: gate } = await getBuyerListingOfferGate(listing.id);
          if (gate && !gate.canOffer) {
            setOfferGate(gate);
            showOfferBlockedAlert(gate);
          } else {
            Alert.alert(t('common.error'), t('feed.makeOffer.unableSend'));
          }
          return;
        }
        setError(t('feed.makeOffer.unableSend'));
        return;
      }

      const threadId = thread.id;
      Alert.alert(
        t('feed.makeOffer.offerSent'),
        t('feed.makeOffer.offerSentMessage'),
        [
          {
            text: t('feed.makeOffer.viewConversation'),
            onPress: () => {
              navigateToThread(router, threadId);
            }
          }
        ],
        { cancelable: false }
      );
    } finally {
      submitLockRef.current = false;
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
              {t('common.loading')}
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
              {error || 'Listing not found.'}
            </Text>
            <Button title={t('common.back')} onPress={handleBack} variant="secondary" />
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
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <HeaderBackButton onPress={handleBack} />
            <Text variant="body" style={styles.headerTitle} numberOfLines={1}>
              {sellerName}
            </Text>
            <View style={styles.headerRightPlaceholder} />
          </View>

          {/* Contenu scrollable + bouton sticky */}
          <View style={styles.flex}>
            <ScrollView
              style={styles.content}
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
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
                  {listing.price > 0 ? (
                    <BuyerFinalPriceRow
                      itemPriceChf={listing.price}
                      textStyle={styles.listingPrice}
                    />
                  ) : null}
                </View>
              </View>

              {/* Quick offers — montants CHF fixes (pas de %) */}
              <View style={styles.quickOffersRow}>
                {quickOffers.map((preset, index) => {
                  const cardKey = index === 0 ? 'p0' : index === 1 ? 'p1' : 'p2';
                  return (
                    <TouchableOpacity
                      key={`preset-${preset.amount}`}
                      style={[
                        styles.quickCard,
                        selectedCard === cardKey && styles.quickCardSelected
                      ]}
                      activeOpacity={0.8}
                      onPress={() => handleSelectPreset(index)}
                    >
                      <Text variant="body" style={styles.quickPrice}>
                        {formatChf(preset.amount)}
                      </Text>
                      <Text variant="captionSm" style={styles.quickTotal}>
                        {t('feed.makeOffer.buyerTotal', {
                          total: formatCatalogPriceChf(preset.total)
                        })}
                      </Text>
                      <Text variant="captionSm" style={styles.quickDiscount}>
                        {formatOfferDiscountLabel(preset.discountChf)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={[
                    styles.quickCard,
                    selectedCard === 'other' && styles.quickCardSelected
                  ]}
                  activeOpacity={0.8}
                  onPress={handleSelectOther}
                >
                  <Text variant="body" style={styles.quickPrice}>
                    {t('feed.makeOffer.otherUpper')}
                  </Text>
                  <Text variant="captionSm" style={styles.quickTotal}>
                    {t('feed.makeOffer.other')}
                  </Text>
                  <Text variant="captionSm" style={styles.quickDiscount}>
                    {t('feed.makeOffer.nameYourPrice')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Manual input */}
              <View style={styles.toBlock}>
                <Text variant="body" style={styles.toLabel}>
                  {t('feed.makeOffer.to')}
                </Text>
                <Text variant="captionSm" color="textSecondary" style={styles.toHint}>
                  {t('feed.makeOffer.itemPriceHint')}
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
                  />
                  <Text variant="body" style={styles.toCurrency}>
                    CHF
                  </Text>
                </View>
                {manualOfferBuyerTotal != null ? (
                  <Text variant="captionSm" style={styles.offerBuyerTotal}>
                    {t('feed.makeOffer.buyerTotal', {
                      total: formatCatalogPriceChf(manualOfferBuyerTotal)
                    })}
                  </Text>
                ) : null}
              </View>

              {offerGate && !offerGate.canOffer ? (
                <View style={styles.errorToast}>
                  <Text variant="captionSm" color="textSecondary">
                    {offerGate.reason === 'pending'
                      ? t('feed.makeOffer.pendingBlocked')
                      : t('feed.makeOffer.acceptedBlocked')}
                  </Text>
                  <Button
                    title={t('feed.makeOffer.viewConversation')}
                    variant="secondary"
                    onPress={() => navigateToThread(router, offerGate.threadId)}
                    style={styles.conversationLinkBtn}
                  />
                </View>
              ) : null}

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
                { paddingBottom: safeBottom + 12 }
              ]}
            >
              <Button
                title={t('feed.makeOffer.sendOffer')}
                onPress={handleSubmit}
                variant="primary"
                disabled={!isValidAmount || submitting || Boolean(offerGate && !offerGate.canOffer)}
                loading={submitting}
                style={styles.submitButton}
                textStyle={styles.submitText}
              />
            </View>
          </View>
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
  headerRightPlaceholder: {
    width: 28
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
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginVertical: 16,
    gap: 8
  },
  quickCard: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 72,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#FFFFFF'
  },
  quickCardSelected: {
    borderColor: '#C3EA4F',
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
  toHint: {
    marginBottom: 4
  },
  offerBuyerTotal: {
    marginTop: 6,
    fontSize: 13,
    color: '#84CC16',
    fontFamily: theme.fontFamily.semiBold
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
    borderBottomColor: '#C3EA4F'
  },
  toInputBlurred: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  errorToast: {
    marginTop: 8,
    paddingHorizontal: 20
  },
  conversationLinkBtn: {
    marginTop: 8
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
    backgroundColor: '#C3EA4F'
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.appleBlack
  }
});

