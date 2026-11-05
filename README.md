# Carnet — Mon argent

Petite appli perso pour gérer son argent au quotidien : on note ses dépenses et ses rentrées, et Carnet calcule **ce qu'il reste pour vivre jusqu'à la fin du mois, et combien ça fait par jour**.

- **Fixes mensuels** : salaire, aides, loyer, forfait, box… notés une fois, comptés chaque mois.
- **Dépenses** ajoutées en deux secondes (montant, catégorie, libellé, date).
- **Jauge de rythme** : compare ce qui est dépensé à la part du mois déjà passée.
- **Plafonds par catégorie** qui passent en orange puis en rouge.
- **Sauvegarde** : export et import d'un fichier JSON.
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
- Si tu vides les données du navigateur, tu les perds. **Exporte une sauvegarde de temps en temps** (onglet *Budgets > Sauvegarde*), et importe-la pour les retrouver sur un autre appareil.

## Publier une nouvelle version

Après une modification, change le numéro dans `sw.js` (`carnet-v1` → `carnet-v2`), puis commit et push. Le téléphone récupère la nouvelle version à la prochaine ouverture.

## Idées pour la suite

À demander à l'assistant d'Antigravity, par exemple :

- « Ajoute l'import d'un relevé CSV de ma banque, avec catégorisation automatique par mots-clés. »
- « Ajoute un graphique de l'évolution de ce qu'il me reste en fin de mois, sur 6 mois. »
- « Ajoute des objectifs d'épargne avec une barre de progression. »
- « Ajoute une recherche dans les opérations. »
