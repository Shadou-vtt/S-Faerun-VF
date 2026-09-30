# S-Faerûn VF

Module maison de Shadou pour la campagne **L'épopée de Faerûn** (Foundry VTT v13/v14, système dnd5e).

## Ce qu'il fait
1. **États et règles en français** : les liens automatiques vers les états (À terre, Étourdi, Épuisement…) et les règles pointent vers le SRD 2024 français (`dnd5e.content24`) au lieu des pages anglaises du Manuel des joueurs.
2. **Vitrines VF** : des contenus du monde sont recopiés automatiquement (au démarrage et à chaque modification) dans des compendiums du monde, rangés dans le dossier « Module S-Faerûn VF » :
   - « Options de personnage (VF) » : classes, sous-classes, espèces, historiques, dons ;
   - « Sorts (VF) » : sorts du dossier « Sorts 2024 » ;
   - « Équipement (VF) » : armes, armures, équipement, consommables, outils, trésors, contenants ;
   - « Invocations (VF) » : créatures du monde utilisées par les activités d'invocation (un joueur qui invoque reçoit sa propre copie, comme avec un compendium officiel).
   Les objets et acteurs du monde restent la seule version de référence ; les vitrines peuvent être supprimées, elles sont reconstruites.
3. **Autres sources masquées** : dans le navigateur de compendiums (« Ajouter une classe / un sort / un objet… »), seuls les compendiums d'objets VF sont proposés. Les compendiums officiels restent accessibles dans l'onglet Compendiums.

Chaque fonction peut être désactivée dans les réglages du module.

## Installation
Manifest : `https://raw.githubusercontent.com/Shadou-vtt/S-Faerun-VF/main/module.json`

## Historique
- 1.1.0 : vitrines Sorts, Équipement et Invocations ; masquage de tous les autres compendiums d'objets ; effets d'un module inactif ramenés au type de base dans les copies.
- 1.0.0 : première version (références SRD FR, vitrine des options de personnage).
