import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

const ALLOWED_PREFIXES = ['+41', '+33', '+49', '+39'] as const;
type AllowedPrefix = (typeof ALLOWED_PREFIXES)[number];

type Step = 1 | 2;

export default function VerifyPhoneScreen() {
  const router = useRouter();

  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>(1);
  const [prefix, setPrefix] = useState<AllowedPrefix>('+41');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [formattedPhone, setFormattedPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const otpInputsRef = useRef<Array<TextInput | null>>([]);
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  const canResend = secondsLeft === 0 && !!formattedPhone;

  const formatPhoneE164 = (pfx: AllowedPrefix, local: string): string => {
    const digits = local.replace(/\D/g, '');
    const trimmed = digits.startsWith('0') ? digits.slice(1) : digits;
    return `${pfx}${trimmed}`;
  };

  const handleSendCode = async () => {
    if (!ALLOWED_PREFIXES.includes(prefix)) {
      setError('Bloomi is only available in Switzerland, France, Germany, and Italy.');
      return;
    }

    const digits = phoneLocal.replace(/\D/g, '');
    if (!digits) {
      setError('Please enter a valid phone number.');
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
    } catch {
      setError('Something went wrong sending the code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!formattedPhone) {
      setError('Phone number missing. Please go back to the previous step.');
      return;
    }

    const token = otpDigits.join('');
    if (token.length !== 6) {
      setError('Please enter all 6 digits of the code.');
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
          setError('The code has expired. Please request a new one.');
        } else if (msg.includes('invalid')) {
          setError('The code is incorrect. Please try again.');
        } else {
          setError(verifyError.message);
        }
        return;
      }

      router.replace('/tabs/feed');
    } catch {
      setError('Something went wrong verifying the code. Please try again.');
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
      setError('Something went wrong sending the code. Please try again.');
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

  const handleChangeOtpDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(0, 1);
    if (!digit && !value) {
      const updated = [...otpDigits];
      updated[index] = '';
      setOtpDigits(updated);
      return;
    }

    if (!digit) return;

    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);

    if (index < otpInputsRef.current.length - 1) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const renderStep1 = () => (
    <>
      <Text style={styles.title}>Verify your phone</Text>
      <Text style={styles.subtitle}>
        Enter your number to receive a verification code by SMS.
      </Text>

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
          <Text style={styles.phoneLabel}>Phone</Text>
          <View style={styles.phoneInputRow}>
            <Text style={styles.phonePrefixInline}>{prefix}</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder="79 123 45 67"
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
          title="Send code"
          onPress={handleSendCode}
          loading={loading}
          variant="primary"
        />
      </View>
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={styles.title}>Enter the code</Text>
      <Text style={styles.subtitle}>
        We sent a 6-digit code by SMS. Enter it below to confirm your number.
      </Text>

      <View style={styles.otpRow}>
        {otpDigits.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              otpInputsRef.current[index] = ref;
            }}
            style={styles.otpInput}
            keyboardType="number-pad"
            maxLength={1}
            value={digit}
            onChangeText={(value) => handleChangeOtpDigit(index, value)}
          />
        ))}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.primaryButtonContainer}>
        <Button
          title="Verify"
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
            Resend code
            {secondsLeft > 0 ? ` (${secondsLeft}s)` : ''}
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
          setSessionError(
            'We could not restore your session. Please sign in again.'
          );
          setSessionReady(false);
          return;
        }

        setTimeout(pollSession, 500);
      } catch {
        if (!isMounted) return;
        attempts += 1;
        if (attempts >= maxAttempts) {
          setSessionError(
            'We could not restore your session. Please sign in again.'
          );
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
          <HeaderBackButton onPress={() => router.back()} />
          <View style={{ flex: 1 }} />
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            {!sessionReady && !sessionError && (
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <ActivityIndicator size="large" color={theme.colors.textPrimary} />
              </View>
            )}

            {sessionError && (
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <Text style={styles.errorText}>{sessionError}</Text>
                <View style={styles.primaryButtonContainer}>
                  <Button
                    title="Back to sign in"
                    onPress={() => router.replace('/auth/login')}
                    variant="primary"
                  />
                </View>
              </View>
            )}

            {sessionReady && !sessionError && (step === 1 ? renderStep1() : renderStep2())}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: 32,
    paddingBottom: 32,
    justifyContent: 'flex-start'
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
    marginTop: 8
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    textAlign: 'center',
    ...theme.typography.body,
    fontSize: 20,
    color: theme.colors.textPrimary
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
  }
});

