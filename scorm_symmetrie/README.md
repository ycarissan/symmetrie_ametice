# Symétrie des Orbitales Atomiques - Module 3 : Atome Isolé

## 📦 Package SCORM pour Moodle

Ce package permet de visualiser les orbitales atomiques **s** et **p** (p_x, p_y, p_z) et d'observer leur comportement sous différentes opérations de symétrie.

### ✨ Fonctionnalités

- **Visualisation 3D interactive** des orbitales s et p
- **Deux représentations**, au choix par un bouton :
  - *Sphères* : diagramme polaire de |Y| (une orbitale p = deux sphères tangentes au noyau, de phases opposées)
  - *Analytique* : diagramme polaire de |Y|² (densité angulaire), couleur selon le signe de Y
- **Application des opérations de symétrie** :
  - Identité (E)
  - Plans miroir (σ_xz, σ_yz, σ_xy)
  - Axes de rotation (C₂ autour de x, y, z ; C₃ et C₄ autour de z)
  - Inversion (i)
- **Affichage des résultats** avec explications pédagogiques
- **Intégration SCORM 1.2** pour le suivi dans Moodle

### 📂 Structure du package

```
scorm_symmetrie/
├── index.html          # Page principale
├── style.css          # Styles CSS
├── script.js          # Logique Three.js et symétries
├── scorm_helper.js    # Intégration SCORM 1.2
├── three.min.js       # Librairie Three.js
├── OrbitControls.js   # Contrôles de caméra
└── imsmanifest.xml    # Manifest SCORM
```

### 🚀 Installation dans Moodle

1. **Télécharger** le fichier `scorm_symmetrie_module3.zip`
   (pour le régénérer : `cd scorm_symmetrie && zip -r ../scorm_symmetrie_module3.zip .` —
   `imsmanifest.xml` doit être à la racine de l'archive)
2. Dans Moodle :
   - Créer une nouvelle activité **"Package SCORM"**
   - Importer le fichier `.zip`
   - Configurer selon vos besoins (affichage, dimensions, etc.)

### 🎯 Utilisation

1. **Sélectionner une orbitale** (s, p_x, p_y, ou p_z)
2. **Choisir une opération de symétrie** dans la liste (l'élément de symétrie s'affiche aussitôt)
3. **Cliquer sur "Appliquer la symétrie"** : l'opération est animée
4. Observer le résultat et lire l'explication

**Contrôles 3D** :
- **Souris** : Tourner la vue (cliquer + glisser)
- **Molette** : Zoomer/dézoomer
- **Bouton 🔄** : Réinitialiser la caméra
- **Curseur d'animation** : suit l'animation lancée par « Appliquer » ; le déplacer met en pause et permet de parcourir l'opération

### 🔬 Exemples de transformations

| Orbitale | Symétrie | Résultat | Explication |
|----------|----------|----------|-------------|
| p_x | σ_yz | -p_x | Antisymétrique (change de signe) |
| p_x | C₂(z) | -p_x | Antisymétrique |
| p_z | σ_xy | -p_z | Antisymétrique |
| s | Toutes | s | Symétrique |
| p_x | C₄(z) | p_y | Rotation des lobes de 90° |
| p_x | C₃(z) | −½ p_x + √3/2 p_y | Combinaison linéaire |

### 📊 Intégration SCORM

- **Statut** : Mise à jour automatiquement (incomplet → complété)
- **Score** : 100% par défaut (à adapter selon vos besoins)
- **Temps** : Temps de session enregistré
- **Compatibilité** : SCORM 1.2 (compatible Moodle, Blackboard, etc.)

### 🛠️ Personnalisation

#### Ajouter une nouvelle orbitale
Modifiez `script.js` :
```javascript
// Dans stateFromName() et buildOrbital()
// (une orbitale p est représentée par la direction de son lobe positif)
```

#### Ajouter une nouvelle symétrie
Modifiez `script.js` :
```javascript
// Dans la table OPERATIONS (et une <option> dans index.html)
C4_x: { kind: 'rotation', axis: AXES.x, angle: Math.PI / 2, label: 'C₄(x)' },
```

#### Changer les couleurs
Modifiez `COLORS` dans `script.js` :
```javascript
const COLORS = {
    positive: 0xFF0000,  // Rouge
    negative: 0x0000FF,  // Bleu
    // ...
};
```

### 📝 Notes pédagogiques

- **Orbitale s** : Toujours symétrique (ne change pas sous aucune opération)
- **Orbitale p** : 
  - Symétrique par rapport aux plans qui la contiennent
  - Antisymétrique par rapport aux plans/axes perpendiculaires
- **Convention** : Rouge = phase positive, Bleu = phase négative

### 🎨 Couleurs utilisées

- **Rouge (E63946)** : Phase positive
- **Bleu (4A6FA5)** : Phase négative
- **Gris (6C757D)** : Éléments de symétrie
- **Fond (F8F9FA)** : Couleur de fond claire

### 🐛 Résolution des problèmes

**Le package ne s'affiche pas dans Moodle** :
- Vérifiez que le fichier `.zip` n'est pas corrompu
- Assurez-vous que Moodle est configuré pour accepter les packages SCORM
- Vérifiez les permissions sur le serveur

**Les orbitales ne s'affichent pas** :
- Vérifiez que WebGL est activé dans le navigateur
- Essayez avec Chrome ou Firefox (meilleur support WebGL)

**Problèmes de symétrie** :
- Vérifiez la table `OPERATIONS` et `transformPoint()` dans `script.js`

### 📄 Licence

Ce package est fourni sous licence **MIT**.

### 📞 Support

Pour toute question ou suggestion, contactez l'équipe de développement.
