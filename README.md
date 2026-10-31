# Journal des migraines (PWA iPhone)

Application web installable pour déclarer ses crises de migraine, avec météo automatique, rapport et calendrier.
Les données restent **uniquement sur le téléphone**. Aucun serveur ni compte n'est nécessaire.

## Mise en ligne sur GitHub Pages
1. Crée un dépôt sur GitHub (ex. `migraines`). Il peut être public ou privé, mais GitHub Pages sur un dépôt privé nécessite un compte payant.
2. Dépose tous les fichiers à la racine : `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.json` et le dossier `icons/`.
3. Va dans **Settings › Pages › Build and deployment** et choisis **Deploy from a branch**, puis `main` et `/ (root)`.
4. Au bout d'1 à 2 minutes, l'app est disponible sur `https://<ton-compte>.github.io/migraines/`.

## Installation sur l'iPhone
1. Ouvre l'URL dans **Safari**.
2. Touche **Partager › Sur l'écran d'accueil**.
3. Lance l'app depuis l'icône et autorise la **localisation** pour la météo.

## Bon à savoir
- Météo : Open-Meteo (gratuit, sans clé), à l'heure de début de la crise. Inclut la variation de pression sur 24 h. Les crises de plus de 3 mois utilisent l'archive historique.
- Sauvegarde : *Historique › Exporter (JSON)*. Fais-la régulièrement, car supprimer l'app ou les données de Safari efface tout.
- Mise à jour de l'app : modifie les fichiers puis change `CACHE = 'migraines-v1'` en `v2` dans `sw.js`.
