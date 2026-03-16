import React, { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { AppIcon } from '../../components/ui/AppIcon';
import { theme } from '../../lib/theme';
import { useFeedFiltersStore } from '../../lib/store/feedFilters';
import { getPriceBounds } from '../../lib/api';

type PriceOption = {
  label: string;
  min?: number;
  max?: number;
};

const PRICE_OPTIONS: PriceOption[] = [
  { label: 'Less than 50CHF', max: 50 },
  { label: '50CHF - 100CHF', min: 50, max: 100 },
  { label: '+ 100CHF', min: 100 }
];

export default function PriceFilterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { filters, setFilters } = useFeedFiltersStore();
  const [min, setMin] = useState<string>(
    filters.priceMin !== undefined ? String(filters.priceMin) : ''
  );
  const [max, setMax] = useState<string>(
    filters.priceMax !== undefined ? String(filters.priceMax) : ''
  );
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [minPlaceholder, setMinPlaceholder] = useState<string>('0.00');
  const [maxPlaceholder, setMaxPlaceholder] = useState<string>('0.00');
  const [loadingBounds, setLoadingBounds] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isToFocused, setIsToFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const applyOption = (option: PriceOption) => {
    setSelectedOption(option.label);
    setMin(option.min !== undefined ? String(option.min) : '');
    setMax(option.max !== undefined ? String(option.max) : '');
    Keyboard.dismiss();
  };

  const handleClearAll = () => {
    setMin('');
    setMax('');
    setSelectedOption(null);
  };

  const handleShowResult = () => {
    const parsedMin = min.trim().length > 0 ? Number(min) : undefined;
    const parsedMax = max.trim().length > 0 ? Number(max) : undefined;

    const priceMin = Number.isFinite(parsedMin || NaN) ? parsedMin : undefined;
    const priceMax = Number.isFinite(parsedMax || NaN) ? parsedMax : undefined;

    setFilters({
      priceMin,
      priceMax,
      priceRange:
        priceMin !== undefined || priceMax !== undefined
          ? { min: priceMin, max: priceMax }
          : undefined
    });

    router.back();
  };

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const loadBounds = async () => {
      try {
        setLoadingBounds(true);
        setError(null);
        const { min: minPrice, max: maxPrice, error: boundsError } = await getPriceBounds(filters);
        if (boundsError) {
          setError(boundsError.message);
          return;
        }
        if (minPrice !== null) {
          setMinPlaceholder(minPrice.toFixed(2));
        }
        if (maxPrice !== null) {
          setMaxPlaceholder(maxPrice.toFixed(2));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load price range.');
      } finally {
        setLoadingBounds(false);
      }
    };

    void loadBounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category, filters.conditions]);

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleShowResult}
            activeOpacity={0.7}
          >
            <AppIcon name="arrowLeftOutline" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="body" style={styles.headerTitle}>
            Price
          </Text>
          <TouchableOpacity activeOpacity={0.7} onPress={handleClearAll}>
            <Text variant="body" style={styles.clearAllText}>
              Clear all
            </Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text variant="captionSm" color="textSecondary" style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}

          <View style={styles.content}>
            {/* Champ 1 : Price from */}
            <View style={styles.inputContainer}>
              <Text variant="captionSm" style={styles.inputLabel}>
                Price from
              </Text>
              {loadingBounds ? (
                <View style={styles.skeletonInputRow}>
                  <View style={styles.skeletonInput} />
                </View>
              ) : (
                <View style={styles.inputRow}>
                  <TextInput
                    keyboardType="numeric"
                    placeholder={`${minPlaceholder} CHF`}
                    placeholderTextColor="#AAAAAA"
                    style={styles.input}
                    value={min}
                    onFocus={() => {
                      setSelectedOption(null);
                    }}
                    onChangeText={(value) => {
                      setSelectedOption(null);
                      setMin(value);
                    }}
                  />
                </View>
              )}
              <View style={styles.inputUnderline} />
            </View>

            {/* Gap de 20px + Champ 2 : To */}
            <View style={[styles.inputContainer, styles.secondInputContainer]}>
              <Text variant="captionSm" style={styles.inputLabel}>
                To
              </Text>
              {loadingBounds ? (
                <View style={styles.skeletonInputRow}>
                  <View style={styles.skeletonInput} />
                </View>
              ) : (
                <View style={styles.inputRow}>
                  <TextInput
                    keyboardType="numeric"
                    placeholder={`${maxPlaceholder} CHF`}
                    placeholderTextColor="#AAAAAA"
                    style={styles.input}
                    value={max}
                    onFocus={() => {
                      setIsToFocused(true);
                      setSelectedOption(null);
                    }}
                    onBlur={() => setIsToFocused(false)}
                    onChangeText={(value) => {
                      setSelectedOption(null);
                      setMax(value);
                    }}
                  />
                </View>
              )}
              <View
                style={[
                  styles.inputUnderline,
                  isToFocused && styles.inputUnderlineActive
                ]}
              />
            </View>
          
          <View style={styles.presetsContainer}>
            <View style={styles.presetsSeparator} />
            {PRICE_OPTIONS.map((option) => {
              const checked = selectedOption === option.label;
              return (
                <TouchableOpacity
                  key={option.label}
                  style={styles.presetRow}
                  activeOpacity={0.7}
                  onPress={() => applyOption(option)}
                >
                  <Text variant="body" style={styles.presetLabel}>
                    {option.label}
                  </Text>
                  <View
                    style={[
                      styles.checkbox,
                      checked && styles.checkboxChecked
                    ]}
                  >
                    {checked && <Text style={styles.checkboxCheckmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.footer,
            { paddingBottom: (keyboardVisible ? 0 : 24) + insets.bottom }
          ]}
        >
          <Button
            title="Show result"
            onPress={handleShowResult}
            variant="primary"
            style={styles.showResultButton}
            textStyle={styles.showResultText}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#FFFFFF'
  },
  backButton: {
    padding: 4
  },
  headerTitle: {
    ...theme.typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  clearAllText: {
    ...theme.typography.body,
    fontSize: 16,
    color: theme.colors.textPrimary
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  errorText: {
    marginBottom: 4
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16
  },
  inputsColumn: {
    marginBottom: 16
  },
  inputContainer: {
    flex: 1
  },
  secondInputContainer: {
    marginTop: 16
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#000000',
    marginBottom: 6
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: 8
  },
  input: {
    flex: 1,
    ...theme.typography.body,
    fontSize: 16,
    color: '#000000',
    backgroundColor: 'transparent',
    paddingVertical: 4,
    paddingHorizontal: 0
  },
  inputUnderline: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginTop: 4
  },
  inputUnderlineActive: {
    backgroundColor: '#C3EA4F'
  },
  presetsContainer: {
    marginTop: 24
  },
  presetsSeparator: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginBottom: 4
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: -20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  presetLabel: {
    ...theme.typography.body,
    fontSize: 16,
    color: theme.colors.textPrimary
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: {
    borderColor: '#C3EA4F',
    backgroundColor: '#C3EA4F'
  },
  checkboxCheckmark: {
    fontSize: 14,
    color: '#FFFFFF'
  },
  footer: {
    paddingHorizontal: 16
  },
  showResultButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#C3EA4F'
  },
  showResultText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.appleBlack
  },
  skeletonInputRow: {
    height: 24,
    justifyContent: 'center'
  },
  skeletonInput: {
    width: 120,
    height: 16,
    borderRadius: 4,
    backgroundColor: '#E5E5E5'
  }
});

