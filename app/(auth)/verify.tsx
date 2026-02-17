import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { DEV_OTP_MODE, DEV_TEST_CODE } from '../../lib/env';
import { isDevTestCode, verifyDevTestCode } from '../../lib/auth';

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const router = useRouter();

  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!phone || typeof phone !== 'string') {
      setError('Numéro de téléphone introuvable. Merci de recommencer la connexion.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Vérifier si c'est le code de test en mode développement
      if (isDevTestCode(code)) {
        const result = await verifyDevTestCode(phone);
        if (!result.success) {
          setError(result.error || 'Erreur lors de l\'authentification de test');
          setIsSubmitting(false);
          return;
        }
        // La session a été créée par verifyDevTestCode
        router.replace('/(tabs)/feed');
        return;
      }

      // Code normal : vérification via Supabase
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: 'sms'
      });

      if (verifyError) {
        setError(verifyError.message);
        setIsSubmitting(false);
        return;
      }

      if (!data.session) {
        setError('Impossible de finaliser la connexion. Merci de réessayer.');
        setIsSubmitting(false);
        return;
      }

      router.replace('/(tabs)/feed');
    } catch (e) {
      setError('Une erreur est survenue lors de la vérification du code.');
      setIsSubmitting(false);
    }
  };

  const isCodeInvalid = code.trim().length !== 6 || !/^\d{6}$/.test(code.trim());

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            paddingHorizontal: 24,
            paddingTop: 48
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 8 }}>
            Entrez le code SMS
          </Text>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>
            Nous avons envoyé un code de vérification à{' '}
            <Text style={{ fontWeight: '600' }}>{phone ?? 'votre numéro'}</Text>.
          </Text>

          {DEV_OTP_MODE && (
            <View
              style={{
                backgroundColor: '#fef3c7',
                borderWidth: 1,
                borderColor: '#fbbf24',
                borderRadius: 8,
                padding: 12,
                marginBottom: 24
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#92400e', marginBottom: 4 }}>
                🧪 Mode développement activé
              </Text>
              <Text style={{ fontSize: 12, color: '#78350f' }}>
                Pour tester sans SMS, utilisez le code :{' '}
                <Text style={{ fontWeight: '700', fontFamily: 'monospace' }}>
                  {DEV_TEST_CODE}
                </Text>
              </Text>
            </View>
          )}

          <View style={{ gap: 16 }}>
            <View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  marginBottom: 4
                }}
              >
                Code à 6 chiffres
              </Text>
              <TextInput
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                keyboardType="number-pad"
                autoFocus
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  letterSpacing: 8,
                  textAlign: 'center',
                  fontSize: 20
                }}
              />
            </View>
          </View>

          {error ? (
            <Text
              style={{
                color: '#e11d48',
                marginTop: 16,
                fontSize: 13
              }}
            >
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            onPress={handleVerify}
            disabled={isSubmitting || isCodeInvalid}
            style={{
              marginTop: 32,
              backgroundColor: isSubmitting || isCodeInvalid ? '#ccc' : '#111827',
              borderRadius: 999,
              paddingVertical: 14,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8
            }}
          >
            {isSubmitting && <ActivityIndicator color="#fff" />}
            <Text
              style={{
                color: '#fff',
                fontWeight: '600',
                fontSize: 15
              }}
            >
              Valider
            </Text>
          </TouchableOpacity>

          <View style={{ marginTop: 24 }}>
            <Text
              style={{
                fontSize: 12,
                color: '#9ca3af'
              }}
            >
              Nous envoyons un SMS de vérification. Assurez-vous de pouvoir recevoir des
              SMS sur ce numéro.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

