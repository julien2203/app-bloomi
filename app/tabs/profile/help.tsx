import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../../components/ui/Text';
import { theme } from '../../../lib/theme';

type HelpItem = {
  question: string;
  answer: string;
};

type HelpSection = {
  title: string;
  items: HelpItem[];
};

const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'BUY',
    items: [
      {
        question: 'How can you personalize your feed?',
        answer:
          'Your feed adapts based on your searches, favorites, and interactions. The more you use the app, the more relevant suggestions become.'
      },
      {
        question: 'How do you buy an item?',
        answer:
          'Open the listing, tap Buy, choose delivery or in-person handoff, then confirm payment.'
      },
      {
        question: 'How do you save a search?',
        answer:
          'After applying your filters, use Save search to get notified when new matching items are posted.'
      },
      {
        question: 'How do you chat with a member?',
        answer:
          'Tap Message from a listing to ask your questions before buying.'
      },
      {
        question: 'How do you add an item to favorites?',
        answer:
          'Tap the heart on a listing. You can quickly find your favorites later.'
      },
      {
        question: 'How do you make an offer?',
        answer:
          'If enabled by the seller, use Make an offer to propose a different price.'
      },
      {
        question: 'How do you reserve an item?',
        answer:
          'Some sellers accept reservations through messaging or with a dedicated option.'
      },
      {
        question: 'How do you buy a bundle?',
        answer:
          'Contact the seller or use a bundle option (if available) to group multiple items.'
      },
      {
        question: 'How do you track your order?',
        answer:
          'Go to My purchases to view tracking and delivery details.'
      },
      {
        question: 'What if the item does not match the listing?',
        answer:
          'Report the issue from your order with photos and a clear explanation.'
      },
      {
        question: 'Can you cancel a purchase?',
        answer:
          'Yes, but only before shipment or confirmation.'
      },
      {
        question: 'How can you find items more easily?',
        answer:
          'Use filters, categories, brands, and location to narrow down your search.'
      }
    ]
  },
  {
    title: 'SELL',
    items: [
      {
        question: 'How do you manage your listings?',
        answer:
          'In My listings, you can edit, pause, or delete your listings.'
      },
      {
        question: 'What are the basics for selling well?',
        answer:
          'Use clear photos, an honest description, a fair price, and reply quickly.'
      },
      {
        question: 'How do you post a listing?',
        answer:
          'Tap Sell, add photos, description, category, and price, then publish.'
      },
      {
        question: 'How do payments and transfers work?',
        answer:
          'Funds are secured and transferred after the transaction is validated.'
      },
      {
        question: 'Why can a listing be removed?',
        answer:
          'A listing may be removed if an item is prohibited, non-compliant, counterfeit, or misleadingly described.'
      },
      {
        question: 'How do shipping and returns work?',
        answer:
          'Instructions are sent after a sale. Returns may be available under Bloomi conditions.'
      },
      {
        question: 'Professional seller account (if enabled)',
        answer:
          'You may get specific tools such as more visibility, advanced management, and business options.'
      },
      {
        question: 'Recommended tips for you',
        answer:
          'Bloomi may suggest tips or guidance based on your activity.'
      }
    ]
  },
  {
    title: 'ACCOUNT',
    items: [
      {
        question: 'What can you manage in your profile?',
        answer:
          'Photo, bio, personal info, notifications, security settings, and preferences.'
      },
      {
        question: 'Why verify your phone number or identity?',
        answer:
          'To secure transactions and reduce fraud.'
      },
      {
        question: 'How do sign-up and sign-in work?',
        answer:
          'You can create an account with email, phone, or another available method. Your password can be reset.'
      },
      {
        question: 'Why can an account be blocked?',
        answer:
          'Because of rule violations, security concerns, or unusual activity.'
      },
      {
        question: 'How do ratings and stars work?',
        answer:
          'After a transaction, each member can leave a review.'
      },
      {
        question: 'What should you know about data privacy?',
        answer:
          'You can manage your settings and control some visible profile information.'
      },
      {
        question: 'Security and reports: the basics',
        answer:
          'Report suspicious behavior and avoid off-platform payments.'
      },
      {
        question: 'Referrals',
        answer:
          'Some referral features may exist depending on app updates.'
      },
      {
        question: 'Bloomi terms and policies',
        answer:
          'Usage rules and policies are available in the app.'
      },
      {
        question: 'Personalized account suggestions',
        answer:
          'Recommendations may appear based on your usage.'
      }
    ]
  },
  {
    title: 'MISC',
    items: [
      {
        question: 'How do you contact Bloomi support?',
        answer:
          'Use the Help center or email contact@bloomi.ch.'
      },
      {
        question: 'How do you report a user or listing?',
        answer:
          'Use the Report button from a profile, listing, or conversation.'
      },
      {
        question: 'Which items are prohibited?',
        answer:
          'Illegal, dangerous, counterfeit, or non-compliant products are not allowed.'
      },
      {
        question: 'How can you stay safe on the app?',
        answer:
          'Stay within Bloomi messaging and avoid sharing sensitive information.'
      },
      {
        question: 'What if the app has a bug?',
        answer:
          'Update the app, restart your phone, or check your connection.'
      }
    ]
  }
];

export default function HelpCenterScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="h2" style={styles.pageTitle}>
          BLOOMI Help Center
        </Text>

        {HELP_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text variant="h3" style={styles.sectionTitle}>
              {section.title}
            </Text>

            {section.items.map((item) => (
              <View key={`${section.title}-${item.question}`} style={styles.item}>
                <Text variant="body" style={styles.question}>
                  {`\u2022 ${item.question}`}
                </Text>
                <Text variant="captionSm" color="textSecondary" style={styles.answer}>
                  {item.answer}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32
  },
  pageTitle: {
    fontFamily: theme.fontFamily.bold,
    color: '#000000',
    marginBottom: 12
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
  }
});

