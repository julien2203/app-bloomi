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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { normalizePhoneToE164 } from '../../lib/phone';

export default function SignInScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = async () => {
    setIsSubmitting(true);
    setError(null);

    const result = normalizePhoneToE164(phone);

    if (!result.ok) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        phone: result.value
      });
      if (signInError) {
        setError(signInError.message);
        setIsSubmitting(false);
        return;
      }

      router.push({
        pathname: '/(auth)/verify',
        params: { phone: result.value, country: result.country }
      });
    } catch (e) {
      setError('Une erreur est survenue lors de l’envoi du code.');
      setIsSubmitting(false);
    }
  };

  const isPhoneEmpty = !phone.trim();

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
          <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
            Bienvenue sur Bloomi
          </Text>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 32 }}>
            Connectez-vous pour accéder au marketplace.
          </Text>

          <View style={{ gap: 16 }}>
            <View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  marginBottom: 4
                }}
              >
                Téléphone
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+41 79 123 45 67"
                autoCapitalize="none"
                keyboardType="phone-pad"
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10
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
            onPress={handleSendCode}
            disabled={isSubmitting || isPhoneEmpty}
            style={{
              marginTop: 32,
              backgroundColor: isSubmitting || isPhoneEmpty ? '#ccc' : '#111827',
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
              Recevoir le code
            </Text>
          </TouchableOpacity>

          <View style={{ marginTop: 24 }}>
            <Text
              style={{
                fontSize: 12,
                color: '#9ca3af'
              }}
            >
              Nous envoyons un SMS de vérification à votre numéro (CH/FR/DE/IT uniquement)
              pour sécuriser votre accès à Bloomi.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

