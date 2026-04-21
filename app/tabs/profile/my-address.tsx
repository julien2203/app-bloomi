import React, { useCallback, useEffect, useRef, useState } from 'react';
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

const PROFILE_COUNTRY_CH = 'CH';

export default function MyAddressScreen() {
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
        .select('street, postal_code, city, country')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setStreet(String((data as any).street ?? ''));
        setPostalCode(String((data as any).postal_code ?? ''));
        setCity(String((data as any).city ?? ''));
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unable to load your address.');
    } finally {
      setLoadingProfile(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const save = useCallback(async () => {
    if (!user?.id || saving) return;
    const st = street.trim();
    const pc = postalCode.trim();
    const ct = city.trim();
    if (!st || !pc || !ct) {
      Alert.alert('Incomplete address', 'Please fill in street, postal code, and city.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          street: st,
          postal_code: pc,
          city: ct,
          country: PROFILE_COUNTRY_CH
        })
        .eq('id', user.id);
      if (error) throw error;
      Alert.alert('Saved', 'Your address has been updated.');
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unable to save.');
    } finally {
      setSaving(false);
    }
  }, [city, postalCode, router, saving, street, user?.id]);

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
            My address
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
            <Text variant="captionSm" color="textSecondary" style={styles.fieldLabel}>
              Street (with number)
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Rhône street 10"
              placeholderTextColor={theme.colors.textSecondary}
              value={street}
              onChangeText={setStreet}
              autoCapitalize="sentences"
            />

            <Text variant="captionSm" color="textSecondary" style={styles.fieldLabel}>
              Postal code
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Ex. 1200"
              placeholderTextColor={theme.colors.textSecondary}
              value={postalCode}
              onChangeText={setPostalCode}
              keyboardType="numbers-and-punctuation"
            />

            <Text variant="captionSm" color="textSecondary" style={styles.fieldLabel}>
              City
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Geneva"
              placeholderTextColor={theme.colors.textSecondary}
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
            />

            <Text variant="captionSm" color="textSecondary" style={styles.fieldLabel}>
              Country
            </Text>
            <View style={styles.countryReadonly}>
              <Text variant="body" color="textSecondary">
                Switzerland — saved addresses here are limited to Switzerland.
              </Text>
            </View>

            <View style={styles.saveWrap}>
              <Button
                title={saving ? 'Saving…' : 'Save'}
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
  saveWrap: {
    marginTop: theme.spacing.gapLg
  }
});
