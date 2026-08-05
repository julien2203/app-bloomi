import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeBottomInset } from '../../lib/safeArea';
import { Text } from '../ui/Text';
import { theme } from '../../lib/theme';

export type SafetyChoiceSheetAction = {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  actions: SafetyChoiceSheetAction[];
};

/**
 * Bottom sheet for report / block / safety flows (replaces stacked Alert.alert on iOS).
 */
export function SafetyChoiceSheet({ visible, onClose, title, message, actions }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root} pointerEvents="box-none">
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(getSafeBottomInset(insets.bottom), 12) }]}
          accessibilityViewIsModal
        >
          <View style={styles.handleZone}>
            <View style={styles.handle} />
          </View>
          <Text variant="h3" style={styles.title}>
            {title}
          </Text>
          {message ? (
            <Text variant="caption" color="textSecondary" style={styles.message}>
              {message}
            </Text>
          ) : null}
          <ScrollView
            style={styles.scroll}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={actions.length > 6}
          >
            {actions.map((a, i) => (
              <Pressable
                key={`${a.label}-${i}`}
                disabled={a.disabled}
                onPress={() => {
                  if (!a.disabled) a.onPress();
                }}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && styles.rowBorder,
                  pressed && !a.disabled && styles.rowPressed,
                  a.disabled && styles.rowDisabled
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: Boolean(a.disabled) }}
              >
                <Text
                  variant="body"
                  style={a.variant === 'destructive' ? styles.destructiveLabel : undefined}
                >
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.45)'
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: 8,
    maxHeight: '88%'
  },
  handleZone: {
    alignItems: 'center',
    paddingBottom: 12
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border
  },
  title: {
    textAlign: 'center',
    marginBottom: 8
  },
  message: {
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20
  },
  scroll: {
    maxHeight: 360
  },
  row: {
    paddingVertical: 16,
    paddingHorizontal: 4
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border
  },
  rowPressed: {
    backgroundColor: theme.colors.muted
  },
  rowDisabled: {
    opacity: 0.45
  },
  destructiveLabel: {
    color: theme.colors.danger,
    fontFamily: theme.fontFamily.semiBold
  }
});
