import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getSafeBottomInset } from '../../../lib/safeArea';
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
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      Alert.alert(t('common.error'), t('profile.leaveReview.mustSignIn'));
      return;
    }
    if (!orderId || !reviewedId) {
      Alert.alert(t('common.error'), t('profile.leaveReview.missingOrder'));
      return;
    }
    if (rating < 1 || rating > 5) {
      Alert.alert(t('profile.leaveReview.ratingRequired'), t('profile.leaveReview.ratingHint'));
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
            ? t('profile.leaveReview.alreadyReviewed')
            : error.message;
        throw new Error(msg);
      }

      if (reviewedId && reviewedId !== user.id) {
        void sendPushNotificationWithUserJwt({
          user_id: reviewedId,
          titleKey: 'profile.leaveReview.someoneReviewed',
          bodyKey: 'profile.leaveReview.reviewReceivedBody',
          notification_type: 'new_feedback',
          data: { order_id: orderId, reviewer_id: user.id }
        });
      }

      router.replace('/tabs/profile/orders');
    } catch (e) {
      const message =
        e instanceof Error && e.message ? e.message : t('profile.leaveReview.submitError');
      Alert.alert(t('common.error'), message);
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
            {t('profile.leaveReview.title')}
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(getSafeBottomInset(insets.bottom), 16) + 24 }
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
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
                  {t('profile.leaveReview.youAreRating')}
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
              label={t('profile.leaveReview.commentOptional')}
              placeholder={t('profile.leaveReview.commentPlaceholder')}
              value={comment}
              onChangeText={setComment}
              multiline
              textAlignVertical="top"
              style={styles.commentInput}
            />
          </View>

          <View style={styles.actionsWrap}>
            <Button
              title={submitting ? t('common.loading') : t('profile.leaveReview.submitReview')}
              onPress={onSubmit}
              disabled={!canSubmit || submitting}
              loading={submitting}
              variant="primary"
            />
            <Button title={t('profile.leaveReview.skip')} onPress={onSkip} variant="secondary" />
          </View>
        </ScrollView>
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
    flex: 1
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
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
    marginTop: 16,
    gap: 10
  }
});

