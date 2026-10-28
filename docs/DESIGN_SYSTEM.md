# Design system — Build Your Team

**Direction : un stade, la nuit, version premium.** Profondeur (verre dépoli, lueurs de projecteurs), typographie contemporaine, pelouse tondue en bandes sous les projecteurs. On évite le look « dashboard IA générique » : pas de halos néon partout, une seule couleur d'accent, l'or réservé au prestige.

Source unique des valeurs : `packages/ui/src/tokens.ts`.

## Version 2 (28/10/2026) : « stadium night, premium »

Objectif : une interface plus actuelle et plus haut de gamme, sans quitter la palette du brief (noir profond, cyan, or discret, vert de pelouse).

| Élément | Choix |
|---|---|
| **Fond** | Composant `Backdrop` (`packages/ui`) : fond nuit avec une lueur cyan en haut à gauche (projecteurs), une lueur émeraude en bas (pelouse), une touche d'or, deux faisceaux de projecteurs, un grain fin et une vignette. Le rendu est statique, donc sans coût à l'exécution. |
| **Surfaces** | `Panel` en verre dépoli : vrai flou via `expo-blur` (`backdrop-filter` sur le web), remplissage translucide, reflet en haut, bordure fine, rayon de 22 et ombre portée sur le web. |
| **Contrôles** | Boutons en pilule. Le bouton principal a un dégradé cyan → menthe (`#2BE3D0` → `#8DF7C4`) et un léger halo ; les boutons secondaires sont en verre. Champs et sélecteurs en pilule dans une piste vitrée. |
| **Typographie** | **Unbounded** (600/700/800) pour les titres et tous les chiffres importants : notes, budgets, offres, chrono, code du salon. **Manrope** (400–800) pour le texte et les libellés. Titres en casse normale avec un interlettrage resserré. |
| **Cartes** | Plaque arrondie avec un coin biseauté, bordure en dégradé selon le palier, feuille holographique (plus marquée pour Élite et Légende), halo lumineux derrière le portrait, plaque de nom vitrée avec le club, statistiques sur une grille 3 × 2. |
| **Terrain** | Tribunes au fond avec une foule ponctuée de lumières, deux projecteurs, bords adoucis qui se fondent dans le stade, lignes légèrement lumineuses, halo vert autour de la pelouse. |
| **Joueurs du salon** | Pastille ronde avec les initiales, à la couleur du siège (`PlayerBadge`), dans le lobby, la bande des participants, le classement et les équipes. |
| **Barre de jeu** | Pilule vitrée (`GameTopBar`) : code du salon, état, bouton son, réglages. Les métadonnées sont masquées sur les écrans étroits. |
| **Accueil** | Barre de navigation vitrée, pastille « live », titre « Bid. Build. Win. », boutons côte à côte, trois chiffres clés, carte d'enchère flottante avec des bulles d'offres sur le terrain, section « Comment ça marche » en trois étapes. |

## Couleurs

| Jeton | Valeur | Usage |
|---|---|---|
| `ink` | `#05070A` | Fond principal (sous le `Backdrop`) |
| `glass` / `glassHi` | blanc à 4,5 % / 8 % | Surfaces vitrées |
| `text` / `textDim` / `textMute` | `#F3F6F8` / `#A6B1BC` / `#66727E` | Hiérarchie du texte |
| `accent` → `accent2` | `#2BE3D0` → `#8DF7C4` | **Uniquement l'interaction et l'état actif** (dégradé des boutons principaux, emplacement cible, chrono) |
| `gold` → `gold2` | `#E6C170` → `#B98A3A` | Prestige : cartes Légende, vainqueur, trophée, partage du résultat |
| `grass` / `grassStripe` / `grassDeep` | `#0E4429` / `#125234` / `#082A19` | Pelouse |
| `danger` / `warn` / `success` | `#FF5D6C` / `#FFB547` / `#3DDC97` | PASSER, chrono sous 3 s, messages |
| Couleurs des participants | `#5AA9FF` `#FFB547` `#FF6B8A` `#B18CFF` | Une par siège, distinctes de l'accent |

## Typographie

- **Unbounded** : titres, notes, montants, chrono, code du salon.
- **Manrope** : interface, libellés, noms.
- Les chiffres changeants (budgets, offres, chrono) utilisent des chiffres tabulaires.

## Signature : le terrain 2,5D (`packages/ui/src/Pitch.tsx`)

- Projection perspective réelle (rapport de profondeur 0,68). Les marquages sont aux dimensions officielles (105 × 68 m), avec 14 bandes de tonte, un éclairage de projecteur radial et une vignette limitée à l'aire du terrain.
- Les cartes restent droites et sont mises à l'échelle `1/z` selon la profondeur. Celles du premier plan passent devant celles du fond.
- Emplacement vide : contour pointillé et biseauté, avec le libellé tactique (GB, DC, MC…).
- Emplacement **cible** de l'enchère en cours : turquoise, avec une pulsation lente et la mention « CIBLE ».

## Cartes (`PlayerCard`)

- Plaque **biseautée** en haut à droite et en bas à gauche : une forme originale, différente du blason des cartes EA FC.
- Liseré et bande verticale aux couleurs du palier. Dégradé sombre et un reflet diagonal discret.
- Contenu : note, poste, drapeau, portrait procédural, nom, six statistiques du jeu d'attributs du pack, postes secondaires.
- Paliers (définis par le pack, rendus par un style générique) :

| Style | Palier football | Note |
|---|---|---|
| `bronze` | Espoir | < 65 |
| `silver` | Confirmé | 65–74 |
| `gold` | Titulaire | 75–82 |
| `elite` | Élite (turquoise) | 83–87 |
| `icon` | Légende (or + reflet plus marqué) | 88+ |

- Variantes : `full` pour l'enchère et la fiche (avec statistiques), `compact` pour le terrain (note, poste, portrait, nom court). Marqueur « ! » pour un joueur hors poste.

## Mouvement

| Moment | Animation |
|---|---|
| Arrivée du joueur mis aux enchères | Retournement en 3D, ressort sur l'échelle, reflet lumineux qui traverse la carte |
| Surenchère | Le montant grossit puis revient avec un ressort, la carte pulse, le nom de l'enchérisseur apparaît en fondu |
| Chrono | Anneau qui se vide, orange sous 5 s, rouge et tic sonore sous 3 s |
| Victoire de l'enchère | Tampon « VENDU » en ressort, aux couleurs du gagnant, avec le prix |
| Transfert | La carte part vers le terrain et rétrécit ; sur le terrain, elle tombe avec un rebond et un anneau s'élargit sur la pelouse |
| Joueur suivant | Le cycle de présentation recommence |
| Équipes finales | Terrains côte à côte, tableau comparatif |
| Vainqueur | Trophée qui monte avec un ressort, halo doré qui respire, confettis |

- **Réduction des animations** : le réglage Système, Complètes ou Réduites suit `useReducedMotion` du système. En mode réduit, plus de retournement, de vol, de pulsation ni de confettis : les états s'affichent directement.
- **Sons** : dix sons courts synthétisés (présentation, offre, surenchère adverse, tic, vendu, invendu, passe, arrivée, erreur, victoire). Volume réglable de 0 à 100 % et coupure totale, aussi accessible depuis la barre de la partie. Vibrations sur iOS et Android, désactivables.

## Mise en page adaptative

| Contexte | Mise en page |
|---|---|
| Large (≥ 900 px) ou paysage | Terrain à gauche, en héros, avec la bande des participants. Panneau d'enchères à droite. |
| Paysage court (< 560 px de haut, téléphone couché) | Panneau dense : carte de 96 px, PASSER sur la ligne des boutons rapides. |
| Portrait téléphone | Enchère en haut (boutons à portée de pouce), terrain en dessous, défilement. |

Les zones de sécurité sont gérées par `react-native-safe-area-context`. Les zones tactiles font au moins 44 px.

## Accessibilité

- Libellés et rôles d'accessibilité sur tous les contrôles (bouton, radio, interrupteur, onglet, minuteur), régions annoncées en direct pour la meilleure offre et les notifications.
- Clavier sur le web : les éléments `Pressable` reçoivent le focus, avec une bordure visible sur les boutons et les choix. Validation des formulaires avec Entrée.
- Contraste : texte principal à environ 16:1 sur le fond, accent à environ 11:1.
