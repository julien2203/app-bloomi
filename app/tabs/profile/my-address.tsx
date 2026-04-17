import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { SUPABASE_URL } from '../../../lib/env';
import { theme } from '../../../lib/theme';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { useAuthStore } from '../../../stores/authStore';

const PROFILE_COUNTRY_CH = 'CH';

type AddressSuggestion = {
  id: string;
  label: string;
  street: string;
  postal_code: string;
  city: string;
};

const POST_AUTOCOMPLETE_URL = 'https://api.post.ch/api/address/v1/autocomplete';
const DCAPI_STREETS = 'https://dcapi.apis.post.ch/address/v1/streets';
const DCAPI_ZIPS = 'https://dcapi.apis.post.ch/address/v1/zips';

function normalizeFromAutocompletePayload(json: unknown): AddressSuggestion[] {
  if (json == null) return [];
  const root = json as Record<string, unknown>;
  const candidates =
    (Array.isArray(root) ? root : null) ??
    (Array.isArray(root.suggestions) ? root.suggestions : null) ??
    (Array.isArray(root.results) ? root.results : null) ??
    (Array.isArray(root.items) ? root.items : null) ??
    (Array.isArray(root.predictions) ? root.predictions : null) ??
    (Array.isArray(root.data) ? root.data : null);

  if (!Array.isArray(candidates)) return [];

  const out: AddressSuggestion[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    if (typeof row === 'string') {
      out.push({
        id: `s-${i}`,
        label: row,
        street: row,
        postal_code: '',
        city: ''
      });
      continue;
    }
    if (row && typeof row === 'object') {
      const o = row as Record<string, unknown>;
      const street =
        String(o.street ?? o.streetName ?? o.streetname ?? o.line1 ?? o.text ?? o.label ?? '').trim();
      const postal_code = String(
        o.zip ?? o.postalCode ?? o.postal_code ?? o.postCode ?? ''
      ).trim();
      const city = String(o.city ?? o.town ?? o.city18 ?? o.city27 ?? o.locality ?? '').trim();
      const label =
        String(o.label ?? o.displayText ?? o.formatted ?? o.formattedAddress ?? '').trim() ||
        [street, postal_code, city].filter(Boolean).join(', ');
      if (!label && !street) continue;
      out.push({
        id: `o-${i}`,
        label: label || street,
        street: street || label,
        postal_code,
        city
      });
    }
  }
  return out;
}

export default function MyAddressScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [street, setStreet] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');

  const [postToken, setPostToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPostToken = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setPostToken(null);
      setTokenLoading(false);
      return;
    }
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-post-token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      const json = (await res.json()) as { access_token?: string; error?: string; details?: unknown };
      if (!res.ok || !json.access_token) {
        throw new Error(
          typeof json.error === 'string' ? json.error : 'Swiss Post token unavailable'
        );
      }
      setPostToken(json.access_token);
    } catch (e) {
      setPostToken(null);
      Alert.alert(
        'Address lookup',
        e instanceof Error ? e.message : 'Unable to reach Swiss Post at the moment.'
      );
    } finally {
      setTokenLoading(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('street, postal_code, city, country')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setStreet(String((data as any).street ?? ''));
        setPostalCode(String((data as any).postal_code ?? ''));
        setCity(String((data as any).city ?? ''));
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unable to load your address.');
    } finally {
      setLoadingProfile(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchPostToken();
    void loadProfile();
  }, [fetchPostToken, loadProfile]);

  const fetchCityForZip = useCallback(async (zip: string, bearer: string): Promise<string> => {
    const z = zip.trim();
    if (!/^\d{4}$/.test(z)) return '';
    try {
      const r = await fetch(
        `${DCAPI_ZIPS}?zipCity=${encodeURIComponent(z)}&type=DOMICILE`,
        {
          headers: {
            Authorization: `Bearer ${bearer}`,
            Accept: 'application/json'
          }
        }
      );
      const raw = await r.text();
      let j: { zips?: Array<{ city18?: string; city27?: string }> };
      try {
        j = raw ? (JSON.parse(raw) as typeof j) : { zips: [] };
      } catch {
        return '';
      }
      const first = j.zips?.[0];
      return String(first?.city18 ?? first?.city27 ?? '').trim();
    } catch {
      return '';
    }
  }, []);

  const fetchStreetSuggestionsDcapi = useCallback(
    async (query: string, zipHint: string, bearer: string): Promise<AddressSuggestion[]> => {
      const q = query.trim();
      const zip = zipHint.trim();
      const url =
        zip.length >= 4
          ? `${DCAPI_STREETS}?name=${encodeURIComponent(q)}&zip=${encodeURIComponent(zip)}`
          : `${DCAPI_STREETS}?name=${encodeURIComponent(q)}`;
      const r = await fetch(url, {
        headers: {
          Authorization: `Bearer ${bearer}`,
          Accept: 'application/json'
        }
      });
      const raw = await r.text();
      let j: { streets?: string[] };
      try {
        j = raw ? (JSON.parse(raw) as typeof j) : { streets: [] };
      } catch {
        return [];
      }
      const streets = j.streets ?? [];
      const pc = zip.length >= 4 ? zip : '';
      const cy = pc ? await fetchCityForZip(pc, bearer) : '';
      const out: AddressSuggestion[] = [];
      for (let i = 0; i < streets.length; i++) {
        const s = streets[i];
        out.push({
          id: `dc-${i}-${s}`,
          label: pc ? `${s}, ${pc} ${cy}`.trim() : s,
          street: s,
          postal_code: pc,
          city: cy
        });
      }
      return out;
    },
    [fetchCityForZip]
  );

  const runAutocomplete = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!postToken || q.length < 3) {
        setSuggestions([]);
        return;
      }
      setSuggestionsLoading(true);
      try {
        const primaryUrl = `${POST_AUTOCOMPLETE_URL}?query=${encodeURIComponent(q)}`;
        const r1 = await fetch(primaryUrl, {
          headers: {
            Authorization: `Bearer ${postToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json'
          }
        });
        const raw1 = await r1.text();
        let parsed: unknown = null;
        try {
          parsed = raw1 ? JSON.parse(raw1) : null;
        } catch {
          parsed = null;
        }
        let list = normalizeFromAutocompletePayload(parsed);
        if (!list.length) {
          list = await fetchStreetSuggestionsDcapi(q, postalCode, postToken);
        }
        setSuggestions(list);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    },
    [fetchStreetSuggestionsDcapi, postToken, postalCode]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!postToken || street.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runAutocomplete(street);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [street, postToken, runAutocomplete]);

  const onSelectSuggestion = useCallback((s: AddressSuggestion) => {
    setStreet(s.street);
    if (s.postal_code) setPostalCode(s.postal_code);
    if (s.city) setCity(s.city);
    setSuggestions([]);
  }, []);

  const save = useCallback(async () => {
    if (!user?.id || saving) return;
    const st = street.trim();
    const pc = postalCode.trim();
    const ct = city.trim();
    if (!st || !pc || !ct) {
      Alert.alert('Incomplete address', 'Please fill in street, postal code, and city.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          street: st,
          postal_code: pc,
          city: ct,
          country: PROFILE_COUNTRY_CH
        })
        .eq('id', user.id);
      if (error) throw error;
      Alert.alert('Saved', 'Your address has been updated.');
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unable to save.');
    } finally {
      setSaving(false);
    }
  }, [city, postalCode, router, saving, street, user?.id]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="body" style={styles.headerTitle}>
            My address
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
        <View style={styles.separator} />

        {loadingProfile ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {tokenLoading ? (
              <Text variant="captionSm" color="textSecondary" style={styles.hint}>
                Connecting to Swiss Post…
              </Text>
            ) : postToken ? null : (
              <Text variant="captionSm" color="danger" style={styles.hint}>
                Swiss Post address lookup is unavailable. You can still enter your address
                manually.
              </Text>
            )}

            <Text variant="captionSm" color="textSecondary" style={styles.fieldLabel}>
              Street (with number)
            </Text>
            <View style={styles.streetBlock}>
              <TextInput
                style={styles.input}
                placeholder="e.g. Rhône street 10"
                placeholderTextColor={theme.colors.textSecondary}
                value={street}
                onChangeText={setStreet}
                autoCapitalize="sentences"
              />
              {suggestionsLoading ? (
                <View style={styles.suggestionsLoading}>
                  <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                </View>
              ) : null}
              {suggestions.length > 0 ? (
                <View style={styles.suggestionsBox}>
                  {suggestions.map((s) => (
                    <Pressable
                      key={s.id}
                      style={({ pressed }) => [
                        styles.suggestionRow,
                        pressed && styles.suggestionRowPressed
                      ]}
                      onPress={() => onSelectSuggestion(s)}
                    >
                      <Text variant="caption" style={styles.suggestionText}>
                        {s.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <Text variant="captionSm" color="textSecondary" style={styles.fieldLabel}>
              Postal code
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Ex. 1200"
              placeholderTextColor={theme.colors.textSecondary}
              value={postalCode}
              onChangeText={setPostalCode}
              keyboardType="numbers-and-punctuation"
            />

            <Text variant="captionSm" color="textSecondary" style={styles.fieldLabel}>
              City
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Geneva"
              placeholderTextColor={theme.colors.textSecondary}
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
            />

            <Text variant="captionSm" color="textSecondary" style={styles.fieldLabel}>
              Country
            </Text>
            <View style={styles.countryReadonly}>
              <Text variant="body" color="textSecondary">
                Switzerland — saved addresses here are limited to Switzerland.
              </Text>
            </View>

            <View style={styles.saveWrap}>
              <Button
                title={saving ? 'Saving…' : 'Save'}
                onPress={() => void save()}
                disabled={saving}
                loading={saving}
                variant="primary"
              />
            </View>
          </ScrollView>
        )}

      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
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
  headerRightPlaceholder: {
    width: theme.spacing.settingsHeaderSideWidth
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingTop: theme.spacing.gapMd,
    paddingBottom: theme.spacing.gapLg
  },
  hint: {
    marginBottom: theme.spacing.gapMd
  },
  fieldLabel: {
    marginBottom: theme.spacing.gapSm,
    marginTop: theme.spacing.gapSm
  },
  streetBlock: {
    position: 'relative',
    zIndex: 2
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: theme.spacing.gapSm,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.regular,
    fontSize: theme.typography.body.fontSize,
    backgroundColor: theme.colors.background
  },
  countryReadonly: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: theme.spacing.gapSm,
    backgroundColor: theme.colors.muted
  },
  suggestionsLoading: {
    paddingVertical: 8,
    alignItems: 'flex-start'
  },
  suggestionsBox: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.googleWhite,
    marginBottom: theme.spacing.gapSm,
    maxHeight: 220,
    ...theme.shadows.card
  },
  suggestionRow: {
    paddingHorizontal: theme.spacing.gapMd,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.separator
  },
  suggestionRowPressed: {
    backgroundColor: theme.colors.muted
  },
  suggestionText: {
    color: theme.colors.textPrimary
  },
  saveWrap: {
    marginTop: theme.spacing.gapLg
  }
});
