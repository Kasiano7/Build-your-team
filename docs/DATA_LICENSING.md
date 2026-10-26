# Licences des données joueurs — Build Your Team

> Note de recherche, mise à jour le 2026-10-26. **Ceci n'est pas un avis juridique.** Les points marqués « incertain » doivent être validés par un avocat spécialisé en propriété intellectuelle / droit du sport (idéalement compétent en droit de l'UE **et** aux États-Unis, puisque l'app sort sur le web, l'App Store et Google Play).

## Synthèse

| Sujet | Conclusion | Niveau de risque si on ignore |
|---|---|---|
| Reprendre les notes EA SPORTS FC (OVR, PAC/SHO/PAS/DRI/DEF/PHY, attributs GK) | **Non**, sans licence écrite d'EA. Aucun programme de licence public n'existe. | Élevé (contrat, droit sui generis UE, marques, possible droit d'auteur) |
| Scraper FUTBIN / FUTWIZ / SoFIFA / FUT.GG | **Source inacceptable** : ces sites ne détiennent pas les droits sur les notes EA et ne peuvent pas les concéder. | Élevé |
| Fournisseurs de données sous licence (Sportmonks, API-Football, Football-Data.org, Opta, Sportradar, StatsBomb) | Possible pour **statistiques brutes, effectifs, nationalités, postes**. Aucun ne fournit les notes EA. Vérifier par écrit l'usage commercial « jeu ». | Moyen (dépend du contrat) |
| Noms / visages de vrais joueurs | Nécessite une licence de droits d'image (FIFPRO collectif + compléments clubs/ligues/joueurs non couverts). Photos d'agence « éditoriales » interdites en jeu. | Élevé |
| MVP | Jeu de données **fictif** clairement étiqueté + avatars procéduraux originaux + couche d'import indépendante. | Faible |

---

## 1. Les notes EA SPORTS FC peuvent-elles être reproduites commercialement ?

**Réponse courte : non, pas sans autorisation écrite d'EA.** Plusieurs couches de protection se cumulent ; certaines sont incertaines, mais leur cumul rend le risque inacceptable pour un produit commercial.

### 1.1 Contrat / conditions d'utilisation d'EA (certain)
- Le *User Agreement* d'EA accorde une licence « personnelle, limitée, non transférable » et **pour un usage non commercial** ; il interdit de copier ou distribuer les services et le contenu EA sauf autorisation expresse, et précise que tout le contenu appartient à EA ou à ses concédants (sections 2 et 3) : https://www.ea.com/legal/user-agreement
- La CJUE a jugé que lorsqu'une base n'est protégée ni par le droit d'auteur ni par le droit sui generis, son exploitant reste libre d'imposer des **restrictions contractuelles** (ex. anti-scraping) : *Ryanair c. PR Aviation*, C-30/14 (2015) — https://www.scl.org/3280-the-cjeu-takes-flight-databases-and-air-fares/ . Donc même si les droits de propriété intellectuelle étaient faibles, le contrat suffit à interdire la reprise depuis les services EA.

### 1.2 Droit sui generis des bases de données (UE) (probable, mais incertain)
- Directive 96/9/CE, art. 7 : protège le fabricant d'une base qui justifie d'un **investissement substantiel** dans l'obtention, la vérification ou la présentation du contenu, contre l'extraction / réutilisation d'une partie substantielle ; durée 15 ans, relancée à chaque nouvel investissement substantiel (art. 10) : https://eur-lex.europa.eu/eli/dir/1996/9/oj
- **Point d'incertitude clé** : la CJUE exclut l'investissement consacré à la **création** des données (*British Horseracing Board c. William Hill*, C-203/02, 2004 : https://curia.europa.eu/en/actu/communiques/cp04/aff/cp040089en.pdf ; idem pour les calendriers de matchs, *Fixtures Marketing*). Or EA « crée » ses notes. Mais EA investit aussi massivement dans la **collecte et vérification** (réseau de milliers de contributeurs/scouts, éditeurs qui vérifient chaque changement : https://www.techradar.com/news/gaming/this-is-how-fifa-17-player-ratings-are-decided-1329441 ; données Opta licenciées pour valider les notes : https://insidersport.com/2023/10/02/stats-perform-ea-data-partnership/). Un juge pourrait donc reconnaître la protection.
- *CV-Online Latvia c. Melons*, C-762/19 (2021) : l'extraction/réutilisation est interdite lorsqu'elle porte atteinte au retour sur investissement du fabricant — https://www.twobirds.com/en/insights/2021/uk/cv-online-latvia-cjeu-complicates-the-enforcement-of-database-rights . Un jeu commercial reprenant l'ensemble des notes d'une édition est un cas d'école d'atteinte.

### 1.3 Droit d'auteur sur les notes (incertain)
- UE : une base n'est protégée par le droit d'auteur que si le choix/la disposition reflète une création intellectuelle propre ; l'effort et le savoir-faire ne suffisent pas (*Football Dataco c. Yahoo*, C-604/10, 2012) — https://www.scl.org/2407-football-dataco-no-database-copyright-protection-for-fixture-lists/ . Une note isolée est probablement non protégeable ; l'ensemble est plus discutable.
- États-Unis : des **estimations fondées sur un jugement d'expert** ont été jugées originales et protégeables (*CDN Inc. c. Kapes*, 197 F.3d 1256, 9e Cir. 1999, cotes de pièces de monnaie) — https://law.resource.org/pub/us/case/reporter/F3/197/197.F3d.1256.html . Les notes EA, explicitement subjectives (« eye test »), s'en rapprochent : risque réel côté US.
- À l'inverse, les **statistiques factuelles** (buts, minutes) ne sont pas protégeables en soi, et un tribunal US a admis l'usage de noms + statistiques publiques en fantasy (*C.B.C. c. MLB Advanced Media*, 8e Cir. 2007) — https://www.loeb.com/en/insights/publications/2007/10/cbc-distribution--marketing-inc-v-major-league-b__ . Cela ne s'étend **pas** aux notes propriétaires d'EA.

### 1.4 Marques et présentation (certain pour les marques)
- « EA SPORTS FC », « Ultimate Team », « FUT » sont des marques d'EA. Afficher « Données officielles EA FC » ou imiter le design des cartes FUT exposerait à une action en contrefaçon / concurrence déloyale (parasitisme). Les abréviations génériques PAC/SHO/… sont probablement libres seules, mais **pas** combinées à un visuel de carte imitant FUT (incertain → avocat).
- Les stores rejettent les apps utilisant la PI de tiers sans droits (Apple, guideline 5.2.1 ; exemple d'app rejetée pour un logo FIFA via une API foot) : https://developer.apple.com/forums/thread/718427

### 1.5 EA propose-t-il une licence ou une API ?
- **Non, pas pour ce besoin.** Le seul programme officiel est la *FC Community API* (annoncée le 27/07/2026), réservée à **trois sites** (FUT.GG, FUTBIN, FUTWIZ), limitée aux données Ultimate Team du compte de l'utilisateur, avec la mention « We are not accepting requests at this time » : https://www.ea.com/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-community-api-update
- EA publie ses notes sur https://www.ea.com/games/ea-sports-fc/ratings , mais leur consultation reste soumise au *User Agreement* (usage non commercial).
- **Seule voie légale : une licence négociée directement avec EA (business development / licensing).** Probabilité d'accord faible pour un jeu concurrent ; à tenter seulement par écrit, via un avocat.

---

## 2. Sites de fans (FUTBIN, FUTWIZ, SoFIFA, FUT.GG)

- Leurs pages de conditions n'ont pas pu être récupérées automatiquement (HTTP 403/404 le 2026-10-26) : **le propriétaire doit les lire manuellement** (liens en pied de page de chaque site). Cela ne change pas la conclusion.
- **Ces sites ne peuvent pas concéder ce qu'ils ne détiennent pas** : les notes viennent d'EA (FUT.GG indique que ses notes proviennent d'EA : https://www.fut.gg/editorial-policy/). Reprendre leurs données cumule (a) le risque EA (§1), (b) le droit sui generis propre de chaque site sur sa propre base (investissement de collecte/présentation, cf. *CV-Online*), (c) une violation probable de leurs CGU (cf. *Ryanair*, §1.1).
- Les datasets Kaggle / Gigasheet « EA FC players » sont eux-mêmes issus de scraping (ex. https://baselight.app/u/kaggle/dataset/nyagami_ea_sports_fc_25_database_ratings_and_stats) : **aucune chaîne de droits**, donc inutilisables.
- **Règle projet : le scraping (ou la copie manuelle) de ces sites et de ea.com n'est pas une source acceptable.**

---

## 3. Fournisseurs de données sous licence

Aucun ne vend les notes EA. Ils fournissent des **données factuelles** (identité, nationalité, postes, effectifs, statistiques de match) et parfois **leurs propres notes de match**. Pour chacun, exiger par écrit : usage commercial dans un **jeu** (pas seulement un site de résultats), droit de stockage/cache, durée de conservation après résiliation, et statut des **photos et logos** (presque toujours exclus ou à licencier séparément).

| Fournisseur | Données utiles | Modèle / prix public | Fréquence | Remarques |
|---|---|---|---|---|
| **Sportmonks** | Joueurs, effectifs, stats par match et saison, **notes de match propriétaires** (51 stats) | Abonnement : Starter dès 29 €/mois (5 ligues), Growth 99 €/mois (30), Pro 249 €/mois (120) — https://www.sportmonks.com/football-api/plans-pricing ; notes : https://www.sportmonks.com/blogs/player-ratings | Temps réel / quotidien | CGU commerciales à confirmer avec leur équipe commerciale. |
| **API-Football (API-Sports)** | Joueurs, stats par match dont une **note** par match, URL de photo | Gratuit 100 req/j ; Pro 19 $/mois, Ultra 29 $, Mega 39 $ — https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide | ~1 min en direct | Les CGU traitent séparément « Data/Logos/images » (cf. fil Apple ci-dessus) : **ne pas supposer que les photos sont licenciées**. |
| **Football-Data.org** | Effectifs, buteurs, compositions, cartons ; stats de match en add-on | Gratuit (12 compétitions) ; 29–199 €/mois ; add-on stats 15 €/mois — https://www.football-data.org/pricing | Direct sur plans payants | Pas de stats individuelles détaillées ; termes commerciaux non publiés (contact direct). |
| **Stats Perform / Opta** | Données de performance très détaillées (200+ compétitions) ; source utilisée par EA | Sur devis, entreprise — https://www.statsperform.com/resource/build-and-monetize-with-opta | Temps réel | Référence qualité ; coût élevé, contrat négocié. |
| **Sportradar** | Profils joueurs, stats ; **API Images** séparée (portraits) | Pas de prix public ; essai 30 j / 1 000 appels — https://sportradar.com/content-hub/blog/best-practices-for-integrating-sportradars-sports-data-apis/ | Temps réel | B2B : données à stocker côté serveur. |
| **StatsBomb (Hudl)** | Données d'événements très riches | Open data **non commerciale** + attribution — https://github.com/statsbomb/statsbombpy ; API payante sur devis | Par match | L'open data est **interdite** pour notre usage commercial. |

> Les données de « performance officielles » de certaines ligues sont détenues en exclusivité (ex. Premier League/EFL → Stats Perform pour paris/fantasy : https://www.statsperform.com/press/stats-perform-extends-long-term-official-statistics-partnership-for-premier-league-efl-and-spfl). Vérifier que le revendeur choisi a bien le droit de sous-licencier pour un jeu.

---

## 4. Noms, image et portraits des joueurs

- **Droit à l'image / de la personnalité** : en France, art. 9 du Code civil (respect de la vie privée, base du droit à l'image) ; aux États-Unis, *right of publicity*. Les tribunaux US ont refusé à EA la défense du Premier Amendement pour des représentations réalistes de joueurs dans un jeu (*Keller c. EA*, 9e Cir. 2013 ; *Hart c. EA*, 3e Cir. 2013) — https://www.crowell.com/en/insights/client-alerts/the-ninth-circuit-court-of-appeals-finds-that-the-use-of-college-football-player-s-likeness-in-a-video-game-is-not-protected-by-the-first-amendment-as-a-matter-of-law . Un jeu commercial affichant noms + notes + visages de vrais joueurs requiert donc une licence.
- **FIFPRO (licence collective)** : FIFPRO Commercial Enterprises BV agrège les droits nom/image/ressemblance (NIL) apportés par les syndicats nationaux pour l'industrie du divertissement numérique ; contact via https://www.fifpro.org/who-we-are/commercial . Exemples de licenciés hors EA : Soccerverse (65 000+ joueurs, 70+ syndicats, déc. 2025) — https://decrypt.co/351814/soccerverse-secures-fifpro-license-to-bring-real-world-authenticity-to-on-chain-football-game ; Soccer Manager (Invincibles Studio).
- **Limites de FIFPRO** (à combler par d'autres contrats) :
  - pays non membres ou sortis (ex. le syndicat espagnol AFE a quitté FIFPRO) — https://soccergaming.com/could-spanish-players-be-removed-from-ea-sports-fc-efootball-and-other-football-games/ ;
  - joueurs contestant la licence collective (Ibrahimović/Bale 2020) et juridictions exigeant le consentement individuel (Brésil, *Lei Pelé*) — https://www.freeths.co.uk/2021/05/27/zlatan-fires-shots-at-ea-games-and-fifapro-drawing-attention-to-the-world-of-image-rights ; https://bura.brunel.ac.uk/bitstream/2438/20150/1/FullText.pdf ;
  - **noms de clubs, maillots, logos, noms de ligues** : droits distincts, vendus collectivement par la plupart des grandes ligues (Premier League, LaLiga, Ligue 1, Bundesliga ; Serie A club par club) — https://www.dacbeachcroft.com/en/what-we-think/publicity-on-the-pitch-football-superstars-vs-ea-sports .
- **Photos** : une photo de joueur implique deux droits — le droit d'auteur du photographe/agence **et** le droit à l'image du joueur. Les licences « éditoriales » (Getty, etc.) excluent les usages commerciaux/promotionnels comme un jeu — https://www.americanfootballinternational.com/using-editorial-football-photography-without-infringing-rights/ . Il faut une licence **commerciale** des photos (ou des portraits fournis par le licencié, ex. API Images Sportradar sous contrat) **plus** la licence NIL.
- **Nationalité / drapeaux** : les drapeaux nationaux sont en général libres ; les **logos de fédérations** ne le sont pas.

---

## 5. Recommandation pour le projet

**(a) MVP = données fictives.** Livrer un jeu de données de joueurs **inventés** (noms générés, nationalités et postes plausibles, notes fictives cohérentes), avec avatars **procéduraux originaux** (aucune ressemblance recherchée avec un vrai joueur). Bandeau permanent visible dans le lobby et sur les cartes : **« Données de démonstration — joueurs fictifs »**. Éviter les noms proches de vrais joueurs (filtre anti-collision sur une liste de noms connus).

**(b) Couche d'import indépendante.** Le moteur de jeu ne connaît qu'un schéma interne ; les données arrivent par un module d'import :
- formats CSV et JSON, validés par un **schéma versionné** (ex. JSON Schema `player-dataset/v1`) ; rejet explicite des lignes invalides avec rapport ;
- métadonnées obligatoires par jeu de données : `source`, `licence`, `licenceRef` (n° de contrat), `validFrom/validUntil`, `version`, `generatedAt`, `isFictional` ;
- **déduplication** par identifiant fournisseur stable (+ clé de repli nom normalisé + date de naissance + nationalité) ;
- jeux de données immuables et versionnés, activables/désactivables à distance (pour retirer un dataset à l'expiration d'une licence) ;
- champs `portraitUrl` / `portraitLicence` séparés : pas de portrait affiché sans licence d'image renseignée.

**(c) Mentions.** Ne **jamais** afficher « Données officielles EA FC », ni logo/marque EA, ni design imitant les cartes FUT, sans autorisation écrite d'EA. Ajouter dans les mentions légales : « Build Your Team n'est ni affilié ni approuvé par Electronic Arts. »

**(d) Pas de fausses notes réelles.** Ne jamais associer des notes inventées au nom ou au visage d'un vrai joueur, ni les présenter comme ses notes réelles (risque de dénigrement, d'atteinte à l'image et de pratique trompeuse). Toute note affichée pour un vrai joueur doit provenir d'une source licenciée ou du modèle maison (e), avec mention de la source.

**(e) Modèle de notation maison (option recommandée à moyen terme).** Calculer nos propres notes 1–99 (général + 6 axes, + 6 axes gardien) à partir de **statistiques brutes licenciées** (ex. Sportmonks / Opta) : normalisation par poste et par minutes jouées, percentiles par compétition, pondérations documentées, recalcul hebdomadaire. Nom propre du système (ex. « Indice BYT »), libellés d'axes non identiques à EA si l'avocat le recommande. Vérifier que le contrat du fournisseur autorise les **œuvres dérivées** (notes calculées) et leur affichage public.

### Checklist du propriétaire

- [ ] Consulter un avocat PI / droit du sport (UE + US) : valider ce document, les libellés d'axes, le design des cartes.
- [ ] Lire et archiver (PDF daté) les CGU de FUTBIN, FUTWIZ, SoFIFA, FUT.GG et du *User Agreement* EA.
- [ ] (Optionnel) Demande écrite de licence à EA pour les notes FC ; ne rien utiliser avant signature.
- [ ] Choisir un fournisseur de stats ; obtenir **par écrit** : usage commercial dans un jeu, stockage, œuvres dérivées, territoire (monde), plateformes (web/iOS/Android), sort des données à la fin du contrat.
- [ ] Ouvrir les comptes (essai Sportmonks / API-Football / Sportradar) et comparer couverture et qualité.
- [ ] Contacter FIFPRO Commercial pour une licence NIL ; identifier les trous de couverture (Espagne, pays non membres, joueurs exclus).
- [ ] Si clubs/ligues affichés : licences ligues/clubs (noms, logos, maillots) — sinon noms de clubs fictifs.
- [ ] Licence commerciale pour les portraits (agence ou fournisseur), distincte de la licence NIL.
- [ ] Rédiger mentions légales, crédits fournisseurs (attribution exigée) et clause de non-affiliation EA.
- [ ] Tenir un registre des licences (contrat, périmètre, date d'expiration) relié aux champs `licenceRef` des datasets.
- [ ] Avant soumission App Store / Google Play : préparer la preuve des droits (Apple 5.2.1).
