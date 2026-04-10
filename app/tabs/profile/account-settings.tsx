import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { Text } from '../../../components/ui/Text';
import { theme } from '../../../lib/theme';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const userId = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string | null>(null);

  const [fullName, setFullName] = useState<string>('');
  const [gender, setGender] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);

  const [showBirthPicker, setShowBirthPicker] = useState(false);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailUpdating, setEmailUpdating] = useState(false);

  const [genderModalOpen, setGenderModalOpen] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const maskedPhone = useMemo(() => maskPhone(phone), [phone]);
  const birthDateLabel = useMemo(() => formatDdMmYyyy(birthDate), [birthDate]);

  const loadAll = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [{ data: authData, error: authError }, profileRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('profiles').select('phone, display_name, gender, birth_date').eq('id', userId).maybeSingle()
      ]);

      if (authError) throw authError;
      // Tolérance si la migration gender/birth_date n'est pas encore déployée.
      let profileData: any = profileRes.data ?? null;
      if (profileRes.error) {
        const msg = String((profileRes.error as any)?.message ?? profileRes.error);
        const looksLikeMissingColumn =
          msg.toLowerCase().includes('column') && (msg.toLowerCase().includes('gender') || msg.toLowerCase().includes('birth_date'));

        if (!looksLikeMissingColumn) throw profileRes.error;

        const fallback = await supabase.from('profiles').select('phone, display_name').eq('id', userId).maybeSingle();
        if (fallback.error) throw fallback.error;
        profileData = fallback.data ?? null;
      }

      const e = authData.user?.email ?? '';
      setEmail(e);
      setEmailDraft(e);

      const profile = profileData as any;
      setPhone(typeof profile?.phone === 'string' ? profile.phone : null);
      setFullName(typeof profile?.display_name === 'string' ? profile.display_name : '');
      setGender(typeof profile?.gender === 'string' ? profile.gender : null);
      setBirthDate(profile?.birth_date ? safeParseDate(profile.birth_date) : null);
    } catch (e) {
      Alert.alert('Error', formatErrorMessage(e, 'Unable to load account settings.'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const openEmailModal = useCallback(() => {
    setEmailDraft(email);
    setEmailModalOpen(true);
  }, [email]);

  const handleChangeEmail = useCallback(async () => {
    const next = emailDraft.trim();
    if (!next) return;
    if (emailUpdating) return;

    setEmailUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw error;
      setEmail(next);
      setEmailModalOpen(false);
      Alert.alert('Email', 'Votre demande de changement email a été envoyée.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unable to update email.');
    } finally {
      setEmailUpdating(false);
    }
  }, [emailDraft, emailUpdating]);

  const handlePhoneFlow = useCallback(() => {
    router.push('/auth/verify-phone');
  }, [router]);

  const handlePickGender = useCallback((value: string | null) => {
    setGender(value);
    setGenderModalOpen(false);
  }, []);

  const handlePickBirthDate = useCallback(() => {
    setBirthDate((prev) => prev ?? new Date(2000, 0, 1));
    setShowBirthPicker(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!userId) return;
    if (saving) return;

    setSaving(true);
    try {
      const payloadFull: any = {
        id: userId,
        display_name: fullName.trim() || null,
        gender: gender?.trim() || null,
        birth_date: birthDate ? toIsoDate(birthDate) : null
      };

      const attempt = await supabase.from('profiles').upsert(payloadFull);
      if (attempt.error) {
        const msg = String((attempt.error as any)?.message ?? attempt.error);
        const looksLikeMissingColumn =
          msg.toLowerCase().includes('column') && (msg.toLowerCase().includes('gender') || msg.toLowerCase().includes('birth_date'));
        if (!looksLikeMissingColumn) throw attempt.error;

        const payloadFallback: any = {
          id: userId,
          display_name: fullName.trim() || null
        };
        const fallback = await supabase.from('profiles').upsert(payloadFallback);
        if (fallback.error) throw fallback.error;
      }

      router.back();
    } catch (e) {
      Alert.alert('Error', formatErrorMessage(e, 'Unable to save.'));
    } finally {
      setSaving(false);
    }
  }, [birthDate, fullName, gender, router, saving, userId]);

  const handleResetPassword = useCallback(async () => {
    if (!email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      Alert.alert('Password', 'Un email de réinitialisation a été envoyé');
    } catch (e) {
      Alert.alert('Error', formatErrorMessage(e, 'Unable to send reset email.'));
    }
  }, [email]);

  const handleDeleteAccount = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_user');
      if (error) throw error;
      setDeleteModalOpen(false);
      router.replace('/auth/login');
    } catch (e) {
      Alert.alert(
        'Error',
        formatErrorMessage(e, 'Unable to delete account. Please contact support.')
      );
    } finally {
      setDeleting(false);
    }
  }, [deleting, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <Text variant="body" style={styles.headerTitle}>
          Account settings
        </Text>
        <Pressable
          onPress={handleSave}
          disabled={saving || loading}
          style={({ pressed }) => [
            styles.saveButton,
            (saving || loading) && styles.saveButtonDisabled,
            pressed && !(saving || loading) && styles.saveButtonPressed
          ]}
          hitSlop={10}
        >
          {saving ? (
            <ActivityIndicator size="small" color={theme.colors.lime} />
          ) : (
            <Text variant="body" style={styles.saveText}>
              Save
            </Text>
          )}
        </Pressable>
      </View>
      <View style={styles.separator} />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={theme.colors.textSecondary} />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.block}>
            <Pressable onPress={openEmailModal} style={styles.row} hitSlop={6}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowValue}>{email || '—'}</Text>
              </View>
              <Pressable
                onPress={openEmailModal}
                style={({ pressed }) => [styles.changeBtn, pressed && styles.changeBtnPressed]}
                hitSlop={6}
              >
                <Text style={styles.changeBtnText}>Change</Text>
              </Pressable>
            </Pressable>

            <View style={styles.rowSeparator} />

            <Pressable onPress={handlePhoneFlow} style={styles.row} hitSlop={6}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowValue}>{maskedPhone}</Text>
              </View>
              <Pressable
                onPress={handlePhoneFlow}
                style={({ pressed }) => [styles.changeBtn, pressed && styles.changeBtnPressed]}
                hitSlop={6}
              >
                <Text style={styles.changeBtnText}>Change</Text>
              </Pressable>
            </Pressable>

            <Text style={styles.disclaimer}>
              En modifiant votre téléphone, vous devrez confirmer un code reçu par SMS.
            </Text>
          </View>

          <View style={styles.block}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Full name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="—"
                placeholderTextColor={theme.colors.sectionLabel}
                style={styles.fieldInput}
              />
              <View style={styles.fieldSeparator} />
            </View>

            <Pressable onPress={() => setGenderModalOpen(true)} style={styles.field} hitSlop={6}>
              <Text style={styles.fieldLabel}>Gender</Text>
              <Text style={styles.fieldValue}>{genderLabel(gender)}</Text>
              <View style={styles.fieldSeparator} />
            </Pressable>

            <Pressable onPress={handlePickBirthDate} style={styles.field} hitSlop={6}>
              <Text style={styles.fieldLabel}>Date of birth</Text>
              <Text style={styles.fieldValue}>{birthDateLabel || '—'}</Text>
              <View style={styles.fieldSeparator} />
            </Pressable>
          </View>

          <View style={styles.block}>
            <Pressable onPress={handleResetPassword} style={styles.actionRow} hitSlop={6}>
              <Text style={styles.actionLabel}>Change password</Text>
              <Text style={styles.actionChevron}>{'›'}</Text>
            </Pressable>
            <View style={styles.rowSeparator} />
            <Pressable onPress={() => setDeleteModalOpen(true)} style={styles.actionRow} hitSlop={6}>
              <Text style={styles.actionLabel}>Delete my account</Text>
              <Text style={styles.actionChevron}>{'›'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Modal
        visible={emailModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEmailModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEmailModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <Text style={styles.modalTitle}>Change email</Text>
            <TextInput
              value={emailDraft}
              onChangeText={setEmailDraft}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="email@example.com"
              placeholderTextColor={theme.colors.sectionLabel}
              style={styles.modalInput}
            />
            <View style={styles.modalButtonsRow}>
              <Pressable onPress={() => setEmailModalOpen(false)} style={styles.modalBtn}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleChangeEmail}
                disabled={emailUpdating || !emailDraft.trim()}
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  (emailUpdating || !emailDraft.trim()) && styles.modalBtnDisabled
                ]}
              >
                {emailUpdating ? (
                  <ActivityIndicator size="small" color={theme.colors.appleBlack} />
                ) : (
                  <Text style={styles.modalBtnTextPrimary}>Save</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={genderModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setGenderModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setGenderModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <Text style={styles.modalTitle}>Gender</Text>
            {[
              { label: 'Male', value: 'Male' },
              { label: 'Female', value: 'Female' },
              { label: 'Other', value: 'Other' },
              { label: 'Prefer not to say', value: 'Prefer not to say' }
            ].map((opt) => (
              <Pressable key={opt.value} onPress={() => handlePickGender(opt.value)} style={styles.pickerRow}>
                <Text style={styles.pickerRowText}>{opt.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={deleteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDeleteModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <Text style={styles.modalTitle}>Delete my account</Text>
            <Text style={styles.modalBody}>This action is permanent. Your account will be deleted.</Text>
            <View style={styles.modalButtonsRow}>
              <Pressable onPress={() => setDeleteModalOpen(false)} style={styles.modalBtn}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleDeleteAccount}
                disabled={deleting}
                style={[styles.modalBtn, styles.deleteBtn, deleting && styles.modalBtnDisabled]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={theme.colors.googleWhite} />
                ) : (
                  <Text style={styles.deleteBtnText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {showBirthPicker ? (
        <BirthDatePicker
          value={birthDate ?? new Date(2000, 0, 1)}
          onCancel={() => setShowBirthPicker(false)}
          onChange={(d) => {
            setBirthDate(d);
            setShowBirthPicker(false);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function genderLabel(v: string | null): string {
  if (!v) return '—';
  return v;
}

function safeParseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDdMmYyyy(d: Date | null): string {
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function maskPhone(v: string | null): string {
  if (!v) return '—';
  const s = String(v).trim();
  if (!s.startsWith('+')) return s;
  const digits = s.slice(1).replace(/\D/g, '');
  if (digits.length < 5) return s;
  const cc = digits.slice(0, 2);
  const last3 = digits.slice(-3);
  return `+${cc}(***) ***${last3}`;
}

function BirthDatePicker({
  value,
  onCancel,
  onChange
}: {
  value: Date;
  onCancel: () => void;
  onChange: (d: Date) => void;
}) {
  const DateTimePicker = require('@react-native-community/datetimepicker').default as React.ComponentType<any>;
  return (
    <DateTimePicker
      value={value}
      mode="date"
      display="default"
      onChange={(_: any, selected?: Date) => {
        if (!selected) {
          onCancel();
          return;
        }
        onChange(selected);
      }}
    />
  );
}

function formatErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e.trim()) return e;
  const maybeMessage = (e as any)?.message;
  if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;
  try {
    const s = JSON.stringify(e);
    return s && s !== '{}' ? s : fallback;
  } catch {
    return fallback;
  }
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
  saveButton: {
    minWidth: theme.spacing.settingsHeaderSideWidth,
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  saveButtonPressed: {
    opacity: 0.7
  },
  saveButtonDisabled: {
    opacity: 0.35
  },
  saveText: {
    ...theme.typography.settingsHeaderTitle,
    color: theme.colors.lime
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator
  },
  content: {
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingTop: theme.spacing.gapMd,
    gap: theme.spacing.gapMd
  },
  loadingWrap: {
    paddingTop: theme.spacing.gapMd,
    alignItems: 'center'
  },
  block: {
    backgroundColor: theme.colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.separator,
    borderRadius: 12,
    overflow: 'hidden'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingVertical: theme.spacing.settingsRowPaddingY
  },
  rowLeft: {
    flex: 1,
    paddingRight: 12
  },
  rowValue: {
    ...theme.typography.body,
    color: theme.colors.appleBlack
  },
  changeBtn: {
    borderWidth: 1,
    borderColor: theme.colors.lime,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  changeBtnPressed: {
    opacity: 0.7
  },
  changeBtnText: {
    ...theme.typography.caption,
    color: theme.colors.appleBlack
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator
  },
  disclaimer: {
    ...theme.typography.captionSm,
    color: theme.colors.sectionLabel,
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingBottom: theme.spacing.settingsRowPaddingY
  },
  field: {
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingTop: 12
  },
  fieldLabel: {
    ...theme.typography.settingsSectionLabel,
    color: theme.colors.sectionLabel,
    paddingBottom: 6
  },
  fieldInput: {
    ...theme.typography.body,
    color: theme.colors.appleBlack,
    paddingVertical: 0,
    paddingHorizontal: 0
  },
  fieldValue: {
    ...theme.typography.body,
    color: theme.colors.appleBlack,
    paddingBottom: 12
  },
  fieldSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator,
    marginTop: 12
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingVertical: theme.spacing.settingsRowPaddingY
  },
  actionLabel: {
    ...theme.typography.body,
    color: theme.colors.appleBlack
  },
  actionChevron: {
    ...theme.typography.body,
    color: theme.colors.appleBlack
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.settingsPaddingX
  },
  modalCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 16
  },
  modalTitle: {
    ...theme.typography.h3,
    color: theme.colors.appleBlack,
    marginBottom: 12
  },
  modalBody: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: 12
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.separator,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...theme.typography.body,
    color: theme.colors.appleBlack
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.separator
  },
  modalBtnPrimary: {
    backgroundColor: theme.colors.lime,
    borderColor: theme.colors.lime
  },
  modalBtnDisabled: {
    opacity: 0.5
  },
  modalBtnText: {
    ...theme.typography.body,
    color: theme.colors.appleBlack
  },
  modalBtnTextPrimary: {
    ...theme.typography.body,
    color: theme.colors.appleBlack,
    fontFamily: theme.fontFamily.semiBold
  },
  pickerRow: {
    paddingVertical: 12
  },
  pickerRowText: {
    ...theme.typography.body,
    color: theme.colors.appleBlack
  },
  deleteBtn: {
    backgroundColor: theme.colors.danger,
    borderColor: theme.colors.danger
  },
  deleteBtnText: {
    ...theme.typography.body,
    color: theme.colors.googleWhite,
    fontFamily: theme.fontFamily.semiBold
  }
});

