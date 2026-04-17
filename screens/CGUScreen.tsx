import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/ui/Text';
import { theme } from '../lib/theme';

export default function CGUScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Terms of Use</Text>
          <Text style={styles.date}>Effective as of April 13, 2026</Text>
        </View>

        <Text style={styles.paragraph}>
          Welcome to Bloomi. We built this platform around a simple idea: to make local second-hand fashion easy,
          secure, and genuinely human for everyone in Switzerland.
        </Text>
        <Text style={styles.paragraph}>
          These Terms of Use (the &quot;Terms&quot;) set out the rules that apply between you and Bloomi. They apply as
          soon as you create an account, browse the platform, or complete a transaction. We have done our best to
          draft them clearly, without unnecessary jargon.
        </Text>
        <Text style={styles.paragraph}>
          By using Bloomi, you accept these Terms in full. If you have any questions, please write to us at
          contact@bloomi.ch; we are here to help.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>1. Who is Bloomi?</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.paragraph}>
          Bloomi is a Swiss platform that connects buyers and sellers of second-hand fashion. It is operated by
          Bloomi Sàrl, a limited liability company governed by Swiss law. Our details are as follows:
        </Text>
        <Text style={styles.bullet}>• Legal name: Bloomi Sàrl</Text>
        <Text style={styles.bullet}>• UID (IDE) number: CHE-356.866.102</Text>
        <Text style={styles.bullet}>• Registered office: Bloomi Sàrl, 1091 Grandvaux, Switzerland</Text>
        <Text style={styles.bullet}>• Contact: contact@bloomi.ch</Text>
        <Text style={styles.paragraph}>
          Bloomi acts solely as a technical intermediary: we connect buyers and sellers, but we are not a party to the
          sale contracts concluded between them. We do not store the items, we do not physically inspect them, and we
          do not guarantee the quality of each listing.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>2. Who may use Bloomi?</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>2.1 Eligibility</Text>
        <Text style={styles.paragraph}>
          Bloomi is open to any natural person with legal capacity under Swiss law. If you are a minor, you must obtain
          the prior consent of your legal representative before creating an account.
        </Text>
        <Text style={styles.h2}>2.2 Private individuals and professional shops</Text>
        <Text style={styles.paragraph}>
          Bloomi welcomes two types of sellers, and the rules are not exactly the same depending on your profile:
        </Text>
        <Text style={styles.bullet}>
          • Private individuals (C2C sales): these Terms apply in full. Bloomi applies in particular the peer-to-peer
          return policy described in Section 5.
        </Text>
        <Text style={styles.bullet}>
          • Professional shops (B2C sales): each shop applies its own general terms and conditions of sale. Bloomi
          does not handle returns or disputes relating to those transactions.
        </Text>
        <Text style={styles.h2}>2.3 Your Bloomi account</Text>
        <Text style={styles.paragraph}>To use the platform, you create a personal account with:</Text>
        <Text style={styles.bullet}>• your first and last name,</Text>
        <Text style={styles.bullet}>• your date of birth,</Text>
        <Text style={styles.bullet}>• a valid telephone number,</Text>
        <Text style={styles.bullet}>• an email address,</Text>
        <Text style={styles.bullet}>• a secure password.</Text>
        <Text style={styles.paragraph}>
          Your information must be accurate and kept up to date. Only one account per person. Your login credentials
          are yours: keep them confidential and do not share them with anyone.
        </Text>
        <Text style={styles.paragraph}>
          For professional shops, creating a business account requires providing valid proof of business in Switzerland
          (extract from the commercial register or equivalent document). Bloomi reserves the right to refuse or
          suspend any business account whose supporting documents are incomplete or invalid.
        </Text>
        <Text style={styles.h2}>2.4 What we require before your first sale</Text>
        <Text style={styles.paragraph}>
          To receive your payouts, our payment service provider Stripe will ask you to verify your identity. This
          process includes in particular:
        </Text>
        <Text style={styles.bullet}>• providing your bank details (IBAN or other),</Text>
        <Text style={styles.bullet}>• submitting an official identity document,</Text>
        <Text style={styles.bullet}>• regulatory checks (AML, sanctions lists).</Text>
        <Text style={styles.paragraph}>
          These checks are carried out directly by Stripe. Bloomi does not have access to them and cannot be held
          liable for any block or refusal on Stripe&apos;s part.
        </Text>
        <Text style={styles.h2}>2.5 Right to suspend an account</Text>
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            IF WE DETECT FRAUDULENT CONDUCT, A BREACH OF THESE TERMS, ABUSE OF THE PLATFORM, OR ANY ACTIVITY CONTRARY
            TO APPLICABLE LAW, WE MAY RESTRICT OR CLOSE AN ACCOUNT, WITH OR WITHOUT PRIOR NOTICE.
          </Text>
        </View>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>3. What may be sold</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>3.1 Permitted items</Text>
        <Text style={styles.paragraph}>Bloomi is dedicated to second-hand fashion. The following are permitted:</Text>
        <Text style={styles.bullet}>• Clothing (new, pre-owned, or never worn),</Text>
        <Text style={styles.bullet}>• Footwear,</Text>
        <Text style={styles.bullet}>• Bags, belts, and leather goods accessories,</Text>
        <Text style={styles.bullet}>• Costume jewellery and watches,</Text>
        <Text style={styles.bullet}>• Eyewear and other fashion accessories,</Text>
        <Text style={styles.bullet}>• Children&apos;s toys,</Text>
        <Text style={styles.bullet}>• Children&apos;s books.</Text>
        <Text style={styles.h2}>3.2 Prohibited items</Text>
        <Text style={styles.paragraph}>Certain items are not permitted on Bloomi. The following are prohibited:</Text>
        <Text style={styles.bullet}>
          • any item that is unlawful under Swiss law (weapons, drugs, protected species, etc.),
        </Text>
        <Text style={styles.bullet}>• any item whose description is false or misleading.</Text>
        <Text style={styles.paragraph}>
          We reserve the right to remove any non-compliant listing, without prior notice and without compensation.
        </Text>
        <Text style={styles.h2}>3.3 Your listings, your responsibility</Text>
        <Text style={styles.paragraph}>When you publish a listing on Bloomi, you agree to:</Text>
        <Text style={styles.bullet}>• describe the item honestly and accurately (photos, condition, size, etc.),</Text>
        <Text style={styles.bullet}>• use genuine photos of the item, not AI-generated images,</Text>
        <Text style={styles.bullet}>
          • not publish content that is harmful, discriminatory, or unlawful.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>4. How does a sale work?</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>4.1 The contract is between you</Text>
        <Text style={styles.paragraph}>
          When a buyer pays for an item, a sale contract is concluded directly between the buyer and the seller. Bloomi
          is not a party to that contract. Our role is to provide the technical infrastructure that makes the
          transaction possible.
        </Text>
        <Text style={styles.h2}>4.2 Rules by seller type</Text>
        <Text style={styles.bullet}>
          • Sales between private individuals: Bloomi&apos;s Terms apply in full, including the return policy in Section
          5.
        </Text>
        <Text style={styles.bullet}>
          • Sales by a professional shop: the shop&apos;s general terms and conditions of sale apply. Bloomi does not
          handle returns or disputes.
        </Text>
        <Text style={styles.h2}>4.3 Payments are processed by Stripe</Text>
        <Text style={styles.paragraph}>
          All payments on Bloomi are processed by Stripe, Inc., our secure payment service provider. Bloomi collects
          funds via Stripe on your behalf and pays them out to you once the transaction is confirmed. We do not hold
          your funds in our own accounts.
        </Text>
        <Text style={styles.paragraph}>
          Stripe may temporarily hold funds as part of its regulatory checks. Bloomi has no control over those
          decisions and cannot be held liable for them.
        </Text>
        <Text style={styles.h2}>4.4 Transaction process</Text>
        <Text style={styles.paragraph}>When you sell: you have 4 business days to ship</Text>
        <Text style={styles.paragraph}>
          As soon as the buyer has paid, you receive a notification. You then have a maximum of 4 business days to
          ship the parcel. If that period elapses without shipment, the order is cancelled and the buyer is refunded.
        </Text>
        <Text style={styles.paragraph}>Sale confirmed</Text>
        <Text style={styles.paragraph}>
          The transaction is confirmed when the buyer confirms receipt of the parcel. If the buyer does not respond
          within 48 hours after delivery, the transaction is automatically confirmed. Funds are then paid out to you
          via Stripe.
        </Text>
        <Text style={styles.paragraph}>If something goes wrong</Text>
        <Text style={styles.bullet}>
          • You do not ship within the deadline: the buyer is refunded (item price plus shipping, excluding buyer
          protection fees) and your account may be subject to sanctions.
        </Text>
        <Text style={styles.bullet}>
          • You cancel because the item is no longer available: the buyer receives a full refund.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>5. Returns</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.paragraph}>
          Important: This section applies only to transactions between private individuals. For purchases from a
          professional shop, the shop&apos;s return conditions apply. Bloomi does not intervene in those cases.
        </Text>
        <Text style={styles.h2}>5.1 You have 24 hours to report an issue</Text>
        <Text style={styles.paragraph}>
          As a buyer, if the item received does not match the listing, you have 24 hours from confirmation of receipt
          to open a return request. After that period, the transaction is closed definitively.
        </Text>
        <Text style={styles.h2}>5.2 How returns work</Text>
        <Text style={styles.bullet}>• Returns must be made exclusively via Swiss Post.</Text>
        <Text style={styles.bullet}>• Return shipping costs are borne by you as the buyer.</Text>
        <Text style={styles.bullet}>
          • The refund does not include the original outbound shipping charges or buyer protection fees.
        </Text>
        <Text style={styles.paragraph}>
          The refund is triggered once the seller has confirmed receipt of the return parcel.
        </Text>
        <Text style={styles.h2}>5.3 Special situations</Text>
        <Text style={styles.bullet}>
          • You do not send the parcel back in time: the transaction is confirmed definitively; no refund is possible.
        </Text>
        <Text style={styles.bullet}>
          • You use a carrier other than Swiss Post: the seller may refuse the return; no refund is possible.
        </Text>
        <Text style={styles.bullet}>
          • The return parcel is lost by Swiss Post: Bloomi is not liable for postal losses. The buyer is refunded the
          item amount; the seller is compensated in accordance with Swiss Post&apos;s decision.
        </Text>
        <Text style={styles.h2}>5.4 Our role in disputes between private individuals</Text>
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            BLOOMI DOES NOT MEDIATE BETWEEN PRIVATE INDIVIDUALS. AS A TECHNICAL INTERMEDIARY, WE CANNOT VERIFY THE
            AUTHENTICITY OF CLAIMS. THAT IS PRECISELY WHY WE HAVE PUT IN PLACE A CLEAR, SYSTEMATIC RIGHT OF RETURN: IF
            YOU ARE NOT SATISFIED, YOU RETURN THE ITEM AND YOU ARE REFUNDED.
          </Text>
        </View>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>6. Delivery</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>6.1 Available delivery methods</Text>
        <Text style={styles.paragraph}>
          As a seller, you choose at listing how you wish to ship your item:
        </Text>
        <Text style={styles.bullet}>• Swiss Post (with tracking number),</Text>
        <Text style={styles.bullet}>• Hand delivery in person.</Text>
        <Text style={styles.h2}>6.2 Hand delivery in person</Text>
        <Text style={styles.paragraph}>
          If you offer this delivery method, once the sale and payment are confirmed, the buyer and seller may
          exchange their telephone number and address via Bloomi messaging to arrange handover. Scheduling the meeting
          and exchanging the item then take place directly between the parties.
        </Text>
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            BLOOMI IS NOT INVOLVED IN THIS TYPE OF ARRANGEMENT AND CANNOT BE HELD LIABLE FOR ANYTHING THAT OCCURS IN
            THAT CONTEXT.
          </Text>
        </View>
        <Text style={styles.h2}>6.3 Shipping charges</Text>
        <Text style={styles.paragraph}>
          Shipping charges are set by Bloomi and displayed clearly at checkout. They are borne by the buyer unless
          otherwise stated.
        </Text>
        <Text style={styles.h2}>6.4 The seller is responsible for shipment</Text>
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            AS A SELLER, YOU ARE RESPONSIBLE FOR PACKAGING, ADDRESSING, AND DEPOSITING THE PARCEL WITHIN THE DEADLINES.
            BLOOMI IS NOT LIABLE FOR ISSUES ARISING FROM A POORLY PACKAGED PARCEL, INCORRECT ADDRESSING, OR LATE
            DEPOSIT.
          </Text>
        </View>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>7. Fees and commissions</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>7.1 Bloomi commission</Text>
        <Text style={styles.paragraph}>
          Bloomi charges a commission on each sale completed through the platform. The exact scale is available at all
          times in our help section. We reserve the right to change it. Any change applies only to sales completed
          after the updated scale is published.
        </Text>
        <Text style={styles.h2}>7.2 Buyer protection fees</Text>
        <Text style={styles.paragraph}>
          These fees, which are displayed clearly before payment, are used to:
        </Text>
        <Text style={styles.bullet}>• hold funds securely until confirmed receipt,</Text>
        <Text style={styles.bullet}>• refund the buyer if the seller does not ship,</Text>
        <Text style={styles.bullet}>
          • compensate the seller if the parcel is lost by the carrier.
        </Text>
        <Text style={styles.paragraph}>These fees are not refunded in the event of a return.</Text>
        <Text style={styles.h2}>7.3 How to pay on Bloomi</Text>
        <Text style={styles.paragraph}>
          The payment methods available are those offered by Stripe at the time of your order. Bloomi may add or remove
          methods at any time.
        </Text>
        <Text style={styles.h2}>7.4 When do you receive your funds?</Text>
        <Text style={styles.paragraph}>
          Once the transaction is confirmed, your balance is available in your personal area. You may request a payout
          at any time. Processing time is generally 4 to 12 days depending on Stripe. Bloomi cannot guarantee that
          timeframe precisely. Available funds may also be used directly to make purchases on Bloomi.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>8. What Bloomi cannot guarantee</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>8.1 Our role remains technical</Text>
        <Text style={styles.paragraph}>
          Bloomi is not a shop, a bank, or a custodian of funds. We connect buyers and sellers. We do not guarantee the
          quality of listed items or proper performance of contracts between users.
        </Text>
        <Text style={styles.h2}>8.2 What Bloomi is not liable for</Text>
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            TO THE EXTENT PERMITTED BY MANDATORY LAW, BLOOMI CANNOT BE HELD LIABLE FOR:
          </Text>
          <Text style={styles.clauseBullet}>• INACCURATE DESCRIPTION OF AN ITEM BY A SELLER,</Text>
          <Text style={styles.clauseBullet}>• DELIVERY DELAYS OR DELIVERY ISSUES,</Text>
          <Text style={styles.clauseBullet}>• DAMAGE CAUSED BY A PURCHASED ITEM,</Text>
          <Text style={styles.clauseBullet}>• DISPUTES BETWEEN USERS,</Text>
          <Text style={styles.clauseBullet}>
            • ANY FINANCIAL LOSS OR DATA LOSS RELATED TO USE OF THE PLATFORM.
          </Text>
        </View>
        <Text style={styles.h2}>8.3 Force majeure</Text>
        <Text style={styles.paragraph}>
          Bloomi is not liable for service interruptions caused by events beyond our control: internet outages,
          natural disasters, administrative decisions, strikes, or other circumstances constituting force majeure under
          Swiss law.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>9. Your content and our rights</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>9.1 The Bloomi brand and platform belong to us</Text>
        <Text style={styles.paragraph}>
          The Bloomi name, our logo, our design, our code, and all elements of the platform are the exclusive property
          of Bloomi Sàrl, protected under Swiss and international law. Any unauthorised reproduction is prohibited.
        </Text>
        <Text style={styles.h2}>9.2 What you publish on Bloomi</Text>
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            BY PUBLISHING PHOTOS OR DESCRIPTIONS ON BLOOMI, YOU CONFIRM THAT YOU ARE THE AUTHOR OR THAT YOU HOLD THE
            NECESSARY RIGHTS. YOU GRANT BLOOMI A FREE, NON-EXCLUSIVE LICENCE TO DISPLAY, HOST, AND USE THAT CONTENT FOR
            THE OPERATION AND PROMOTION OF THE PLATFORM.
          </Text>
        </View>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>10. Personal data</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.paragraph}>
          At Bloomi, trust also means respecting your privacy. We process your data in accordance with the Swiss
          Federal Act on Data Protection (FADP) and our Privacy Policy, available on the platform.
        </Text>
        <Text style={styles.paragraph}>
          We collect only what we need to operate Bloomi: your account information, your transactions, and for
          sellers, the data transmitted to Stripe for identity verification.
        </Text>
        <Text style={styles.paragraph}>
          You may at any time access, correct, or request deletion of your data by writing to us at contact@bloomi.ch.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>11. Your account and closure</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>11.1 When you wish to leave</Text>
        <Text style={styles.paragraph}>
          You may delete your Bloomi account at any time from the app or the website. Deletion is permanent: you lose
          access to your transaction history. Please withdraw your balance before you leave.
        </Text>
        <Text style={styles.h2}>11.2 When Bloomi must take action</Text>
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            WE MAY SUSPEND OR CLOSE AN ACCOUNT IN THE EVENT OF FRAUD, BREACH OF THESE TERMS, ABUSE OF THE PLATFORM, OR
            NON-COMPLIANCE WITH APPLICABLE LAW.
          </Text>
        </View>
        <Text style={styles.paragraph}>
          Closing an account does not mean you forfeit funds held with Stripe. You remain responsible for withdrawing
          your balance in accordance with Stripe&apos;s conditions.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>12. Changes to the Terms</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.paragraph}>
          Bloomi is a living platform; these Terms may change. In the event of a material change, we will notify you via
          an in-app notice or by email before the changes take effect.
        </Text>
        <Text style={styles.paragraph}>
          Changes do not apply to transactions already in progress at the time they are published.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>13. Governing law</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>13.1 Swiss law applies</Text>
        <Text style={styles.paragraph}>
          These Terms and any relationship between Bloomi and its users are governed exclusively by Swiss law.
        </Text>
        <Text style={styles.h2}>13.2 First, we seek a solution together</Text>
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            IN THE EVENT OF A DISPUTE, WE ALWAYS PREFER TO TALK IT THROUGH. WRITE TO US AT CONTACT@BLOOMI.CH AND WE WILL
            DO OUR BEST TO FIND AN AMICABLE SOLUTION. IF NO AGREEMENT IS REACHED WITHIN A REASONABLE PERIOD, THE COURTS
            OF THE CANTON OF VAUD SHALL HAVE JURISDICTION, SUBJECT TO MANDATORY PROVISIONS IN FAVOUR OF CONSUMERS.
          </Text>
        </View>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>14. Contact us</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.paragraph}>
          A question about these Terms? Uncertainty about a transaction? We are here to help.
        </Text>
        <Text style={styles.bullet}>• Email: contact@bloomi.ch</Text>
        <Text style={styles.bullet}>• Website: www.bloomi.ch</Text>
        <Text style={styles.bullet}>• Address: Bloomi Sàrl, 1091 Grandvaux, Switzerland</Text>
        <Text style={styles.paragraph}>Thank you for being part of the Bloomi community 🌱</Text>

        <Text style={styles.footer}>© 2026 Bloomi Sàrl — All rights reserved</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  scroll: {
    flex: 1
  },
  content: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: theme.spacing.gapMd,
    paddingBottom: theme.spacing.gapLg * 2
  },
  header: {
    marginBottom: theme.spacing.gapLg
  },
  pageTitle: {
    ...theme.typography.h2,
    color: theme.colors.textPrimary
  },
  date: {
    ...theme.typography.caption,
    color: theme.colors.sectionLabel,
    marginTop: 4
  },
  articleHeader: {
    marginTop: theme.spacing.gapLg,
    marginBottom: theme.spacing.gapSm
  },
  articleTitle: {
    ...theme.typography.h3,
    color: theme.colors.textPrimary
  },
  separator: {
    marginTop: 8,
    width: 56,
    height: 3,
    borderRadius: 999,
    backgroundColor: theme.colors.lime
  },
  h2: {
    ...theme.typography.body,
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.gapSm
  },
  paragraph: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    marginTop: 6
  },
  bullet: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    marginTop: 4,
    paddingLeft: 4
  },
  clauseBox: {
    marginTop: theme.spacing.gapSm,
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.separator,
    paddingHorizontal: theme.spacing.gapMd,
    paddingVertical: theme.spacing.gapSm
  },
  clauseText: {
    ...theme.typography.caption,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.bold
  },
  clauseBullet: {
    ...theme.typography.caption,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.bold,
    marginTop: 4
  },
  footer: {
    ...theme.typography.caption,
    color: theme.colors.sectionLabel,
    textAlign: 'center',
    marginTop: theme.spacing.gapLg
  }
});
