# Déploiement — Build Your Team

> Dernière vérification des documentations officielles : 26 octobre 2026.
> Rien n'est déployé ni publié automatiquement : toutes les étapes ci-dessous
> sont à exécuter par le propriétaire, avec ses propres comptes.

## 1. Vue d'ensemble

| Brique | Code | Rôle | Hébergement recommandé |
|---|---|---|---|
| Client web (SPA) | `apps/game` (`npx expo export -p web` → `apps/game/dist`) | Jeu dans le navigateur, liens d'invitation `/r/<CODE>`, vote spectateur `/vote/<CODE>`, page `/privacy` | **Vercel** (fichiers statiques) |
| Apps iOS / Android | `apps/game` (EAS Build) | Même code, natif React Native | App Store / Google Play — voir [STORE_RELEASE.md](./STORE_RELEASE.md) |
| Serveur temps réel | `services/realtime` (Node 24, `tsx src/main.ts`, Socket.IO) | Salons, enchères, minuteurs, votes | **Fly.io** (`fly.toml`) ou **Render** (`render.yaml`), image `services/realtime/Dockerfile` |
| Base de données | `database/migrations/*.sql` | Persistance des parties (rechargées au redémarrage du serveur), purge à 30 jours | **Supabase** PostgreSQL 15+ via `DATABASE_URL` (SSL) |

```
 Navigateur / app mobile ──HTTPS──▶ Vercel (SPA statique)
          │
          └──WSS (Socket.IO)──▶ Fly.io / Render : 1 instance @byt/realtime ──TLS──▶ Supabase Postgres
```

## 2. Développement local

Prérequis : Node 24, `npm install` déjà fait à la racine.

Deux terminaux, à la racine du repo :

```bash
npm run dev:server   # serveur temps réel sur http://localhost:4000 (PGlite embarqué, aucune base à installer)
npm run dev:web      # Expo (Metro) : web sur http://localhost:8081 + QR code pour les téléphones
```

- **Sans `DATABASE_URL`**, le serveur utilise PGlite (vrai moteur PostgreSQL en WASM) stocké dans
  `services/realtime/.data/pglite` ; les migrations sont appliquées au démarrage.
- **Téléphones sur le même Wi-Fi (LAN)** :
  - App native : scanner le QR code affiché par `npm run dev:web` avec **Expo Go** (Android) ou
    l'appareil photo (iOS), ou utiliser un *development build* (`eas build --profile development`,
    nécessite `npx expo install expo-dev-client`). Le client déduit automatiquement l'URL du serveur
    à partir de l'IP LAN de Metro (`http://<IP-LAN>:4000`) — aucune variable à définir.
  - Navigateur du téléphone : ouvrir `http://<IP-LAN>:8081` (le client web vise alors
    `http://<IP-LAN>:4000`).
  - Trouver l'IP LAN sous Windows : `ipconfig` (ligne « Adresse IPv4 », ex. `192.168.1.23`).
  - Pare-feu Windows : autoriser Node.js sur les **réseaux privés** (ports 4000 et 8081).
- Forcer un serveur précis : définir `EXPO_PUBLIC_SERVER_URL` (ex. dans `apps/game/.env.local`,
  ignoré par git) puis relancer Metro.

## 3. Variables d'environnement

### Serveur temps réel (`services/realtime`)

| Variable | Obligatoire en prod | Défaut | Description |
|---|---|---|---|
| `PORT` | non | `4000` | Port HTTP/WebSocket. Render injecte le sien automatiquement. |
| `DATABASE_URL` | **oui** | — | Chaîne PostgreSQL. Absente ⇒ PGlite local (**éphémère dans un conteneur** : à éviter en prod). SSL activé automatiquement si l'URL contient `sslmode=require` ou `supabase`. |
| `PGLITE_DIR` | non | `services/realtime/.data/pglite` (`/data/pglite` dans l'image Docker) | Dossier PGlite si pas de `DATABASE_URL`. |
| `CORS_ORIGIN` | **oui** | `*` | Origines autorisées, séparées par des virgules (ex. `https://buildyourteam.app,https://www.buildyourteam.app`). |
| `DATASETS_DIR` | non | `packages/football/data/datasets` | Datasets sous licence produits par `npm run data:import` (voir `docs/DATA_LICENSING.md`). Le pack démo fictif est toujours inclus. |
| `TIME_SCALE` | non | `1` | Accélère les minuteurs (tests uniquement — laisser à 1 en prod). |
| `LOG_LEVEL` | non | (tout) | `error` = erreurs seulement, `silent` = aucun log. |
| `TRUST_PROXY` | **oui derrière un proxy** | (désactivé) | Si défini, l’IP client (anti-abus du vote spectateur) est lue dans `Fly-Client-IP`, sinon dans le **dernier** saut de `X-Forwarded-For`. À activer sur Fly.io / Render ; sans proxy, laisser vide (en-têtes falsifiables). |
| `MIGRATIONS_DIR` | non | `<repo>/database/migrations` | Dossier des migrations SQL appliquées au démarrage. |

### Client (`apps/game`) — injectées **au moment du build** (publiques, jamais de secret)

| Variable | Exemple prod | Description |
|---|---|---|
| `EXPO_PUBLIC_SERVER_URL` | `https://realtime.buildyourteam.app` | URL du serveur temps réel (HTTPS ⇒ WSS). |
| `EXPO_PUBLIC_WEB_URL` | `https://buildyourteam.app` | Origine web publique utilisée dans les liens d'invitation `/r/<CODE>` et spectateur `/vote/<CODE>`. |

Où les définir :
- **Web (Vercel)** : *Project Settings → Environment Variables* (Production et Preview).
- **Apps natives (EAS)** : bloc `env` des profils `preview` / `production` de `apps/game/eas.json`
  (valeurs `REPLACE-ME` à remplacer), **ou** variables d'environnement EAS en visibilité
  *Plain text* (`eas env:set --name EXPO_PUBLIC_SERVER_URL --value https://... --environment production --visibility plaintext`).
  Choisir une seule source : si vous passez par les variables EAS, supprimez le bloc `env`
  correspondant d'`eas.json` pour éviter toute ambiguïté.
  Réf. : <https://docs.expo.dev/eas/environment-variables/>

## 4. Topologie de production recommandée

- **Web** : Vercel (CDN mondial, HTTPS automatique, déploiement à chaque push).
- **Temps réel** : Fly.io, région `cdg` (Paris), **1 Machine** toujours allumée. Alternative : Render (Francfort).
- **Base** : Supabase (région UE, ex. Paris `eu-west-3` ou Francfort), connexion TLS.
- **Domaines** : `buildyourteam.app` (web) et `realtime.buildyourteam.app` (serveur) — noms indicatifs.

### 4.1 Base de données — Supabase

1. Créer un projet Supabase (région UE), noter le mot de passe de la base.
2. *Connect* → récupérer la chaîne de connexion :
   - **Fly.io** (sortie IPv6 disponible) : connexion directe
     `postgresql://postgres:[MOT-DE-PASSE]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require`
   - **Render** ou tout réseau IPv4 seulement : *Shared pooler*, **mode session** (port 5432)
     `postgresql://postgres.[PROJECT-REF]:[MOT-DE-PASSE]@[POOLER-HOST]:5432/postgres?sslmode=require`
   - **Ne pas utiliser le mode transaction (port 6543)** : prévu pour le serverless, sans état de session.
3. Encoder en URL les caractères spéciaux du mot de passe (`&`, `#`, `?`, espace…).
4. Optionnel : activer *Enforce SSL* dans *Database settings*.
5. Aucune migration manuelle : le serveur applique `database/migrations/*.sql` à son démarrage
   (table `schema_migrations`). Commande manuelle disponible : `npm run migrate -w @byt/realtime`.

Réf. : <https://supabase.com/docs/guides/database/connecting-to-postgres>

### 4.2 Serveur temps réel — Fly.io (recommandé)

Fichiers : `fly.toml` (racine), `services/realtime/Dockerfile`, `.dockerignore` (racine).
Le contexte de build Docker est la **racine du repo** (le serveur importe directement les sources
TypeScript de `packages/shared`, `packages/game-engine`, `packages/football` et lit `database/`).

```bash
# Installer flyctl : https://fly.io/docs/flyctl/install/
fly auth login
# 1) Remplacer `app = "REPLACE-ME-byt-realtime"` dans fly.toml par un nom libre, puis :
fly apps create <nom-de-l-app>
# 2) Secrets (jamais dans fly.toml ni dans git)
fly secrets set DATABASE_URL="postgresql://...?sslmode=require" \
                CORS_ORIGIN="https://buildyourteam.app,https://www.buildyourteam.app"
# 3) Déployer depuis la racine du repo — UNE seule Machine
fly deploy --ha=false
fly scale show            # doit afficher 1 Machine
fly scale count 1         # à lancer si 2 Machines ont été créées
# 4) Vérifier
curl https://<nom-de-l-app>.fly.dev/health   # {"ok":true,"db":"pg",...}
fly logs
```

Points clés de `fly.toml` : `auto_stop_machines = "off"`, `auto_start_machines = false`,
`min_machines_running = 1`, `internal_port = 4000`, check HTTP sur `/health`, `strategy = "rolling"`.

Réf. : <https://fly.io/docs/reference/configuration/>, <https://fly.io/docs/apps/app-availability/>

### 4.3 Serveur temps réel — Render (alternative)

Fichier : `render.yaml` (Blueprint).

1. Render Dashboard → *New → Blueprint* → choisir le repo : Render lit `render.yaml`.
2. Renseigner les variables marquées `sync: false` : `DATABASE_URL` (pooler Supabase **mode session**)
   et `CORS_ORIGIN`.
3. Vérifier `https://<service>.onrender.com/health`.

Ne **pas** utiliser le plan gratuit : mise en veille après 15 min sans trafic, redémarrages
possibles à tout moment, explicitement déconseillé en production. Garder `numInstances: 1`.

Réf. : <https://render.com/docs/blueprint-spec>, <https://render.com/docs/free>

### 4.4 Client web — Vercel

Fichier : `apps/game/vercel.json` (build `npx expo export -p web`, sortie `dist`, réécriture SPA
de toutes les routes vers `/index.html`, en-têtes de cache pour `/_expo/static/*`).

1. Vercel → *Add New… → Project* → importer le repo Git.
2. **Root Directory = `apps/game`** (bouton *Edit* à côté de « Root Directory »).
   Laisser activée l'option d'inclusion des fichiers situés hors du Root Directory (activée par
   défaut) : le build a besoin de la racine (lockfile, `packages/*`).
3. Framework Preset : *Other* (déjà forcé par `"framework": null` dans `vercel.json`).
4. Node.js : 24.x (*Settings → Build and Deployment → Node.js Version*).
5. Variables d'environnement (Production **et** Preview) : `EXPO_PUBLIC_SERVER_URL`,
   `EXPO_PUBLIC_WEB_URL`. Elles sont figées dans le bundle au build : **redéployer** après modification.
6. Déployer. Tester `/`, `/privacy`, `/r/ABCD` et `/vote/ABCD` (rafraîchissement direct de la page :
   doit afficher l'app, pas une 404).

L'installation utilise `npm ci --workspace=game` (installation filtrée sur le workspace du jeu,
exécutée à la racine du monorepo par npm). `npm ci` échoue si `package-lock.json` n'est pas
synchronisé : committer le lockfile à jour.

Réf. : <https://vercel.com/docs/monorepos>, <https://vercel.com/docs/builds/configure-a-build#root-directory>,
<https://vercel.com/docs/project-configuration/vercel-json>, <https://docs.expo.dev/guides/publishing-websites/>

## 5. CORS

- `CORS_ORIGIN` doit lister **exactement** les origines web (schéma + hôte, sans `/` final) :
  domaine de production, éventuel `www`, et si besoin l'URL Vercel de production
  (`https://<projet>.vercel.app`).
- Les URL de *preview* Vercel changent à chaque déploiement : utiliser un serveur de **staging**
  distinct avec un `CORS_ORIGIN` plus large plutôt que d'ouvrir la production.
- Les apps natives ne sont pas soumises au CORS navigateur.
- Ne jamais laisser `*` (valeur par défaut) en production.

## 6. Domaine personnalisé

- **Web (Vercel)** : *Project → Settings → Domains* → ajouter `buildyourteam.app` et
  `www.buildyourteam.app`, puis créer les enregistrements DNS indiqués par Vercel. HTTPS automatique.
- **Serveur (Fly.io)** : `fly certs add realtime.buildyourteam.app`, puis créer le CNAME
  (ou A/AAAA) indiqué par `fly certs show realtime.buildyourteam.app`.
- **Serveur (Render)** : *Settings → Custom Domains*.
- Ensuite, mettre à jour : `EXPO_PUBLIC_WEB_URL` / `EXPO_PUBLIC_SERVER_URL` (Vercel + EAS),
  `CORS_ORIGIN` (serveur), puis redéployer le web **et** reconstruire les apps natives.

## 7. Limites de montée en charge — pourquoi une seule instance, et pas de serverless

- L'état de chaque salon (enchère en cours, minuteurs, joueurs connectés) vit **en mémoire** dans le
  processus Node ; les clients gardent une **connexion WebSocket persistante** vers ce processus.
- Les plateformes serverless (fonctions Vercel, Lambda…) ne conservent ni mémoire ni connexions entre
  invocations et coupent les requêtes longues : incompatible avec Socket.IO et des minuteurs serveur.
- Deux instances derrière un load balancer couperaient les salons en deux (joueurs d'un même salon sur
  des processus différents). Le scaling horizontal exigerait des *sticky sessions*, une attribution des
  salons à une instance (room ownership) et un adaptateur Socket.IO (Redis…) : **hors périmètre MVP**.
- Montée en charge possible : **verticale** (plus de CPU/RAM : `[[vm]]` dans `fly.toml`, `plan` dans
  `render.yaml`). Une instance `shared-cpu-1x` / 512 Mo suffit largement pour des dizaines de salons
  simultanés ; surveiller CPU et mémoire avant d'agrandir.
- **Redéploiement = coupure de quelques secondes** : au redémarrage, les salons sont rechargés depuis
  PostgreSQL et les clients Socket.IO se reconnectent automatiquement. Éviter de déployer pendant
  les pics de jeu.
- Anti-abus des votes spectateurs : le serveur lit l'IP client dans `X-Forwarded-For` (en-tête posé par
  le proxy Fly/Render).

## 8. Sauvegardes

- Les données de partie sont purgées automatiquement après **30 jours** (cf. page `/privacy`) : l'enjeu
  est surtout la continuité de service, pas l'archivage.
- Supabase : sauvegardes quotidiennes automatiques sur les plans payants (conservées 7 jours sur Pro ;
  PITR en option). Le plan gratuit n'inclut pas de sauvegardes automatiques : prévoir un dump régulier :
  ```bash
  pg_dump "$DATABASE_URL" --format=custom --file=byt-$(date +%F).dump
  ```
- Restauration : `pg_restore --clean --if-exists -d "$DATABASE_URL" byt-AAAA-MM-JJ.dump`, puis
  redémarrer le serveur (`fly machine restart` ou *Manual Deploy* sur Render).
- PGlite n'est **pas** une solution de production (pas de sauvegarde, perdu à chaque redéploiement
  sans volume).

Réf. : <https://supabase.com/docs/guides/platform/backups>

## 9. Supervision

- **Logs structurés JSON** (une ligne par événement : `t`, `level`, `msg`, + champs) sur stdout/stderr :
  `server_started`, `room_created`, `migrations_applied`, `invalid_pack`, `shutting_down`…
  - Fly : `fly logs` ou *log shipping* vers un service externe (Better Stack, Axiom, Datadog…).
  - Render : onglet *Logs*, ou *Log Streams* vers un fournisseur externe.
- **`GET /health`** → `{"ok":true,"db":"pg","rooms":<n>,"uptimeSec":<s>}` :
  - utilisé par les health checks Fly/Render et le `HEALTHCHECK` Docker ;
  - brancher un moniteur externe (UptimeRobot, Better Stack…) toutes les 1–5 min avec alerte e-mail ;
  - vérifier que `db` vaut `pg` en production (et non `pglite`).
- Alertes à prévoir : serveur injoignable, redémarrages en boucle, base Supabase proche des quotas.

## 10. Coûts (ordre de grandeur, à revérifier sur les grilles tarifaires)

| Poste | Option | Ordre de grandeur |
|---|---|---|
| Serveur temps réel | Fly.io `shared-cpu-1x` 512 Mo, 24/7 | ~4–5 $/mois (3,69 $ à `iad` ; Europe un peu plus cher) + trafic sortant 0,02 $/Go ; IPv4 partagée gratuite, IPv4 dédiée 2 $/mois |
| Serveur temps réel | Render instance `0.5c-512mb` | ~7 $/mois |
| Base | Supabase Free / Pro | 0 $ (500 Mo, projet mis en pause après 1 semaine d'inactivité, pas de sauvegardes automatiques) / à partir de 25 $/mois (sauvegardes quotidiennes conservées 7 jours) |
| Web | Vercel Hobby / Pro | 0 $ (usage personnel, non commercial) / ~20 $/mois par membre |
| Builds mobiles | EAS Free / Starter | 0 $ (jusqu'à 15 builds Android + 15 builds iOS, file d'attente) / 19 $/mois + usage |
| Stores | Apple Developer Program / Google Play Console | 99 $/an / 25 $ une fois |
| Domaine | `.app` ou autre | ~10–20 $/an |

Total MVP réaliste : **~5–15 $/mois** + comptes stores ; ~60 $/mois avec Supabase Pro + Vercel Pro.

Réf. : <https://fly.io/docs/about/pricing/>, <https://render.com/pricing>, <https://supabase.com/pricing>,
<https://vercel.com/pricing>, <https://expo.dev/pricing>

## 11. Comptes à créer par le propriétaire (checklist)

- [ ] **GitHub** (ou GitLab/Bitbucket) : héberger le repo, relié à Vercel/Render.
- [ ] **Supabase** : projet PostgreSQL (région UE) → `DATABASE_URL`.
- [ ] **Fly.io** (carte bancaire requise après l'essai) **ou** **Render** : serveur temps réel.
- [ ] **Vercel** : client web (Hobby si non commercial, sinon Pro).
- [ ] **Registrar de domaine** (OVH, Gandi, Cloudflare…) : domaine + DNS.
- [ ] **Expo** (expo.dev) : EAS Build / Submit.
- [ ] **Apple Developer Program** (99 $/an) — voir [STORE_RELEASE.md](./STORE_RELEASE.md).
- [ ] **Google Play Console** (25 $) — voir [STORE_RELEASE.md](./STORE_RELEASE.md).
- [ ] **Monitoring** (optionnel) : UptimeRobot / Better Stack.
- [ ] Adresse e-mail de contact publique (page `/privacy`, fiches stores).

## 12. Check-list de mise en production

- [ ] `DATABASE_URL` Supabase avec `sslmode=require` configurée sur le serveur ; `/health` renvoie `"db":"pg"`.
- [ ] `CORS_ORIGIN` = origines web exactes (pas `*`).
- [ ] Une seule Machine/instance (`fly scale show`).
- [ ] Vercel : Root Directory `apps/game`, variables `EXPO_PUBLIC_*` définies, routes profondes OK.
- [ ] Domaines personnalisés + HTTPS actifs ; variables mises à jour ; web redéployé.
- [ ] `eas.json` : valeurs `REPLACE-ME` remplacées (ou variables EAS définies).
- [ ] Moniteur externe sur `/health` ; logs consultables.
- [ ] Page `/privacy` complétée (contact éditeur) et accessible publiquement.

## Dépannage Vercel

### `500 FUNCTION_INVOCATION_FAILED`

Vercel a tenté d'exécuter du code comme **fonction serveur**. Cela arrive quand le projet Vercel pointe sur `services/realtime` : Vercel détecte `src/index.ts` et le lance comme un serveur. Or le serveur temps réel (WebSockets permanents, chronos en mémoire) **ne peut pas tourner sur Vercel**.

Le site, lui, est **100 % statique** (export web Expo). Aucune fonction Vercel n'est nécessaire.

**Correction**, dans Vercel → Project → Settings → Build & Deployment :

- **Root Directory** : laisser la **racine du dépôt**. Le fichier `vercel.json` à la racine construit `apps/game` et publie `apps/game/dist`. `apps/game` fonctionne aussi, grâce à `apps/game/vercel.json`. Ne **jamais** choisir `services/realtime` : son `vercel.json` fait désormais échouer le build avec un message explicite, au lieu de produire une erreur 500.
- **Framework Preset** : « Other ». Les fichiers `vercel.json` imposent `framework: null`.
- Redéployer.

### « Serveur de jeu non configuré » sur la page d'accueil

Le site a été construit sans `EXPO_PUBLIC_SERVER_URL`. Pour corriger :

1. Déployez le serveur temps réel sur Fly.io ou Render (sections ci-dessus).
2. Dans Vercel → Settings → Environment Variables, ajoutez :
   - `EXPO_PUBLIC_SERVER_URL=https://<votre-serveur>` (Production et Preview) ;
   - `EXPO_PUBLIC_WEB_URL=https://<votre-site>.vercel.app`.
3. **Redéployez**. Ces variables sont intégrées au moment du build.
4. Sur le serveur temps réel, ajoutez l'URL Vercel à `CORS_ORIGIN`.
