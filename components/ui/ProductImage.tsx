import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ProductImageProps = {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
};

export function ProductImage({ uri, style }: ProductImageProps) {
  const [loading, setLoading] = useState(Boolean(uri));
  const [hasError, setHasError] = useState(false);
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    setHasError(false);
    setLoading(Boolean(uri));
  }, [uri]);

  useEffect(() => {
    if (!loading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [loading, pulse]);

  const showFallback = useMemo(() => !uri || hasError, [uri, hasError]);

  return (
    <View style={[styles.container, style]}>
      {!showFallback ? (
        <Image
          source={{ uri }}
          style={[styles.image, loading && styles.hiddenImage]}
          resizeMode="contain"
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setHasError(true);
            setLoading(false);
          }}
        />
      ) : (
        <View style={styles.fallback}>
          <Ionicons name="image-outline" size={26} color="#A3A3A3" />
        </View>
      )}

      {loading && !showFallback ? (
        <Animated.View style={[styles.skeleton, { opacity: pulse }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5'
  },
  hiddenImage: {
    opacity: 0
  },
  skeleton: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#D9D9D9'
  },
  fallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5'
  }
});

