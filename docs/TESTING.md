# Guide de test de l'API - Bloomi App

## Prérequis

1. ✅ Le schéma Supabase est appliqué (`docs/supabase_schema.sql`)
2. ✅ Les politiques RLS sont appliquées (`docs/supabase_rls.sql`)
3. ✅ Vous êtes connecté dans l'app (auth fonctionne)

## Méthode 1: Écran de test intégré

### Ajouter l'onglet de test

1. Ouvrir `app/tabs/_layout.tsx`
2. Ajouter l'onglet "Test" dans la configuration des tabs:

```typescript
<Tabs.Screen
  name="test/index"
  options={{
    title: 'Test',
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="flask-outline" size={size} color={color} />
    )
  }}
/>
```

3. L'écran `app/tabs/test/index.tsx` est déjà créé avec des boutons de test

### Utiliser l'écran de test

1. Lancer l'app: `npm start`
2. Se connecter avec votre compte
3. Aller dans l'onglet "Test"
4. Cliquer sur les boutons pour tester chaque fonction API
5. Voir les résultats dans la zone de résultat

## Méthode 2: Test depuis un écran existant

### Exemple: Tester dans FeedScreen

Modifier `app/tabs/feed/index.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { getPublishedListings } from '../../../lib/api';
import type { ListingWithRelations } from '../../../lib/types';

export default function FeedScreen() {
  const [listings, setListings] = useState<ListingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadListings();
  }, []);

  const loadListings = async () => {
    try {
      setLoading(true);
      const result = await getPublishedListings({ page: 1, pageSize: 20 });
      setListings(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      console.error('Erreur chargement listings:', err);
    } finally {
      setLoading(false);
    }
  };

  // ... reste du code
}
```

## Méthode 3: Test depuis la console (React Native Debugger)

### Activer le debugger

1. Lancer l'app
2. Secouer le téléphone (ou `Cmd+D` sur iOS, `Cmd+M` sur Android)
3. Sélectionner "Debug"
4. Ouvrir la console du navigateur

### Tester dans la console

```javascript
// Dans la console du navigateur (React Native Debugger)
import { getPublishedListings, createListing } from './lib/api';

// Test 1: Récupérer les annonces publiées
const listings = await getPublishedListings({ page: 1, pageSize: 10 });
console.log('Listings:', listings);

// Test 2: Créer une annonce
const newListing = await createListing({
  seller_id: '', // Rempli automatiquement par RLS
  title: 'Test Annonce',
  description: 'Description de test',
  price: 29.99,
  status: 'draft',
  category: 'test',
  condition: 'new',
  delivery_mode: 'both',
  city: 'Genève',
  country_code: 'CH'
});
console.log('Nouvelle annonce:', newListing);

// Test 3: Récupérer mes annonces
const myListings = await getMyListings();
console.log('Mes annonces:', myListings);

// Test 4: Récupérer mes conversations
const threads = await getThreads();
console.log('Mes conversations:', threads);
```

## Scénarios de test complets

### Test 1: Créer une annonce

```typescript
import { createListing } from '@/lib/api';

// 1. Créer une annonce en brouillon
const draft = await createListing({
  seller_id: '', // Rempli automatiquement
  title: 'iPhone 13 Pro',
  description: 'Excellent état, boîte d\'origine',
  price: 899.99,
  status: 'draft',
  category: 'electronics',
  condition: 'like_new',
  delivery_mode: 'both',
  city: 'Genève',
  country_code: 'CH'
});

console.log('Annonce créée:', draft.id);

// 2. Publier l'annonce
const published = await updateListing(draft.id, {
  status: 'published',
  published_at: new Date().toISOString()
});

console.log('Annonce publiée:', published.id);
```

### Test 2: Ajouter des photos

```typescript
import { addListingPhoto } from '@/lib/api';

// Ajouter plusieurs photos
const photo1 = await addListingPhoto(listingId, 'https://example.com/photo1.jpg', 0);
const photo2 = await addListingPhoto(listingId, 'https://example.com/photo2.jpg', 1);
const photo3 = await addListingPhoto(listingId, 'https://example.com/photo3.jpg', 2);

console.log('Photos ajoutées:', [photo1, photo2, photo3]);
```

### Test 3: Créer une conversation

```typescript
import { getOrCreateThread, sendMessage } from '@/lib/api';

// 1. Créer ou récupérer un thread
const thread = await getOrCreateThread(listingId);
console.log('Thread:', thread.id);

// 2. Envoyer un message
const message = await sendMessage(thread.id, 'Bonjour, est-ce que c\'est encore disponible?');
console.log('Message envoyé:', message.id);

// 3. Récupérer tous les messages
const messages = await getMessages(thread.id);
console.log('Messages:', messages);
```

### Test 4: Créer une commande

```typescript
import { createOrder } from '@/lib/api';

// Récupérer d'abord le listing
const listing = await getListingById(listingId);

// Créer la commande
const order = await createOrder({
  listing_id: listingId,
  seller_id: listing.seller_id, // Rempli automatiquement
  buyer_id: '', // Rempli automatiquement par RLS
  status: 'pending',
  delivery_mode: 'shipping',
  shipping_address: '123 Rue de la Paix',
  shipping_city: 'Genève',
  shipping_postal_code: '1200',
  shipping_country: 'CH'
});

console.log('Commande créée:', order.id);
```

## Vérification des erreurs RLS

### Test: Vérifier que RLS fonctionne

```typescript
import { supabase } from '@/lib/supabase';

// Test 1: Essayer de lire tous les profiles (devrait échouer)
try {
  const { data, error } = await supabase.from('profiles').select('*');
  console.log('❌ RLS ne fonctionne pas!', data);
} catch (err) {
  console.log('✅ RLS fonctionne!', err);
}

// Test 2: Essayer de créer une annonce pour un autre utilisateur (devrait échouer)
try {
  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id: 'autre-user-id', // Pas votre ID
      title: 'Test',
      price: 10
    });
  console.log('❌ RLS ne fonctionne pas!', data);
} catch (err) {
  console.log('✅ RLS fonctionne!', err);
}
```

## Checklist de test

### ✅ Tests de base
- [ ] `getPublishedListings()` retourne des annonces publiées
- [ ] `createListing()` crée une annonce en brouillon
- [ ] `getMyListings()` retourne uniquement mes annonces
- [ ] `updateListing()` met à jour une annonce
- [ ] `deleteListing()` supprime une annonce

### ✅ Tests de photos
- [ ] `addListingPhoto()` ajoute une photo
- [ ] `deleteListingPhoto()` supprime une photo
- [ ] `reorderListingPhotos()` réordonne les photos

### ✅ Tests de messages
- [ ] `getThreads()` retourne mes conversations
- [ ] `getOrCreateThread()` crée un nouveau thread
- [ ] `getMessages()` retourne les messages d'un thread
- [ ] `sendMessage()` envoie un message

### ✅ Tests de commandes
- [ ] `createOrder()` crée une commande
- [ ] `getMyOrders()` retourne mes commandes
- [ ] `updateOrder()` met à jour une commande

### ✅ Tests RLS
- [ ] Impossible de lire les profiles d'autres utilisateurs
- [ ] Impossible de modifier les annonces d'autres utilisateurs
- [ ] Impossible de voir les messages d'autres conversations
- [ ] Impossible de créer une commande pour un autre utilisateur

## Dépannage

### Erreur: "relation does not exist"
→ Le schéma n'est pas appliqué. Exécuter `docs/supabase_schema.sql` dans Supabase.

### Erreur: "new row violates row-level security policy"
→ Les politiques RLS bloquent l'opération. Vérifier:
1. Vous êtes bien connecté (`auth.uid()` existe)
2. Les politiques RLS sont appliquées (`docs/supabase_rls.sql`)
3. Vous avez les droits nécessaires (owner, participant, etc.)

### Erreur: "foreign key constraint"
→ Une référence n'existe pas. Vérifier:
1. Le `seller_id` correspond à un profile existant
2. Le `listing_id` existe dans la table listings
3. Le `thread_id` existe dans la table threads

### Erreur: "duplicate key value"
→ Contrainte unique violée. Vérifier:
1. Un thread existe déjà pour ce `(listing_id, buyer_id)`
2. Un profile existe déjà pour cet `id`

## Prochaines étapes

Une fois les tests validés:
1. Implémenter l'UI complète dans les écrans existants
2. Ajouter la gestion d'erreurs utilisateur-friendly
3. Ajouter le loading states dans l'UI
4. Supprimer ou désactiver l'écran de test en production
