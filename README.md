# Paddock 26

Simulateur de course automobile en 3D inspiré de la réglementation 2026, jouable dans le navigateur et sur Android.
Écuries, pilotes et noms sont fictifs ; chaque joueur peut les renommer et changer les livrées.

## Fonctionnalités
- **Moteur de simulation physique** (`src/sim.js`, indépendant du rendu et testable sous Node) : adhérence, aéro active, usure des pneus, consommation, pluie et piste qui sèche, stratégies des IA calculées.
- **Rendu 3D** avec three.js : 24 circuits, textures procédurales, pluie et gerbes d'eau, réalisateur automatique qui choisit la meilleure action en piste.
- **Modes** : course rapide, championnat du monde, carrière sur plusieurs saisons (création de pilote ou d'écurie, évolutions techniques), marathon des 24 circuits, multijoueur en salon.
- **Simulateur de stratégie** avant la course, avec le même modèle d'usure et d'essence que la course.
- **Replays** sauvegardés (format `.p26r` : JSON compressé en gzip) et **export vidéo vertical 9:16** (encodage MP4 dans le navigateur) avec habillage, cartons et sons synthétisés, pensé pour les réseaux sociaux.
- **Son moteur V6 synthétisé** avec Web Audio, pilotage tactile, interface en français et en anglais.

## Structure
```
src/      code de l'appli (app.js : rendu + interface, sim.js : moteur, i18n.js, données circuits/écuries)
tools/    scripts Node de calibrage et de tests statistiques du moteur (courses simulées en masse)
build.py  assemble tout en un seul fichier HTML autonome → dist/paddock26.html
android/  coquille WebView et script de build APK sans Gradle
```

## Lancer
```bash
python3 build.py          # génère dist/paddock26.html
open dist/paddock26.html  # aucune dépendance, fonctionne hors ligne
```
APK Android : `android/build_apk.sh` (nécessite le SDK Android ; mot de passe du keystore via `PADDOCK26_KS_PASS`).

## Stack
JavaScript (vanilla), three.js, Web Audio, WebCodecs, Python pour le build, Node pour les outils de calibrage.

---
Développé avec l'assistance de Claude Code (Anthropic) ; conception du jeu, du modèle de simulation et choix techniques par Mathéo Gérard.
