# Déployer le serveur de jeu sur Fly.io (pas à pas)

Ce guide met en ligne le **serveur temps réel** (`services/realtime`). Le site web reste sur Vercel. Durée : environ 15 minutes.

> **Déjà préparé et vérifié dans le dépôt :**
> - `fly.toml` configuré (Paris, une seule machine, jamais d'arrêt automatique, contrôle de santé `/health`, volume persistant) ;
> - `services/realtime/Dockerfile` prêt.
>
> L'image a été reproduite localement (mêmes fichiers, installation de production : 37 modules, sans Expo). Le serveur a démarré en mode production : `/health` répond, les 3 packs sont chargés, et un test de création, de rejoint et de lancement de partie passe par WebSocket.
>
> Le build Docker lui-même n'a pas pu être lancé ici (Docker n'est pas installé). C'est Fly.io qui le fera sur ses serveurs.

**Données :** le serveur utilise son moteur PostgreSQL intégré (PGlite) sur un **disque persistant Fly de 1 Go**, sans compte Supabase. Pour passer plus tard sur une base gérée, il suffira d'un secret `DATABASE_URL`.

**Coût :** Fly.io facture à l'usage. Une petite machine (1 vCPU partagé, 512 Mo) allumée en permanence, plus 1 Go de volume, coûte de l'ordre de quelques dollars par mois. Vérifiez la grille tarifaire et le crédit d'essai sur fly.io/pricing.

## 1. Installer l'outil `flyctl` (une fois)

Dans PowerShell :

```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

Commande officielle (docs.fly.io/flyctl/install). **Fermez puis rouvrez le terminal** pour que la commande `fly` soit reconnue.

## 2. Créer le compte ou se connecter

```powershell
fly auth signup
```

Si vous avez déjà un compte :

```powershell
fly auth login
```

Le navigateur s'ouvre : c'est vous qui saisissez vos identifiants et le moyen de paiement demandé par Fly.

## 3. Créer l'application et le volume

Depuis la **racine du projet** (`Build Your team`) :

```powershell
fly apps create byt-realtime-kasiano7
```

Si le nom est déjà pris, choisissez-en un autre et reportez-le sur la ligne `app = "..."` de `fly.toml`.

```powershell
fly volumes create byt_data --region cdg --size 1 --yes
```

## 4. Autoriser votre site Vercel

Remplacez par l'adresse exacte de votre site, sans `/` final :

```powershell
fly secrets set CORS_ORIGIN="https://VOTRE-SITE.vercel.app" --stage
```

## 5. Déployer

```powershell
fly deploy --ha=false
```

L'option `--ha=false` est indispensable : **une seule machine** doit tourner, car l'état des parties est en mémoire. Le premier build prend quelques minutes.

## 6. Vérifier

```powershell
fly status
```

Puis ouvrez `https://byt-realtime-kasiano7.fly.dev/health` (avec votre nom d'application). Vous devez voir `{"ok":true,"db":"pglite",...}`.

## 7. Brancher le site Vercel

Dans Vercel → votre projet → **Settings → Environment Variables**, ajoutez pour Production et Preview :

| Nom | Valeur |
|---|---|
| `EXPO_PUBLIC_SERVER_URL` | `https://byt-realtime-kasiano7.fly.dev` |
| `EXPO_PUBLIC_WEB_URL` | `https://VOTRE-SITE.vercel.app` |

Puis **Deployments → Redeploy**. Ces variables sont intégrées au moment du build, d'où le redéploiement. Le bandeau « Serveur de jeu non configuré » disparaît, et les parties fonctionnent entre plusieurs navigateurs et téléphones, même sur des réseaux différents.

Pour l'application de test sur téléphone (build EAS preview), saisissez la même adresse `https://….fly.dev` dans Réglages → Serveur de jeu. Aucun nouveau build n'est nécessaire.

## Au quotidien

| Besoin | Commande |
|---|---|
| Voir les logs en direct | `fly logs` |
| Mettre à jour après un `git pull` | `fly deploy --ha=false` |
| Vérifier qu'une seule machine tourne | `fly scale show`, puis `fly scale count 1` si besoin |
| Ajouter un domaine du site à CORS | `fly secrets set CORS_ORIGIN="https://site1,https://site2"` |
| Sauvegarder le volume | `fly volumes list`, puis `fly volumes snapshots list <id>` (Fly prend des instantanés quotidiens des volumes) |

## En cas de problème

| Symptôme | Cause probable et solution |
|---|---|
| `/health` ne répond pas après le déploiement | Lisez `fly logs`. Si vous voyez `local_db_corrupted`, le serveur recrée une base neuve tout seul. |
| Le site affiche « Connexion au serveur impossible » | `EXPO_PUBLIC_SERVER_URL` est absente ou le site n'a pas été redéployé depuis (étape 7) ; ou `CORS_ORIGIN` ne correspond pas exactement à l'adresse du site (étape 4). |
| Deux machines listées par `fly status` | `fly scale count 1` |
