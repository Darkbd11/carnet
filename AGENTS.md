# Notes pour les assistants de code

Carnet est une appli web statique (PWA), sans framework ni étape de build. Garde-la ainsi sauf demande contraire.

- Langue : toute l'interface et les messages sont en français, ton tutoiement.
- `js/app.js` : un seul script classique (pas de modules ES), pour que `index.html` marche aussi en double-cliquant dessus.
- État : objet `S` (`S.tx` = opérations, `S.profile.recurring` = fixes mensuels, `S.profile.budgets` = plafonds par catégorie, `S.profile.goals` = objectifs d'épargne `{id, label, target, saved}`). Toujours écrire via `api.*` puis `render()`.
- Stockage : `localStorage`, clé `carnet-argent-v1` (JSON en clair, ou boîte chiffrée `{enc:"carnet",…}` si le verrouillage est activé). N'écris jamais directement : passe par `saveLocal()`. Si le format change, migre les anciennes données dans `loadLocal()` au lieu de les perdre.
- Une opération : `{id, type: "in"|"out", cat, amount, label, date: "YYYY-MM-DD", ts}`. Un fixe : `{id, type, cat, amount, label, since: "YYYY-MM"}`.
- Catégories : objet `CATS` en haut de `app.js`.
- Sécurité : pas de ressource externe, ni de script ou d'attribut `style` en ligne (CSP dans `index.html`). Les valeurs calculées passent par `data-bg`, `data-w`, etc. et `applyStyles()`. Tout texte inséré dans le HTML passe par `esc()`, toute donnée lue d'un fichier ou du stockage passe par `cleanData()`. Un nouveau champ doit y être ajouté, sinon il disparaît au chargement.
- Couleurs : uniquement via les variables CSS de `:root` dans `css/style.css`, avec leurs équivalents en thème sombre.
- Après toute modification publiée, incrémente `CACHE` dans `sw.js`.
- Montants : formatés avec `Intl.NumberFormat("fr-FR", {currency: "EUR"})`.
