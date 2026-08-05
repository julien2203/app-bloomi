import React, { useMemo } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/Text';
import { AppIcon } from '../ui/AppIcon';
import { theme } from '../../lib/theme';
import type { ChatEventCardIcon, ChatEventCardModel } from '../../lib/chatTransactionEvents';
import { mergeEventI18nParams, trimEventName } from '../../lib/chatTransactionEvents';

type Props = {
  model: ChatEventCardModel;
  width: number;
  listingTitle?: string | null;
  listingImage?: string | null;
  listingPriceLabel?: string | null;
  onPrimaryPress?: () => void;
  onSecondaryPress?: () => void;
  primaryLoading?: boolean;
};

const ICON_SIZE = 18;

function accentForIcon(icon: ChatEventCardIcon) {
  switch (icon) {
    case 'confetti':
    case 'check':
      return { bg: '#F0FDF4', border: '#86EFAC' };
    case 'clock':
      return { bg: '#FFFBEB', border: '#FDE68A' };
    case 'printer':
    case 'package':
    case 'truck':
    default:
      return { bg: '#FFFFFF', border: theme.colors.border };
  }
}

function EventIcon({ icon }: { icon: ChatEventCardIcon }) {
  if (icon === 'check') {
    return <AppIcon name="checkCircleBold" size={ICON_SIZE} color="#15803D" />;
  }

  const emoji =
    icon === 'confetti'
      ? '🎉'
      : icon === 'printer'
        ? '🖨️'
        : icon === 'package'
          ? '📦'
          : icon === 'truck'
            ? '🚚'
            : '⏳';

  return <Text style={styles.emoji}>{emoji}</Text>;
}

export function TransactionEventCard({
  model,
  width,
  listingTitle,
  listingImage,
  listingPriceLabel,
  onPrimaryPress,
  onSecondaryPress,
  primaryLoading
}: Props) {
  const { t } = useTranslation();

  const title = t(model.titleKey, model.titleParams ?? {});

  const body = useMemo(() => {
    if (!model.bodyKey) return null;
    const params = mergeEventI18nParams(model);
    if ('name' in params && !trimEventName(String(params.name))) {
      params.name =
        model.nameRole === 'seller'
          ? t('messages.events.fallbackSeller')
          : t('messages.events.fallbackBuyer');
    }
    return t(model.bodyKey, params);
  }, [model, t]);

  const accent = useMemo(() => accentForIcon(model.icon), [model.icon]);
  const showListing = Boolean(listingTitle?.trim());

  const primaryLabel = model.primaryAction
    ? t(model.primaryAction.labelKey, model.primaryAction.labelParams ?? {})
    : null;
  const secondaryLabel = model.secondaryAction
    ? t(model.secondaryAction.labelKey, model.secondaryAction.labelParams ?? {})
    : null;

  return (
    <View
      style={[
        styles.card,
        theme.shadows.card,
        { width, backgroundColor: accent.bg, borderColor: accent.border }
      ]}
    >
      {showListing ? (
        <View style={styles.listingBlock}>
          {listingImage ? (
            <Image source={{ uri: listingImage }} style={styles.listingImage} />
          ) : (
            <View style={[styles.listingImage, styles.listingImagePlaceholder]} />
          )}
          <View style={styles.listingTextCol}>
            <Text variant="captionSm" color="textSecondary" style={styles.listingKicker}>
              {t('messages.events.listingKicker')}
            </Text>
            <Text variant="caption" style={styles.listingTitle} numberOfLines={2}>
              {listingTitle}
            </Text>
            {listingPriceLabel ? (
              <Text variant="captionSm" color="textSecondary">
                {listingPriceLabel}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.eventBlock}>
        <View style={styles.iconBadge}>
          <EventIcon icon={model.icon} />
        </View>
        <View style={styles.textCol}>
          <Text variant="caption" style={styles.eventTitle} numberOfLines={2}>
            {title}
          </Text>
          {body ? (
            <Text variant="captionSm" color="textSecondary" style={styles.eventBody} numberOfLines={3}>
              {body}
            </Text>
          ) : null}
        </View>
      </View>

      {model.primaryAction || model.secondaryAction ? (
        <View style={styles.actions}>
          {model.primaryAction ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.btn, styles.btnPrimary, primaryLoading && styles.btnDisabled]}
              onPress={onPrimaryPress}
              disabled={primaryLoading || !onPrimaryPress}
              accessibilityRole="button"
            >
              <Text variant="captionSm" style={styles.btnPrimaryText} numberOfLines={2}>
                {primaryLabel}
              </Text>
            </TouchableOpacity>
          ) : null}
          {model.secondaryAction ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.btn, styles.btnSecondary]}
              onPress={onSecondaryPress}
              disabled={!onSecondaryPress}
              accessibilityRole="button"
            >
              <Text variant="captionSm" style={styles.btnSecondaryText} numberOfLines={2}>
                {secondaryLabel}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    overflow: 'hidden'
  },
  listingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border
  },
  listingImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: theme.colors.muted
  },
  listingImagePlaceholder: {
    backgroundColor: theme.colors.border
  },
  listingTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  listingKicker: {
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontSize: 10,
    lineHeight: 12
  },
  listingTitle: {
    fontWeight: '600',
    lineHeight: 18
  },
  eventBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1
  },
  emoji: {
    fontSize: ICON_SIZE,
    lineHeight: 20,
    textAlign: 'center'
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 3
  },
  eventTitle: {
    fontWeight: '600',
    lineHeight: 18
  },
  eventBody: {
    lineHeight: 16
  },
  actions: {
    marginTop: 10,
    gap: 6
  },
  btn: {
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38
  },
  btnPrimary: {
    backgroundColor: theme.colors.primary
  },
  btnSecondary: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  btnDisabled: {
    opacity: 0.6
  },
  btnPrimaryText: {
    color: theme.colors.appleBlack,
    fontWeight: '600',
    textAlign: 'center'
  },
  btnSecondaryText: {
    color: theme.colors.textPrimary,
    fontWeight: '500',
    textAlign: 'center'
  }
});
