import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../stores/authStore';
import { getProfileForUser, type Profile } from '../../../lib/profile';

export default function ProfileScreen() {
  const { user, signOut, isLoading } = useAuthStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      return;
    }

    let isCancelled = false;

    const load = async () => {
      setIsProfileLoading(true);
      const data = await getProfileForUser(user.id);
      if (!isCancelled) {
        setProfile(data);
        setIsProfileLoading(false);
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 8 }}>
          Profil
        </Text>
        <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
          Vue d&apos;ensemble de votre compte Bloomi.
        </Text>

        <View
          style={{
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            marginBottom: 24
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
            Utilisateur connecté
          </Text>
          {isProfileLoading ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginTop: 4
              }}
            >
              <ActivityIndicator size="small" />
              <Text style={{ fontSize: 13, color: '#6b7280' }}>
                Chargement du profil...
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 4 }}>
              <Text style={{ fontSize: 13, color: '#6b7280' }}>
                Téléphone :{' '}
                <Text style={{ fontWeight: '600', color: '#111827' }}>
                  {profile?.phone ?? user?.phone ?? 'Non disponible'}
                </Text>
              </Text>
              <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                Pays :{' '}
                <Text style={{ fontWeight: '600', color: '#111827' }}>
                  {profile?.country ?? 'Non défini'}
                </Text>
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          disabled={isLoading}
          onPress={signOut}
          style={{
            backgroundColor: '#111827',
            borderRadius: 999,
            paddingVertical: 14,
            alignItems: 'center'
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontWeight: '600',
              fontSize: 15
            }}
          >
            Se déconnecter
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

