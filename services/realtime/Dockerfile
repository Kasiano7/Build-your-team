# syntax=docker/dockerfile:1
#
# Image du serveur temps réel Build Your Team (@byt/realtime).
#
# Contexte de build = RACINE du monorepo (le serveur importe les sources TypeScript
# de packages/shared, packages/game-engine et des packs de contenu packages/football,
# packages/basketball, packages/rugby, packages/motorsport et packages/arena, et lit
# database/migrations au démarrage) :
#
#   docker build -f services/realtime/Dockerfile -t byt-realtime .
#   docker run --rm -p 4000:4000 -e DATABASE_URL=postgresql://... byt-realtime
#
# IMPORTANT : une seule instance doit tourner (état des salons en mémoire +
# WebSockets persistants). Pas de serverless, pas de scaling horizontal.

FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    PORT=4000 \
    PGLITE_DIR=/data/pglite \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

WORKDIR /app

# tsx est une devDependency de la racine (donc exclue par --omit=dev) : on
# l'installe globalement, à la même version que package-lock.json.
RUN npm install -g tsx@4.23.15 && npm cache clean --force

# 1) Manifestes uniquement (cache Docker des dépendances).
#    On copie le package.json de TOUS les workspaces pour que l'arbre des
#    workspaces corresponde exactement à package-lock.json (sinon `npm ci`
#    refuse de s'exécuter). Seules les dépendances de @byt/realtime (et des
#    workspaces dont il dépend) sont réellement installées.
COPY package.json package-lock.json ./
COPY apps/game/package.json apps/game/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/game-engine/package.json packages/game-engine/package.json
COPY packages/football/package.json packages/football/package.json
COPY packages/basketball/package.json packages/basketball/package.json
COPY packages/rugby/package.json packages/rugby/package.json
COPY packages/motorsport/package.json packages/motorsport/package.json
COPY packages/arena/package.json packages/arena/package.json
COPY services/realtime/package.json services/realtime/package.json

RUN npm ci --omit=dev --workspace @byt/realtime --ignore-scripts \
 && npm cache clean --force

# 2) Sources (TypeScript exécuté directement par tsx, pas d'étape de build).
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/game-engine packages/game-engine
COPY packages/football packages/football
COPY packages/basketball packages/basketball
COPY packages/rugby packages/rugby
COPY packages/motorsport packages/motorsport
COPY packages/arena packages/arena
COPY services/realtime services/realtime
COPY database database

# Répertoire PGlite (utilisé si DATABASE_URL est absent). Sur Fly.io, un volume
# persistant est monté sur /data (voir fly.toml) : il appartient à root, donc le
# conteneur démarre en root, attribue /data à l'utilisateur `node`, puis abandonne
# ses privilèges (setpriv) avant de lancer le serveur.
RUN mkdir -p /data/pglite && chown -R node:node /data

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

# Équivalent de `npx tsx services/realtime/src/main.ts` (tsx est global), lancé
# en tant que `node` après avoir rendu /data accessible. `exec` : tsx reçoit
# directement SIGTERM/SIGINT et le serveur s'arrête proprement.
CMD ["sh", "-c", "mkdir -p /data/pglite && chown -R node:node /data && if command -v setpriv >/dev/null 2>&1; then exec setpriv --reuid=node --regid=node --init-groups tsx services/realtime/src/main.ts; else exec tsx services/realtime/src/main.ts; fi"]
