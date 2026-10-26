# Publication sur les stores — Build Your Team

> Dernière vérification des documentations officielles : 26 octobre 2026.

## ⚠ Avertissement — rien n'est publié

**Aucun build n'a été lancé, aucune app n'a été créée ni soumise sur l'App Store ou Google Play.**
Ce document décrit la procédure. Rien ne sera construit, soumis ou publié tant que le propriétaire
n'aura pas (1) créé lui-même les comptes Expo, Apple Developer et Google Play Console, (2) fourni
les identifiants nécessaires via les outils officiels (jamais par chat ni dans le repo), et
(3) donné une **autorisation explicite** pour chaque étape (build, envoi TestFlight / test interne,
soumission en revue, mise en production).

---

## 1. Prérequis

| Élément | Détail |
|---|---|
| Compte **Expo** | <https://expo.dev/signup> — EAS Build / Submit (plan gratuit : jusqu'à 15 builds Android + 15 builds iOS) |
| **Apple Developer Program** | **99 USD/an**. Organisation : numéro D-U-N-S requis (gratuit), site web et e-mail sur le domaine de l'organisation. <https://developer.apple.com/support/enrollment/> |
| **Google Play Console** | **25 USD** une fois, pièce d'identité + carte bancaire au nom légal, 18 ans minimum. <https://support.google.com/googleplay/android-developer/answer/6112435> |
| Serveur de production | En ligne avec HTTPS (voir [DEPLOYMENT.md](./DEPLOYMENT.md)) — les reviewers Apple/Google doivent pouvoir jouer. |
| URL publique de politique de confidentialité | Ex. `https://buildyourteam.app/privacy` (voir § 7). |
| Identifiants | iOS `com.buildyourteam.app`, Android `com.buildyourteam.app` (déjà dans `apps/game/app.json`). |

Configuration EAS : `apps/game/eas.json`
- `cli.appVersionSource: "remote"` : les numéros de build (`ios.buildNumber`, `android.versionCode`)
  sont gérés par les serveurs EAS ; `autoIncrement: true` sur `production`. La version affichée
  reste `expo.version` dans `app.json` (`0.1.0` aujourd'hui — passer à `1.0.0` pour la sortie).
- Profils : `development` (development build, distribution interne), `preview` (interne, **APK**
  Android, serveur de staging), `production` (stores, AAB Android, auto-incrément).
- Remplacer toutes les valeurs `REPLACE-ME` / `REPLACE_ME_*` avant usage.

Réf. : <https://docs.expo.dev/eas/json/>, <https://docs.expo.dev/build/eas-json/>,
<https://docs.expo.dev/build-reference/app-versions/>

## 2. EAS Build — commandes

Toutes les commandes se lancent **depuis `apps/game`** (EAS gère les monorepos et envoie le repo
entier au builder). EAS s'appuie sur git : committer avant de builder.

```bash
cd apps/game

# Une seule fois
npx eas-cli@latest login
npx eas-cli@latest init            # lie le projet Expo (ajoute extra.eas.projectId dans app.json)

# Development build (nécessite d'abord : npx expo install expo-dev-client)
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile development --platform ios

# Preview (tests internes, serveur de staging)
npx eas-cli@latest build --profile preview --platform android   # APK installable via lien/QR
npx eas-cli@latest device:create                                 # iOS : enregistrer les iPhone testeurs (ad hoc)
npx eas-cli@latest build --profile preview --platform ios

# Production (stores)
npx eas-cli@latest build --profile production --platform android  # .aab
npx eas-cli@latest build --profile production --platform ios      # .ipa
npx eas-cli@latest build --profile production --platform all
```

Les variables `EXPO_PUBLIC_SERVER_URL` et `EXPO_PUBLIC_WEB_URL` sont figées dans le binaire au build
(bloc `env` d'`eas.json` ou variables EAS de l'environnement `preview` / `production`, visibilité
*Plain text* : ce sont des valeurs publiques). Changer de serveur = reconstruire l'app.
Réf. : <https://docs.expo.dev/eas/environment-variables/>

## 3. Signature

### iOS
- Adhésion **Apple Developer Program** (99 USD/an) obligatoire pour TestFlight et l'App Store.
- Au premier `eas build` iOS, EAS propose de se connecter au compte Apple et **génère et stocke**
  le certificat de distribution et les profils de provisionnement (ad hoc pour `preview`,
  App Store pour `production`). Gestion : `npx eas-cli@latest credentials --platform ios`.
- `ITSAppUsesNonExemptEncryption: false` est déjà déclaré (HTTPS standard uniquement) : pas de
  question d'export à chaque build.

### Android
- EAS génère et stocke la **clé d'upload** (upload keystore) au premier build Android
  (`npx eas-cli@latest credentials --platform android` pour la consulter / sauvegarder).
- **Play App Signing** : Google conserve la clé de signature finale de l'app ; la clé EAS ne sert
  qu'à signer les uploads (réinitialisable via le support Google en cas de perte).
- Sauvegarder une copie du keystore (téléchargeable via `eas credentials`) dans un coffre-fort de
  mots de passe — jamais dans git.

Réf. : <https://docs.expo.dev/app-signing/managed-credentials/>, <https://support.google.com/googleplay/android-developer/answer/9842756>

## 4. EAS Submit

`submit.production` dans `eas.json` : Android → piste `internal`, `releaseStatus: "draft"`
(obligatoire tant que l'app n'a jamais été publiée) ; iOS → `appleId`, `ascAppId` (« Apple ID »
numérique de l'app dans App Store Connect → Informations sur l'app), `appleTeamId`.

```bash
# iOS → App Store Connect / TestFlight
npx eas-cli@latest submit --platform ios --profile production --latest

# Android → Google Play (piste de test interne)
npx eas-cli@latest submit --platform android --profile production --latest

# Ou build + soumission enchaînés (après autorisation explicite)
npx eas-cli@latest build --profile production --platform all --auto-submit
```

- **Google** : créer d'abord l'app dans la Play Console (*Créer une application*). EAS a besoin d'une
  **clé de compte de service Google** (JSON) : la téléverser sur expo.dev (identifiant d'application)
  ou via `npx eas-cli@latest credentials --platform android` — elle reste stockée chez EAS, **pas dans
  le repo** (c'est pourquoi `serviceAccountKeyPath` n'est pas renseigné). La toute première soumission
  peut se faire via `eas submit` (création de la release sur la piste interne).
- **Apple** : EAS peut créer une clé API App Store Connect (`eas credentials --platform ios`) ; requise
  pour le mode `--non-interactive` (CI). Le build apparaît dans TestFlight après traitement
  (~10–15 min).

Réf. : <https://docs.expo.dev/submit/android/>, <https://docs.expo.dev/submit/ios/>,
<https://docs.expo.dev/submit/eas-json/>

## 5. Tests avant publication

### iOS — TestFlight
- **Testeurs internes** : jusqu'à **100** membres de l'équipe App Store Connect (rôles Admin,
  Developer, App Manager, Marketing…), **sans revue** Apple ; disponible dès le traitement du build.
- **Testeurs externes** : jusqu'à **10 000** personnes (invitation par e-mail ou **lien public**) ;
  le premier build d'une version passe par la **Beta App Review** ; description de la bêta et
  informations de revue (contact, instructions) obligatoires.
- Un build TestFlight expire au bout de 90 jours.

Réf. : <https://developer.apple.com/testflight/>

### Android — Google Play
- **Test interne** : jusqu'à 100 testeurs (liste d'adresses e-mail), disponible en quelques minutes.
- **Règle des nouveaux comptes personnels** (comptes personnels créés **après le 13 novembre 2023**) :
  la production et la pré-inscription restent bloquées tant que l'app n'a pas fait l'objet d'un
  **test fermé (closed testing) avec au moins 12 testeurs inscrits sans interruption pendant au moins
  14 jours**. Un testeur qui se désinscrit puis revient doit refaire 14 jours consécutifs.
  Ensuite : Play Console → Tableau de bord → *Demander l'accès à la production* (questionnaire sur le
  test fermé, l'app et la préparation) ; examen en général **≤ 7 jours**.
  → Prévoir ce délai (≈ 3 semaines minimum) dans le planning, et recruter 15+ testeurs pour garder une
  marge. Un compte **organisation** n'est pas soumis à cette règle (selon des sources tierces — à
  confirmer à l'inscription).
- Exigence de **niveau d'API cible** : Expo SDK 58 cible une API Android récente ; vérifier l'exigence
  en vigueur dans la Play Console au moment de la soumission.
- Distribution d'APK `preview` hors Play : Google déploie la **vérification des développeurs Android**
  (application annoncée à partir du 30 septembre 2026 au Brésil, en Indonésie, à Singapour et en
  Thaïlande, puis élargissement en 2027) ; les testeurs concernés devront passer par le parcours
  d'installation avancé si le développeur n'est pas vérifié. Sans impact pour la France à ce jour
  (à revérifier).

Réf. : <https://support.google.com/googleplay/android-developer/answer/14151465>,
<https://support.google.com/googleplay/android-developer/answer/9845334>

## 6. Fiches des stores — métadonnées à préparer

### Limites
- **App Store** : nom 30 caractères, sous-titre 30, mots-clés 100 (séparés par des virgules),
  texte promotionnel 170, description 4 000 ; URL de support et URL de politique de confidentialité
  obligatoires.
- **Google Play** : titre 30, description courte **80**, description complète 4 000 ; icône
  512 × 512 ; image de présentation (feature graphic) 1024 × 500.

### Brouillons — Français

- **Nom** : Build Your Team
- **Sous-titre (App Store)** : Enchères foot entre amis
- **Description courte (Play, ≤ 80)** : Même budget pour tous : enchérissez et bâtissez la meilleure équipe !
- **Mots-clés (App Store, ≤ 100)** : `enchères,football,équipe,soirée,multijoueur,amis,mercato,draft,stratégie,party`
- **Description** :
  > Build Your Team, c'est le jeu de soirée où tout le monde part avec le même budget… et où seuls
  > les meilleurs stratèges repartent avec l'équipe de rêve.
  >
  > • Créez un salon et invitez vos amis avec un simple code ou un lien.
  > • Enchérissez en temps réel sur des joueurs de football (fictifs) pour remplir chaque poste.
  > • Gérez votre budget virtuel : faut-il tout miser sur une star ou équilibrer l'effectif ?
  > • Les spectateurs votent pour l'équipe qu'ils préfèrent.
  > • Jouez sur iPhone, iPad, Android ou directement dans le navigateur.
  >
  > Aucun compte requis, aucune publicité, aucun achat intégré. Les budgets sont virtuels et n'ont
  > aucune valeur réelle.

### Drafts — English

- **Name**: Build Your Team
- **Subtitle (App Store)**: Bid. Build. Win.
- **Short description (Play, ≤ 80)**: Same budget for everyone: bid smart and build the best team!
- **Keywords (App Store, ≤ 100)**: `auction,football,soccer,team,party game,multiplayer,friends,draft,transfer,strategy`
- **Description**:
  > Build Your Team is the party game where everyone starts with the same budget… and only the
  > sharpest strategist ends up with the dream team.
  >
  > • Create a room and invite friends with a code or a link.
  > • Bid in real time on (fictional) football players to fill every position.
  > • Manage your virtual budget: go all-in on a star or build a balanced squad?
  > • Spectators vote for their favourite team.
  > • Play on iPhone, iPad, Android or straight from your browser.
  >
  > No account, no ads, no in-app purchases. Budgets are virtual and have no real-world value.

Ne citer aucune marque ni joueur réel (FIFA, clubs, ligues…) : les joueurs de cette version sont
fictifs (voir `docs/DATA_LICENSING.md`).

### Catégorie
- **App Store** : catégorie principale **Jeux**, sous-catégories suggérées **Stratégie** et
  **Société** (*Board*) — Apple n'a pas de sous-catégorie « Party ». Éviter « Casino ».
- **Google Play** : **Jeux > Stratégie** (alternative : *Société* / *Board* ou *Casual*). Éviter « Casino ».

### Captures d'écran
- **App Store** (JPEG/PNG, sans transparence, 1 à 10 par taille) :
  - iPhone 6,9" : 1320 × 2868 (ou 1290 × 2796 / 1260 × 2736) — ou à défaut 6,5" : 1284 × 2778 / 1242 × 2688 ;
  - iPhone « Dynamic Island » taille moyenne (6,1") : 1179 × 2556 ou 1206 × 2622 (au moins une) ;
  - **iPad 13"** : 2064 × 2752 ou 2048 × 2732 (obligatoire : `supportsTablet: true` dans `app.json`).
  - Les tailles inférieures sont dérivées automatiquement.
- **Google Play** (JPEG ou PNG 24 bits sans alpha) : **2 minimum**, 8 max par type d'appareil, côtés
  entre 320 et 3 840 px, le grand côté ≤ 2× le petit. Pour être mis en avant, un jeu doit fournir au
  moins 3 captures 16:9 (1920 × 1080) ou 9:16 (1080 × 1920). Tablettes 7"/10" : 1 080 à 7 680 px.
- Astuce : les scripts Playwright de `e2e/` (ex. `e2e/shot.mjs`) peuvent produire des captures web
  à ces résolutions ; préférer toutefois des captures de l'app native pour l'App Store.

Réf. : <https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications>,
<https://support.google.com/googleplay/android-developer/answer/9866151>

## 7. Politique de confidentialité (URL publique obligatoire)

- Apple (règle 5.1.1(i)) : lien vers la politique **dans les métadonnées App Store Connect et dans
  l'app**. Google : URL obligatoire dans la Play Console (et pour le formulaire Data safety).
- L'app contient déjà la route `/privacy`. Une fois le web déployé, l'URL publique est
  `https://<EXPO_PUBLIC_WEB_URL>/privacy` (ex. `https://buildyourteam.app/privacy`) — la réécriture
  SPA de `apps/game/vercel.json` la rend accessible directement.
- **À compléter avant soumission** : identité de l'éditeur et adresse de contact (section « Vos droits »
  encore marquée « À compléter »), et vérifier que le texte reste conforme aux réponses ci-dessous.

## 8. Classification par âge

Faits à déclarer : aucun argent réel, aucun achat intégré, aucune publicité, aucun chat, pas de
navigation web libre, budgets **virtuels sans valeur et non convertibles**, joueurs fictifs,
pseudos visibles par les autres joueurs du salon, classement final entre joueurs.

### Apple (questionnaire 2025 : 4+, 9+, 13+, 16+, 18+)
- **Jeux d'argent (Gambling)** : **Non** — aucun argent réel ni monnaie convertible.
- **Jeux d'argent simulés (Simulated Gambling)** — définition Apple : « paris ou mises sans argent
  réel ». Le jeu est une **enchère stratégique** avec budget virtuel (on acquiert des joueurs pour
  composer une équipe), sans pari sur un résultat aléatoire, sans gain, sans mécanique de casino.
  Réponse recommandée : **Aucun**, en l'expliquant dans les *Notes pour la revue*. Si le propriétaire
  préfère la prudence : « Peu fréquent » ⇒ **13+**.
- **Concours (Contests)** : chaque partie se conclut par un classement entre joueurs. « Peu fréquent » ⇒ 4+,
  « Fréquent » ⇒ 13+. Choix à faire honnêtement par le propriétaire ; **13+** est une cible prudente et
  cohérente avec le public visé (ados/adultes), robuste quelle que soit l'interprétation des enchères.
- **Coffres à butin (Loot boxes)** : Non. **Messagerie/chat** : Non. **Accès web illimité** : Non.
  **Publicité** : Non. **Contrôle parental / vérification d'âge** : Non.
- **Contenu généré par les utilisateurs** : seuls les **pseudos** sont visibles, dans des salons privés.
  ⚠ Si la réponse est Oui, la règle 1.2 impose filtrage des contenus choquants, signalement et blocage :
  l'app n'a aujourd'hui **ni filtre de pseudos, ni exclusion de joueur** par l'hôte — à envisager avant
  soumission pour limiter le risque de rejet.

Réf. : <https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions>

### Google Play (questionnaire IARC)
- Catégorie : **Jeu**. Violence, sexualité, langage, drogues : Non.
- **Jeux d'argent / jeux d'argent simulés** : même raisonnement qu'Apple — réponse recommandée **Non**
  (enchère stratégique, budget virtuel sans valeur, aucun mécanisme de casino ni de pari).
- **Interaction entre utilisateurs** : Oui (multijoueur, pseudos visibles). **Partage de position** : Non.
  **Achats numériques** : Non.
- Public cible (*Target audience*) : 13 ans et plus (ne pas cibler les enfants, pour éviter les
  exigences du programme Familles).

## 9. Confidentialité — App Privacy (Apple) et Data safety (Google)

Base factuelle (code + page `/privacy`) : pseudo choisi, actions de jeu (enchères, votes), jeton de
session invité aléatoire (stocké sur l'appareil, haché côté serveur), **IP hachée** des votants
spectateurs (uniquement pour limiter les votes répétés), suppression des données de partie après
**30 jours**, aucun compte, aucun e-mail, aucune localisation, **aucun SDK d'analytics, de crash
reporting ou de publicité**, aucun pistage, aucune vente/partage. Hébergeurs (Fly.io/Render,
Supabase, Vercel) = sous-traitants, pas des tiers destinataires.

### Apple — App Privacy (« étiquettes nutritionnelles »)
- **Suivi (Tracking)** : **Non** → pas d'App Tracking Transparency nécessaire.
- **Données collectées** (finalité unique : **Fonctionnalités de l'app**, qui inclut la prévention
  de la fraude) :
  | Type Apple | Donnée | Liée à l'utilisateur ? |
  |---|---|---|
  | Contenu utilisateur → **Contenu de jeu** (*Gameplay Content*) | pseudo + enchères/votes dans la partie | Recommandé : **Oui** (prudent : données pseudonymes, attachées à une session) |
  | Identifiants → **ID utilisateur** (*User ID*) | jeton de session invité / ID participant aléatoire | **Oui** |
  | **Autres types de données** (*Other Data Types*) | IP hachée des votants spectateurs (anti-abus) | Non (hachée, non reliée à une identité) |
- Pas de : coordonnées, localisation, contacts, historique de navigation, diagnostics, données d'usage,
  identifiants publicitaires.

Réf. : <https://developer.apple.com/app-store/app-privacy-details/>

### Google Play — formulaire Data safety
- **Collecte ou partage de données** : Oui (collecte) ; **partage avec des tiers** : **Non**.
- **Chiffrement en transit** : **Oui** (HTTPS/WSS en production — à condition que
  `EXPO_PUBLIC_SERVER_URL` soit en `https://`).
- **Suppression** : **Oui** — suppression automatique des données de partie sous 30 jours (Google
  accepte une suppression automatique sous 90 jours) ; indiquer aussi l'adresse de contact.
- Types déclarés :
  | Catégorie Google | Donnée | Obligatoire ? | Finalités |
  |---|---|---|---|
  | Infos personnelles → **Nom** (inclut les pseudos selon Google) | pseudo | Oui | Fonctionnalités de l'app |
  | Activité dans l'app → **Autres actions** | enchères, votes, déroulé de partie | Oui | Fonctionnalités de l'app |
  | **Appareil ou autres identifiants** | jeton de session invité ; IP hachée des votants spectateurs | Oui | Fonctionnalités de l'app ; Prévention de la fraude, sécurité et conformité |
- Pas de : localisation (l'IP n'est pas utilisée pour localiser), contacts, e-mail, photos,
  diagnostics, identifiant publicitaire.
- Pas de suppression de compte à proposer (aucun compte).

Réf. : <https://support.google.com/googleplay/android-developer/answer/10787469>

## 10. Règle Apple 4.2 (fonctionnalité minimale)

« Your app should include features, content, and UI that elevate it beyond a repackaged website »
(App Review Guidelines 4.2). Build Your Team est une **app React Native native** (Expo SDK 58,
React Native 0.88, Reanimated, SVG, audio natif, stockage sécurisé, retours haptiques) — ce n'est
**pas** une WebView qui encapsule le site. Dans les *Notes pour la revue* :
- expliquer comment tester (créer un salon, rejoindre avec un second appareil ou le web, mode démo
  `/demo` s'il permet de jouer seul) ;
- préciser que le serveur temps réel doit être joignable pendant la revue ;
- rappeler : pas d'argent réel, pas de compte, joueurs fictifs.

Réf. : <https://developer.apple.com/app-store/review/guidelines/#minimum-functionality>

## 11. Procédure complète (après autorisation explicite du propriétaire)

1. Déployer serveur + web de **production** ([DEPLOYMENT.md](./DEPLOYMENT.md)) ; vérifier `/health` et `/privacy`.
2. Compléter `eas.json` (URLs, `appleId`, `ascAppId`, `appleTeamId`) et `app.json` (`version` 1.0.0).
3. `npx eas-cli@latest build --profile preview --platform android` → test sur appareils réels.
4. App Store Connect : créer l'app (bundle `com.buildyourteam.app`) ; Play Console : créer l'app.
5. `npx eas-cli@latest build --profile production --platform all`.
6. `npx eas-cli@latest submit --platform ios --profile production --latest` → TestFlight interne.
7. `npx eas-cli@latest submit --platform android --profile production --latest` → test interne Play.
8. Google (compte personnel récent) : passer en **test fermé ≥ 12 testeurs pendant 14 jours**, puis
   demander l'accès à la production.
9. Remplir fiches, captures, classification, App Privacy / Data safety, URL de confidentialité.
10. Soumettre en revue **uniquement sur instruction explicite** du propriétaire ; choisir la
    publication manuelle après approbation.

## Sources

- Expo : <https://docs.expo.dev/eas/json/>, <https://docs.expo.dev/build/eas-json/>,
  <https://docs.expo.dev/build-reference/app-versions/>, <https://docs.expo.dev/eas/environment-variables/>,
  <https://docs.expo.dev/submit/android/>, <https://docs.expo.dev/submit/ios/>, <https://expo.dev/pricing>
- Apple : <https://developer.apple.com/support/enrollment/>, <https://developer.apple.com/testflight/>,
  <https://developer.apple.com/app-store/review/guidelines/>,
  <https://developer.apple.com/app-store/app-privacy-details/>,
  <https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions>,
  <https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications>
- Google Play : <https://support.google.com/googleplay/android-developer/answer/14151465>,
  <https://support.google.com/googleplay/android-developer/answer/10787469>,
  <https://support.google.com/googleplay/android-developer/answer/9866151>,
  <https://support.google.com/googleplay/android-developer/answer/6112435>
