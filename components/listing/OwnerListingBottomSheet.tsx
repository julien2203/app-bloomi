import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../lib/theme';
import { Text } from '../ui/Text';

type Step = 'actions' | 'delete';

type OwnerListingBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  /** Called after user confirms delete in the second step. */
  onDeleteConfirmed: () => void | Promise<void>;
  /** Met l'annonce en brouillon (retire du feed, garde l'historique). */
  onDeactivateListing?: () => void | Promise<void>;
  /** Annonce courante (menu •••) : id + statut pour le flux brouillon. */
  activeListingId?: string | null;
  listingStatus?: string | null;
  /** Brouillon : lancement de la confirmation « supprimer définitivement » (hors sheet). */
  onRequestPermanentDeleteDraft?: (listingId: string) => void;
};

export function OwnerListingBottomSheet({
  visible,
  onClose,
  onEdit,
  onDeleteConfirmed,
  onDeactivateListing,
  activeListingId,
  listingStatus,
  onRequestPermanentDeleteDraft
}: OwnerListingBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('actions');
  const [deleting, setDeleting] = useState(false);
  const isDraft = String(listingStatus ?? '').toLowerCase() === 'draft';

  useEffect(() => {
    if (visible) {
      setStep('actions');
      setDeleting(false);
    }
  }, [visible]);

  const handleEdit = useCallback(() => {
    onEdit();
    onClose();
  }, [onClose, onEdit]);

  const handleConfirmDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDeleteConfirmed();
      onClose();
    } catch {
      // Keep sheet open so the user can retry or go back.
    } finally {
      setDeleting(false);
    }
  }, [onClose, onDeleteConfirmed]);

  const handleDeactivateListing = useCallback(async () => {
    if (!onDeactivateListing) return;
    setDeleting(true);
    try {
      await onDeactivateListing();
      onClose();
    } catch {
      // garder la feuille ouverte
    } finally {
      setDeleting(false);
    }
  }, [onClose, onDeactivateListing]);

  const handleRequestPermanentDeleteDraft = useCallback(() => {
    const id = activeListingId;
    if (!id || !onRequestPermanentDeleteDraft) return;
    onRequestPermanentDeleteDraft(id);
  }, [activeListingId, onRequestPermanentDeleteDraft]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />

        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 8
            }
          ]}
        >
          <View style={styles.handle} />

          {step === 'actions' ? (
            <>
              <Text variant="body" style={styles.sheetTitle}>
                Manage listing
              </Text>
              <Text variant="captionSm" color="textSecondary" style={styles.sheetSubtitle}>
                Edit or remove this item from your closet.
              </Text>

              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={handleEdit}
                accessibilityRole="button"
                accessibilityLabel="Edit listing"
              >
                <View style={styles.rowIconWrap}>
                  <Feather name="edit-2" size={20} color={theme.colors.textPrimary} />
                </View>
                <Text variant="body" style={styles.rowLabel}>
                  Edit listing
                </Text>
                <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
              </Pressable>

              <View style={styles.separator} />

              {isDraft ? (
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={handleRequestPermanentDeleteDraft}
                  accessibilityRole="button"
                  accessibilityLabel="Supprimer définitivement"
                >
                  <View style={[styles.rowIconWrap, styles.rowIconWrapDanger]}>
                    <Feather name="trash-2" size={20} color={theme.colors.danger} />
                  </View>
                  <Text variant="body" style={styles.rowLabelDanger}>
                    Supprimer définitivement
                  </Text>
                  <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => setStep('delete')}
                  accessibilityRole="button"
                  accessibilityLabel="Delete listing"
                >
                  <View style={[styles.rowIconWrap, styles.rowIconWrapDanger]}>
                    <Feather name="trash-2" size={20} color={theme.colors.danger} />
                  </View>
                  <Text variant="body" style={styles.rowLabelDanger}>
                    Delete listing
                  </Text>
                  <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [styles.cancelPill, pressed && styles.cancelPillPressed]}
                onPress={onClose}
                accessibilityRole="button"
              >
                <Text variant="body" style={styles.cancelPillText}>
                  Cancel
                </Text>
              </Pressable>
            </>
          ) : isDraft ? (
            <View style={styles.draftDeleteFallback}>
              <Pressable
                style={({ pressed }) => [styles.cancelPill, pressed && styles.cancelPillPressed]}
                onPress={() => setStep('actions')}
                accessibilityRole="button"
              >
                <Text variant="body" style={styles.cancelPillText}>
                  Back
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text variant="body" style={styles.sheetTitle}>
                Delete this listing?
              </Text>
              <Text variant="captionSm" color="textSecondary" style={styles.deleteHint}>
                This cannot be undone. Buyers will no longer see this item.
              </Text>

              {onDeactivateListing ? (
                <Pressable
                  style={({ pressed }) => [styles.deactivateBtn, pressed && styles.rowPressed]}
                  onPress={() => void handleDeactivateListing()}
                  disabled={deleting}
                  accessibilityRole="button"
                  accessibilityLabel="Deactivate listing"
                >
                  <Text variant="body" style={styles.deactivateBtnText}>
                    Désactiver l&apos;annonce
                  </Text>
                  <Text variant="captionSm" color="textSecondary" style={styles.deactivateBtnHint}>
                    Brouillon : retirée du fil, conservée pour l&apos;historique des commandes.
                  </Text>
                </Pressable>
              ) : null}

              <View style={styles.deleteActions}>
                <Pressable
                  style={({ pressed }) => [styles.secondaryBtn, pressed && styles.rowPressed]}
                  onPress={() => setStep('actions')}
                  disabled={deleting}
                  accessibilityRole="button"
                >
                  <Text variant="body" style={styles.secondaryBtnText}>
                    Back
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.dangerBtn, pressed && styles.dangerBtnPressed]}
                  onPress={() => void handleConfirmDelete()}
                  disabled={deleting}
                  accessibilityRole="button"
                >
                  {deleting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text variant="body" style={styles.dangerBtnText}>
                      Delete
                    </Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
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
    backgroundColor: 'rgba(0,0,0,0.45)'
  },
  sheet: {
    backgroundColor: theme.colors.backgroundWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: 16
  },
  sheetTitle: {
    fontFamily: theme.fontFamily.semiBold,
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginBottom: 6
  },
  sheetSubtitle: {
    marginBottom: 18,
    lineHeight: 18
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    columnGap: 12
  },
  rowPressed: {
    opacity: 0.65
  },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowIconWrapDanger: {
    backgroundColor: `${theme.colors.danger}18`
  },
  rowLabel: {
    flex: 1,
    fontFamily: theme.fontFamily.semiBold
  },
  rowLabelDanger: {
    flex: 1,
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.danger
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginVertical: 4
  },
  cancelPill: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.muted,
    alignItems: 'center'
  },
  cancelPillPressed: {
    opacity: 0.8
  },
  cancelPillText: {
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary
  },
  deleteHint: {
    marginBottom: 16,
    lineHeight: 18
  },
  deactivateBtn: {
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.muted
  },
  deactivateBtnText: {
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4
  },
  deactivateBtnHint: {
    textAlign: 'center',
    lineHeight: 16
  },
  deleteActions: {
    flexDirection: 'row',
    columnGap: 12
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryBtnText: {
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary
  },
  dangerBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50
  },
  dangerBtnPressed: {
    opacity: 0.88
  },
  dangerBtnText: {
    fontFamily: theme.fontFamily.semiBold,
    color: '#FFFFFF'
  },
  draftDeleteFallback: {
    paddingVertical: 16,
    alignItems: 'center'
  }
});
