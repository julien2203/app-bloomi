import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { AppIcon } from '../ui/AppIcon';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { fetchProfilePickupAddresses } from '../../lib/profilePickupAddresses';
import { formatPickupAddressLine } from '../../lib/pickupAddress';

type PickupAddressRoutes = {
  primary: string;
  work: string;
};

const DEFAULT_PICKUP_ADDRESS_ROUTES: PickupAddressRoutes = {
  primary: '/tabs/profile/my-address',
  work: '/tabs/profile/work-address'
};

type PickupAddressesSectionProps = {
  onPrimaryCompleteChange?: (complete: boolean) => void;
  error?: string;
  addressRoutes?: PickupAddressRoutes;
};

export function PickupAddressesSection({
  onPrimaryCompleteChange,
  error,
  addressRoutes = DEFAULT_PICKUP_ADDRESS_ROUTES
}: PickupAddressesSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [primaryLine, setPrimaryLine] = useState<string | null>(null);
  const [workLine, setWorkLine] = useState<string | null>(null);

  const loadAddresses = useCallback(async () => {
    if (!user?.id) {
      setPrimaryLine(null);
      setWorkLine(null);
      onPrimaryCompleteChange?.(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const addresses = await fetchProfilePickupAddresses(supabase, user.id);
      setPrimaryLine(
        addresses.primary ? formatPickupAddressLine(addresses.primary) : null
      );
      setWorkLine(addresses.work ? formatPickupAddressLine(addresses.work) : null);
      onPrimaryCompleteChange?.(Boolean(addresses.primary));
    } finally {
      setLoading(false);
    }
  }, [onPrimaryCompleteChange, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadAddresses();
    }, [loadAddresses])
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('sell.pickupAddresses.title')}</Text>
      <Text style={styles.sectionSubtitle}>{t('sell.pickupAddresses.subtitle')}</Text>

      <View style={styles.privacyNote}>
        <Feather name="info" size={16} color={theme.colors.textSecondary} />
        <Text style={styles.privacyNoteText}>{t('sell.pickupAddresses.privacyNote')}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <View style={styles.cards}>
          <PickupAddressCard
            icon={<AppIcon name="homeBold" size={22} color={theme.colors.textPrimary} />}
            label={t('sell.pickupAddresses.primaryLabel')}
            badge={t('sell.pickupAddresses.primaryBadge')}
            value={primaryLine}
            placeholder={t('sell.pickupAddresses.addPrimary')}
            onPress={() => router.push(addressRoutes.primary as never)}
          />
          <PickupAddressCard
            icon={<Feather name="briefcase" size={20} color={theme.colors.textPrimary} />}
            label={t('sell.pickupAddresses.workLabel')}
            badge={t('sell.pickupAddresses.workBadge')}
            value={workLine}
            placeholder={t('sell.pickupAddresses.addWork')}
            onPress={() => router.push(addressRoutes.work as never)}
          />
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

type PickupAddressCardProps = {
  icon: React.ReactNode;
  label: string;
  badge: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
};

function PickupAddressCard({
  icon,
  label,
  badge,
  value,
  placeholder,
  onPress
}: PickupAddressCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardIconWrap}>{icon}</View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardLabel}>{label}</Text>
          <Text style={styles.cardBadge}>{badge}</Text>
        </View>
        <Text style={[styles.cardValue, !value && styles.cardPlaceholder]} numberOfLines={2}>
          {value ?? placeholder}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 4,
    marginBottom: 16
  },
  sectionTitle: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.semiBold,
    marginBottom: 4
  },
  sectionSubtitle: {
    ...theme.typography.captionSm,
    color: theme.colors.textSecondary,
    marginBottom: 12
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    marginBottom: 12,
    borderRadius: theme.radius.cardRadius,
    backgroundColor: theme.colors.muted
  },
  privacyNoteText: {
    flex: 1,
    ...theme.typography.captionSm,
    color: theme.colors.textSecondary,
    lineHeight: 18
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center'
  },
  cards: {
    gap: 10
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: theme.radius.cardRadius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundWhite
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  cardBody: {
    flex: 1,
    marginRight: 8
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4
  },
  cardLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.semiBold
  },
  cardBadge: {
    ...theme.typography.captionSm,
    color: theme.colors.textSecondary
  },
  cardValue: {
    ...theme.typography.captionSm,
    color: theme.colors.textPrimary
  },
  cardPlaceholder: {
    color: theme.colors.textSecondary
  },
  error: {
    ...theme.typography.caption,
    color: '#EF4444',
    marginTop: 8
  }
});
