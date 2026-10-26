# Règles du jeu — Build Your Team

Toutes les règles ci-dessous sont **appliquées par le serveur** (`packages/game-engine`). Le client se contente d'afficher la vue envoyée par le serveur.

## 1. Salon

- 2 à 4 participants. Le créateur est l'**hôte**. Code de salon : 6 caractères, sans caractères ambigus (pas de 0/O ni de 1/I/L).
- Pas de compte. Chaque participant reçoit un **jeton de session invité** aléatoire de 256 bits. Le serveur n'en garde que l'empreinte SHA-256. Le jeton est stocké dans SecureStore sur mobile et dans localStorage sur le web, et permet de retrouver sa place après une déconnexion.
- Pseudo de 2 à 16 caractères, rendu unique dans le salon (« Alex » devient « Alex 2 »). Un filtre de base refuse les pseudos injurieux.
- Dans le salon d'attente, l'hôte peut retirer un participant. Le jeton du participant retiré est révoqué.
- L'hôte lance la partie à partir de 2 joueurs, sans attendre que toutes les places soient prises. Une fois la partie lancée, on ne peut plus la rejoindre comme joueur. Les nouveaux venus sont redirigés vers la vue spectateur.

## 2. Modes

| | Rapide (MVP) | Classique |
|---|---|---|
| Budget | 200M (150 / 200 / 300) | 500M (400 / 500 / 800) |
| Titulaires | 5 : 1 GB, 1 DEF, 1 MIL, 2 ATT | 11 : 4-3-3, 4-4-2 ou 4-2-3-1 |
| Banc | 0 | 3 remplaçants |
| Changement de formation | non | oui, pendant la draft |
| Chrono d'ouverture | 15 s (10 / 15 / 20 / 30) | 20 s |

Les deux modes utilisent exactement le même moteur. Un mode ne fait que décrire des emplacements, un banc et un budget.

## 3. Déroulement d'une enchère

1. **Tirage.** Le serveur tire un joueur au hasard avec un PRNG à graine, dont l'état est conservé dans la partie. Seuls les joueurs dont **au moins un participant a besoin** sont candidats, c'est-à-dire ceux qui ont un emplacement titulaire libre compatible et le budget pour l'ouverture. Les bons joueurs sortent un peu plus souvent (poids `(note − 58)^1.6`).
2. **Présentation** (1 s). La carte apparaît chez tout le monde en même temps. On ne peut pas encore enchérir.
3. **Ouverture.** Le serveur fixe l'heure de fin `endsAt` d'après sa propre horloge. Les clients affichent le compte à rebours en tenant compte du décalage d'horloge mesuré à la connexion.
4. **Participants éligibles.** Est éligible celui qui peut placer le joueur, sur un emplacement titulaire compatible ou sur le banc, et peut payer au moins la mise d'ouverture sans enfreindre la réserve (§4). Les autres sont « hors course » pour cette enchère.
5. **Offres.**
   - La première offre vaut au moins **10M**, la mise d'ouverture.
   - Chaque offre suivante dépasse la meilleure offre d'au moins **10M**.
   - Boutons +10M, +20M, +50M, ou montant libre.
   - On ne peut pas surenchérir sur sa propre meilleure offre.
   - Une offre est **engageante** : le meilleur enchérisseur ne peut pas passer.
6. **Chrono.** Après chaque offre valide, la fin d'enchère passe à `max(fin actuelle, maintenant + 12 s)`. Le chrono ne peut donc jamais raccourcir.
7. **Passer.** C'est définitif pour ce joueur : on ne peut plus enchérir dessus.
8. **Clôture**, exécutée par le serveur même si aucun client n'agit :
   - **anticipée** dès que tous les éligibles, sauf le meilleur enchérisseur, ont passé ;
   - sinon, à l'heure de fin.
9. **Résultat.**
   - **Vendu** : le montant est débité du budget du gagnant et le joueur est placé automatiquement (§5). Animation de 2,4 s ; la présentation du joueur suivant (1 s) enchaîne aussitôt.
   - **Invendu** si personne n'a enchéri. Le joueur sort du tirage mais reste disponible comme joueur libre (§6).
10. **Enchère suivante**, ou fin de la draft.

### Concurrence et sécurité

- Toutes les commandes d'un salon passent par une **file sérielle** : enchères, passes, ticks du chrono, connexions. Deux offres « simultanées » sont donc traitées l'une après l'autre. La seconde est validée contre l'état produit par la première et, si elle n'est plus assez haute, refusée avec le code `BID_TOO_LOW`. Le client affiche alors « Surenchéri ! ».
- Chaque commande porte un `actionId` unique. Une commande renvoyée, par exemple après une coupure réseau, est **acquittée sans être appliquée deux fois**.
- Le nouvel état n'est diffusé qu'**après** l'écriture en base, faite en une seule transaction.
- Les entrées sont validées par des schémas Zod, avec une limitation de débit par connexion (environ 12 messages/s, rafale de 30).

## 4. Réserve : chaque équipe peut toujours être complétée

On note `R` le prix de réserve (10M) et `postes restants` le nombre d'emplacements titulaires encore vides.

```
enchère max = budget − R × (postes restants − (1 si le joueur occupe un poste titulaire, sinon 0))
```

- Exemple en mode rapide : avec 200M et 5 postes vides, on peut miser au plus 200 − 10 × 4 = **160M** sur un premier joueur.
- **Conséquence pour le jeu :** personne ne peut se ruiner sur une star au point de ne plus pouvoir compléter son équipe. Il reste toujours au moins 10M par poste vide.
- **Conséquence stratégique :** dépenser beaucoup tôt réduit la marge sur les postes suivants. Les joueurs voient leur « enchère max possible » en direct.

## 5. Placement automatique

Chaque joueur a un **poste naturel** (le premier rôle) et d'éventuels **postes secondaires**. Chaque **emplacement tactique** a une famille (GB, DEF, MIL, ATT) et une liste de postes préférés.

Compatibilité entre un joueur et un emplacement :

| Score | Cas |
|---|---|
| 3 | le poste naturel fait partie des postes préférés |
| 2 | un poste secondaire fait partie des postes préférés |
| 1 | le poste naturel est de la même famille que l'emplacement (« hors poste », signalé par un « ! ») |
| 0 | incompatible : un gardien ne joue jamais dans le champ |

Règle de placement : le joueur va sur l'emplacement titulaire **libre** au meilleur score. En cas d'égalité, c'est l'ordre de la formation qui départage. Sinon il va sur le premier emplacement libre du banc. Sinon, il ne peut pas être acheté, et son acheteur potentiel n'est pas éligible à cette enchère.

Gestion de l'équipe pendant la draft :

- On peut échanger deux emplacements, y compris un titulaire et un remplaçant, si chaque joueur déplacé est compatible avec sa destination (score > 0).
- En mode classique, on peut changer de formation. Le moteur replace tout le monde avec les mêmes règles, les meilleurs joueurs d'abord. Le changement est refusé si l'effectif ne rentre pas dans la nouvelle formation.

## 6. Fin de la draft et joueurs libres

La draft s'arrête dans l'un de ces cas :

- toutes les équipes ont leurs titulaires ;
- aucun joueur restant n'est utile à personne ;
- le plafond d'enchères est atteint : `participants × (titulaires + banc) × 3`, soit 60 pour 4 joueurs en mode rapide. Ce plafond garantit qu'une partie se termine même si quelqu'un ne joue pas.

Les postes encore vides sont alors complétés par une règle **identique pour tous et transparente**. On parcourt les participants dans l'ordre d'arrivée, et pour chacun ses emplacements dans l'ordre de la formation. Chaque emplacement reçoit **le joueur compatible le moins bien noté** parmi ceux qui n'ont jamais été vendus, au prix de réserve (10M). Le budget de chacun le permet toujours, grâce à la réserve du §4.

Rester passif ne rapporte donc rien : on hérite des joueurs les plus faibles.

## 7. Vote final

| Participants | Mode de vote |
|---|---|
| 3 ou 4 | **Vote croisé.** Chacun vote pour une équipe autre que la sienne, une seule fois. Le vote se clôt dès que tout le monde a voté, ou au bout de 75 s. |
| 2 | **Vote des spectateurs.** Un vote croisé finirait forcément à 1 contre 1. Les joueurs partagent un lien `/vote/<CODE>`, les spectateurs votent pour l'une des deux équipes, et les joueurs ne votent pas. Le vote se clôt au bout de 5 min, ou plus tôt sur décision de l'hôte (s'il y a au moins un vote). |

Protections contre les votes répétés, vérifiées par le serveur :

- un vote par votant, garanti en mémoire et par la contrainte `UNIQUE(room_code, voter_id)` en base ;
- l'identifiant spectateur est mémorisé sur l'appareil, donc recharger la page n'ouvre pas droit à un second vote ;
- au plus 3 votes spectateurs par adresse IP et par salon (IP hachée ; derrière un proxy, voir `TRUST_PROXY`).

Ces mesures sont raisonnables, pas inviolables : quelqu'un qui change d'appareil **et** de réseau peut voter à nouveau. C'est un niveau adapté à un jeu entre amis.

### Classement et égalités

L'ordre est déterminé ainsi :

1. le nombre de votes ;
2. en cas d'égalité, la **note d'équipe** (moyenne des titulaires, à une décimale) ;
3. puis le budget restant le plus élevé ;
4. puis l'ordre d'arrivée dans le salon.

L'écran de résultats indique quel critère a départagé le premier et le deuxième. Un vote sans aucune voix est donc tranché par la note d'équipe.

## 8. Déconnexions

- Un joueur déconnecté apparaît « hors ligne ». Le jeu continue : les chronos sont gérés par le serveur.
- **Le meilleur enchérisseur déconnecté reste engagé.** Il remporte le joueur si personne ne surenchérit.
- À la reconnexion, que ce soit après un rechargement, une sortie de l'arrière-plan ou un changement de réseau, le client reprend automatiquement sa session et retrouve tout son état : budget, équipe, enchère en cours.
- Si le serveur redémarre, les salons actifs sont rechargés depuis PostgreSQL et leurs chronos reprennent.

## 9. Données des joueurs

À la création de la partie, l'hôte choisit le jeu de joueurs :

- **Réels** (par défaut) : 162 footballeurs réels, saison 2025-2026. Leurs notes et statistiques sont des **estimations de Build Your Team**, affichées comme telles (« NOTE ESTIMÉE », « non officielles »). Ce ne sont pas des notes EA SPORTS FC. Les cartes montrent une silhouette neutre, sans photo.
- **Fictifs** : 180 joueurs entièrement inventés.

Les règles sont identiques dans les deux cas. Voir `DATA_LICENSING.md` pour les conditions d'usage du mode Réels.
