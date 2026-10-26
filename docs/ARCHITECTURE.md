# Architecture — Build Your Team

## Vue d'ensemble

```
┌──────────────────────────── apps/game (Expo SDK 58, une seule base de code) ─────────────────────┐
│  Web (react-native-web, export SPA)   ·   iOS   ·   Android                                       │
│  expo-router · Reanimated 4 · react-native-svg · expo-audio · SecureStore · socket.io-client      │
│  ▸ affiche la RoomView reçue · envoie des intentions (bid/pass/…) · anime à partir des événements │
└───────────────▲──────────────────────────────────────────────────────────────┬──────────────────┘
                │ room:update {view, events}                                     │ commandes + ack (Zod)
                │                                                                ▼
┌──────────────────────────── services/realtime (Node 24, Socket.IO) ────────────────────────────────┐
│  GameServer : 1 file sérielle par salon → moteur pur → transaction PostgreSQL → diffusion          │
│  Planificateur : un minuteur par salon sur nextDeadline() → advance() (clôtures côté serveur)      │
│  Sessions invitées (sha256 du jeton) · idempotence (actionId) · limitation de débit · logs JSON    │
└───────────────▲─────────────────────────────────────────────────────────────────────────────────────┘
                │ SQL (pg en prod / PGlite en local et tests : le même moteur PostgreSQL)
┌───────────────┴──────────── database/migrations ──────────────────────────────────────────────────┐
│  rooms (instantané autoritaire) · participants · auctions · bids · team_assignments · votes ·      │
│  results · game_events (journal) · universes · content_packs · characters                          │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Monorepo (npm workspaces)

| Dossier | Rôle |
|---|---|
| `packages/shared` | Types du domaine **indépendants de l'univers** (`Character`, `FormationSlot`, `RoomState`…), contrats Socket.IO avec schémas Zod, codes d'erreur, modération des pseudos. |
| `packages/game-engine` | Moteur d'enchères **pur et déterministe** : chaque fonction prend `(état, commande, {pack, now})` et renvoie un nouvel état et des événements, ou une erreur. Il couvre les règles de compatibilité, de placement, de réserve, les joueurs libres, le vote, la vue publique et la validation des packs. Aucune entrée/sortie. |
| `packages/football` | Premier **pack de contenu** : postes, familles, attributs (PAC…PHY, et DIV…POS pour les gardiens), paliers de cartes, formations, modes. Il contient aussi le dataset fictif et la **couche d'import** (CSV/JSON → schéma → normalisation → dédoublonnage → fichier versionné). |
| `packages/ui` | Composants visuels réutilisables et sans lien avec un univers : jetons de design, `PlayerCard`, `Pitch` (projection 2,5D), `Avatar` procédural, `Flag`. |
| `services/realtime` | Serveur de jeu autoritaire : Socket.IO, accès PostgreSQL, persistance, planification. |
| `apps/game` | Application Expo universelle : écrans, état client, sons. |
| `database/migrations` | Schéma SQL, appliqué automatiquement au démarrage du serveur. |
| `e2e` | Scénarios Playwright multi-navigateurs sur le vrai serveur. |
| `references` | Références visuelles. Le fichier `squad-reference.png` n'a pas été fourni. |

Les packages sont consommés **en source TypeScript**, sans étape de build : Metro et tsx les compilent à la volée. Ils sont tous en `"type": "module"`.

## Générique ou spécifique à l'univers

Le moteur ne sait pas ce qu'est un footballeur. Un univers est décrit par un `ContentPack` :

- `roles` (ST, GK… ou Tank, Soigneur…) regroupés en `roleGroups`, chaque groupe désignant un **jeu d'attributs** ;
- `attributeSets` : la liste des statistiques à afficher, propre à chaque groupe ;
- `formations` : des emplacements avec une famille, des rôles préférés et des coordonnées normalisées ;
- `modes` : budgets, formations autorisées, taille du banc ;
- `tiers` : des seuils de note associés à un style visuel générique (`bronze` … `icon`) ;
- `characters` : rôles (le premier est le rôle naturel), note générale, attributs libres, graine de portrait ou URL sous licence.

Ajouter un univers « animation » revient à écrire un nouveau package. Le moteur, le serveur, la base, l'écran d'enchères, la carte et le terrain restent inchangés : le terrain place n'importe quelle liste d'emplacements, et la carte affiche les attributs déclarés par le pack. Seul le décor du terrain, la pelouse, est propre au football. Le prévoir comme un rendu de fond paramétrable fait partie de la roadmap.

## Modèle de données (correspondance avec la demande)

| Entité demandée | Implémentation |
|---|---|
| Universe | table `universes`, `ContentPack.universeId` |
| ContentPack | table `content_packs` (définition en JSONB, versionnée par `dataset_id@version` et empreinte du contenu) |
| Character / CharacterAttributes | table `characters` (`roles TEXT[]`, `attributes JSONB` selon le schéma du pack) |
| Formation / FormationSlot | `content_packs.definition.formations[].slots[]` (données du pack) |
| Room / GameSession | table `rooms` : instantané autoritaire `state JSONB`, statut et version |
| Participant | table `participants` (empreinte du jeton de session) |
| Auction / Bid | tables `auctions` et `bids` (identifiant de l'offre = `actionId` du client) |
| Team / TeamAssignment | `RoomState.participants[].team`, table `team_assignments` (`UNIQUE(room_code, character_id)`) |
| Vote | table `votes` (`UNIQUE(room_code, voter_id)`, IP hachée) |
| Result | table `results` |
| Journal | table `game_events` (chaque événement, avec acteur et version) |

## Choix d'autorité et de cohérence

1. **Une file sérielle par salon.** Node exécute un seul thread JavaScript. Chaque salon possède en plus une chaîne de promesses, si bien que deux commandes du même salon ne s'entrelacent jamais, même pendant l'attente de la base. C'est cette file qui rend la validation d'une offre **atomique**.
2. **Persister avant de publier.** Le résultat du moteur est écrit en une seule transaction : instantané, événements et lignes normalisées. Il ne remplace l'état en mémoire et n'est diffusé qu'une fois la transaction validée. Si l'écriture échoue, la commande est refusée avec le code `INTERNAL` et l'état ne change pas.
3. **Horloge serveur.** Les échéances (`revealEndsAt`, `endsAt`, `nextAt`, `voting.endsAt`) sont des timestamps du serveur. Un minuteur appelle `advance()` à l'échéance, que des clients soient connectés ou non. Côté client, l'affichage tient compte du décalage d'horloge, mesuré en retenant la plus courte de trois mesures aller-retour.
4. **Idempotence.** Les 300 derniers `actionId` sont conservés dans l'état. Un renvoi est acquitté avec `duplicate: true` sans être réappliqué. Le client renvoie automatiquement la même action une fois en cas d'expiration du délai.
5. **Reprise.** Au démarrage, le serveur recharge les salons actifs (lobby, draft, vote) mis à jour il y a moins de 12 h, puis reprogramme leurs échéances.
6. **Rétention.** Les salons inactifs depuis 30 jours sont supprimés, ainsi que toutes leurs lignes liées (en cascade), comme annoncé dans la politique de confidentialité.

## Limites d'échelle (assumées pour le MVP)

- **Une seule instance** du serveur temps réel, car l'état des salons vit en mémoire. Ordre de grandeur : un vCPU tient sans difficulté plusieurs centaines de salons simultanés. Les messages sont petits, la vue complète est renvoyée à chaque changement et pèse quelques dizaines de Ko au plus en mode classique.
- Pour passer à plusieurs instances, il faudra que chaque salon appartienne à une instance précise (routage par code de salon, Redis ou l'adaptateur Socket.IO, verrou consultatif en base). Voir ROADMAP.
- Le serveur ne peut **pas** tourner en serverless (Vercel Functions, Lambda), car il a besoin de WebSockets persistants et de minuteurs. Hébergement recommandé : Fly.io ou Render (voir DEPLOYMENT).

## Décisions techniques documentées

| Décision | Raison |
|---|---|
| Expo SDK 58 + expo-router, une seule base de code pour web, iOS et Android | Code partagé au maximum, vraie application native (pas une WebView), déploiement web statique. |
| **react-native-svg plutôt que Skia** pour le terrain et les cartes | Skia sur le web impose de charger CanvasKit en WASM (plusieurs Mo, démarrage plus lent, plus fragile). Une projection perspective calculée à la main en SVG donne le rendu 2,5D voulu, partout, en gardant le texte natif (net et accessible). |
| Projection perspective vraie, et non une rotation CSS | Les lignes, les bandes de tonte et les positions partagent la même perspective, tandis que les cartes restent droites et lisibles, réduites selon la profondeur. |
| Socket.IO | Reconnexion, accusés de réception, salles, repli en long-polling : fiable sur réseau mobile. |
| PostgreSQL via `pg` en production, **PGlite** en local et dans les tests | PGlite est le vrai moteur PostgreSQL compilé en WASM : même SQL, mêmes migrations, sans Docker. Ce n'est **pas** une simulation : les tests d'intégration exécutent du SQL réel. |
| Moteur pur et déterministe (PRNG avec graine dans l'état) | Testable unitairement, rejouable depuis un instantané, auditable. |
| Vue complète renvoyée à chaque changement (plutôt que des diffs) | Simple et résistant aux pertes de messages. La version du salon élimine les vues périmées. |
| Portraits procéduraux originaux | Aucun droit à l'image en jeu. Les datasets sous licence peuvent fournir `portraitUrl`. |
| Sons synthétisés (`scripts/generate-sounds.mjs`) | Originaux et libres de droits, petits fichiers WAV. |
| React Compiler activé, ESLint `react-hooks` sans erreur | Les valeurs animées Reanimated sont écrites avec `.set()` et l'état dérivé sans `setState` dans les effets, comme l'exige le compilateur. |
