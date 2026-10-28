# Rapport de tests et état du projet — Build Your Team

Date : 26/10/2026. Environnement : Windows 11, Node 24.20, Chromium (Playwright 1.64), Expo SDK 58.

Ce rapport sépare **ce qui a été développé**, **ce qui a été réellement testé** (et comment), **ce qui reste incomplet** et **les limites connues**. Rien n'est annoncé comme testé sans avoir été exécuté.

## 1. Tests automatisés exécutés

| Suite | Commande | Résultat |
|---|---|---|
| Moteur de jeu (unitaires, dont des parties complètes avec les packs « Réels » foot et basket) | `npx vitest run packages` | **28/28 OK** |
| Intégration temps réel : vrai `GameServer`, vrai SQL PostgreSQL via PGlite, clients socket.io-client indépendants ; verrou et récupération de la base locale | `npx vitest run services` | **15/15 OK** |
| TypeScript strict (tous les packages et l'app) | `npm run typecheck` | **OK** |
| ESLint (`eslint-config-expo` et règles React Compiler) | `npx eslint src` (apps/game) | **0 problème** |
| `expo-doctor` | `npx expo-doctor` | **20/20 contrôles OK** |
| Bundle natif Android (bytecode Hermes) | `npx expo export -p android` | **OK** (5,1 Mo) |
| Bundle natif iOS | `npx expo export -p ios` | **OK** |
| Build web de production | `npx expo export -p web` | **OK** |
| E2E 4 navigateurs sur le **build web de production** | `node e2e/four-players.mjs http://localhost:8090` | **OK** |
| E2E 4 navigateurs sur le serveur de dev | `node e2e/four-players.mjs` | **OK** |
| E2E 2 joueurs et 3 spectateurs | `node e2e/spectators.mjs` | **OK** |
| E2E mode classique (formation, banc) | `node e2e/classic.mjs` | **OK** (contrôle visuel) |
| E2E Basket : choix de l'univers, enchères sur le terrain, draft, vote spectateur, résultat | `node e2e/basketball.mjs` | **OK** |

### Les 14 scénarios multijoueurs obligatoires

Chaque scénario a été vérifié à deux niveaux : dans le test d'intégration Socket.IO (`services/realtime/test/multiplayer.test.ts`) et dans l'E2E navigateur (`e2e/four-players.mjs`), avec quatre contextes Chromium isolés et des tailles d'écran variées : 1366×800, 1024×768, 844×390 et 390×844.

| # | Scénario | Intégration | E2E navigateur |
|---|---|---|---|
| 1 | Création du salon (persisté en base) | ✅ | ✅ |
| 2 | Arrivée des trois autres joueurs (lien `/r/CODE` et saisie du code), salon complet refusé | ✅ | ✅ |
| 3 | Lancement par l'hôte uniquement. Un double envoi avec le même `actionId` est acquitté sans être rejoué | ✅ | ✅ |
| 4 | Même joueur, même identifiant d'enchère et même échéance reçus par les 4 clients | ✅ | ✅ |
| 5 | Deux offres quasi simultanées et identiques : une seule acceptée, l'autre refusée (`BID_TOO_LOW`) | ✅ | ✅ (un écran affiche « Vous menez », l'autre peut encore surenchérir) |
| 6 | Offre refusée faute de budget (max 160M = 200 − 4 × 10) | ✅ | — (le bouton est désactivé dans l'interface) |
| 7 | Joueur qui passe, clôture anticipée | ✅ | ✅ |
| 8 | Attribution au bon participant | ✅ | ✅ |
| 9 | Budget débité, identique sur les 4 écrans et en base | ✅ | ✅ |
| 10 | Placement automatique sur un emplacement compatible, ligne `team_assignments` créée | ✅ | ✅ |
| 11 | Déconnexion puis reconnexion : budget et équipe intacts, faux jeton refusé | ✅ | ✅ (onglet fermé puis rouvert, session reprise) |
| 12 | Fin de draft : équipes complètes, au moins une enchère clôturée par le seul chrono serveur | ✅ | ✅ |
| 13 | Vote : refus du vote pour sa propre équipe, clôture quand tout le monde a voté | ✅ | ✅ |
| 14 | Présentation du résultat (même vainqueur sur les 4 écrans, résultat en base) | ✅ | ✅ |

Autres comportements testés :

- **2 joueurs avec vote spectateurs** : les joueurs ne peuvent pas voter, un seul vote par spectateur, plafond de 3 votes par IP, clôture par l'hôte, vote conservé après rechargement de la page, bascule automatique d'un spectateur arrivé en avance (intégration et E2E).
- **Redémarrage du serveur** : un second serveur sur la même base recharge la partie en cours et ses chronos continuent. Ce cas s'est aussi produit **pour de vrai** pendant le dernier E2E à 4 navigateurs : le serveur de dev (`tsx watch`) a redémarré en pleine draft. Les quatre clients se sont reconnectés et ont repris leur session, et la partie est allée jusqu'au vote et au résultat sans erreur.
- **Rétention** : un salon de plus de 30 jours est supprimé, avec ses lignes liées en cascade.
- **Modération** : retrait d'un participant par l'hôte avec révocation de sa session, refus des pseudos injurieux (y compris en leetspeak et avec accents), sans faux positif sur des noms réels comme « Dickson ».
- **Moteur** : réserve, chrono porté à 12 s, offre engageante, joueurs libres (le moins bien noté compatible, à 10M), plafond d'enchères, mode classique à 11 titulaires, changement de formation, échanges incompatibles refusés, départage par la note d'équipe.
- **Import de données** : CSV avec champs entre guillemets, rejet des lignes invalides avec motif, doublons détectés par `externalId` et par identité, refus d'écraser une version publiée (CLI exécutée).

### Mise à jour du 28/10/2026 (soir) — modes de jeu, Rugby, F1, Arènes, football réel uniquement

| Suite | Commande | Résultat |
|---|---|---|
| Toutes les suites (moteur, packs, serveur) | `npx vitest run` | **92/92 OK** (10 fichiers) |
| Moteur : nouveaux modes (`packages/game-engine/test/modes.test.ts`) | `npx vitest run packages/game-engine` | **56/56 OK** |
| Serveur : modes sur vrai Socket.IO + PGlite (`services/realtime/test/modes.test.ts`) | `npx vitest run services` | **OK**. Couvre : 1 joueur contre 3 bots pilotés par le serveur jusqu'au tournoi, puis revanche enregistrée en SQL (round 2) ; duo et exclusion de l'équipe entière ; enchère sous pli ; veto ; mercato avec échange tracé en SQL ; votes du chat injectés |
| TypeScript strict (7 packages, serveur, app) | `npm run typecheck` | **OK** |
| ESLint app | `npx eslint src` (apps/game) | **0 problème** |
| E2E navigateur des modes | `node e2e/modes.mjs` | **OK**. Partie 1 (desktop) : enchères hollandaises, moitié prix, 3 bots, mercato, vote puis tournoi, vue TV, revanche en manche 2. Partie 2 (390×844) : sous pli, Mystère (carte « ? »), Éclair, tournoi seul |
| Connexion Twitch anonyme | script ponctuel vers `irc-ws.chat.twitch.tv` | **OK** : connexion et entrée dans un salon en lecture seule. Le décodage des messages est testé à part ; aucun message réel de chat n'a été reçu pendant l'essai |

Vérifications visuelles (captures dans `test-results/modes`) : création, salon avec bots, enchère hollandaise, TV pendant la draft et le mercato, mercato, tableau du tournoi, carte mystère sur téléphone. Les agents ont aussi vérifié dans le navigateur le joker vol, la vente à la banque, l'échange accepté par un bot, la poule à 3 équipes, le Grand Prix F1 et les surfaces rugby, stand F1 et arène (1280 et 375 px).

**Non vérifié :**
- applications natives iOS et Android, et build Docker de ces changements ;
- scan réel des QR codes par un téléphone ;
- votes envoyés par un vrai chat Twitch ;
- duo joué dans l'interface : il est testé dans le moteur et sur Socket.IO, pas dans le navigateur ;
- timing des animations de révélation au premier plan : les captures automatiques ne le montrent pas.

### Mise à jour du 28/10/2026

- **Design v2** (verre, typographies Unbounded/Manrope, cartes holographiques, stade). L'E2E à 4 navigateurs passe toujours.
- **Univers Basket :** pack validé, partie classique simulée à 4 avec changement de composition, placement automatique par poste, E2E dans l'interface à 2 joueurs plus un spectateur. Captures sur desktop et mobile.

### Mise à jour du 26/10/2026 (soir)

- **Délai entre deux joueurs réduit de 6,8 s à 3,4 s** : animation « vendu » de 2,4 s, puis présentation du joueur suivant en 1 s. Mesuré dans l'interface (`e2e/timing.mjs`) : **3,47 s** entre la dernière passe et l'ouverture de l'enchère suivante, et 1,1 s entre le lancement et la première enchère. L'E2E à 4 navigateurs fait toute la draft en environ 1 min 10 s (contre 2 min auparavant).
- **Mode « Joueurs réels »** testé : validation du pack, partie complète simulée en mode classique à 4, E2E à 4 navigateurs, captures (accueil, enchère desktop et mobile, vote).
- **Base locale de dev** : deux serveurs lancés en même temps avaient corrompu la base embarquée. Un verrou empêche désormais un second serveur de l'ouvrir. En cas de corruption, une base neuve est créée automatiquement dans un nouveau dossier (tests ajoutés, et vérifié sur le serveur lancé dans le terminal).

## 2. Vérifications visuelles réalisées

Captures Playwright examinées à chaque étape (dans `test-results/`, non versionné) : accueil (desktop et mobile), lobby, enchère (1440, 1280, 1024, 844×390 et 390×844), tampon VENDU, transfert vers le terrain, mode classique en 4-3-3 puis 4-4-2 avec banc, vote croisé, vote spectateurs, résultats et trophée.

Problèmes trouvés et **corrigés** pendant ces vérifications :

- La bande des participants s'étirait et écrasait le panneau d'enchères.
- Mise en page trop serrée en paysage sur téléphone : ajout d'un mode dense.
- Une carte réapparaissait semi-transparente après son arrivée (animation `entering` rejouée sur le web).
- Chevauchement des emplacements GB et DEF.
- Halo du trophée trop chargé.
- Icône qui ressemblait à un fichier.
- Libellé de formation en double.
- Watcher Metro qui plantait à cause des fichiers de la base embarquée.

## 3. Fonctionnalités développées

**Jouable de bout en bout :** mode rapide de 2 à 4 joueurs, et mode classique (11 titulaires, 3 remplaçants, 3 formations) avec le même moteur.

**Interface :** accueil, création et rejoindre (code, lien d'invitation), lobby, enchères en temps réel avec boutons +10/+20/+50, montant libre et bouton PASSER, terrain 2,5D, cartes originales à 5 paliers, fiche joueur, échange de joueurs et changement de formation, comparaison des équipes, vote croisé ou spectateurs, résultats partageables (texte et lien), mode démo hors ligne clairement libellé, réglages (volume, coupure, animations réduites, vibrations), politique de confidentialité.

**Serveur :** autorité complète, idempotence, sessions invitées, reprise après redémarrage, journal d'événements, rétention à 30 jours, limitation de débit, modération.

**Contenu :** dataset fictif de 180 joueurs et couche d'import sous licence versionnée.

**Plateformes :** configuration EAS (development, preview, production), icône, splash, Dockerfile, Fly.io, Render, Vercel.

## 4. Non testé ou incomplet (honnêtement)

| Élément | État |
|---|---|
| **Exécution sur un vrai iPhone ou Android** (ou un simulateur) | ❌ **Non testé** : pas de Mac ni d'émulateur ici. Seuls les bundles natifs ont été compilés. Il faut une partie sur appareils réels via `eas build --profile preview`. |
| Sons et vibrations sur mobile | ❌ Non vérifiés à l'oreille. Sur le web, les sons se chargent sans erreur. |
| Rotation, retour au premier plan, clavier numérique sur mobile | Code en place (`AppState`, mise en page adaptative), **non testé sur appareil**. |
| Partage natif (`Share`) | Code en place. Sur le web, il est remplacé par la copie dans le presse-papiers (testée visuellement). Non testé sur mobile. |
| Déploiement réel sur Vercel, Fly.io ou Render et Supabase | ❌ Non effectué : comptes requis. Les fichiers de configuration sont validés contre leurs schémas JSON. Le Dockerfile n'a pas été construit (Docker absent) ; son arborescence a été reproduite et le serveur a démarré depuis celle-ci. |
| Connexion à un vrai PostgreSQL hébergé (`pg`) | Le chemin de code existe. Testé uniquement via PGlite, le même moteur et le même SQL, mais pas le même pilote réseau. |
| Glisser-déposer des cartes | Non implémenté : on déplace en touchant la carte puis la destination. |
| Image de résultat partageable (`og:image`) | Non implémenté : on partage un texte, un lien et une page de résultats publique `/vote/CODE`. |
| Données de joueurs réels | **Ajoutées** (mode « Réels », notes estimées, non officielles). Utilisation commerciale soumise aux droits nom/image : voir DATA_LICENSING §0. |
| Référence graphique `references/squad-reference.png` | **Non fournie.** La direction artistique a été établie à partir du texte de la demande. |
| Accessibilité avec lecteur d'écran (VoiceOver, TalkBack) | Libellés en place, **non testée** avec un lecteur d'écran réel. |

## 5. Limites connues

- **Une seule instance** du serveur temps réel (état des salons en mémoire). Voir ARCHITECTURE.
- Les protections du vote spectateur sont **raisonnables, pas inviolables** : changer d'appareil et de réseau permet de revoter.
- Le filtre de pseudos est une liste de base. Il faut prévoir une modération plus complète et un signalement avant de passer à l'échelle.
- Sur petit téléphone, en mode classique, les cartes du terrain sont petites. La fiche détaillée s'ouvre au toucher.
- Sur le web, les sons ne peuvent démarrer qu'après une première interaction de l'utilisateur, à cause des règles d'autoplay des navigateurs.

## 6. Comptes et dépendances à configurer (action du propriétaire)

| Besoin | Pourquoi |
|---|---|
| Compte Expo / EAS | Builds iOS et Android |
| Apple Developer Program (99 $/an) | TestFlight et App Store |
| Google Play Console (25 $) | Tests internes ou fermés, puis production (les comptes personnels doivent passer par 12 testeurs pendant 14 jours) |
| Vercel | Application web |
| Fly.io ou Render | Serveur temps réel |
| Supabase (ou un autre PostgreSQL) | `DATABASE_URL` |
| Nom de domaine et contact de l'éditeur | Liens d'invitation, politique de confidentialité publique |
| Fournisseur de données sous licence et droits FIFPRO (si joueurs réels) | Voir DATA_LICENSING |

Rien n'a été publié sur aucun store. Aucune publication ne se fera sans les identifiants du propriétaire et son autorisation explicite.

## 7. Prochaines étapes de commercialisation

Voir ROADMAP. En priorité : une partie sur appareils réels, le choix de la stratégie de données, la mise en ligne de staging (Vercel, Fly.io, Supabase), puis TestFlight et le test fermé Google Play.
