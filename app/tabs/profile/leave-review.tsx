import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { Button } from '../../../components/ui/Button';
import { Text } from '../../../components/ui/Text';
import { TextField } from '../../../components/ui/TextField';
import { theme } from '../../../lib/theme';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import { sendPushNotificationWithUserJwt } from '../../../lib/pushNotifications';

type LeaveReviewParams = {
  order_id?: string;
  reviewed_id?: string;
  reviewed_name?: string;
  reviewed_avatar?: string;
};

export default function LeaveReviewScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const params = useLocalSearchParams<LeaveReviewParams>();

  const orderId = useMemo(() => String(params.order_id ?? ''), [params.order_id]);
  const reviewedId = useMemo(
    () => String(params.reviewed_id ?? ''),
    [params.reviewed_id]
  );
  const reviewedName = useMemo(
    () => String(params.reviewed_name ?? 'User'),
    [params.reviewed_name]
  );
  const reviewedAvatar = useMemo(
    () => String(params.reviewed_avatar ?? ''),
    [params.reviewed_avatar]
  );

  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = Boolean(user?.id) && rating >= 1 && rating <= 5 && !!orderId && !!reviewedId;

  const onSkip = useCallback(() => {
    router.replace('/tabs/profile/orders');
  }, [router]);

  const onSubmit = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be signed in.');
      return;
    }
    if (!orderId || !reviewedId) {
      Alert.alert('Error', 'Missing order information.');
      return;
    }
    if (rating < 1 || rating > 5) {
      Alert.alert('Rating required', 'Choose a rating between 1 and 5 stars.');
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    try {
      const payload = {
        order_id: orderId,
        reviewer_id: user.id,
        reviewed_id: reviewedId,
        rating,
        comment: comment.trim() ? comment.trim() : null
      };

      const { error } = await supabase.from('reviews').insert(payload);
      if (error) {
        const msg =
          (error as any)?.code === '23505'
            ? 'You have already left a review for this order.'
            : error.message;
        throw new Error(msg);
      }

      if (reviewedId && reviewedId !== user.id) {
        void sendPushNotificationWithUserJwt({
          user_id: reviewedId,
          title: "⭐ Quelqu'un t'a laissé un avis !",
          body: "Découvre ce qu'on pense de toi sur Bloomi.",
          data: { order_id: orderId, reviewer_id: user.id }
        });
      }

      router.replace('/tabs/profile/orders');
    } catch (e) {
      const message =
        e instanceof Error && e.message ? e.message : 'Unable to submit review.';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  }, [comment, orderId, rating, reviewedId, router, submitting, user?.id]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="h2" style={styles.title}>
            Leave a review
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.userRow}>
            {reviewedAvatar ? (
              <Image source={{ uri: reviewedAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}
            <View style={styles.userText}>
              <Text variant="captionSm" color="textSecondary">
                You are rating
              </Text>
              <Text variant="h3" style={styles.name} numberOfLines={1}>
                {reviewedName}
              </Text>
            </View>
          </View>

          <View style={styles.starsRow}>
            {([1, 2, 3, 4, 5] as const).map((i) => {
              const selected = rating >= i;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setRating(i)}
                  activeOpacity={0.85}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={selected ? 'star' : 'star-outline'}
                    size={30}
                    color={selected ? theme.colors.primary : theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          <TextField
            label="Comment (optional)"
            placeholder="Write a comment..."
            value={comment}
            onChangeText={setComment}
            multiline
            textAlignVertical="top"
            style={styles.commentInput}
          />

          <View style={styles.actionsWrap}>
            <Button
              title={submitting ? 'Sending…' : 'Submit review'}
              onPress={onSubmit}
              disabled={!canSubmit || submitting}
              loading={submitting}
              variant="primary"
            />
            <Button title="Skip" onPress={onSkip} variant="secondary" />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  header: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: 16,
    paddingBottom: 10
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerRightPlaceholder: {
    width: 28
  },
  title: {
    marginBottom: 10,
    flex: 1,
    textAlign: 'center'
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: 8
  },
  card: {
    backgroundColor: theme.colors.googleWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.muted
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.muted
  },
  userText: {
    flex: 1
  },
  name: {
    marginTop: 2
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16
  },
  starButton: {
    paddingVertical: 6
  },
  commentInput: {
    minHeight: 120,
    paddingTop: 12
  },
  actionsWrap: {
    marginTop: 8,
    gap: 10
  }
});

