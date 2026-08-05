import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { theme } from '../../../lib/theme';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { useAuthStore } from '../../../stores/authStore';
import { useTranslation } from 'react-i18next';

export default function MyAddressScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [street, setStreet] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');

  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('street, postal_code, city, country, address_first_name, address_last_name, display_name')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const row = data as Record<string, unknown>;
        setStreet(String(row.street ?? ''));
        setPostalCode(String(row.postal_code ?? ''));
        setCity(String(row.city ?? ''));
        const fn = String(row.address_first_name ?? '').trim();
        const ln = String(row.address_last_name ?? '').trim();
        if (fn || ln) {
          setFirstName(fn);
          setLastName(ln);
        } else {
          // Préremplir depuis le display_name si possible (ex. "Jean Dupont")
          const display = String(row.display_name ?? '').trim();
          if (display) {
            const parts = display.split(/\s+/).filter(Boolean);
            if (parts.length >= 2) {
              setFirstName(parts[0]!);
              setLastName(parts.slice(1).join(' '));
            } else {
              setFirstName(display);
            }
          }
        }
      }
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('profile.unableLoad'));
    } finally {
      setLoadingProfile(false);
    }
  }, [t, user?.id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const save = useCallback(async () => {
    if (!user?.id || saving) return;
    const fn = firstName.trim();
    const ln = lastName.trim();
    const st = street.trim();
    const pc = postalCode.trim();
    const ct = city.trim();
    if (!fn || !ln || !st || !pc || !ct) {
      Alert.alert(t('profile.myAddress.incomplete'), t('profile.myAddress.incompleteMessage'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          address_first_name: fn,
          address_last_name: ln,
          street: st,
          postal_code: pc,
          city: ct
        })
        .eq('id', user.id);
      if (error) throw error;
      Alert.alert(t('profile.myAddress.saved'), t('profile.myAddress.updated'));
      router.back();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('profile.accountSettings.unableSave'));
    } finally {
      setSaving(false);
    }
  }, [city, firstName, lastName, postalCode, router, saving, street, t, user?.id]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="body" style={styles.headerTitle}>
            {t('profile.myAddress.title')}
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
        <View style={styles.separator} />

        {loadingProfile ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text variant="captionSm" color="textSecondary" style={styles.intro}>
              {t('profile.myAddress.nameHint')}
            </Text>

            <Text variant="captionSm" color="textSecondary" style={styles.fieldLabel}>
              {t('profile.myAddress.firstName')}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t('profile.myAddress.firstNameExample')}
              placeholderTextColor={theme.colors.textSecondary}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoComplete="given-name"
              textContentType="givenName"
            />

            <Text variant="captionSm" color="textSecondary" style={styles.fieldLabel}>
              {t('profile.myAddress.lastName')}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t('profile.myAddress.lastNameExample')}
              placeholderTextColor={theme.colors.textSecondary}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoComplete="family-name"
              textContentType="familyName"
            />

            <Text variant="captionSm" color="textSecondary" style={styles.fieldLabel}>
              {t('profile.myAddress.street')}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t('profile.myAddress.streetExample')}
              placeholderTextColor={theme.colors.textSecondary}
              value={street}
              onChangeText={setStreet}
              autoCapitalize="sentences"
              autoComplete="street-address"
              textContentType="streetAddressLine1"
            />

            <Text variant="captionSm" color="textSecondary" style={styles.fieldLabel}>
              {t('profile.myAddress.postalCode')}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t('profile.myAddress.postalExample')}
              placeholderTextColor={theme.colors.textSecondary}
              value={postalCode}
              onChangeText={setPostalCode}
              keyboardType="numbers-and-punctuation"
              autoComplete="postal-code"
              textContentType="postalCode"
            />

            <Text variant="captionSm" color="textSecondary" style={styles.fieldLabel}>
              {t('profile.myAddress.city')}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t('profile.myAddress.cityExample')}
              placeholderTextColor={theme.colors.textSecondary}
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
              autoComplete="postal-address"
              textContentType="addressCity"
            />

            <Text variant="captionSm" color="textSecondary" style={styles.fieldLabel}>
              {t('feed.checkout.country')}
            </Text>
            <View style={styles.countryReadonly}>
              <Text variant="body" color="textSecondary">
                {t('feed.checkout.countryCH')}
              </Text>
            </View>
            <Text variant="captionSm" color="textSecondary" style={styles.countryHint}>
              {t('profile.myAddress.countryInfo')}
            </Text>

            <View style={styles.saveWrap}>
              <Button
                title={saving ? t('profile.accountSettings.saving') : t('common.save')}
                onPress={() => void save()}
                disabled={saving}
                loading={saving}
                variant="primary"
              />
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingVertical: theme.spacing.settingsHeaderPaddingY
  },
  headerTitle: {
    ...theme.typography.settingsHeaderTitle,
    color: theme.colors.appleBlack,
    textAlign: 'center',
    flex: 1
  },
  headerRightPlaceholder: {
    width: theme.spacing.settingsHeaderSideWidth
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingTop: theme.spacing.gapMd,
    paddingBottom: theme.spacing.gapLg
  },
  intro: {
    marginBottom: theme.spacing.gapSm
  },
  fieldLabel: {
    marginBottom: theme.spacing.gapSm,
    marginTop: theme.spacing.gapSm
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: theme.spacing.gapSm,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.regular,
    fontSize: theme.typography.body.fontSize,
    backgroundColor: theme.colors.background
  },
  countryReadonly: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: theme.spacing.gapSm,
    backgroundColor: theme.colors.muted
  },
  countryHint: {
    marginBottom: theme.spacing.gapSm
  },
  saveWrap: {
    marginTop: theme.spacing.gapLg
  }
});
