import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import {
  savePendingSellerProfile,
  upsertSellerProfileFields,
  clearPendingSellerProfile,
  type PendingSellerProfile,
  type SellerTypeChoice
} from '../../lib/pendingSellerProfile';

const IDE_REGEX = /^CHE-\d{3}\.\d{3}\.\d{3}$/;

function isBusinessSellerType(type: SellerTypeChoice | null): type is 'pro' | 'sole_proprietorship' {
  return type === 'pro' || type === 'sole_proprietorship';
}

export default function SellerTypeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';

  const [sellerType, setSellerType] = useState<SellerTypeChoice | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [ideNumber, setIdeNumber] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companySocial, setCompanySocial] = useState('');
  const [isInfluencer, setIsInfluencer] = useState<boolean | null>(null);
  const [influencerInstagram, setInfluencerInstagram] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusinessForm = isBusinessSellerType(sellerType);
  const ideRequired = sellerType === 'pro';

  const validateBusinessFields = () => {
    if (!companyName.trim() || !companyAddress.trim()) {
      setError(t('auth.sellerType.fillRequired'));
      return false;
    }
    if (ideRequired && !ideNumber.trim()) {
      setError(t('auth.sellerType.fillRequired'));
      return false;
    }
    const ide = ideNumber.trim();
    if (ide && !IDE_REGEX.test(ide)) {
      setError(t('auth.sellerType.ideFormat'));
      return false;
    }
    return true;
  };

  const goToVerifyEmail = () => {
    router.replace({
      pathname: '/auth/verify-email',
      params: email ? { email } : {}
    });
  };

  const handleContinue = async () => {
    if (!sellerType) return;

    try {
      setLoading(true);
      setError(null);

      const pendingPayload: PendingSellerProfile = {
        sellerType,
        isInfluencer,
        influencerInstagram: isInfluencer === true ? influencerInstagram : undefined,
        companyName: isBusinessForm ? companyName : undefined,
        ideNumber: isBusinessForm ? ideNumber : undefined,
        companyAddress: isBusinessForm ? companyAddress : undefined,
        companySocial: isBusinessForm ? companySocial : undefined,
        email: email || undefined
      };

      if (isBusinessForm && !validateBusinessFields()) {
        return;
      }

      if (isInfluencer === true && !influencerInstagram.trim()) {
        setError(t('auth.sellerType.influencerInstagramRequired'));
        return;
      }

      await savePendingSellerProfile(pendingPayload);

      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user) {
        // Email confirmation activée : pas de session → données conservées localement
        // et appliquées après vérification email / création du profil.
        goToVerifyEmail();
        return;
      }

      const { error: upsertError } = await upsertSellerProfileFields(data.user.id, pendingPayload);
      if (upsertError) {
        setError(upsertError.message);
        return;
      }

      await clearPendingSellerProfile();
      goToVerifyEmail();
    } finally {
      setLoading(false);
    }
  };

  const canContinue =
    !!sellerType &&
    (!isBusinessForm ||
      (companyName.trim().length > 0 &&
        companyAddress.trim().length > 0 &&
        (!ideRequired || ideNumber.trim().length > 0))) &&
    (isInfluencer !== true || influencerInstagram.trim().length > 0);

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text style={styles.headerTitle}>{t('auth.signUp.title')}</Text>
          <View style={{ width: 20 }} />
        </View>
        <View style={styles.headerSeparator} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              <Text style={styles.sectionTitle}>{t('auth.sellerType.sellingAs')}</Text>

              <View style={styles.pillsColumn}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.pillFull,
                    sellerType === 'individual' ? styles.pillActive : styles.pillInactive
                  ]}
                  onPress={() => setSellerType('individual')}
                >
                  <Text style={styles.pillText}>{t('auth.sellerType.individual')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.pillFull,
                    sellerType === 'pro' ? styles.pillActive : styles.pillInactive
                  ]}
                  onPress={() => setSellerType('pro')}
                >
                  <Text style={styles.pillText}>{t('auth.sellerType.professional')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.pillFull,
                    sellerType === 'sole_proprietorship' ? styles.pillActive : styles.pillInactive
                  ]}
                  onPress={() => setSellerType('sole_proprietorship')}
                >
                  <Text style={styles.pillText}>{t('auth.sellerType.soleProprietorship')}</Text>
                </TouchableOpacity>
              </View>

              {isBusinessForm && (
                <View style={styles.proForm}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('auth.sellerType.companyName')}</Text>
                    <View style={styles.fieldInputWrapper}>
                      <TextInput
                        style={styles.fieldInput}
                        value={companyName}
                        onChangeText={setCompanyName}
                        placeholder=""
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      {ideRequired
                        ? t('auth.sellerType.ideNumber')
                        : t('auth.sellerType.ideNumberOptional')}
                    </Text>
                    <View style={styles.fieldInputWrapper}>
                      <TextInput
                        style={styles.fieldInput}
                        value={ideNumber}
                        onChangeText={setIdeNumber}
                        autoCapitalize="characters"
                        placeholder={t('auth.sellerType.idePlaceholder')}
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('auth.sellerType.businessAddress')}</Text>
                    <View style={styles.fieldInputWrapper}>
                      <TextInput
                        style={styles.fieldInput}
                        value={companyAddress}
                        onChangeText={setCompanyAddress}
                        placeholder=""
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('auth.sellerType.websiteOptional')}</Text>
                    <View style={styles.fieldInputWrapper}>
                      <TextInput
                        style={styles.fieldInput}
                        value={companySocial}
                        onChangeText={setCompanySocial}
                        placeholder={t('auth.sellerType.socialPlaceholder')}
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* Influenceur / créateur */}
              <View style={styles.influencerBlock}>
                <Text style={styles.influencerTitle}>
                  {t('auth.sellerType.influencerQuestion')}
                </Text>
                <View style={styles.pillsColumn}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      styles.pillFull,
                      isInfluencer === true ? styles.pillActive : styles.pillInactive
                    ]}
                    onPress={() => {
                      setIsInfluencer(true);
                    }}
                  >
                    <Text style={styles.pillText}>{t('auth.sellerType.influencerYes')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                      styles.pillFull,
                      isInfluencer === false ? styles.pillActive : styles.pillInactive
                    ]}
                    onPress={() => {
                      setIsInfluencer(false);
                      setInfluencerInstagram('');
                    }}
                  >
                    <Text style={styles.pillText}>{t('auth.sellerType.influencerNo')}</Text>
                  </TouchableOpacity>
                </View>
                {isInfluencer === true ? (
                  <>
                    <View style={[styles.fieldGroup, styles.influencerField]}>
                      <Text style={styles.fieldLabel}>
                        {t('auth.sellerType.influencerInstagram')}
                      </Text>
                      <View style={styles.fieldInputWrapper}>
                        <TextInput
                          style={styles.fieldInput}
                          value={influencerInstagram}
                          onChangeText={setInfluencerInstagram}
                          autoCapitalize="none"
                          autoCorrect={false}
                          placeholder={t('auth.sellerType.influencerInstagramPlaceholder')}
                          placeholderTextColor={theme.colors.textSecondary}
                        />
                      </View>
                    </View>
                    <Text style={styles.influencerHint}>
                      {t('auth.sellerType.influencerHint')}
                    </Text>
                  </>
                ) : null}
              </View>

              {error ? (
                <Text style={styles.errorText}>
                  {error}
                </Text>
              ) : null}

              <Button
                title={t('common.continue')}
                onPress={handleContinue}
                variant="primary-green"
                disabled={!canContinue || loading}
                loading={loading}
                style={[
                  styles.continueButton,
                  (!canContinue || loading) && styles.continueButtonDisabled
                ]}
                textStyle={styles.continueButtonText}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12
  },
  headerTitle: {
    ...theme.typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  headerSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5'
  },
  keyboardView: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24
  },
  content: {
    flex: 1,
    paddingTop: 24,
    paddingHorizontal: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 16
  },
  pillsColumn: {
    flexDirection: 'column',
    rowGap: 12,
    marginBottom: 24
  },
  pill: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pillInactive: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    backgroundColor: '#FFFFFF'
  },
  pillActive: {
    borderWidth: 1,
    borderColor: '#C3EA4F',
    backgroundColor: '#C3EA4F26'
  },
  pillText: {
    fontSize: 15,
    color: theme.colors.textPrimary
  },
  pillFull: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  influencerBlock: {
    marginTop: 8,
    marginBottom: 16
  },
  influencerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 12
  },
  influencerHint: {
    marginTop: 10,
    fontSize: 13,
    color: theme.colors.textSecondary
  },
  influencerField: {
    marginTop: 16,
    marginBottom: 0
  },
  proForm: {
    marginTop: 8
  },
  fieldGroup: {
    marginBottom: 20
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: theme.colors.textPrimary,
    marginBottom: 4
  },
  fieldInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
    paddingVertical: 4
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    paddingVertical: 4
  },
  errorText: {
    ...theme.typography.body,
    color: '#EF4444',
    marginTop: 8,
    marginBottom: 8
  },
  continueButton: {
    marginTop: 8,
    marginBottom: 24,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#C3EA4F'
  },
  continueButtonDisabled: {
    backgroundColor: '#E5E5E5',
    opacity: 0.5
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.appleBlack
  }
});

