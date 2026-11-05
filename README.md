# Carnet — Mon argent

Petite appli perso pour gérer son argent au quotidien : on note ses dépenses et ses rentrées, et Carnet calcule **ce qu'il reste pour vivre jusqu'à la fin du mois, et combien ça fait par jour**.

- **Fixes mensuels** : salaire, aides, loyer, forfait, box… notés une fois, comptés chaque mois.
- **Dépenses** ajoutées en deux secondes (montant, catégorie, libellé, date).
- **Jauge de rythme** : compare ce qui est dépensé à la part du mois déjà passée.
- **Plafonds par catégorie** qui passent en orange puis en rouge.
- **Objectifs d'épargne** avec barre de progression.
- **Évolution sur 6 mois** de ce qu'il reste en fin de mois.
- **Recherche** dans les opérations de tous les mois.
- **Verrouillage par mot de passe** : les données sont chiffrées sur l'appareil.
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
└── icons/                 icônes de l'appli
```

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

Dans le navigateur de l'appareil (`localStorage`). Elles ne partent nulle part. Conséquences :

- Le PC et le téléphone ont chacun leurs propres données.
- Si tu vides les données du navigateur, tu les perds. **Exporte une sauvegarde de temps en temps** (onglet *Réglages > Sauvegarde*), et importe-la pour les retrouver sur un autre appareil.

## Sécurité

**Ce qui est en place**

- **Chiffrement** (si tu actives le verrouillage dans *Réglages*) : AES-256-GCM, clé dérivée du mot de passe avec PBKDF2-SHA256 (600 000 itérations). Ni le mot de passe ni la clé ne sont enregistrés.
- **Verrouillage automatique** après 5 minutes sans activité, ou 1 minute après avoir quitté l'appli. Les données sont alors retirées de la page.
- **Politique CSP stricte** : aucun script en ligne, aucune ressource externe, aucune requête réseau depuis la page.
- **Aucun tiers** : pas de pisteur, pas de police Google, pas de serveur.
- **Fichiers et stockage considérés comme non fiables** : tout est validé au chargement. Un fichier piégé ne peut ni injecter de code ni bloquer l'appli.
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
- **GitHub Pages ne permet pas d'envoyer d'en-têtes de sécurité** personnalisés. La CSP passe donc par une balise `<meta>`.

**Si tu publies le code** : les fichiers de sauvegarde sont exclus par `.gitignore`, ne les ajoute jamais au dépôt. Active aussi la double authentification sur ton compte GitHub : qui contrôle ton compte contrôle le code de l'appli, et pourrait y glisser de quoi lire tes données une fois déverrouillées.

## Publier une nouvelle version

Après une modification, augmente le numéro dans `sw.js` (`carnet-v2` → `carnet-v3`), puis commit et push. Le téléphone récupère la nouvelle version à la prochaine ouverture.

## Idées pour la suite

À demander à l'assistant d'Antigravity, par exemple :

- « Ajoute l'import d'un relevé CSV de ma banque, avec catégorisation automatique par mots-clés. »
- « Quand je supprime ou modifie un fixe, garde l'ancien montant pour les mois passés. »
