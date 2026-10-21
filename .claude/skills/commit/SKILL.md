---
name: commit
description: Crée des commits propres, un par fonctionnalité, à partir des modifications en cours d'Enseigne3D. À utiliser quand l'utilisateur demande de commiter, de « faire les commits » ou tape /commit.
---

# Commits propres, un par fonctionnalité

Objectif : chaque commit raconte **une seule** évolution (une fonctionnalité, un correctif, un réglage), compile et passe les tests seul, et a un message clair en français.

## 1. Faire l'état des lieux

```sh
git status --short
git diff            # modifications non indexées
git diff --cached   # déjà indexé : respecter ce que l'utilisateur a préparé
git log --oneline -10
```

Ne jamais commiter `node_modules/`, des fichiers de test temporaires, des secrets ni des exports (`*.stl`, `*.3mf`, `*.zip`). Si un fichier inattendu apparaît, demander avant de l'inclure.

## 2. Regrouper par fonctionnalité

Lire le diff et lister les groupes avant d'indexer quoi que ce soit, par exemple :

- « Nom par défaut Enseigne3D » → `js/config.js`, `index.html`
- « Sauvegarde des réglages » → `js/ui/storage.js`, `js/main.js` (partie restauration), `js/ui/params.js`
- « Sélecteur de thème » → `index.html` (en-tête), `css/style.css`, `js/main.js` (partie thème)

Règles :
- Un fichier peut appartenir à plusieurs groupes : on indexe alors **des morceaux** du fichier, pas le fichier entier.
- Un test va dans le même commit que le code qu'il vérifie.
- La doc (README) va avec la fonctionnalité qu'elle décrit.
- Un refactoring sans changement de comportement = son propre commit, avant la fonctionnalité qui en dépend.
- Ordonner les commits pour que chacun fonctionne seul (un module avant le code qui l'importe).

Présenter le plan (groupes + fichiers + messages) à l'utilisateur en une courte liste, puis enchaîner sauf objection.

## 3. Indexer groupe par groupe

Fichier entier :
```sh
git add js/ui/storage.js
```

Seulement une partie d'un fichier (`git add -p` est interactif, donc indisponible) : écrire le patch partiel puis l'appliquer à l'index.
```sh
git diff js/main.js > /tmp/claude-scratch/main.patch   # dossier scratchpad de la session
# éditer le patch pour ne garder que les hunks du groupe (les en-têtes @@ doivent rester cohérents)
git apply --cached --recount /tmp/claude-scratch/main.patch
git diff --cached js/main.js                            # vérifier ce qui est indexé
```

Si deux fonctionnalités sont mêlées dans un même hunk et impossibles à séparer proprement, les commiter ensemble et le dire dans le message.

## 4. Vérifier avant chaque commit

- `git diff --cached --stat` : seuls les fichiers du groupe.
- `node --check` sur les fichiers JS modifiés.
- Tests : `npm test` (lancer `npm install` si `node_modules/` manque). Les tests portent sur l'arbre de travail : pour un commit partiel, les lancer au moins sur l'état final, et sur l'état intermédiaire avec `git stash --keep-index` si le découpage est risqué.
- Si les tests échouent, ne pas commiter : signaler la sortie à l'utilisateur.

## 5. Écrire le message

Style du dépôt : français, phrase courte à l'infinitif ou nominale, sans préfixe type `feat:`, majuscule initiale, pas de point final, ≤ 72 caractères.

```
Sauvegarder les réglages dans le navigateur

Texte, couleurs, police (y compris un fichier chargé) et paramètres
sont restaurés à la prochaine ouverture. Bouton « Réinitialiser » pour
revenir aux valeurs par défaut.
```

- Le corps (facultatif) explique le **pourquoi** et ce qui change pour l'utilisateur, pas la liste des lignes modifiées.
- Ajouter les lignes d'attribution demandées par l'environnement, le cas échéant.
- Passer le message par un heredoc : `git commit -F - <<'EOF' ... EOF`.

## 6. Terminer

```sh
git log --oneline -n <nombre de commits créés>
git status --short   # doit être vide, ou ne contenir que ce qui a été volontairement laissé
```

Résumer à l'utilisateur la liste des commits créés. Ne pas pousser (`git push`) sans demande explicite. Ne jamais utiliser `--amend`, `rebase` ou `reset --hard` sur des commits déjà poussés.
