import React from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { Text } from '../../../components/ui/Text';
import { theme } from '../../../lib/theme';

type HelpItemKey = { questionKey: string; answerKey: string };
type HelpSectionKey = { titleKey: string; items: HelpItemKey[] };

const SUPPORT_EMAIL = 'contact@bloomi.ch';

const HELP_SECTIONS: HelpSectionKey[] = [
  {
    titleKey: 'legal.help.buyTitle',
    items: [
      { questionKey: 'legal.help.buy.personalizeFeed.question', answerKey: 'legal.help.buy.personalizeFeed.answer' },
      { questionKey: 'legal.help.buy.buyItem.question', answerKey: 'legal.help.buy.buyItem.answer' },
      { questionKey: 'legal.help.buy.saveSearch.question', answerKey: 'legal.help.buy.saveSearch.answer' },
      { questionKey: 'legal.help.buy.chatMember.question', answerKey: 'legal.help.buy.chatMember.answer' },
      { questionKey: 'legal.help.buy.favorites.question', answerKey: 'legal.help.buy.favorites.answer' },
      { questionKey: 'legal.help.buy.makeOffer.question', answerKey: 'legal.help.buy.makeOffer.answer' },
      { questionKey: 'legal.help.buy.reserve.question', answerKey: 'legal.help.buy.reserve.answer' },
      { questionKey: 'legal.help.buy.bundle.question', answerKey: 'legal.help.buy.bundle.answer' },
      { questionKey: 'legal.help.buy.trackOrder.question', answerKey: 'legal.help.buy.trackOrder.answer' },
      { questionKey: 'legal.help.buy.itemMismatch.question', answerKey: 'legal.help.buy.itemMismatch.answer' },
      { questionKey: 'legal.help.buy.cancelPurchase.question', answerKey: 'legal.help.buy.cancelPurchase.answer' },
      { questionKey: 'legal.help.buy.findItems.question', answerKey: 'legal.help.buy.findItems.answer' }
    ]
  },
  {
    titleKey: 'legal.help.sellTitle',
    items: [
      { questionKey: 'legal.help.sell.manageListings.question', answerKey: 'legal.help.sell.manageListings.answer' },
      { questionKey: 'legal.help.sell.sellingBasics.question', answerKey: 'legal.help.sell.sellingBasics.answer' },
      { questionKey: 'legal.help.sell.postListing.question', answerKey: 'legal.help.sell.postListing.answer' },
      { questionKey: 'legal.help.sell.payments.question', answerKey: 'legal.help.sell.payments.answer' },
      { questionKey: 'legal.help.sell.listingRemoved.question', answerKey: 'legal.help.sell.listingRemoved.answer' },
      { questionKey: 'legal.help.sell.shippingReturns.question', answerKey: 'legal.help.sell.shippingReturns.answer' },
      { questionKey: 'legal.help.sell.proAccount.question', answerKey: 'legal.help.sell.proAccount.answer' },
      { questionKey: 'legal.help.sell.tips.question', answerKey: 'legal.help.sell.tips.answer' }
    ]
  },
  {
    titleKey: 'legal.help.accountTitle',
    items: [
      { questionKey: 'legal.help.account.manageProfile.question', answerKey: 'legal.help.account.manageProfile.answer' },
      { questionKey: 'legal.help.account.verifyIdentity.question', answerKey: 'legal.help.account.verifyIdentity.answer' },
      { questionKey: 'legal.help.account.signUpSignIn.question', answerKey: 'legal.help.account.signUpSignIn.answer' },
      { questionKey: 'legal.help.account.accountBlocked.question', answerKey: 'legal.help.account.accountBlocked.answer' },
      { questionKey: 'legal.help.account.ratings.question', answerKey: 'legal.help.account.ratings.answer' },
      { questionKey: 'legal.help.account.privacy.question', answerKey: 'legal.help.account.privacy.answer' },
      { questionKey: 'legal.help.account.security.question', answerKey: 'legal.help.account.security.answer' },
      { questionKey: 'legal.help.account.referrals.question', answerKey: 'legal.help.account.referrals.answer' },
      { questionKey: 'legal.help.account.policies.question', answerKey: 'legal.help.account.policies.answer' },
      { questionKey: 'legal.help.account.suggestions.question', answerKey: 'legal.help.account.suggestions.answer' }
    ]
  },
  {
    titleKey: 'legal.help.miscTitle',
    items: [
      { questionKey: 'legal.help.misc.contactSupport.question', answerKey: 'legal.help.misc.contactSupport.answer' },
      { questionKey: 'legal.help.misc.report.question', answerKey: 'legal.help.misc.report.answer' },
      { questionKey: 'legal.help.misc.prohibited.question', answerKey: 'legal.help.misc.prohibited.answer' },
      { questionKey: 'legal.help.misc.staySafe.question', answerKey: 'legal.help.misc.staySafe.answer' },
      { questionKey: 'legal.help.misc.bug.question', answerKey: 'legal.help.misc.bug.answer' }
    ]
  }
];

export default function HelpCenterScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <Text variant="body" style={styles.headerTitle}>
          {t('profile.helpCenter')}
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>
      <View style={styles.separator} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {HELP_SECTIONS.map((section) => (
          <View key={section.titleKey} style={styles.section}>
            <Text variant="h3" style={styles.sectionTitle}>
              {t(section.titleKey)}
            </Text>

            {section.items.map((item) => (
              <View key={item.questionKey} style={styles.item}>
                <Text variant="body" style={styles.question}>
                  {`\u2022 ${t(item.questionKey)}`}
                </Text>
                <Text variant="captionSm" color="textSecondary" style={styles.answer}>
                  {t(item.answerKey)}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.contactCta}>
          <Text variant="body" style={styles.contactCtaTitle}>
            {t('legal.help.contactCta.title')}
          </Text>
          <Text variant="captionSm" color="textSecondary" style={styles.contactCtaBody}>
            {t('legal.help.contactCta.bodyPrefix')}
            <Text
              style={styles.contactEmail}
              onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            >
              {SUPPORT_EMAIL}
            </Text>
            {t('legal.help.contactCta.bodySuffix')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32
  },
  section: {
    marginTop: 8,
    marginBottom: 12
  },
  sectionTitle: {
    fontFamily: theme.fontFamily.semiBold,
    color: '#000000',
    marginBottom: 8
  },
  item: {
    marginBottom: 10
  },
  question: {
    fontFamily: theme.fontFamily.regular,
    color: '#000000'
  },
  answer: {
    fontFamily: theme.fontFamily.regular,
    marginTop: 2,
    lineHeight: 18
  },
  contactCta: {
    marginTop: 24,
    alignItems: 'center'
  },
  contactCtaTitle: {
    fontFamily: theme.fontFamily.semiBold,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8
  },
  contactCtaBody: {
    textAlign: 'center',
    lineHeight: 20
  },
  contactEmail: {
    color: theme.colors.primary,
    textDecorationLine: 'underline'
  }
});
