/**
 * Onboarding Step 1
 * Logo + photo grid + headline + CTA sign up
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  type ImageSourcePropType
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

const GRID_GAP = 6;
const GRID_PADDING_H = 20;
const COL_INNER_GAP = 6;
const MIN_GRID_HEIGHT = 300;
const GRID_HEIGHT_SCALE = 1;
const CELL_BORDER_RADIUS = 15;

const PHOTO_LEFT_BOTTOM = require('../../assets/photos/photo1.png');

const GRID_COLUMNS = [
  {
    large: require('../../assets/photos/photo3.png'),
    small: require('../../assets/photos/photo4.png')
  },
  {
    large: require('../../assets/photos/photo5.png'),
    small: require('../../assets/photos/photo6.png')
  }
] as const;

type GridMetrics = {
  colWidth: number;
  gridHeight: number;
  photoSmallH: number;
  photoLargeH: number;
};

function useGridMetrics(gridHeight: number, screenWidth: number): GridMetrics {
  return useMemo(() => {
    const colWidth =
      (screenWidth - GRID_PADDING_H * 2 - GRID_GAP * 2) / 3;
    const photoSmallH = Math.round((gridHeight - COL_INNER_GAP) / 3);
    const photoLargeH = gridHeight - COL_INNER_GAP - photoSmallH;
    return { colWidth, gridHeight, photoSmallH, photoLargeH };
  }, [gridHeight, screenWidth]);
}

/** Colonne gauche : chartreuse + logo en haut, photo1 en bas (grande). */
function OnboardingLeftColumn({ metrics }: { metrics: GridMetrics }) {
  const { colWidth, gridHeight, photoSmallH, photoLargeH } = metrics;
  const cell = { borderRadius: CELL_BORDER_RADIUS, overflow: 'hidden' as const };
  const brandIconSize = Math.round(
    Math.min(colWidth - 6, photoSmallH - 6, colWidth * 0.94)
  );

  return (
    <View style={{ width: colWidth, height: gridHeight, gap: COL_INNER_GAP }}>
      <View
        style={{
          width: colWidth,
          height: photoSmallH,
          backgroundColor: '#C3EA4F',
          alignItems: 'center',
          justifyContent: 'center',
          ...cell
        }}
      >
        <Image
          source={require('../../assets/brand/logo-b.png')}
          style={{ width: brandIconSize, height: brandIconSize }}
          resizeMode="contain"
        />
      </View>
      <Image
        source={PHOTO_LEFT_BOTTOM}
        style={{ width: colWidth, height: photoLargeH, ...cell }}
        resizeMode="cover"
      />
    </View>
  );
}

function OnboardingPhotoColumn({
  metrics,
  largeSource,
  smallSource,
  largeOnBottom = false
}: {
  metrics: GridMetrics;
  largeSource: ImageSourcePropType;
  smallSource: ImageSourcePropType;
  largeOnBottom?: boolean;
}) {
  const { colWidth, gridHeight, photoSmallH, photoLargeH } = metrics;
  const cell = { borderRadius: CELL_BORDER_RADIUS, overflow: 'hidden' as const };

  const smallImage = (
    <Image
      source={smallSource}
      style={{ width: colWidth, height: photoSmallH, ...cell }}
      resizeMode="cover"
    />
  );
  const largeImage = (
    <Image
      source={largeSource}
      style={{ width: colWidth, height: photoLargeH, ...cell }}
      resizeMode="cover"
    />
  );

  return (
    <View style={{ width: colWidth, height: gridHeight, gap: COL_INNER_GAP }}>
      {largeOnBottom ? (
        <>
          {smallImage}
          {largeImage}
        </>
      ) : (
        <>
          {largeImage}
          {smallImage}
        </>
      )}
    </View>
  );
}

export default function OnboardingStep1() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const gridHeight = useMemo(
    () =>
      Math.max(
        MIN_GRID_HEIGHT,
        Math.round(screenHeight * 0.34 * GRID_HEIGHT_SCALE)
      ),
    [screenHeight]
  );
  const metrics = useGridMetrics(gridHeight, screenWidth);

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={require('../../assets/brand/logo-bloomi-full.png')}
            style={[
              styles.logo,
              { width: Math.min(screenWidth * 0.88, 320) }
            ]}
            resizeMode="contain"
          />

          <View style={[styles.photoGrid, { height: metrics.gridHeight }]}>
            <OnboardingLeftColumn metrics={metrics} />
            {GRID_COLUMNS.map((col, index) => (
              <OnboardingPhotoColumn
                key={index}
                metrics={metrics}
                largeSource={col.large}
                smallSource={col.small}
                largeOnBottom={index === 1}
              />
            ))}
          </View>

          <Text style={styles.title}>{t('onboarding.step1.title')}</Text>

          <Text style={styles.subtitle}>
            {t('onboarding.step1.subtitle')}
          </Text>

          <TouchableOpacity
            style={styles.signUpButton}
            activeOpacity={0.85}
            onPress={() => router.push('/onboarding/step-2')}
          >
            <Text style={styles.signUpButtonText}>{t('onboarding.step1.signUpCta')}</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>{t('onboarding.step1.alreadyAccount')}</Text>
            <TouchableOpacity
              onPress={() => router.push('/auth/login')}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            >
              <Text style={styles.loginLink}>{t('auth.login.submit')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.legalText}>
            {`${t('onboarding.step1.legalPrefix')} `}
            <Text style={styles.legalLink} onPress={() => {}}>
              {t('common.termsOfService')}
            </Text>{' '}
            {`${t('onboarding.step1.legalAnd')} `}
            <Text style={styles.legalLink} onPress={() => {}}>
              {t('common.privacyPolicy')}
            </Text>
          </Text>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  scroll: {
    flex: 1,
    zIndex: 0
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 16
  },
  logo: {
    marginTop: 40,
    height: 72,
    alignSelf: 'center'
  },
  photoGrid: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: GRID_GAP,
    marginTop: 24,
    paddingHorizontal: GRID_PADDING_H
  },
  footer: {
    flexShrink: 0,
    width: '100%',
    paddingTop: 12,
    paddingBottom: 4,
    gap: 12,
    zIndex: 2,
    elevation: 2,
    backgroundColor: '#FFFFFF'
  },
  loginRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 4
  },
  title: {
    marginTop: 28,
    paddingHorizontal: 24,
    textAlign: 'center',
    fontSize: 26,
    lineHeight: 32,
    fontFamily: theme.fontFamily.semiBold,
    color: '#1A1A1A'
  },
  subtitle: {
    marginTop: 12,
    paddingHorizontal: 32,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.fontFamily.regular,
    color: '#121212'
  },
  signUpButton: {
    marginTop: 28,
    alignSelf: 'stretch',
    marginHorizontal: 20,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#C3EA4F',
    alignItems: 'center',
    justifyContent: 'center'
  },
  signUpButtonText: {
    fontSize: 16,
    fontFamily: theme.fontFamily.medium,
    color: '#1A1A1A'
  },
  loginText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: theme.fontFamily.regular,
    color: '#1A1A1A',
    textAlign: 'center'
  },
  loginLink: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: theme.fontFamily.semiBold,
    color: '#1A1A1A'
  },
  legalText: {
    paddingHorizontal: 24,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: theme.fontFamily.regular,
    color: '#999999'
  },
  legalLink: {
    color: '#C3EA4F',
    fontFamily: theme.fontFamily.semiBold
  }
});
