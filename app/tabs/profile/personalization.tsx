import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { Text } from '../../../components/ui/Text';
import { theme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import i18n, {
  applyAppLanguage,
  normalizeLanguage,
  saveProfileLanguage,
  SUPPORTED_LANGUAGES,
  type AppLanguage
} from '../../../lib/i18n';

export default function PersonalizationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const userId = user?.id ?? null;

  const [selected, setSelected] = useState<AppLanguage>(normalizeLanguage(i18n.language));
  const [saving, setSaving] = useState<AppLanguage | null>(null);

  useEffect(() => {
    const onLanguageChanged = (lng: string) => {
      setSelected(normalizeLanguage(lng));
    };
    i18n.on('languageChanged', onLanguageChanged);
    return () => {
      i18n.off('languageChanged', onLanguageChanged);
    };
  }, []);

  const onSelectLanguage = useCallback(
    async (lang: AppLanguage) => {
      if (lang === selected || saving) return;

      setSaving(lang);
      try {
        if (userId) {
          const { error } = await saveProfileLanguage(userId, lang);
          if (error) {
            Alert.alert(t('common.error'), error.message);
            return;
          }
        } else {
          await applyAppLanguage(lang);
        }
        setSelected(lang);
      } finally {
        setSaving(null);
      }
    },
    [selected, saving, t, userId]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} accessibilityLabel={t('common.back')} />
        <Text variant="body" style={styles.headerTitle}>
          {t('profile.personalization.title')}
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>
      <View style={styles.separator} />

      <Text style={styles.sectionLabel}>{t('profile.personalization.appLanguage')}</Text>

      <View>
        {SUPPORTED_LANGUAGES.map((lang, idx) => {
          const isSelected = selected === lang;
          const isSaving = saving === lang;

          return (
            <Pressable
              key={lang}
              onPress={() => void onSelectLanguage(lang)}
              style={[styles.row, idx > 0 && styles.rowSeparator]}
              disabled={Boolean(saving)}
            >
              <Text variant="body" style={styles.rowLabel}>
                {lang === 'en'
                  ? t('profile.personalization.english')
                  : t('profile.personalization.french')}
              </Text>
              {isSaving ? (
                <ActivityIndicator size="small" color={theme.colors.appleBlack} />
              ) : isSelected ? (
                <Text variant="body" style={styles.checkmark}>
                  ✓
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  sectionLabel: {
    ...theme.typography.settingsSectionLabel,
    color: theme.colors.sectionLabel,
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingTop: theme.spacing.settingsSectionTop,
    paddingBottom: theme.spacing.settingsSectionBottom
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingVertical: theme.spacing.settingsRowPaddingY,
    backgroundColor: theme.colors.background
  },
  rowSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.separator
  },
  rowLabel: {
    ...theme.typography.body,
    color: theme.colors.appleBlack
  },
  checkmark: {
    ...theme.typography.body,
    color: theme.colors.appleBlack
  }
});
