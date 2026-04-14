import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/ui/Text';
import { theme } from '../lib/theme';

export default function CGUScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Conditions Générales d&apos;Utilisation</Text>
          <Text style={styles.date}>En vigueur à compter du 13 avril 2026</Text>
        </View>

        <Text style={styles.paragraph}>
          Bienvenue sur Bloomi ! Nous avons conçu cette plateforme avec une idée simple : rendre la seconde main locale
          facile, sécurisée et vraiment humaine pour toutes et tous en Suisse.
        </Text>
        <Text style={styles.paragraph}>
          Ces Conditions Générales d&apos;Utilisation (ci-après « les CGU ») décrivent les règles du jeu entre vous et
          Bloomi. Elles s&apos;appliquent dès que vous créez un compte, que vous naviguez sur la plateforme ou que vous
          réalisez une transaction. Nous avons fait de notre mieux pour les rédiger clairement, sans jargon inutile.
        </Text>
        <Text style={styles.paragraph}>
          En utilisant Bloomi, vous acceptez l&apos;ensemble de ces CGU. Une question ? Écrivez-nous à contact@bloomi.ch,
          on est là.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>1. Qui est Bloomi ?</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.paragraph}>
          Bloomi est une plateforme suisse de mise en relation entre acheteurs et vendeurs de mode de seconde main.
          Elle est exploitée par Bloomi Sàrl, société à responsabilité limitée de droit suisse, dont voici les
          coordonnées :
        </Text>
        <Text style={styles.bullet}>• Raison sociale : Bloomi Sàrl</Text>
        <Text style={styles.bullet}>• Numéro IDE : CHE-356.866.102</Text>
        <Text style={styles.bullet}>• Siège social : Bloomi Sàrl, 1091 Grandvaux, Suisse</Text>
        <Text style={styles.bullet}>• Contact : contact@bloomi.ch</Text>
        <Text style={styles.paragraph}>
          Bloomi agit uniquement comme intermédiaire technique : nous connectons des acheteurs et des vendeurs, mais
          nous ne sommes pas partie aux contrats de vente conclus entre eux. Nous ne stockons pas les articles, nous ne
          les vérifions pas physiquement, et nous ne garantissons pas la qualité de chaque article publié.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>2. Qui peut utiliser Bloomi ?</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>2.1 Conditions d&apos;accès</Text>
        <Text style={styles.paragraph}>
          Bloomi est ouvert à toute personne physique disposant de la capacité juridique au sens du droit suisse. Si
          vous êtes mineur·e, vous devez obtenir le consentement préalable de votre représentant légal avant de créer un
          compte.
        </Text>
        <Text style={styles.h2}>2.2 Particuliers et boutiques professionnelles</Text>
        <Text style={styles.paragraph}>
          Bloomi accueille deux types de vendeurs, et les règles ne sont pas tout à fait les mêmes selon votre profil :
        </Text>
        <Text style={styles.bullet}>
          • Particuliers (vente C2C) : les présentes CGU s&apos;appliquent intégralement. Bloomi gère notamment la
          politique de retour entre particuliers décrite à l&apos;article 5.
        </Text>
        <Text style={styles.bullet}>
          • Boutiques professionnelles (vente B2C) : chaque boutique applique ses propres conditions générales de
          vente. Bloomi n&apos;intervient ni dans les retours ni dans les litiges liés à ces transactions.
        </Text>
        <Text style={styles.h2}>2.3 Votre compte Bloomi</Text>
        <Text style={styles.paragraph}>Pour utiliser la plateforme, vous créez un compte personnel avec :</Text>
        <Text style={styles.bullet}>• votre prénom et nom,</Text>
        <Text style={styles.bullet}>• votre date de naissance,</Text>
        <Text style={styles.bullet}>• un numéro de téléphone valide,</Text>
        <Text style={styles.bullet}>• une adresse e-mail,</Text>
        <Text style={styles.bullet}>• un mot de passe sécurisé.</Text>
        <Text style={styles.paragraph}>
          Vos informations doivent être exactes et à jour. Un seul compte par personne. Vos identifiants vous
          appartiennent : gardez-les confidentiels et ne les partagez avec personne.
        </Text>
        <Text style={styles.paragraph}>
          Pour les boutiques professionnelles, la création d&apos;un compte pro nécessite la fourniture d&apos;un justificatif
          d&apos;entreprise valable en Suisse (extrait du registre du commerce ou document équivalent). Bloomi se réserve
          le droit de refuser ou de suspendre tout compte pro dont les justificatifs seraient incomplets ou invalides.
        </Text>
        <Text style={styles.h2}>2.4 Ce qu&apos;on vous demande avant votre première vente</Text>
        <Text style={styles.paragraph}>
          Pour recevoir vos gains, notre prestataire de paiement Stripe vous demandera de vérifier votre identité. Ce
          processus inclut notamment :
        </Text>
        <Text style={styles.bullet}>• la fourniture de vos coordonnées bancaires (IBAN ou autre),</Text>
        <Text style={styles.bullet}>• la transmission d&apos;un document d&apos;identité officiel,</Text>
        <Text style={styles.bullet}>• des contrôles réglementaires (AML, listes de sanctions).</Text>
        <Text style={styles.paragraph}>
          Ces vérifications sont réalisées directement par Stripe. Bloomi n&apos;y a pas accès et ne peut pas être tenu
          responsable d&apos;un blocage ou d&apos;un refus de leur part.
        </Text>
        <Text style={styles.h2}>2.5 On se réserve le droit de suspendre un compte</Text>
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            SI NOUS DÉTECTONS UN COMPORTEMENT FRAUDULEUX, UNE VIOLATION DE CES CGU, UN USAGE ABUSIF DE LA PLATEFORME
            OU TOUTE ACTIVITÉ CONTRAIRE À LA LOI, NOUS POUVONS RESTREINDRE OU FERMER UN COMPTE, AVEC OU SANS PRÉAVIS.
          </Text>
        </View>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>3. Ce qu&apos;on vend</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>3.1 Les articles bienvenus</Text>
        <Text style={styles.paragraph}>Bloomi est dédié à la mode de seconde main. Sont les bienvenus :</Text>
        <Text style={styles.bullet}>• Vêtements (neufs, d&apos;occasion ou jamais portés),</Text>
        <Text style={styles.bullet}>• Chaussures,</Text>
        <Text style={styles.bullet}>• Sacs, ceintures et accessoires de maroquinerie,</Text>
        <Text style={styles.bullet}>• Bijoux fantaisie et montres,</Text>
        <Text style={styles.bullet}>• Lunettes et autres accessoires de mode,</Text>
        <Text style={styles.bullet}>• Jouets pour enfants,</Text>
        <Text style={styles.bullet}>• Livres enfants.</Text>
        <Text style={styles.h2}>3.2 Les articles interdits</Text>
        <Text style={styles.paragraph}>Certains articles n&apos;ont pas leur place sur Bloomi. Sont interdits :</Text>
        <Text style={styles.bullet}>
          • tout article illégal au regard du droit suisse (armes, drogues, espèces protégées, etc.),
        </Text>
        <Text style={styles.bullet}>• tout article dont la description serait mensongère ou trompeuse.</Text>
        <Text style={styles.paragraph}>
          Nous nous réservons le droit de retirer tout article non conforme, sans préavis et sans indemnité.
        </Text>
        <Text style={styles.h2}>3.3 Vos annonces, votre responsabilité</Text>
        <Text style={styles.paragraph}>Quand vous publiez une annonce sur Bloomi, vous vous engagez à :</Text>
        <Text style={styles.bullet}>• décrire l&apos;article honnêtement et fidèlement (photos, état, taille, etc.),</Text>
        <Text style={styles.bullet}>• utiliser de vraies photos de l&apos;article, pas de visuels générés par IA,</Text>
        <Text style={styles.bullet}>
          • ne pas publier de contenus blessants, discriminatoires ou illicites.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>4. Comment se passe une vente ?</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>4.1 Le contrat est entre vous</Text>
        <Text style={styles.paragraph}>
          Lorsqu&apos;un acheteur paie un article, un contrat de vente est conclu directement entre lui et le vendeur.
          Bloomi n&apos;est pas partie à ce contrat. Notre rôle est de fournir l&apos;infrastructure technique qui rend la
          transaction possible.
        </Text>
        <Text style={styles.h2}>4.2 Les règles selon le type de vendeur</Text>
        <Text style={styles.bullet}>
          • Vente entre particuliers : les CGU Bloomi s&apos;appliquent intégralement, y compris la politique de retour de
          l&apos;article 5.
        </Text>
        <Text style={styles.bullet}>
          • Vente par une boutique pro : les CGV de la boutique s&apos;appliquent. Bloomi n&apos;intervient pas dans les
          retours ni les litiges.
        </Text>
        <Text style={styles.h2}>4.3 Les paiements, c&apos;est Stripe qui gère</Text>
        <Text style={styles.paragraph}>
          Tous les paiements sur Bloomi sont traités par Stripe, Inc., notre prestataire de paiement sécurisé. Bloomi
          encaisse les fonds via Stripe pour votre compte et vous les reverse une fois la transaction validée. Nous ne
          conservons pas vos fonds sur nos propres comptes.
        </Text>
        <Text style={styles.paragraph}>
          Stripe peut bloquer temporairement des fonds dans le cadre de ses contrôles réglementaires. Bloomi n&apos;a aucune
          prise sur ces décisions et ne peut en être tenu responsable.
        </Text>
        <Text style={styles.h2}>4.4 Le déroulement d&apos;une transaction</Text>
        <Text style={styles.paragraph}>Vous vendez : vous avez 4 jours pour expédier</Text>
        <Text style={styles.paragraph}>
          Dès que l&apos;acheteur a payé, vous recevez une notification. Vous disposez alors de 4 jours ouvrables maximum
          pour expédier le colis. Passé ce délai sans expédition, la commande est annulée et l&apos;acheteur est remboursé.
        </Text>
        <Text style={styles.paragraph}>La vente est confirmée</Text>
        <Text style={styles.paragraph}>
          La transaction est validée dès que l&apos;acheteur confirme la réception de son colis. S&apos;il ne donne pas signe de
          vie dans les 48 heures suivant la livraison, la transaction est automatiquement validée. Les fonds vous sont
          alors reversés via Stripe.
        </Text>
        <Text style={styles.paragraph}>Si quelque chose se passe mal</Text>
        <Text style={styles.bullet}>
          • Vous n&apos;expédiez pas dans les délais : l&apos;acheteur est remboursé (prix + livraison, hors frais de protection
          acheteur) et votre compte peut être sanctionné.
        </Text>
        <Text style={styles.bullet}>
          • Vous annulez parce que l&apos;article n&apos;est plus disponible : l&apos;acheteur est intégralement remboursé.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>5. Les retours</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.paragraph}>
          Important : Cette section ne s&apos;applique qu&apos;aux transactions entre particuliers. Pour les achats auprès d&apos;une
          boutique professionnelle, ce sont les conditions de retour de la boutique qui s&apos;appliquent. Bloomi
          n&apos;intervient pas dans ces cas-là.
        </Text>
        <Text style={styles.h2}>5.1 Vous avez 24 heures pour signaler un problème</Text>
        <Text style={styles.paragraph}>
          En tant qu&apos;acheteur, si l&apos;article reçu ne correspond pas à l&apos;annonce, vous disposez de 24 heures à compter
          de la validation de la réception pour ouvrir une demande de retour. Passé ce délai, la transaction est
          définitivement clôturée.
        </Text>
        <Text style={styles.h2}>5.2 Comment ça se passe</Text>
        <Text style={styles.bullet}>• Le retour se fait uniquement via La Poste Suisse.</Text>
        <Text style={styles.bullet}>• Les frais de retour sont à votre charge en tant qu&apos;acheteur.</Text>
        <Text style={styles.bullet}>
          • Le remboursement n&apos;inclut pas les frais de livraison initiale ni les frais de protection acheteur.
        </Text>
        <Text style={styles.paragraph}>
          Le remboursement est déclenché une fois que le vendeur a confirmé la réception du colis retour.
        </Text>
        <Text style={styles.h2}>5.3 Situations particulières</Text>
        <Text style={styles.bullet}>
          • Vous ne renvoyez pas le colis dans les temps : la transaction est définitivement validée, aucun remboursement
          possible.
        </Text>
        <Text style={styles.bullet}>
          • Vous utilisez un autre transporteur que La Poste : le vendeur peut refuser le retour, aucun remboursement
          possible.
        </Text>
        <Text style={styles.bullet}>
          • Le colis retour est perdu par La Poste : Bloomi n&apos;est pas responsable des pertes postales. L&apos;acheteur est
          remboursé du montant de l&apos;article, le vendeur est dédommagé selon la décision de La Poste.
        </Text>
        <Text style={styles.h2}>5.4 Notre rôle dans les litiges entre particuliers</Text>
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            BLOOMI NE FAIT PAS DE MÉDIATION ENTRE PARTICULIERS. EN TANT QU&apos;INTERMÉDIAIRE TECHNIQUE, NOUS NE POUVONS PAS
            VÉRIFIER L&apos;AUTHENTICITÉ DES RÉCLAMATIONS. C&apos;EST PRÉCISÉMENT POUR ÇA QUE NOUS AVONS MIS EN PLACE UN DROIT DE
            RETOUR CLAIR ET SYSTÉMATIQUE : SI VOUS N&apos;ÊTES PAS SATISFAIT·E, VOUS RETOURNEZ L&apos;ARTICLE ET VOUS ÊTES
            REMBOURSÉ·E.
          </Text>
        </View>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>6. Livraison</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>6.1 Les modes de livraison disponibles</Text>
        <Text style={styles.paragraph}>
          En tant que vendeur, vous choisissez au moment de la mise en ligne comment vous souhaitez expédier votre
          article :
        </Text>
        <Text style={styles.bullet}>• La Poste Suisse (avec numéro de suivi),</Text>
        <Text style={styles.bullet}>• Remise en main propre.</Text>
        <Text style={styles.h2}>6.2 La remise en main propre</Text>
        <Text style={styles.paragraph}>
          Si vous proposez ce mode de livraison, une fois la vente et le paiement confirmés, acheteur et vendeur
          peuvent échanger leur numéro de téléphone et leur adresse via la messagerie Bloomi pour organiser la remise.
          L&apos;organisation du rendez-vous et l&apos;échange de l&apos;article se font ensuite directement entre les deux parties.
        </Text>
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            BLOOMI N&apos;INTERVIENT PAS DANS CE TYPE D&apos;ARRANGEMENT ET NE PEUT ETRE TENU RESPONSABLE DE CE QUI S&apos;Y PASSE.
          </Text>
        </View>
        <Text style={styles.h2}>6.3 Les frais de livraison</Text>
        <Text style={styles.paragraph}>
          Les frais de livraison sont fixés par Bloomi et affichés clairement au moment de la commande. Ils sont à la
          charge de l&apos;acheteur, sauf mention contraire.
        </Text>
        <Text style={styles.h2}>6.4 C&apos;est le vendeur qui est responsable de l&apos;envoi</Text>
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            EN TANT QUE VENDEUR, VOUS ÊTES RESPONSABLE DE L&apos;EMBALLAGE, DE L&apos;ADRESSAGE ET DU DÉPÔT DU COLIS DANS LES
            DÉLAIS. BLOOMI N&apos;EST PAS RESPONSABLE DES PROBLÈMES LIÉS À UN COLIS MAL EMBALLÉ, MAL ADRESSÉ OU DÉPOSÉ HORS
            DÉLAIS.
          </Text>
        </View>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>7. Frais et commissions</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>7.1 La commission Bloomi</Text>
        <Text style={styles.paragraph}>
          Bloomi prélève une commission sur chaque vente réalisée via la plateforme. Le barème exact est disponible à
          tout moment dans notre espace d&apos;aide. Nous nous réservons le droit de le faire évoluer. Toute modification
          ne s&apos;applique qu&apos;aux ventes passées après la mise en ligne du nouveau barème.
        </Text>
        <Text style={styles.h2}>7.2 Les frais de protection acheteur</Text>
        <Text style={styles.paragraph}>
          Ces frais, affichés clairement avant le paiement, permettent de :
        </Text>
        <Text style={styles.bullet}>• sécuriser temporairement les fonds jusqu&apos;à la réception confirmée,</Text>
        <Text style={styles.bullet}>• rembourser l&apos;acheteur si le vendeur n&apos;expédie pas,</Text>
        <Text style={styles.bullet}>
          • dédommager le vendeur si le colis est perdu par le transporteur.
        </Text>
        <Text style={styles.paragraph}>Ces frais ne sont pas remboursés en cas de retour.</Text>
        <Text style={styles.h2}>7.3 Comment payer sur Bloomi</Text>
        <Text style={styles.paragraph}>
          Les moyens de paiement disponibles sont ceux proposés par Stripe au moment de votre commande. Bloomi peut en
          ajouter ou en retirer à tout moment.
        </Text>
        <Text style={styles.h2}>7.4 Quand est-ce que vous recevez votre argent ?</Text>
        <Text style={styles.paragraph}>
          Une fois la transaction validée, votre solde est disponible dans votre espace personnel. Vous pouvez demander
          un virement à tout moment. Le délai de traitement est généralement de 4 à 12 jours selon Stripe. Bloomi ne
          peut pas garantir ce délai avec précision. Les fonds disponibles peuvent aussi être utilisés directement pour
          acheter sur Bloomi.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>8. Ce que Bloomi ne peut pas garantir</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>8.1 Notre rôle reste technique</Text>
        <Text style={styles.paragraph}>
          Bloomi n&apos;est pas une boutique, une banque, ni un service de garde de fonds. Nous mettons en relation des
          acheteurs et des vendeurs. Nous ne garantissons pas la qualité des articles publiés, ni la bonne exécution
          des contrats conclus entre utilisateurs.
        </Text>
        <Text style={styles.h2}>8.2 Ce dont Bloomi n&apos;est pas responsable</Text>
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            SOUS RÉSERVE DE CE QUE LA LOI IMPOSE, BLOOMI NE PEUT PAS ÊTRE TENU RESPONSABLE DE :
          </Text>
          <Text style={styles.clauseBullet}>• LA DESCRIPTION INEXACTE D&apos;UN ARTICLE PAR UN VENDEUR,</Text>
          <Text style={styles.clauseBullet}>• LES RETARDS OU PROBLÈMES DE LIVRAISON,</Text>
          <Text style={styles.clauseBullet}>• LES DOMMAGES CAUSÉS PAR UN ARTICLE ACHETÉ,</Text>
          <Text style={styles.clauseBullet}>• LES LITIGES ENTRE UTILISATEURS,</Text>
          <Text style={styles.clauseBullet}>
            • TOUTE PERTE FINANCIÈRE OU DE DONNÉES LIÉE À L&apos;UTILISATION DE LA PLATEFORME.
          </Text>
        </View>
        <Text style={styles.h2}>8.3 Cas de force majeure</Text>
        <Text style={styles.paragraph}>
          Bloomi n&apos;est pas responsable des interruptions de service causées par des événements hors de notre contrôle :
          pannes internet, catastrophes naturelles, décisions administratives, grèves ou autres situations de force
          majeure au sens du droit suisse.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>9. Vos contenus et nos droits</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>9.1 La marque et la plateforme Bloomi nous appartiennent</Text>
        <Text style={styles.paragraph}>
          Le nom Bloomi, notre logo, notre design, notre code et tous les éléments de la plateforme sont la propriété
          exclusive de Bloomi Sàrl, protégés par le droit suisse et international. Toute reproduction non autorisée est
          interdite.
        </Text>
        <Text style={styles.h2}>9.2 Ce que vous publiez sur Bloomi</Text>
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            EN PUBLIANT DES PHOTOS OU DES DESCRIPTIONS SUR BLOOMI, VOUS CONFIRMEZ EN ÊTRE L&apos;AUTEUR OU AVOIR LES DROITS
            NÉCESSAIRES. VOUS ACCORDEZ À BLOOMI UNE LICENCE GRATUITE ET NON EXCLUSIVE POUR AFFICHER, HÉBERGER ET
            UTILISER CES CONTENUS DANS LE CADRE DU FONCTIONNEMENT ET DE LA PROMOTION DE LA PLATEFORME.
          </Text>
        </View>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>10. Données personnelles</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.paragraph}>
          Chez Bloomi, la confiance passe aussi par le respect de votre vie privée. Nous traitons vos données
          conformément à la loi fédérale suisse sur la protection des données (LPD) et à notre Politique de
          confidentialité, disponible sur la plateforme.
        </Text>
        <Text style={styles.paragraph}>
          Nous collectons uniquement ce dont nous avons besoin pour faire fonctionner Bloomi : vos informations de
          compte, vos transactions, et pour les vendeurs, les données transmises à Stripe pour la vérification
          d&apos;identité.
        </Text>
        <Text style={styles.paragraph}>
          Vous pouvez à tout moment accéder à vos données, les corriger ou en demander la suppression en nous écrivant à
          contact@bloomi.ch.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>11. Votre compte et sa fermeture</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>11.1 Quand vous souhaitez partir</Text>
        <Text style={styles.paragraph}>
          Vous pouvez supprimer votre compte Bloomi à tout moment depuis l&apos;application ou le site. La suppression est
          définitive : vous perdez l&apos;accès à votre historique de transactions. Pensez à retirer votre solde avant de
          partir.
        </Text>
        <Text style={styles.h2}>11.2 Quand Bloomi doit intervenir</Text>
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            NOUS POUVONS SUSPENDRE OU FERMER UN COMPTE EN CAS DE FRAUDE, DE VIOLATION DE CES CGU, D&apos;USAGE ABUSIF DE LA
            PLATEFORME OU DE NON-RESPECT DE LA LOI APPLICABLE.
          </Text>
        </View>
        <Text style={styles.paragraph}>
          La fermeture d&apos;un compte ne signifie pas la perte de vos fonds détenus chez Stripe. Vous restez responsable
          de retirer votre solde selon les conditions de Stripe.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>12. Évolution des CGU</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.paragraph}>
          Bloomi est une plateforme vivante, nos CGU peuvent évoluer. En cas de modification substantielle, nous vous
          en informerons par notification dans l&apos;app ou par e-mail avant leur entrée en vigueur.
        </Text>
        <Text style={styles.paragraph}>
          Les modifications ne s&apos;appliquent pas aux transactions déjà en cours au moment de leur publication.
        </Text>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>13. Droit applicable</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.h2}>13.1 Le droit suisse s&apos;applique</Text>
        <Text style={styles.paragraph}>
          Ces CGU et toute relation entre Bloomi et ses utilisateurs sont régies exclusivement par le droit suisse.
        </Text>
        <Text style={styles.h2}>13.2 D&apos;abord, on cherche une solution ensemble</Text>
        <View style={styles.clauseBox}>
          <Text style={styles.clauseText}>
            EN CAS DE LITIGE, NOUS PRIVILÉGIONS TOUJOURS LA DISCUSSION. ÉCRIVEZ-NOUS À CONTACT@BLOOMI.CH ET NOUS FERONS
            NOTRE POSSIBLE POUR TROUVER UNE SOLUTION AMIABLE. SI AUCUN ACCORD N&apos;EST TROUVÉ DANS UN DÉLAI RAISONNABLE,
            LES TRIBUNAUX DU CANTON DE VAUD SERONT COMPÉTENTS, SOUS RÉSERVE DES DISPOSITIONS IMPÉRATIVES EN FAVEUR DES
            CONSOMMATEURS.
          </Text>
        </View>

        <View style={styles.articleHeader}>
          <Text style={styles.articleTitle}>14. Nous contacter</Text>
          <View style={styles.separator} />
        </View>
        <Text style={styles.paragraph}>Une question sur ces CGU ? Un doute sur une transaction ? On est là.</Text>
        <Text style={styles.bullet}>• E-mail : contact@bloomi.ch</Text>
        <Text style={styles.bullet}>• Site web : www.bloomi.ch</Text>
        <Text style={styles.bullet}>• Adresse : Bloomi Sàrl, 1091 Grandvaux, Suisse</Text>
        <Text style={styles.paragraph}>Merci de faire partie de la communauté Bloomi 🌱</Text>

        <Text style={styles.footer}>© 2026 Bloomi Sàrl — Tous droits réservés</Text>
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

