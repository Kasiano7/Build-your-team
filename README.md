# BUILD YOUR TEAM — Bid. Build. Win.

Jeu d'enchères multijoueur entre amis, de 2 à 4 joueurs. Chacun a le même budget virtuel. Les footballeurs passent aux enchères un par un, le plus offrant l'emporte et sa carte rejoint son terrain. À la fin, on vote pour la meilleure équipe.

Une seule base de code **Expo / React Native** pour le **web, iOS et Android**. Un **serveur temps réel autoritaire** (Node.js, Socket.IO, PostgreSQL) gère les budgets, les enchères, les chronos et les votes.

> Les joueurs affichés sont **fictifs** (« Données de démonstration — joueurs fictifs »). Aucun argent réel n'est utilisé.

## Démarrer en local (2 commandes)

Prérequis : Node.js 22 ou plus (testé avec 24), npm 10 ou plus. Docker et PostgreSQL ne sont pas nécessaires : en local, le serveur utilise PGlite, le vrai moteur PostgreSQL embarqué.

```bash
npm install
```

```bash
npm run dev:server
```

```bash
npm run dev:web
```

- Serveur de jeu : http://localhost:4000 (`/health`)
- Application web : http://localhost:8081

**Démo à 4 :** ouvrez quatre fenêtres de navigateur, dont au moins trois en navigation privée ou avec des profils différents. En effet, chaque fenêtre garde sa session invitée dans `localStorage`. Dans la première, cliquez sur **Jouer** puis **Créer le salon**. Partagez le lien d'invitation (`/r/CODE`) ou saisissez le code dans les trois autres, puis lancez la partie depuis la première fenêtre.

**Sur téléphone (même réseau Wi-Fi) :** lancez `npm run dev:web`, ou `npx expo start` dans `apps/game`, puis ouvrez l'URL réseau (`http://<IP-du-PC>:8081`) dans le navigateur du téléphone. Le client se connecte automatiquement au serveur sur `<IP-du-PC>:4000`. Pour l'application native, utilisez un build de développement EAS (voir `docs/STORE_RELEASE.md`).

## Tests

```bash
npm test
```

Lance les tests unitaires du moteur (25) et les tests d'intégration (13) : un vrai serveur, quatre clients Socket.IO indépendants et du SQL PostgreSQL réel.

Tests de bout en bout dans le navigateur, avec les deux serveurs de dev lancés :

```bash
node e2e/four-players.mjs
```

```bash
node e2e/spectators.mjs
```

Les résultats détaillés sont dans `docs/TEST_REPORT.md`.

## Structure

```
apps/game            Application Expo universelle (web · iOS · Android)
services/realtime    Serveur de jeu autoritaire (Socket.IO + PostgreSQL)
packages/shared      Types du domaine génériques, contrats Zod, modération
packages/game-engine Moteur d'enchères pur et déterministe
packages/football    Pack « Football » : postes, formations, modes, dataset fictif, import sous licence
packages/ui          Cartes, terrain 2,5D, avatars, drapeaux, jetons de design
database/migrations  Schéma PostgreSQL
e2e                  Scénarios Playwright multi-navigateurs
docs                 Documentation
```

## Documentation

| Document | Contenu |
|---|---|
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Composants, autorité serveur, modèle de données, décisions techniques |
| [GAME_RULES](docs/GAME_RULES.md) | Règles exactes : enchères, réserve, placement, joueurs libres, vote, égalités |
| [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md) | Couleurs, typographie, cartes, terrain, animations, accessibilité |
| [DATA_LICENSING](docs/DATA_LICENSING.md) | Notes EA FC, fournisseurs sous licence, droits à l'image |
| [DEPLOYMENT](docs/DEPLOYMENT.md) | Vercel (web), Fly.io ou Render (temps réel), Supabase (PostgreSQL) |
| [STORE_RELEASE](docs/STORE_RELEASE.md) | EAS Build/Submit, TestFlight, Google Play, métadonnées |
| [TEST_REPORT](docs/TEST_REPORT.md) | Ce qui est développé, testé, incomplet, et les limites connues |
| [ROADMAP](docs/ROADMAP.md) | Prochaines étapes produit et commercialisation |

## Scripts utiles

| Commande | Effet |
|---|---|
| `npm run data:demo` | Régénère le dataset fictif (déterministe) |
| `npm run data:import -- --file x.csv --id … --version … --label … --source … --license …` | Importe un dataset **sous licence**, versionné et validé |
| `npm run typecheck` | Vérifie les types de tous les packages |
| `node apps/game/scripts/generate-sounds.mjs` | Régénère les sons originaux |
| `node apps/game/scripts/generate-icons.mjs` | Régénère l'icône, l'icône adaptative, le splash et le favicon |
