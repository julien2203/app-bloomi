import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { goToMainApp } from '../../lib/navigation/goToMainApp';
import { useTranslation } from 'react-i18next';

const ALLOWED_PREFIXES = ['+41', '+33', '+49', '+39'] as const;
type AllowedPrefix = (typeof ALLOWED_PREFIXES)[number];

type Step = 1 | 2;

export default function VerifyPhoneScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);

  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>(1);
  const [prefix, setPrefix] = useState<AllowedPrefix>('+41');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [formattedPhone, setFormattedPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const otpAutofillRef = useRef<TextInput | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  const [abandonModalVisible, setAbandonModalVisible] = useState(false);
  const [abandonLeaving, setAbandonLeaving] = useState(false);
  const [abandonModalError, setAbandonModalError] = useState<string | null>(null);

  const canResend = secondsLeft === 0 && !!formattedPhone;

  const formatPhoneE164 = (pfx: AllowedPrefix, local: string): string => {
    const digits = local.replace(/\D/g, '');
    const trimmed = digits.startsWith('0') ? digits.slice(1) : digits;
    return `${pfx}${trimmed}`;
  };

  const handleSendCode = async () => {
    if (!ALLOWED_PREFIXES.includes(prefix)) {
      setError(t('auth.verifyPhone.regionOnly'));
      return;
    }

    const digits = phoneLocal.replace(/\D/g, '');
    if (!digits) {
      setError(t('auth.verifyPhone.validPhone'));
      return;
    }

    const phone = formatPhoneE164(prefix, phoneLocal);

    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase.auth.updateUser({
        phone
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setFormattedPhone(phone);
      setStep(2);
      setOtpDigits(Array(6).fill(''));
      setSecondsLeft(60);
      setTimeout(() => otpAutofillRef.current?.focus(), 300);
    } catch {
      setError(t('auth.verifyPhone.sendCodeError'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!formattedPhone) {
      setError(t('auth.verifyPhone.phoneMissing'));
      return;
    }

    const token = otpDigits.join('');
    if (token.length !== 6) {
      setError(t('auth.verifyPhone.enterAllDigits'));
      return;
    }

    try {
      setVerifying(true);
      setError(null);

      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token,
        type: 'phone_change'
      });

      if (verifyError) {
        const msg = verifyError.message.toLowerCase();
        if (msg.includes('expired')) {
          setError(t('auth.verifyPhone.codeExpired'));
        } else if (msg.includes('invalid')) {
          setError(t('auth.verifyPhone.codeIncorrect'));
        } else {
          setError(verifyError.message);
        }
        return;
      }

      await goToMainApp({ phone: formattedPhone });
    } catch {
      setError(t('auth.verifyPhone.verifyCodeError'));
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!formattedPhone || !canResend) return;

    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase.auth.updateUser({
        phone: formattedPhone
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSecondsLeft(60);
    } catch {
      setError(t('auth.verifyPhone.sendCodeError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const handleHeaderBack = () => {
    if (step === 2) {
      setStep(1);
      setOtpDigits(Array(6).fill(''));
      setError(null);
      return;
    }
    setAbandonModalError(null);
    setAbandonModalVisible(true);
  };

  /** Quitter = déconnexion seule. Ne jamais supprimer le compte ici (vendeurs / comptes existants). */
  const handleConfirmAbandonVerification = async () => {
    if (abandonLeaving) return;
    setAbandonLeaving(true);
    setAbandonModalError(null);
    try {
      setAbandonModalVisible(false);
      await signOut();
      router.replace('/auth/login');
    } catch {
      setAbandonModalError(t('auth.verifyPhone.signOutError'));
    } finally {
      setAbandonLeaving(false);
    }
  };

  const applyOtpCode = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setOtpDigits(Array.from({ length: 6 }, (_, i) => digits[i] ?? ''));
  };

  const handleAutofillOtp = (value: string) => {
    applyOtpCode(value);
  };

  const renderStep1 = () => (
    <>
      <Text style={styles.title}>{t('auth.verifyPhone.titleStep1')}</Text>
      <Text style={styles.subtitle}>{t('auth.verifyPhone.subtitleStep1')}</Text>

      <View style={styles.phoneRow}>
        <View style={styles.prefixContainer}>
          {ALLOWED_PREFIXES.map((pfx) => {
            const selected = prefix === pfx;
            return (
              <TouchableOpacity
                key={pfx}
                style={[styles.prefixChip, selected && styles.prefixChipSelected]}
                activeOpacity={0.7}
                onPress={() => setPrefix(pfx)}
              >
                <Text style={[styles.prefixText, selected && styles.prefixTextSelected]}>
                  {pfx}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.phoneInputContainer}>
          <Text style={styles.phoneLabel}>{t('auth.verifyPhone.phoneLabel')}</Text>
          <View style={styles.phoneInputRow}>
            <Text style={styles.phonePrefixInline}>{prefix}</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder={t('auth.verifyPhone.phonePlaceholder')}
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="phone-pad"
              value={phoneLocal}
              onChangeText={setPhoneLocal}
              underlineColorAndroid="transparent"
            />
          </View>
        </View>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.primaryButtonContainer}>
        <Button
          title={t('auth.verifyPhone.sendCode')}
          onPress={handleSendCode}
          loading={loading}
          variant="primary"
        />
      </View>
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={styles.title}>{t('auth.verifyPhone.titleStep2')}</Text>
      <Text style={styles.subtitle}>{t('auth.verifyPhone.subtitleStep2')}</Text>

      <View style={styles.otpRow}>
        <TextInput
          ref={otpAutofillRef}
          value={otpDigits.join('')}
          onChangeText={handleAutofillOtp}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          importantForAutofill="yes"
          maxLength={6}
          autoFocus
          caretHidden
          style={styles.otpAutofillInput}
        />
        {otpDigits.map((digit, index) => (
          <Pressable
            key={index}
            style={styles.otpCell}
            onPress={() => otpAutofillRef.current?.focus()}
          >
            <Text style={styles.otpCellText}>{digit || ' '}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.primaryButtonContainer}>
        <Button
          title={t('auth.verifyPhone.verify')}
          onPress={handleVerifyCode}
          loading={verifying}
          variant="primary"
        />
      </View>

      <View style={styles.resendContainer}>
        <TouchableOpacity
          onPress={handleResend}
          disabled={!canResend || loading}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.resendText,
              (!canResend || loading) && styles.resendTextDisabled
            ]}
          >
            {t('auth.verifyPhone.resendCode')}
            {secondsLeft > 0 ? t('auth.verifyPhone.resendSeconds', { seconds: secondsLeft }) : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // Attendre que la session Supabase soit disponible avant d'afficher le formulaire
  useEffect(() => {
    let isMounted = true;
    let attempts = 0;
    const maxAttempts = 20; // 20 * 500ms = 10s

    const pollSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (data.session) {
          setSessionReady(true);
          setSessionError(null);
          return;
        }

        attempts += 1;
        if (attempts >= maxAttempts) {
          setSessionError(t('auth.verifyPhone.sessionRestoreError'));
          setSessionReady(false);
          return;
        }

        setTimeout(pollSession, 500);
      } catch {
        if (!isMounted) return;
        attempts += 1;
        if (attempts >= maxAttempts) {
          setSessionError(t('auth.verifyPhone.sessionRestoreError'));
          setSessionReady(false);
          return;
        }
        setTimeout(pollSession, 500);
      }
    };

    pollSession();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={handleHeaderBack} />
          <View style={{ flex: 1 }} />
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              {!sessionReady && !sessionError && (
                <View style={styles.centeredBlock}>
                  <ActivityIndicator size="large" color={theme.colors.textPrimary} />
                </View>
              )}

              {sessionError && (
                <View style={styles.centeredBlock}>
                  <Text style={styles.errorText}>{sessionError}</Text>
                  <View style={styles.primaryButtonContainer}>
                    <Button
                      title={t('auth.verifyPhone.backToSignIn')}
                      onPress={() => router.replace('/auth/login')}
                      variant="primary"
                    />
                  </View>
                </View>
              )}

              {sessionReady && !sessionError && (step === 1 ? renderStep1() : renderStep2())}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={abandonModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!abandonLeaving) setAbandonModalVisible(false);
        }}
      >
        <Pressable
          style={styles.abandonOverlay}
          onPress={() => {
            if (!abandonLeaving) setAbandonModalVisible(false);
          }}
        >
          <Pressable style={styles.abandonCard} onPress={() => null}>
            <Text style={styles.abandonTitle}>{t('auth.verifyPhone.abandonTitle')}</Text>
            <Text style={styles.abandonMessage}>{t('auth.verifyPhone.abandonMessage')}</Text>
            {abandonModalError ? (
              <Text style={styles.abandonError}>{abandonModalError}</Text>
            ) : null}
            <View style={styles.abandonSeparator} />
            <View style={styles.abandonActionsRow}>
              <Pressable
                onPress={() => {
                  if (!abandonLeaving) setAbandonModalVisible(false);
                }}
                style={({ pressed }) => [
                  styles.abandonCancelBtn,
                  pressed && !abandonLeaving && styles.abandonBtnPressed
                ]}
                disabled={abandonLeaving}
              >
                <Text style={styles.abandonCancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleConfirmAbandonVerification()}
                style={({ pressed }) => [
                  styles.abandonConfirmBtn,
                  pressed && !abandonLeaving && styles.abandonBtnPressed
                ]}
                disabled={abandonLeaving}
              >
                {abandonLeaving ? (
                  <ActivityIndicator size="small" color={theme.colors.googleWhite} />
                ) : (
                  <Text style={styles.abandonConfirmText}>{t('auth.verifyPhone.abandonConfirm')}</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  header: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  keyboardView: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: 32,
    paddingBottom: 32,
    justifyContent: 'flex-start'
  },
  centeredBlock: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    ...theme.typography.h2,
    marginBottom: 8
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: 24
  },
  phoneRow: {
    marginBottom: 24
  },
  prefixContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    columnGap: 8
  },
  prefixChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#FFFFFF'
  },
  prefixChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary
  },
  prefixText: {
    ...theme.typography.body,
    color: theme.colors.textPrimary
  },
  prefixTextSelected: {
    color: theme.colors.appleBlack,
    fontFamily: theme.fontFamily.semiBold
  },
  phoneInputContainer: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 8
  },
  phoneLabel: {
    ...theme.typography.captionSm,
    color: theme.colors.textSecondary,
    marginBottom: 4
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    minHeight: 32
  },
  phonePrefixInline: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: 0,
    marginBottom: 0,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null)
  },
  phoneInput: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    minHeight: 32,
    ...Platform.select({
      ios: {
        // UITextField centre le texte différemment du <Text> : léger décalage sans réduire la zone tactile
        marginTop: -3,
        paddingTop: 0,
        paddingBottom: 0
      },
      android: {
        textAlignVertical: 'center'
      }
    })
  },
  errorText: {
    ...theme.typography.body,
    color: '#EF4444',
    marginTop: 8
  },
  primaryButtonContainer: {
    marginTop: 24
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    position: 'relative'
  },
  otpAutofillInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02,
    color: 'transparent'
  },
  otpCell: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF'
  },
  otpCellText: {
    ...theme.typography.body,
    fontSize: 20,
    color: theme.colors.textPrimary,
    textAlign: 'center'
  },
  resendContainer: {
    marginTop: 16
  },
  resendText: {
    ...theme.typography.captionSm,
    color: theme.colors.primary
  },
  resendTextDisabled: {
    color: theme.colors.textSecondary
  },
  abandonOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  abandonCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 24
  },
  abandonTitle: {
    fontFamily: theme.fontFamily.bold,
    fontSize: 18,
    color: theme.colors.appleBlack,
    textAlign: 'center'
  },
  abandonMessage: {
    marginTop: 12,
    fontFamily: theme.fontFamily.regular,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20
  },
  abandonError: {
    marginTop: 12,
    fontFamily: theme.fontFamily.regular,
    fontSize: 14,
    color: theme.colors.danger,
    textAlign: 'center'
  },
  abandonSeparator: {
    marginTop: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border
  },
  abandonActionsRow: {
    marginTop: 16,
    flexDirection: 'row',
    columnGap: 10
  },
  abandonCancelBtn: {
    flex: 1,
    backgroundColor: theme.colors.muted,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  abandonCancelText: {
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.appleBlack
  },
  abandonConfirmBtn: {
    flex: 1,
    backgroundColor: theme.colors.danger,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  abandonConfirmText: {
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.googleWhite
  },
  abandonBtnPressed: {
    opacity: 0.85
  }
});

