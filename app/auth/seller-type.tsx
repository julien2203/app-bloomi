import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { AppIcon } from '../../components/ui/AppIcon';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

type SellerType = 'individual' | 'pro';

export default function SellerTypeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';

  const [sellerType, setSellerType] = useState<SellerType | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [ideNumber, setIdeNumber] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companySocial, setCompanySocial] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPro = sellerType === 'pro';

  const validateProFields = () => {
    if (!companyName.trim() || !ideNumber.trim() || !companyAddress.trim()) {
      setError('Merci de remplir tous les champs obligatoires.');
      return false;
    }
    // Validation simple du format IDE (CHE-XXX.XXX.XXX)
    const ideRegex = /^CHE-\d{3}\.\d{3}\.\d{3}$/;
    if (!ideRegex.test(ideNumber.trim())) {
      setError('Le numéro IDE doit être au format CHE-XXX.XXX.XXX.');
      return false;
    }
    return true;
  };

  const goToVerifyEmail = () => {
    router.replace({
      pathname: '/auth/verify-email',
      params: email ? { email } : {}
    });
  };

  const handleContinue = async () => {
    if (!sellerType) return;

    if (!isPro) {
      goToVerifyEmail();
      return;
    }

    if (!validateProFields()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user) {
        setError("Impossible de récupérer votre compte. Merci de réessayer.");
        return;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          company_name: companyName.trim(),
          ide_number: ideNumber.trim(),
          company_address: companyAddress.trim(),
          company_social: companySocial.trim() || null
        })
        .eq('id', data.user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      goToVerifyEmail();
    } finally {
      setLoading(false);
    }
  };

  const canContinue =
    !!sellerType &&
    (!isPro ||
      (companyName.trim().length > 0 &&
        ideNumber.trim().length > 0 &&
        companyAddress.trim().length > 0));

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.iconTouch}
          >
            <AppIcon name="arrowLeftOutline" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sign up</Text>
          <View style={{ width: 20 }} />
        </View>
        <View style={styles.headerSeparator} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              <Text style={styles.sectionTitle}>Are you selling as</Text>

              <View style={styles.pillsRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.pill,
                    sellerType === 'individual' ? styles.pillActive : styles.pillInactive
                  ]}
                  onPress={() => setSellerType('individual')}
                >
                  <Text style={styles.pillText}>Individual</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.pill,
                    sellerType === 'pro' ? styles.pillActive : styles.pillInactive
                  ]}
                  onPress={() => setSellerType('pro')}
                >
                  <Text style={styles.pillText}>Professional</Text>
                </TouchableOpacity>
              </View>

              {isPro && (
                <View style={styles.proForm}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Company name</Text>
                    <View style={styles.fieldInputWrapper}>
                      <TextInput
                        style={styles.fieldInput}
                        value={companyName}
                        onChangeText={setCompanyName}
                        placeholder=""
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>IDE number (CHE-XXX.XXX.XXX)</Text>
                    <View style={styles.fieldInputWrapper}>
                      <TextInput
                        style={styles.fieldInput}
                        value={ideNumber}
                        onChangeText={setIdeNumber}
                        autoCapitalize="characters"
                        placeholder="CHE-123.456.789"
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Business address</Text>
                    <View style={styles.fieldInputWrapper}>
                      <TextInput
                        style={styles.fieldInput}
                        value={companyAddress}
                        onChangeText={setCompanyAddress}
                        placeholder=""
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Website or Instagram (optional)</Text>
                    <View style={styles.fieldInputWrapper}>
                      <TextInput
                        style={styles.fieldInput}
                        value={companySocial}
                        onChangeText={setCompanySocial}
                        placeholder="https:// or @username"
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                    </View>
                  </View>
                </View>
              )}

              {error ? (
                <Text style={styles.errorText}>
                  {error}
                </Text>
              ) : null}

              <Button
                title="Continuer"
                onPress={handleContinue}
                variant="primary-green"
                disabled={!canContinue || loading}
                loading={loading}
                style={[
                  styles.continueButton,
                  (!canContinue || loading) && styles.continueButtonDisabled
                ]}
                textStyle={styles.continueButtonText}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12
  },
  headerTitle: {
    ...theme.typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  iconTouch: {
    padding: 8
  },
  headerSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5'
  },
  keyboardView: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24
  },
  content: {
    flex: 1,
    paddingTop: 24,
    paddingHorizontal: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 16
  },
  pillsRow: {
    flexDirection: 'row',
    columnGap: 12,
    marginBottom: 24
  },
  pill: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pillInactive: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    backgroundColor: '#FFFFFF'
  },
  pillActive: {
    borderWidth: 1,
    borderColor: '#C3EA4F',
    backgroundColor: '#C3EA4F26'
  },
  pillText: {
    fontSize: 15,
    color: theme.colors.textPrimary
  },
  proForm: {
    marginTop: 8
  },
  fieldGroup: {
    marginBottom: 20
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: theme.colors.textPrimary,
    marginBottom: 4
  },
  fieldInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
    paddingVertical: 4
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    paddingVertical: 4
  },
  errorText: {
    ...theme.typography.body,
    color: '#EF4444',
    marginTop: 8,
    marginBottom: 8
  },
  continueButton: {
    marginTop: 8,
    marginBottom: 24,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#CCFF00'
  },
  continueButtonDisabled: {
    backgroundColor: '#E5E5E5',
    opacity: 0.5
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.appleBlack
  }
});

