import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardEvent,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/ui/Screen';
import { Text as UiText } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { FLOATING_TAB_BAR_BOTTOM_RESERVE, HIT_SLOP_COMFORTABLE } from '../../lib/touchTargets';
import { useFiltersScreenStore } from '../../lib/store/useFiltersScreenStore';
import { getPriceBounds } from '../../lib/api';
import { navigateAfterFilterCommit } from '../../lib/navigation/filterExit';

const LIME = '#C3EA4F';
const SEPARATOR_GRAY = '#E5E5E5';
const BORDER_GRAY = '#CCCCCC';
const HEADER_SIDE_W = 88;

type PriceOption = {
  label: string;
  min?: number;
  max?: number;
};

export default function PriceFilterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const PRICE_OPTIONS: PriceOption[] = [
    { label: t('filters.lessThan50'), max: 50 },
    { label: t('filters.range50to100'), min: 50, max: 100 },
    { label: t('filters.moreThan100'), min: 100 }
  ];

  const params = useLocalSearchParams<{
    returnTo?: string;
    resultsSection?: string;
    resultsQuery?: string;
    resultsTitle?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { filters, setFilter } = useFiltersScreenStore();
  const [min, setMin] = useState<string>(
    filters.priceMin != null ? String(filters.priceMin) : ''
  );
  const [max, setMax] = useState<string>(
    filters.priceMax != null ? String(filters.priceMax) : ''
  );
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [minPlaceholder, setMinPlaceholder] = useState<string>('0.00');
  const [maxPlaceholder, setMaxPlaceholder] = useState<string>('0.00');
  const [loadingBounds, setLoadingBounds] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isToFocused, setIsToFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

    const priceMin = Number.isFinite(parsedMin || NaN) ? (parsedMin as number) : null;
    const priceMax = Number.isFinite(parsedMax || NaN) ? (parsedMax as number) : null;
    setFilter('priceMin', priceMin);
    setFilter('priceMax', priceMax);
    navigateAfterFilterCommit(router, typeof params.returnTo === 'string' ? params.returnTo : undefined);
  };

  useEffect(() => {
    const handleShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates.height);
    };
    const handleHide = () => {
      setKeyboardHeight(0);
    };
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, handleShow);
    const hideSub = Keyboard.addListener(hideEvent, handleHide);
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
        setError(e instanceof Error ? e.message : t('filters.priceLoadError'));
      } finally {
        setLoadingBounds(false);
      }
    };

    void loadBounds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.categoryIds, filters.conditionIds, filters.brandIds, filters.sizeIds, filters.colorIds]);

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'android' ? 'height' : undefined}
        style={styles.kav}
        keyboardVerticalOffset={0}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerSide}>
              <HeaderBackButton onPress={() => router.back()} />
            </View>
            <Text style={styles.headerTitle}>{t('filters.price')}</Text>
            <View style={[styles.headerSide, styles.headerSideRight]}>
              <TouchableOpacity activeOpacity={0.7} onPress={handleClearAll} hitSlop={12}>
                <Text style={styles.clearAllText}>{t('filters.clearAll')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.headerRule} />

          {error ? (
            <View style={styles.errorContainer}>
              <UiText variant="captionSm" color="textSecondary" style={styles.errorText}>
                {error}
              </UiText>
            </View>
          ) : null}

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
            <View>
              <Text style={styles.labelFrom}>{t('filters.priceFrom')}</Text>
              <View style={styles.valuePad}>
                {loadingBounds ? (
                  <View style={styles.skeletonInputRow}>
                    <View style={styles.skeletonInput} />
                  </View>
                ) : (
                  <TextInput
                    keyboardType="decimal-pad"
                    placeholder={`${minPlaceholder}CHF`}
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
                )}
              </View>
              <View style={styles.ruleFull} />
            </View>

            <View style={styles.blockAfterFrom}>
              <Text style={styles.labelTo}>{t('filters.priceTo')}</Text>
              <View style={styles.valuePad}>
                {loadingBounds ? (
                  <View style={styles.skeletonInputRow}>
                    <View style={styles.skeletonInput} />
                  </View>
                ) : (
                  <TextInput
                    keyboardType="decimal-pad"
                    placeholder={`${maxPlaceholder}CHF`}
                    placeholderTextColor="#AAAAAA"
                    style={styles.input}
                    value={max}
                    selectionColor={LIME}
                    {...(Platform.OS === 'android' ? { cursorColor: '#000000' as const } : {})}
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
                )}
              </View>
              <View style={[styles.ruleFull, isToFocused && styles.ruleFullFocused]} />
            </View>

            <View style={styles.presetsWrap}>
              <View style={styles.ruleFull} />
              {PRICE_OPTIONS.map((option) => {
                const checked = selectedOption === option.label;
                return (
                  <TouchableOpacity
                    key={option.label}
                    style={styles.presetRow}
                    activeOpacity={0.7}
                    onPress={() => applyOption(option)}
                  >
                    <Text style={styles.presetLabel}>{option.label}</Text>
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked ? (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                paddingBottom:
                  (keyboardHeight > 0 ? keyboardHeight + 8 : 24) +
                  insets.bottom +
                  FLOATING_TAB_BAR_BOTTOM_RESERVE
              }
            ]}
          >
            <Button
            title={t('filters.showResult')}
              onPress={handleShowResult}
              variant="primary"
              style={styles.showResultButton}
              textStyle={styles.showResultText}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kav: {
    flex: 1
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 48,
    backgroundColor: '#FFFFFF'
  },
  headerSide: {
    width: HEADER_SIDE_W,
    alignItems: 'flex-start',
    justifyContent: 'center'
  },
  headerSideRight: {
    alignItems: 'flex-end'
  },
  clearAllHit: {
    minHeight: 44,
    justifyContent: 'center'
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#000000'
  },
  clearAllText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000'
  },
  headerRule: {
    height: 1,
    backgroundColor: SEPARATOR_GRAY,
    width: '100%'
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  errorText: {
    marginBottom: 4
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 16
  },
  labelFrom: {
    fontSize: 14,
    fontWeight: '400',
    color: '#000000',
    paddingHorizontal: 20,
    paddingTop: 20
  },
  labelTo: {
    fontSize: 14,
    fontWeight: '400',
    color: '#000000',
    paddingHorizontal: 20
  },
  valuePad: {
    paddingHorizontal: 20,
    paddingVertical: 8
  },
  input: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent'
  },
  ruleFull: {
    height: 1,
    backgroundColor: SEPARATOR_GRAY,
    width: '100%',
    alignSelf: 'stretch'
  },
  ruleFullFocused: {
    backgroundColor: LIME
  },
  blockAfterFrom: {
    marginTop: 16
  },
  presetsWrap: {
    marginTop: 24
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: SEPARATOR_GRAY
  },
  presetLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
    flex: 1,
    paddingRight: 12
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: BORDER_GRAY,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: {
    backgroundColor: LIME,
    borderColor: LIME
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: '#FFFFFF'
  },
  showResultButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: LIME
  },
  showResultText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000'
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
