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
import { BLOOMI_COUNTRY_CODE } from '../../../lib/bloomiRegion';

export default function WorkAddressScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();

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
        .select('work_street, work_postal_code, work_city, work_country')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setStreet(String((data as any).work_street ?? ''));
        setPostalCode(String((data as any).work_postal_code ?? ''));
        setCity(String((data as any).work_city ?? ''));
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
    const st = street.trim();
    const pc = postalCode.trim();
    const ct = city.trim();

    if (!st && !pc && !ct) {
      setSaving(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            work_street: null,
            work_postal_code: null,
            work_city: null,
            work_country: null
          })
          .eq('id', user.id);
        if (error) throw error;
        router.back();
      } catch (e) {
        Alert.alert(t('common.error'), e instanceof Error ? e.message : t('profile.accountSettings.unableSave'));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!st || !pc || !ct) {
      Alert.alert(
        t('profile.workAddress.incomplete'),
        t('profile.workAddress.incompleteMessage')
      );
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          work_street: st,
          work_postal_code: pc,
          work_city: ct,
          work_country: BLOOMI_COUNTRY_CODE
        })
        .eq('id', user.id);
      if (error) throw error;
      Alert.alert(t('profile.workAddress.saved'), t('profile.workAddress.updated'));
      router.back();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('profile.accountSettings.unableSave'));
    } finally {
      setSaving(false);
    }
  }, [city, postalCode, router, saving, street, t, user?.id]);

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
            {t('profile.workAddress.title')}
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
              {t('profile.workAddress.intro')}
            </Text>

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
    marginBottom: theme.spacing.gapMd
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
