# Roadmap — Build Your Team

## Immédiat : avant toute publication

1. **Contenu.** Choisir la stratégie de données (voir DATA_LICENSING) : rester sur des joueurs fictifs, ou signer avec un fournisseur sous licence et négocier les droits sur les noms et l'image (FIFPRO, clubs). Import avec `npm run data:import`.
2. **Légal.** Compléter le contact de l'éditeur dans `/privacy` et publier la politique sur une URL publique. Faire relire DATA_LICENSING et STORE_RELEASE par un juriste.
3. **Comptes.** Expo/EAS, Apple Developer (99 $/an), Google Play (25 $), Vercel, Fly.io ou Render, Supabase.
4. **Appareils réels.** Faire une partie à 4 sur iPhone et Android via EAS `preview`. Vérifier : sons, vibrations, retour au premier plan, rotation, clavier numérique de l'enchère libre.
5. **Modération.** Remplacer la liste de mots bloqués par une liste maintenue ou un service, et ajouter un bouton de signalement si les pseudos sont considérés comme du contenu utilisateur (guideline 1.2 d'Apple).

## Court terme (v1.1)

- Revanche en un clic : même salon, nouvelles équipes.
- Image de résultat générée côté serveur (`og:image`) pour un partage plus riche, en plus du lien et du texte actuels.
- Réglage du volume par catégorie (interface ou ambiance) et ambiance sonore de stade discrète.
- Glisser-déposer des cartes sur le terrain, en plus du système actuel « toucher puis toucher ».
- QR code du salon dans le lobby, pour rejoindre en scannant.
- Tutoriel interactif de 30 s.
- Mode classique : vote sur 11 titulaires, avec un affichage plus lisible des cartes sur petit écran (zoom au toucher).

## Moyen terme

- **Plusieurs instances** du serveur temps réel : chaque salon appartient à une instance (adaptateur Socket.IO Redis et routage par code de salon), avec reprise après la panne d'une instance grâce aux instantanés PostgreSQL déjà en place.
- **Nouveaux univers** : rendu du fond du terrain paramétrable par pack (terrain de basket, arène…), packs basketball et premier univers original. Le moteur ne change pas.
- Comptes facultatifs (Apple, Google, e-mail) pour garder un historique, des statistiques et des amis. Le mode invité reste par défaut.
- Matchmaking public et salons ouverts.
- Spectateurs en direct pendant les enchères, avec réactions.

## Commercialisation

- **Modèle freemium.** Le jeu de base reste gratuit. Packs d'univers premium, styles de cartes et de terrains cosmétiques, passe « organisateur » (salons à 8, tournois). **Aucune mécanique d'argent réel** dans les enchères : les budgets restent virtuels, pour garder la classification d'âge et éviter les questions de jeux d'argent.
- **Mesure d'audience** respectueuse de la vie privée (événements agrégés, sans publicité ciblée), à déclarer dans les fiches des stores.
- **Partenariats** : créateurs de contenu football, soirées entre amis, événements de bars sportifs (mode « écran géant » où le terrain s'affiche sur une TV).
