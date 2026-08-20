import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { theme } from '../../lib/theme';

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 28;
const THUMB_HIT = 44;
const PRICE_MIN = 0;
const PRICE_MAX = 500;

type Props = {
  minValue: number;
  maxValue: number;
  onChange: (min: number, max: number) => void;
  onChangeEnd?: (min: number, max: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function valueToX(value: number, width: number) {
  if (width <= 0) return 0;
  const ratio = (value - PRICE_MIN) / (PRICE_MAX - PRICE_MIN);
  return ratio * width;
}

function xToValue(x: number, width: number) {
  if (width <= 0) return PRICE_MIN;
  const ratio = clamp(x / width, 0, 1);
  return Math.round(PRICE_MIN + ratio * (PRICE_MAX - PRICE_MIN));
}

export function PriceRangeSlider({
  minValue,
  maxValue,
  onChange,
  onChangeEnd,
  onDragStateChange
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const widthRef = useRef(0);
  const minRef = useRef(minValue);
  const maxRef = useRef(maxValue);
  const dragStartMin = useRef(minValue);
  const dragStartMax = useRef(maxValue);
  const onChangeRef = useRef(onChange);
  const onChangeEndRef = useRef(onChangeEnd);
  const onDragStateChangeRef = useRef(onDragStateChange);
  minRef.current = minValue;
  maxRef.current = maxValue;
  onChangeRef.current = onChange;
  onChangeEndRef.current = onChangeEnd;
  onDragStateChangeRef.current = onDragStateChange;

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setTrackWidth(w);
  }, []);

  const minX = valueToX(minValue, trackWidth);
  const maxX = valueToX(maxValue, trackWidth);

  const finishDrag = useCallback(() => {
    onDragStateChangeRef.current?.(false);
    onChangeEndRef.current?.(minRef.current, maxRef.current);
  }, []);

  const minPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          onDragStateChangeRef.current?.(true);
          dragStartMin.current = minRef.current;
        },
        onPanResponderMove: (_evt, gesture) => {
          const w = widthRef.current;
          const next = xToValue(valueToX(dragStartMin.current, w) + gesture.dx, w);
          const capped = Math.min(next, maxRef.current);
          onChangeRef.current(capped, maxRef.current);
        },
        onPanResponderRelease: finishDrag,
        onPanResponderTerminate: finishDrag
      }),
    [finishDrag]
  );

  const maxPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          onDragStateChangeRef.current?.(true);
          dragStartMax.current = maxRef.current;
        },
        onPanResponderMove: (_evt, gesture) => {
          const w = widthRef.current;
          const next = xToValue(valueToX(dragStartMax.current, w) + gesture.dx, w);
          const capped = Math.max(next, minRef.current);
          onChangeRef.current(minRef.current, capped);
        },
        onPanResponderRelease: finishDrag,
        onPanResponderTerminate: finishDrag
      }),
    [finishDrag]
  );

  const trackPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => false,
        onPanResponderGrant: (evt) => {
          const w = widthRef.current;
          if (w <= 0) return;
          const x = evt.nativeEvent.locationX;
          const value = xToValue(x, w);
          const distMin = Math.abs(value - minRef.current);
          const distMax = Math.abs(value - maxRef.current);
          if (distMin <= distMax) {
            const next = Math.min(value, maxRef.current);
            onChangeRef.current(next, maxRef.current);
          } else {
            const next = Math.max(value, minRef.current);
            onChangeRef.current(minRef.current, next);
          }
        },
        onPanResponderRelease: () => {
          onChangeEndRef.current?.(minRef.current, maxRef.current);
        }
      }),
    []
  );

  const thumbOffset = (THUMB_HIT - THUMB_SIZE) / 2;

  return (
    <View style={styles.wrap}>
      <View style={styles.trackHit} onLayout={onTrackLayout} {...trackPan.panHandlers}>
        <View style={styles.track} />
        {trackWidth > 0 ? (
          <View
            style={[
              styles.fill,
              {
                left: minX,
                width: Math.max(0, maxX - minX)
              }
            ]}
            pointerEvents="none"
          />
        ) : null}
        <View
          style={[
            styles.thumbHit,
            { left: Math.max(0, minX - THUMB_HIT / 2) }
          ]}
          {...minPan.panHandlers}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={[styles.thumb, { marginTop: thumbOffset, marginLeft: thumbOffset }]} />
        </View>
        <View
          style={[
            styles.thumbHit,
            { left: Math.max(0, maxX - THUMB_HIT / 2) }
          ]}
          {...maxPan.panHandlers}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={[styles.thumb, { marginTop: thumbOffset, marginLeft: thumbOffset }]} />
        </View>
      </View>
      <View style={styles.labelsRow}>
        <Text style={styles.label}>{`${minValue} CHF`}</Text>
        <Text style={styles.label}>{`${maxValue} CHF`}</Text>
      </View>
    </View>
  );
}

export const FILTER_PRICE_SLIDER_MIN = PRICE_MIN;
export const FILTER_PRICE_SLIDER_MAX = PRICE_MAX;

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingVertical: theme.spacing.gapSm
  },
  trackHit: {
    height: THUMB_HIT,
    justifyContent: 'center'
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: theme.colors.border,
    width: '100%'
  },
  fill: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: theme.colors.appleBlack,
    top: (THUMB_HIT - TRACK_HEIGHT) / 2
  },
  thumbHit: {
    position: 'absolute',
    width: THUMB_HIT,
    height: THUMB_HIT,
    top: 0,
    zIndex: 2
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: theme.colors.appleBlack,
    borderWidth: 2,
    borderColor: theme.colors.googleWhite
  },
  labelsRow: {
    marginTop: theme.spacing.gapSm,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  label: {
    ...theme.typography.captionSm,
    color: theme.colors.textSecondary
  }
});
