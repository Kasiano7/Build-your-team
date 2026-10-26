# Tester sur vos téléphones : build EAS « preview »

Ce guide vous permet d'installer Build Your Team sur vos téléphones et d'y faire une vraie partie. La version de test s'appelle **« Build Your Team (Preview) »** (identifiant `com.buildyourteam.app.preview`) et s'installe à côté de la future version des stores.

> Ce qui est **déjà fait et vérifié** dans le dépôt :
> - variante `preview` configurée (`app.config.ts`, `eas.json`) ;
> - accès autorisé à un serveur de jeu en HTTP sur le réseau local, **uniquement** dans cette variante ;
> - adresse du serveur modifiable dans l'app ;
> - bundle Android compilé ;
> - `expo prebuild` vérifié (identifiant, nom et autorisation HTTP corrects) ;
> - `expo-doctor` : 20/20.
>
> Ce qui **demande votre compte Expo** : la connexion, la création du projet EAS et le lancement du build dans le cloud.

## 0. Ce qu'il vous faut

| | Android | iPhone |
|---|---|---|
| Compte Expo (gratuit, expo.dev) | ✅ suffit | ✅ requis |
| Compte Apple Developer Program (99 $/an) | — | ✅ **obligatoire** pour installer une app de test |
| Installation | APK téléchargé via un lien ou un QR code | Appareils enregistrés au préalable, ou TestFlight |

**Sans compte Apple, les iPhones peuvent quand même jouer via le navigateur** (§5). Tout le monde rejoint la même partie, quelle que soit la plateforme.

## 1. Lancer le serveur de jeu sur le PC

Les téléphones doivent être sur le **même Wi-Fi** que le PC.

```bash
npm run dev:server
```

L'adresse locale de ce PC (Ethernet) est **`192.168.1.14`**. Elle peut changer : vérifiez avec `ipconfig`. Le serveur répond bien sur `http://192.168.1.14:4000/health` depuis le PC.

**Pare-feu Windows.** S'il demande l'autorisation pour Node.js, acceptez pour les réseaux **privés**. Sinon, autorisez le port 4000 vous-même, par exemple dans PowerShell en administrateur :

```powershell
New-NetFirewallRule -DisplayName "Build Your Team - serveur de test" -Direction Inbound -Protocol TCP -LocalPort 4000,8081 -Action Allow -Profile Private
```

Pour vérifier depuis un téléphone, ouvrez `http://192.168.1.14:4000/health` dans son navigateur. La page doit afficher `{"ok":true,...}`.

> Pour jouer **à distance** (pas sur le même Wi-Fi), il faut un serveur hébergé (Fly.io ou Render, voir `DEPLOYMENT.md`). Il suffit ensuite de saisir son adresse `https://…` dans l'app, sans refaire de build.

## 2. Créer le projet EAS (une seule fois)

Depuis `apps/game` :

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

`eas init` crée le projet sur votre compte et ajoute `extra.eas.projectId` dans `app.json` (la configuration dynamique `app.config.ts` reprend `app.json`). Si la commande vous demande d'ajouter l'identifiant vous-même, collez-le dans `app.json`, sous `expo.extra.eas.projectId`. Committez ensuite ce changement.

## 3. Lancer le build Android

```bash
npx eas-cli@latest build --profile preview --platform android
```

- Au premier build, EAS propose de **générer un keystore Android** : répondez **oui**. Il est stocké et géré par EAS : gardez ce compte, il sert pour les mises à jour.
- Durée : environ 10 à 25 minutes, selon la file d'attente de l'offre gratuite.
- À la fin, EAS affiche un **lien et un QR code**. Ouvrez-les sur chaque téléphone Android, téléchargez l'APK et autorisez « Installer des applis inconnues » pour le navigateur quand Android le demande.

## 4. Premier lancement : indiquer le serveur

Au premier lancement, l'accueil affiche **« Version de test : aucun serveur configuré »** :

1. Touchez le bandeau pour ouvrir **Réglages**, puis **Serveur de jeu**.
2. Saisissez `192.168.1.14`. Le port 4000 est ajouté automatiquement.
3. Touchez **Tester**. Le message attendu est « Serveur joignable ».
4. Touchez **Enregistrer**. L'adresse est mémorisée sur le téléphone.

Vous pouvez ensuite créer ou rejoindre une partie comme sur le web.

Avec un serveur local, le bouton **Inviter** partage le code et le lien `http://192.168.1.14:8081/r/CODE`, c'est-à-dire la version web servie par le PC. Pour que ce lien fonctionne, gardez `npm run dev:web` lancé.

## 5. iPhones

**Option A, tout de suite et sans compte Apple : le navigateur.** Sur le PC, lancez aussi :

```bash
npm run dev:web
```

Puis, sur l'iPhone, ouvrez `http://192.168.1.14:8081` dans Safari. C'est la même application et la même partie que les téléphones Android.

**Option B, l'app native.** Elle nécessite l'Apple Developer Program.

```bash
npx eas-cli@latest device:create
```

Envoyez le lien ou le QR code à chaque iPhone pour enregistrer l'appareil, puis lancez :

```bash
npx eas-cli@latest build --profile preview --platform ios
```

EAS vous demande de vous connecter à votre compte Apple pour créer le certificat et le profil ad hoc. Ce profil n'autorise que les iPhones enregistrés. Pour un groupe de testeurs plus large, passez par TestFlight (voir `STORE_RELEASE.md`).

## 6. Ce qu'il faut vérifier pendant la partie

Ces points n'ont pas encore pu être testés sur appareil réel. Vos retours sont précieux.

- [ ] Partie complète à 4 : création, invitation, enchères, transfert de la carte, vote, résultats.
- [ ] Sons à chaque étape (présentation, offre, tic des 3 dernières secondes, vendu, victoire). Réglage du volume, coupure.
- [ ] Vibrations (victoire d'enchère, offres). Interrupteur dans Réglages.
- [ ] Rotation portrait et paysage pendant les enchères ; lisibilité du terrain.
- [ ] Passer l'app en arrière-plan 30 s puis revenir : reconnexion automatique, même équipe et même budget.
- [ ] Couper le Wi-Fi quelques secondes en pleine enchère : le badge « Hors ligne » apparaît puis la connexion reprend.
- [ ] Clavier numérique du montant libre ; bouton PASSER facile à atteindre au pouce.
- [ ] Bouton **Inviter** : la feuille de partage native s'ouvre.
- [ ] Animations réduites (Réglages, ou option d'accessibilité du téléphone).

Le plus utile : une capture d'écran et une phrase par problème.

## 7. Mettre à jour la version de test

Toute modification nécessite un nouveau build : relancez la commande du §3. Les mises à jour à distance (EAS Update) ne sont pas encore configurées ; c'est une option pour plus tard. Changer de serveur, en revanche, ne demande **pas** de nouveau build : il suffit de passer par Réglages.

## Sécurité

La variante `preview` autorise le HTTP non chiffré, pour joindre un serveur de test sur le réseau local. La variante `production` (stores) ne l'autorise **pas** : ce point est vérifié par `npx expo config` (`usesCleartextTraffic: false`, pas d'exception App Transport Security sur iOS). Le champ « Serveur de jeu » n'existe pas dans la version production.
