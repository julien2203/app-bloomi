import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StackHeaderBackButton } from '../../../components/navigation/StackHeaderBackButton';
import {
  profileStackScreenOptions,
  profileStackScreenWithBack
} from '../../../lib/navigation/profileStackScreenOptions';

const nativeHeaderWithArrow = {
  headerLeft: () => <StackHeaderBackButton />
};

export default function ProfileStackLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={profileStackScreenOptions}>
      <Stack.Screen
        name="index"
        options={{ title: t('navigation.profile'), headerBackTitle: '' }}
      />
      <Stack.Screen
        name="edit-listing"
        options={{ title: t('profile.editListing.title'), headerShown: false }}
      />
      <Stack.Screen
        name="edit-profile"
        options={profileStackScreenWithBack({
          title: t('profile.editProfileScreen.title'),
          ...nativeHeaderWithArrow
        })}
      />
      <Stack.Screen
        name="my-address"
        options={{ title: t('profile.myAddress.title') }}
      />
      <Stack.Screen
        name="favorites"
        options={{ title: t('profile.favorites.title') }}
      />
      <Stack.Screen
        name="personalization"
        options={profileStackScreenWithBack({
          title: t('profile.settingsScreen.languageRegion'),
          ...nativeHeaderWithArrow
        })}
      />
      <Stack.Screen
        name="wallet"
        options={profileStackScreenWithBack({
          title: t('profile.walletScreenTitle'),
          ...nativeHeaderWithArrow
        })}
      />
      <Stack.Screen name="orders" options={{ title: t('profile.myOrders') }} />
      <Stack.Screen
        name="leave-review"
        options={{
          title: t('profile.leaveReview.title'),
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom'
        }}
      />
      <Stack.Screen
        name="activate-seller-account"
        options={{ title: t('profile.activateSeller.screenTitle'), headerShown: false }}
      />
      <Stack.Screen
        name="notifications"
        options={{ title: t('profile.notifications'), headerShown: false }}
      />
      <Stack.Screen
        name="notification-settings"
        options={{ title: t('profile.settingsScreen.pushNotifications') }}
      />
      <Stack.Screen
        name="account-settings"
        options={{ title: t('profile.settingsScreen.accountSettings') }}
      />
      <Stack.Screen
        name="blocked-users"
        options={{ title: t('profile.blockedUsers.title'), headerShown: false }}
      />
      <Stack.Screen
        name="settings"
        options={{ title: t('profile.settingsScreen.title'), headerBackTitle: '' }}
      />
      <Stack.Screen
        name="legal"
        options={profileStackScreenWithBack({
          title: t('profile.legalInfo'),
          ...nativeHeaderWithArrow
        })}
      />
      <Stack.Screen
        name="help"
        options={profileStackScreenWithBack({
          title: t('profile.helpCenter'),
          ...nativeHeaderWithArrow
        })}
      />
      <Stack.Screen
        name="feedback"
        options={profileStackScreenWithBack({
          title: t('profile.sendFeedback'),
          ...nativeHeaderWithArrow
        })}
      />
    </Stack>
  );
}
