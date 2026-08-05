/**
 * Remplace legal.help dans en.json / fr.json (contenu centre d'aide).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const helpEn = {
  pageTitle: 'Bloomi Help Center',
  buyTitle: 'BUY',
  sellTitle: 'SELL',
  accountTitle: 'ACCOUNT',
  miscTitle: 'MISC',
  buy: {
    personalizeFeed: {
      question: 'How can you personalize your feed?',
      answer:
        'Your feed adapts based on your searches, favorites, and interactions. The more you use the app, the more relevant suggestions become.'
    },
    buyItem: {
      question: 'How do you buy an item?',
      answer:
        'Open the listing, tap Buy, choose delivery or in-person handoff, then confirm payment.'
    },
    saveSearch: {
      question: 'How do you save a search?',
      answer:
        'After applying your filters, use Save search to get notified when new matching items are posted.'
    },
    chatMember: {
      question: 'How do you chat with a member?',
      answer: 'Tap Message from a listing to ask your questions before buying.'
    },
    favorites: {
      question: 'How do you add an item to favorites?',
      answer: 'Tap the heart on a listing. You can quickly find your favorites later.'
    },
    makeOffer: {
      question: 'How do you make an offer?',
      answer: 'If enabled by the seller, use Make an offer to propose a different price.'
    },
    reserve: {
      question: 'How do you reserve an item?',
      answer: 'Some sellers accept reservations through messaging or with a dedicated option.'
    },
    bundle: {
      question: 'How do you buy a bundle?',
      answer: 'Contact the seller or use a bundle option (if available) to group multiple items.'
    },
    trackOrder: {
      question: 'How do you track your order?',
      answer: 'Go to My purchases to view tracking and delivery details.'
    },
    itemMismatch: {
      question: 'What if the item does not match the listing?',
      answer: 'Report the issue from your order with photos and a clear explanation.'
    },
    cancelPurchase: {
      question: 'Can you cancel a purchase?',
      answer: 'Yes, but only before shipment or confirmation.'
    },
    findItems: {
      question: 'How can you find items more easily?',
      answer: 'Use filters, categories, brands, and location to narrow down your search.'
    }
  },
  sell: {
    manageListings: {
      question: 'How do you manage your listings?',
      answer: 'In My listings, you can edit, pause, or delete your listings.'
    },
    sellingBasics: {
      question: 'What are the basics for selling well?',
      answer: 'Use clear photos, an honest description, a fair price, and reply quickly.'
    },
    postListing: {
      question: 'How do you post a listing?',
      answer: 'Tap Sell, add photos, description, category, and price, then publish.'
    },
    payments: {
      question: 'How do payments and transfers work?',
      answer: 'Funds are secured and transferred after the transaction is validated.'
    },
    listingRemoved: {
      question: 'Why can a listing be removed?',
      answer:
        'A listing may be removed if an item is prohibited, non-compliant, counterfeit, or misleadingly described.'
    },
    shippingReturns: {
      question: 'How do shipping and returns work?',
      answer: 'Instructions are sent after a sale. Returns may be available under Bloomi conditions.'
    },
    proAccount: {
      question: 'Professional seller account (if enabled)',
      answer:
        'You may get specific tools such as more visibility, advanced management, and business options.'
    },
    tips: {
      question: 'Recommended tips for you',
      answer: 'Bloomi may suggest tips or guidance based on your activity.'
    }
  },
  account: {
    manageProfile: {
      question: 'What can you manage in your profile?',
      answer: 'Photo, bio, personal info, notifications, security settings, and preferences.'
    },
    verifyIdentity: {
      question: 'Why verify your phone number or identity?',
      answer: 'To secure transactions and reduce fraud.'
    },
    signUpSignIn: {
      question: 'How do sign-up and sign-in work?',
      answer:
        'You can create an account with email, phone, or another available method. Your password can be reset.'
    },
    accountBlocked: {
      question: 'Why can an account be blocked?',
      answer: 'Because of rule violations, security concerns, or unusual activity.'
    },
    ratings: {
      question: 'How do ratings and stars work?',
      answer: 'After a transaction, each member can leave a review.'
    },
    privacy: {
      question: 'What should you know about data privacy?',
      answer: 'You can manage your settings and control some visible profile information.'
    },
    security: {
      question: 'Security and reports: the basics',
      answer: 'Report suspicious behavior and avoid off-platform payments.'
    },
    referrals: {
      question: 'Referrals',
      answer: 'Some referral features may exist depending on app updates.'
    },
    policies: {
      question: 'Bloomi terms and policies',
      answer: 'Usage rules and policies are available in the app.'
    },
    suggestions: {
      question: 'Personalized account suggestions',
      answer: 'Recommendations may appear based on your usage.'
    }
  },
  misc: {
    contactSupport: {
      question: 'How do you contact Bloomi support?',
      answer: 'Use the Help center or email contact@bloomi.ch.'
    },
    report: {
      question: 'How do you report a user or listing?',
      answer: 'Use the Report button from a profile, listing, or conversation.'
    },
    prohibited: {
      question: 'Which items are prohibited?',
      answer: 'Illegal, dangerous, counterfeit, or non-compliant products are not allowed.'
    },
    staySafe: {
      question: 'How can you stay safe on the app?',
      answer: 'Stay within Bloomi messaging and avoid sharing sensitive information.'
    },
    bug: {
      question: 'What if the app has a bug?',
      answer: 'Update the app, restart your phone, or check your connection.'
    }
  }
};

const helpFr = {
  pageTitle: "Centre d'aide Bloomi",
  buyTitle: 'ACHETER',
  sellTitle: 'VENDRE',
  accountTitle: 'COMPTE',
  miscTitle: 'DIVERS',
  buy: {
    personalizeFeed: {
      question: 'Comment personnaliser votre fil ?',
      answer:
        'Votre fil s\'adapte à vos recherches, favoris et interactions. Plus vous utilisez l\'application, plus les suggestions deviennent pertinentes.'
    },
    buyItem: {
      question: 'Comment acheter un article ?',
      answer:
        'Ouvrez l\'annonce, appuyez sur Acheter, choisissez la livraison ou la remise en main propre, puis confirmez le paiement.'
    },
    saveSearch: {
      question: 'Comment enregistrer une recherche ?',
      answer:
        'Après avoir appliqué vos filtres, utilisez Enregistrer la recherche pour être notifié lorsque de nouveaux articles correspondants sont publiés.'
    },
    chatMember: {
      question: 'Comment discuter avec un membre ?',
      answer: 'Appuyez sur Message depuis une annonce pour poser vos questions avant d\'acheter.'
    },
    favorites: {
      question: 'Comment ajouter un article aux favoris ?',
      answer: 'Appuyez sur le cœur d\'une annonce. Retrouvez vos favoris à tout moment.'
    },
    makeOffer: {
      question: 'Comment faire une offre ?',
      answer: 'Si le vendeur l\'autorise, utilisez Faire une offre pour proposer un autre prix.'
    },
    reserve: {
      question: 'Comment réserver un article ?',
      answer: 'Certains vendeurs acceptent les réservations par message ou via une option dédiée.'
    },
    bundle: {
      question: 'Comment acheter un lot ?',
      answer: 'Contactez le vendeur ou utilisez une option lot (si disponible) pour regrouper plusieurs articles.'
    },
    trackOrder: {
      question: 'Comment suivre votre commande ?',
      answer: 'Rendez-vous dans Mes achats pour voir le suivi et les détails de livraison.'
    },
    itemMismatch: {
      question: 'Et si l\'article ne correspond pas à l\'annonce ?',
      answer: 'Signalez le problème depuis votre commande avec des photos et une explication claire.'
    },
    cancelPurchase: {
      question: 'Pouvez-vous annuler un achat ?',
      answer: 'Oui, mais uniquement avant l\'expédition ou la confirmation.'
    },
    findItems: {
      question: 'Comment trouver des articles plus facilement ?',
      answer: 'Utilisez les filtres, catégories, marques et la localisation pour affiner votre recherche.'
    }
  },
  sell: {
    manageListings: {
      question: 'Comment gérer vos annonces ?',
      answer: 'Dans Mes annonces, vous pouvez modifier, mettre en pause ou supprimer vos annonces.'
    },
    sellingBasics: {
      question: 'Les bases pour bien vendre ?',
      answer: 'Utilisez des photos claires, une description honnête, un prix juste et répondez rapidement.'
    },
    postListing: {
      question: 'Comment publier une annonce ?',
      answer: 'Appuyez sur Vendre, ajoutez photos, description, catégorie et prix, puis publiez.'
    },
    payments: {
      question: 'Comment fonctionnent les paiements et virements ?',
      answer: 'Les fonds sont sécurisés et transférés une fois la transaction validée.'
    },
    listingRemoved: {
      question: 'Pourquoi une annonce peut-elle être supprimée ?',
      answer:
        'Une annonce peut être retirée si l\'article est interdit, non conforme, contrefait ou décrit de manière trompeuse.'
    },
    shippingReturns: {
      question: 'Comment fonctionnent l\'expédition et les retours ?',
      answer: 'Les instructions sont envoyées après une vente. Les retours peuvent être possibles selon les conditions Bloomi.'
    },
    proAccount: {
      question: 'Compte vendeur professionnel (si activé)',
      answer:
        'Vous pouvez bénéficier d\'outils spécifiques : plus de visibilité, gestion avancée et options professionnelles.'
    },
    tips: {
      question: 'Conseils recommandés pour vous',
      answer: 'Bloomi peut vous suggérer des conseils en fonction de votre activité.'
    }
  },
  account: {
    manageProfile: {
      question: 'Que pouvez-vous gérer dans votre profil ?',
      answer: 'Photo, bio, informations personnelles, notifications, sécurité et préférences.'
    },
    verifyIdentity: {
      question: 'Pourquoi vérifier votre numéro ou identité ?',
      answer: 'Pour sécuriser les transactions et réduire la fraude.'
    },
    signUpSignIn: {
      question: 'Comment fonctionnent l\'inscription et la connexion ?',
      answer:
        'Vous pouvez créer un compte par e-mail, téléphone ou une autre méthode disponible. Votre mot de passe peut être réinitialisé.'
    },
    accountBlocked: {
      question: 'Pourquoi un compte peut-il être bloqué ?',
      answer: 'En cas de violation des règles, de problème de sécurité ou d\'activité inhabituelle.'
    },
    ratings: {
      question: 'Comment fonctionnent les notes et avis ?',
      answer: 'Après une transaction, chaque membre peut laisser un avis.'
    },
    privacy: {
      question: 'Que faut-il savoir sur la confidentialité ?',
      answer: 'Vous pouvez gérer vos paramètres et contrôler certaines informations visibles sur votre profil.'
    },
    security: {
      question: 'Sécurité et signalements : l\'essentiel',
      answer: 'Signalez les comportements suspects et évitez les paiements hors plateforme.'
    },
    referrals: {
      question: 'Parrainage',
      answer: 'Certaines fonctionnalités de parrainage peuvent exister selon les mises à jour de l\'application.'
    },
    policies: {
      question: 'Conditions et politiques Bloomi',
      answer: 'Les règles d\'utilisation et politiques sont disponibles dans l\'application.'
    },
    suggestions: {
      question: 'Suggestions personnalisées',
      answer: 'Des recommandations peuvent apparaître en fonction de votre utilisation.'
    }
  },
  misc: {
    contactSupport: {
      question: 'Comment contacter le support Bloomi ?',
      answer: 'Utilisez le Centre d\'aide ou écrivez à contact@bloomi.ch.'
    },
    report: {
      question: 'Comment signaler un utilisateur ou une annonce ?',
      answer: 'Utilisez le bouton Signaler depuis un profil, une annonce ou une conversation.'
    },
    prohibited: {
      question: 'Quels articles sont interdits ?',
      answer: 'Les produits illégaux, dangereux, contrefaits ou non conformes ne sont pas autorisés.'
    },
    staySafe: {
      question: 'Comment rester en sécurité sur l\'application ?',
      answer: 'Restez dans la messagerie Bloomi et évitez de partager des informations sensibles.'
    },
    bug: {
      question: 'Et si l\'application a un bug ?',
      answer: 'Mettez à jour l\'application, redémarrez votre téléphone ou vérifiez votre connexion.'
    }
  }
};

for (const [lang, help] of [
  ['en', helpEn],
  ['fr', helpFr]
]) {
  const file = path.join(root, 'locales', `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.legal.help = help;
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log('Updated legal.help in', lang);
}
