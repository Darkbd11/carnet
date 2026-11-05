# Carnet — Mon argent

Petite appli perso pour gérer son argent au quotidien : on note ses dépenses et ses rentrées, et Carnet calcule **ce qu'il reste pour vivre jusqu'à la fin du mois, et combien ça fait par jour**.

- **Une seule fois ou régulier** : à la saisie, choisis si une somme revient chaque semaine, chaque mois, tous les 3 mois ou chaque année.
- **Fixes** : salaire, aides, loyer, forfait, box… notés une fois, comptés automatiquement à partir du mois choisi. Changer un montant à partir d'un mois, arrêter ou reprendre un fixe ne modifie pas les mois passés.
- **Échéances** : indique le jour de prélèvement pour voir ce qui reste à payer ce mois-ci.
- **Report du solde** (à activer) : ce qu'il reste à la fin d'un mois s'ajoute au suivant, en positif comme en négatif.
- **Plusieurs comptes** : courant, livret, espèces, avec des virements qui ne comptent pas comme des dépenses, et une correction à partir du solde réel.
- **Annuler** une suppression pendant quelques secondes.
- **Dépenses** ajoutées en deux secondes : suggestions à partir de tes libellés et catégorie devinée automatiquement.
- **Catégories personnalisées** : crée, renomme, change la couleur ou masque.
- **Import de relevé bancaire (CSV)** : colonnes détectées, doublons écartés, catégories devinées, annulation possible.
- **Jauge de rythme** : compare ce qui est dépensé à la part du mois déjà passée.
- **Bilan du mois** : ce qui a augmenté ou baissé par rapport au mois précédent.
- **Plafonds par catégorie** qui passent en orange puis en rouge.
- **Objectifs d'épargne** : barre de progression, date cible, et versements déduits du reste à vivre.
- **Évolution sur 6 mois** de ce qu'il reste en fin de mois.
- **Onglet Bilan** : évolution par catégorie sur 6 ou 12 mois, et bilan de l'année.
- **Recherche et filtres** : par libellé, catégorie, période et montant.
- **Rappel de sauvegarde** après 30 jours sans export.
- **Verrouillage par mot de passe** : les données sont chiffrées sur l'appareil.
- **Synchronisation automatique** entre tes appareils, chiffrée, via un dépôt GitHub privé.
- **Sauvegarde** : export et import d'un fichier JSON, chiffré ou non, et export CSV pour Excel.
- **Thème** clair, sombre ou comme l'appareil.
- **Installable sur le téléphone** et utilisable hors-ligne (PWA).

Aucun framework, aucune installation : du HTML, du CSS et du JavaScript.

## Structure

```
carnet/
├── index.html             la page de l'appli
├── css/style.css          le design (thème clair et sombre)
├── js/app.js              toute la logique
├── manifest.webmanifest   nom, icônes, couleurs (pour l'installation)
├── sw.js                  service worker (fonctionnement hors-ligne)
├── fonts/                 polices intégrées (licence libre SIL OFL)
├── icons/                 icônes de l'appli
└── tests/                 tests automatiques
```

## Vérifier que rien n'est cassé

Avec Node installé, sans rien d'autre à installer :

```bash
node --test tests/carnet.test.js
```

À lancer avant chaque mise en ligne. Ces tests couvrent les calculs, la saisie, l'import, la fusion de la synchro et les fichiers piégés, mais pas l'affichage dans un vrai navigateur.

## Lancer l'appli sur ton PC

**Le plus simple** : double-clique sur `index.html`. Tout marche, sauf l'installation et le hors-ligne.

**Comme en vrai** : ouvre un terminal dans le dossier (dans Antigravity : *Terminal > New Terminal*) et lance :

```bash
python -m http.server 8000
```

puis ouvre http://localhost:8000 dans ton navigateur. (Avec Node installé, `npx serve .` marche aussi.)

## Mettre le projet sur GitHub

Le projet est déjà un dépôt git avec un premier commit.

1. Sur https://github.com/new, crée un dépôt nommé `carnet`. Laisse-le **vide** : ne coche ni README, ni .gitignore, ni licence.
2. Dans le terminal, dans le dossier `carnet` (remplace `TON-PSEUDO`) :

```bash
git remote add origin https://github.com/TON-PSEUDO/carnet.git
git branch -M main
git push -u origin main
```

Antigravity peut aussi le faire pour toi depuis l'onglet *Source Control*.

## Publier l'appli pour l'utiliser sur ton téléphone (gratuit)

1. Sur GitHub, dans ton dépôt : **Settings > Pages**.
2. *Source* : **Deploy from a branch**, branche **main**, dossier **/ (root)**, puis **Save**.
3. Au bout d'une minute ou deux, l'appli est en ligne sur `https://TON-PSEUDO.github.io/carnet/`.
4. Sur ton téléphone, ouvre ce lien :
   - **Android (Chrome)** : menu ⋮ > *Ajouter à l'écran d'accueil*.
   - **iPhone (Safari)** : bouton Partager > *Sur l'écran d'accueil*.

> Le dépôt peut rester **privé** si ton compte GitHub le permet pour Pages ; sinon il doit être public. Ce n'est pas grave : **tes données ne sont jamais sur GitHub**, seulement le code.

## Où sont mes données ?

Dans le navigateur de l'appareil (`localStorage`). Sans la synchro, elles ne partent nulle part. Conséquences :

- Sans la synchro, le PC et le téléphone ont chacun leurs propres données.
- Si tu vides les données du navigateur, tu les perds. **Exporte une sauvegarde de temps en temps** (onglet *Réglages > Sauvegarde*), et importe-la pour les retrouver sur un autre appareil.

## Synchroniser ton PC et ton téléphone

Tes appareils s'échangent un fichier chiffré via un dépôt GitHub privé. Ce dépôt est différent de celui du code.

**1. Crée le dépôt** sur https://github.com/new : nomme-le par exemple `carnet-donnees` et choisis **Private**.

**2. Crée un jeton d'accès** sur https://github.com/settings/personal-access-tokens/new :

- *Expiration* : choisis une durée (un an au maximum). Quand il expire, Carnet te le signale : crées-en un autre et utilise *Réglages > Changer le jeton*.
- *Repository access* : **Only select repositories**, puis ton dépôt `carnet-donnees`.
- *Permissions* : **Contents**, en **Read and write**.
- Copie le jeton affiché. GitHub ne le montre qu'une fois. Ne le mets jamais dans ton code ni dans un message.

**3. Dans Carnet, sur chaque appareil** :

1. Active le verrouillage dans *Réglages*. La synchro l'exige, car c'est lui qui protège ton jeton sur l'appareil.
2. Touche *Configurer la synchro*, puis saisis le dépôt, le jeton et ta **phrase de synchro** (12 caractères au minimum, la même partout).

**À savoir**

- **La phrase de synchro ne peut pas être récupérée.** Si tu la perds, tu gardes tes données sur tes appareils, mais il faudra repartir d'un dépôt vide.
- **Si le même élément est modifié sur deux appareils**, la modification la plus récente gagne, selon l'horloge des appareils. Les éléments différents sont simplement réunis.
- **La première synchro réunit** les données des deux appareils. Si tu as saisi deux fois les mêmes dépenses, elles apparaîtront en double.
- **Importer une sauvegarde (remplacer) touche tous tes appareils** : ce qui n'est pas dans le fichier y est aussi supprimé.
- **Les échanges ont lieu** à l'ouverture, au retour dans l'appli, quelques secondes après une modification, et toutes les 2 minutes quand l'appli est ouverte. Rien ne se passe si elle est fermée ou verrouillée.
- **L'historique du dépôt** garde les anciennes versions chiffrées.
- **Changer la phrase de synchro** (*Réglages*) : tes autres appareils devront être reconfigurés. Si l'ancienne a été découverte, repars plutôt d'un nouveau dépôt, car l'historique reste lisible avec elle.
- **Pour arrêter complètement** : désactive la synchro dans Carnet, supprime le jeton sur GitHub, puis supprime le dépôt.

## Sécurité

**Ce qui est en place**

- **Chiffrement** (si tu actives le verrouillage dans *Réglages*) : AES-256-GCM, clé dérivée du mot de passe avec PBKDF2-SHA256 (600 000 itérations). Ni le mot de passe ni la clé ne sont enregistrés.
- **Verrouillage automatique** après 5 minutes sans activité, ou 1 minute après avoir quitté l'appli. Les données sont alors retirées de la page.
- **Politique CSP stricte** : aucun script en ligne, aucune ressource externe. La seule connexion autorisée est l'API GitHub, utilisée uniquement si tu actives la synchro.
- **Aucun tiers** : pas de pisteur, polices intégrées à l'appli, pas de serveur à nous. Sans synchro, rien ne quitte l'appareil.
- **Synchro chiffrée de bout en bout** : GitHub ne reçoit qu'un fichier illisible, avec une clé dérivée de ta phrase de synchro. Le jeton est conservé uniquement dans la partie chiffrée de l'appareil, et jamais dans les exports. Carnet refuse un dépôt public et n'écrase jamais un fichier distant qu'il ne sait pas déchiffrer.
- **Fichiers et stockage considérés comme non fiables** : tout est validé au chargement. Un fichier piégé ne peut ni injecter de code ni bloquer l'appli.
- **Relevés bancaires** traités comme des données non fiables : ils restent dans ton navigateur et rien n'est envoyé.
- **Export CSV** protégé contre l'injection de formules dans Excel.
- **Protection contre l'affichage dans le cadre d'un autre site**.

**Ce que ça ne protège pas**

Aucune appli ne peut promettre zéro faille, et voici les limites de celle-ci :

- **Sans verrouillage**, les données sont en clair dans le navigateur.
- **Une fois le carnet déverrouillé**, un virus sur l'appareil ou une extension de navigateur malveillante peut lire ce qui est affiché.
- **Un mot de passe faible se devine** : quelqu'un qui copie tes données peut tester des mots de passe sans limite sur sa machine. Prends une longue phrase.
- **Mot de passe oublié = données perdues**. C'est le prix du chiffrement : garde une sauvegarde.
- **Les données peuvent être effacées** par quelqu'un qui a accès au navigateur, même verrouillé. Le chiffrement les rend illisibles, pas indestructibles.
- **Sur `github.io`**, tous tes projets partagent la même origine : une autre de tes pages pourrait accéder au stockage de Carnet. Avec le verrouillage, elle ne verrait que des données chiffrées, mais ne publie pas sur ce compte de code auquel tu ne fais pas confiance.
- **Avec la synchro**, GitHub voit la taille du fichier et l'heure des échanges, mais pas le contenu. Une phrase de synchro faible se devine si quelqu'un récupère le fichier. Quelqu'un qui a ton jeton peut aussi effacer ou remplacer ce fichier, sans pouvoir le lire : tes appareils refuseront un faux fichier, et l'historique garde les versions précédentes.
- **La CSP autorise l'API GitHub** : un code malveillant déjà présent dans la page pourrait s'en servir pour envoyer des données. Elle bloque toute autre destination.
- **GitHub Pages ne permet pas d'envoyer d'en-têtes de sécurité** personnalisés. La CSP passe donc par une balise `<meta>`.

**Si tu publies le code** : les fichiers de sauvegarde sont exclus par `.gitignore`, ne les ajoute jamais au dépôt. Active aussi la double authentification sur ton compte GitHub : qui contrôle ton compte contrôle le code de l'appli, et pourrait y glisser de quoi lire tes données une fois déverrouillées.

## Publier une nouvelle version

Après une modification, augmente le numéro dans `sw.js` (`carnet-v5` → `carnet-v6`), puis commit et push. Le téléphone récupère la nouvelle version à la prochaine ouverture.

## Idées pour la suite

À demander à l'assistant d'Antigravity, par exemple :

- « Ajoute des budgets par semaine. »
