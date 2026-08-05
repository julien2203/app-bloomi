import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  type PanResponderGestureState,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type NativeTouchEvent
} from 'react-native';

function getTouchDistance(evt: GestureResponderEvent): number | null {
  const touches = evt.nativeEvent.touches;
  if (!touches || touches.length < 2) return null;
  const [a, b] = touches as [NativeTouchEvent, NativeTouchEvent];
  return Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY);
}

function getTouchCount(evt: GestureResponderEvent): number {
  return evt.nativeEvent.touches?.length ?? 0;
}

type ZoomableImageProps = {
  uri: string;
  width: number;
  height: number;
  maxScale?: number;
  /** Laisse le pager parent gérer les swipes horizontaux quand le zoom est à 1. */
  allowPagerSwipe?: boolean;
  /** Réinitialise le zoom quand la page n'est plus active. */
  isActive?: boolean;
  onZoomChange?: (zoomed: boolean) => void;
};

/** iOS : zoom natif ScrollView (pinch fiable). Android : pinch + pan + double-tap. */
export function ZoomableImage({
  uri,
  width,
  height,
  maxScale = 4,
  allowPagerSwipe = false,
  isActive = true,
  onZoomChange
}: ZoomableImageProps) {
  if (Platform.OS === 'ios') {
    return (
      <IosZoomableImage
        uri={uri}
        width={width}
        height={height}
        maxScale={maxScale}
        allowPagerSwipe={allowPagerSwipe}
        isActive={isActive}
        onZoomChange={onZoomChange}
      />
    );
  }

  return (
    <AndroidZoomableImage
      uri={uri}
      width={width}
      height={height}
      maxScale={maxScale}
      allowPagerSwipe={allowPagerSwipe}
      isActive={isActive}
      onZoomChange={onZoomChange}
    />
  );
}

function IosZoomableImage({
  uri,
  width,
  height,
  maxScale = 4,
  allowPagerSwipe = false,
  isActive = true,
  onZoomChange
}: ZoomableImageProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (isActive) return;
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    setZoomed(false);
    onZoomChange?.(false);
  }, [isActive, onZoomChange]);

  useEffect(() => {
    setZoomed(false);
    onZoomChange?.(false);
  }, [uri, onZoomChange]);

  const handleZoomScroll = useCallback(
    (event: { nativeEvent: { zoomScale?: number } }) => {
      if (!allowPagerSwipe) return;
      const zoomScale = event.nativeEvent.zoomScale;
      if (typeof zoomScale === 'number') {
        const nextZoomed = zoomScale > 1.01;
        setZoomed(nextZoomed);
        onZoomChange?.(nextZoomed);
      }
    },
    [allowPagerSwipe, onZoomChange]
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={{ width, height }}
      contentContainerStyle={[styles.iosZoomContent, { width, height }]}
      maximumZoomScale={maxScale}
      minimumZoomScale={1}
      centerContent
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      bouncesZoom
      pinchGestureEnabled
      scrollEnabled={!allowPagerSwipe || zoomed}
      scrollEventThrottle={16}
      onScroll={handleZoomScroll}
      onScrollEndDrag={handleZoomScroll}
      onMomentumScrollEnd={handleZoomScroll}
    >
      <Image source={{ uri }} style={{ width, height }} resizeMode="contain" />
    </ScrollView>
  );
}

function AndroidZoomableImage({
  uri,
  width,
  height,
  maxScale,
  allowPagerSwipe = false,
  isActive = true,
  onZoomChange
}: ZoomableImageProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const scaleRef = useRef(1);
  const baseScaleRef = useRef(1);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const baseTranslateXRef = useRef(0);
  const baseTranslateYRef = useRef(0);
  const panStartXRef = useRef(0);
  const panStartYRef = useRef(0);
  const currentTranslateXRef = useRef(0);
  const currentTranslateYRef = useRef(0);
  const lastTapTsRef = useRef(0);
  const tapStartRef = useRef<{ x: number; y: number } | null>(null);
  const gestureMovedRef = useRef(false);
  const pinchingRef = useRef(false);

  const notifyZoomed = useCallback(
    (zoomed: boolean) => {
      onZoomChange?.(zoomed);
    },
    [onZoomChange]
  );

  const animateTo = useCallback(
    (nextScale: number, nextX: number, nextY: number) => {
      scaleRef.current = nextScale;
      baseScaleRef.current = nextScale;
      baseTranslateXRef.current = nextX;
      baseTranslateYRef.current = nextY;
      currentTranslateXRef.current = nextX;
      currentTranslateYRef.current = nextY;
      notifyZoomed(nextScale > 1.01);
      Animated.parallel([
        Animated.spring(scale, { toValue: nextScale, useNativeDriver: true, friction: 7 }),
        Animated.spring(translateX, { toValue: nextX, useNativeDriver: true, friction: 7 }),
        Animated.spring(translateY, { toValue: nextY, useNativeDriver: true, friction: 7 })
      ]).start();
    },
    [notifyZoomed, scale, translateX, translateY]
  );

  const resetTransform = useCallback(() => {
    scaleRef.current = 1;
    baseScaleRef.current = 1;
    pinchStartDistanceRef.current = null;
    baseTranslateXRef.current = 0;
    baseTranslateYRef.current = 0;
    panStartXRef.current = 0;
    panStartYRef.current = 0;
    currentTranslateXRef.current = 0;
    currentTranslateYRef.current = 0;
    pinchingRef.current = false;
    gestureMovedRef.current = false;
    scale.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
    notifyZoomed(false);
  }, [notifyZoomed, scale, translateX, translateY]);

  useEffect(() => {
    resetTransform();
  }, [uri, resetTransform]);

  useEffect(() => {
    if (isActive || scaleRef.current <= 1.01) return;
    animateTo(1, 0, 0);
  }, [animateTo, isActive]);

  const beginPinchIfNeeded = useCallback(
    (evt: GestureResponderEvent) => {
      const distance = getTouchDistance(evt);
      if (distance == null) return false;
      // Coupe immédiatement le scroll du pager parent (FlatList Android).
      notifyZoomed(true);
      pinchingRef.current = true;
      gestureMovedRef.current = true;
      if (pinchStartDistanceRef.current == null) {
        pinchStartDistanceRef.current = distance;
        baseScaleRef.current = scaleRef.current;
      }
      return true;
    },
    [notifyZoomed]
  );

  const tryHandleDoubleTap = useCallback(() => {
    if (gestureMovedRef.current || pinchingRef.current) return;
    const now = Date.now();
    if (now - lastTapTsRef.current < 300) {
      if (scaleRef.current > 1.01) {
        animateTo(1, 0, 0);
      } else {
        animateTo(2.5, 0, 0);
      }
      lastTapTsRef.current = 0;
      return;
    }
    lastTapTsRef.current = now;
  }, [animateTo]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (evt) => {
          const touchCount = getTouchCount(evt);
          if (touchCount >= 2) return true;
          if (scaleRef.current > 1.01) return true;
          return !allowPagerSwipe;
        },
        // Critique Android : le FlatList parent capture le 1er doigt.
        // Il faut reprendre en phase capture dès le 2e doigt / zoom actif.
        onStartShouldSetPanResponderCapture: (evt) => {
          const touchCount = getTouchCount(evt);
          if (touchCount >= 2) {
            beginPinchIfNeeded(evt);
            return true;
          }
          return scaleRef.current > 1.01;
        },
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          const touchCount = getTouchCount(evt);
          if (touchCount >= 2) return true;
          if (scaleRef.current > 1.01) {
            return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
          }
          if (allowPagerSwipe) return false;
          return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
        },
        onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
          const touchCount = getTouchCount(evt);
          if (touchCount >= 2) {
            beginPinchIfNeeded(evt);
            return true;
          }
          if (scaleRef.current > 1.01) {
            return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
          }
          return false;
        },
        onPanResponderTerminationRequest: () => scaleRef.current <= 1.01 && !pinchingRef.current,
        onShouldBlockNativeResponder: (evt) => {
          return getTouchCount(evt) >= 2 || scaleRef.current > 1.01 || pinchingRef.current;
        },
        onPanResponderGrant: (evt) => {
          gestureMovedRef.current = false;
          pinchingRef.current = false;

          const touch = evt.nativeEvent.touches?.[0];
          if (touch) {
            tapStartRef.current = { x: touch.pageX, y: touch.pageY };
          }

          if (beginPinchIfNeeded(evt)) return;

          pinchStartDistanceRef.current = null;
          panStartXRef.current = baseTranslateXRef.current;
          panStartYRef.current = baseTranslateYRef.current;
        },
        onPanResponderMove: (evt, gestureState: PanResponderGestureState) => {
          const distance = getTouchDistance(evt);
          if (distance != null) {
            beginPinchIfNeeded(evt);
            if (pinchStartDistanceRef.current == null) return;
            const raw = baseScaleRef.current * (distance / pinchStartDistanceRef.current);
            const clamped = Math.max(1, Math.min(maxScale ?? 4, raw));
            scaleRef.current = clamped;
            scale.setValue(clamped);
            notifyZoomed(clamped > 1.01 || pinchingRef.current);
            return;
          }

          if (scaleRef.current <= 1.01) return;

          if (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2) {
            gestureMovedRef.current = true;
          }

          const nextX = panStartXRef.current + gestureState.dx;
          const nextY = panStartYRef.current + gestureState.dy;
          currentTranslateXRef.current = nextX;
          currentTranslateYRef.current = nextY;
          translateX.setValue(nextX);
          translateY.setValue(nextY);
        },
        onPanResponderRelease: (evt) => {
          const wasPinching = pinchingRef.current;
          pinchStartDistanceRef.current = null;
          pinchingRef.current = false;

          const touch = evt.nativeEvent.changedTouches?.[0];
          const start = tapStartRef.current;
          const isTap =
            !wasPinching &&
            !!touch &&
            !!start &&
            Math.hypot(touch.pageX - start.x, touch.pageY - start.y) <= 12;

          if (scaleRef.current <= 1.01) {
            animateTo(1, 0, 0);
            // Double-tap zoom-in quand on possède le responder (pas de pager).
            if (isTap && !allowPagerSwipe) tryHandleDoubleTap();
            return;
          }

          baseTranslateXRef.current = currentTranslateXRef.current;
          baseTranslateYRef.current = currentTranslateYRef.current;
          baseScaleRef.current = scaleRef.current;
          notifyZoomed(true);

          // Double-tap zoom-out : on possède le responder dès que zoomé.
          if (isTap) tryHandleDoubleTap();
        },
        onPanResponderTerminate: () => {
          pinchStartDistanceRef.current = null;
          pinchingRef.current = false;
          if (scaleRef.current <= 1.01) {
            notifyZoomed(false);
          }
        }
      }),
    [
      allowPagerSwipe,
      animateTo,
      beginPinchIfNeeded,
      maxScale,
      notifyZoomed,
      scale,
      translateX,
      translateY,
      tryHandleDoubleTap
    ]
  );

  const handleTouchStart = useCallback((evt: GestureResponderEvent) => {
    if (!allowPagerSwipe || scaleRef.current > 1.01) return;
    const touch = evt.nativeEvent.touches?.[0];
    if (!touch) return;
    tapStartRef.current = { x: touch.pageX, y: touch.pageY };
    gestureMovedRef.current = false;
  }, [allowPagerSwipe]);

  const handleTouchMove = useCallback(
    (evt: GestureResponderEvent) => {
      if (getTouchCount(evt) >= 2) {
        beginPinchIfNeeded(evt);
        return;
      }
      if (!allowPagerSwipe || scaleRef.current > 1.01) return;
      const touch = evt.nativeEvent.touches?.[0];
      const start = tapStartRef.current;
      if (!touch || !start) return;
      if (Math.hypot(touch.pageX - start.x, touch.pageY - start.y) > 12) {
        gestureMovedRef.current = true;
      }
    },
    [allowPagerSwipe, beginPinchIfNeeded]
  );

  const handleTouchEnd = useCallback(
    (evt: GestureResponderEvent) => {
      // Double-tap quand le pager possède le 1er doigt (Android + allowPagerSwipe).
      if (!allowPagerSwipe || scaleRef.current > 1.01) return;
      if (getTouchCount(evt) > 0) return;
      const touch = evt.nativeEvent.changedTouches?.[0];
      const start = tapStartRef.current;
      if (!touch || !start) return;
      const dist = Math.hypot(touch.pageX - start.x, touch.pageY - start.y);
      if (dist > 12) return;
      tryHandleDoubleTap();
    },
    [allowPagerSwipe, tryHandleDoubleTap]
  );

  return (
    <View
      style={[styles.androidWrap, { width, height }]}
      collapsable={false}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      {...panResponder.panHandlers}
    >
      <Animated.Image
        source={{ uri }}
        style={[
          { width, height },
          {
            transform: [{ translateX }, { translateY }, { scale }]
          }
        ]}
        resizeMode="contain"
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iosZoomContent: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  androidWrap: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  }
});
