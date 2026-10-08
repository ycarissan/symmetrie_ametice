/**
 * Symétrie des Orbitales Atomiques - Module 3 : Atome Isolé
 * Prototype SCORM pour Moodle - Version finale corrigée
 */

// ============================================
// VARIABLES GLOBALES
// ============================================

let scene, camera, renderer, controls;
let orbitalGroup, symmetryElementGroup, animatedOrbitalGroup;

let currentOrbital = 's';
let currentSymmetry = 'E';

// Animation
let animationData = null;
let animationSlider;

// Paramètres de rendu
const LOBE_RADIUS = 0.8;
const LOBE_DISTANCE = 2.0;
const ORBITAL_SCALE = 1.0;

// Couleurs
const COLORS = {
    positive: 0xE63946,
    negative: 0x4A6FA5,
    neutral: 0x6C757D,
    background: 0xF8F9FA,
    grid: 0xE9ECEF
};

// ============================================
// INITIALISATION
// ============================================

function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.background);
    
    camera = new THREE.PerspectiveCamera(75, 
        document.getElementById('three-canvas').clientWidth / 
        document.getElementById('three-canvas').clientHeight, 
        0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('three-canvas'),
        antialias: true
    });
    renderer.setSize(
        document.getElementById('three-canvas').clientWidth,
        document.getElementById('three-canvas').clientHeight
    );
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Lumière
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 5, 5);
    scene.add(directionalLight1);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-5, -5, -5);
    scene.add(directionalLight2);
    
    // Grille et axes
    const gridHelper = new THREE.GridHelper(10, 10, COLORS.grid, COLORS.grid);
    scene.add(gridHelper);
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
    
    // Groupes
    orbitalGroup = new THREE.Group();
    scene.add(orbitalGroup);
    
    animatedOrbitalGroup = new THREE.Group();
    scene.add(animatedOrbitalGroup);
    animatedOrbitalGroup.visible = false;
    
    symmetryElementGroup = new THREE.Group();
    scene.add(symmetryElementGroup);
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 20;
    
    window.addEventListener('resize', onWindowResize);
    animate();
}

function onWindowResize() {
    const canvas = document.getElementById('three-canvas');
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    if (animationData) {
        updateAnimation();
    }
    
    controls.update();
    renderer.render(scene, camera);
}

// ============================================
// ANIMATION - CORRIGÉE
// ============================================

function updateAnimation() {
    const slider = animationSlider;
    let progress = parseInt(slider.value) / 100;
    
    const group = animationData.group;
    const originalPositions = animationData.originalPositions;
    const targetPositions = animationData.targetPositions;
    const originalColors = animationData.originalColors;
    const targetColors = animationData.targetColors;
    
    for (let i = 0; i < group.children.length; i++) {
        const child = group.children[i];
        if (child.type === 'Mesh' && originalPositions[i]) {
            child.position.x = originalPositions[i].x + (targetPositions[i].x - originalPositions[i].x) * progress;
            child.position.y = originalPositions[i].y + (targetPositions[i].y - originalPositions[i].y) * progress;
            child.position.z = originalPositions[i].z + (targetPositions[i].z - originalPositions[i].z) * progress;
            
            if (originalColors[i] && targetColors[i]) {
                const startColor = new THREE.Color(originalColors[i]);
                const endColor = new THREE.Color(targetColors[i]);
                const currentColor = startColor.clone().lerp(endColor, progress);
                child.material.color.copy(currentColor);
            }
        }
    }
}

function startAnimation(symmetry) {
    clearSymmetryGroup();
    visualizeSymmetryElement(symmetry);
    
    const initialOrbital = currentOrbital;
    let newOrbital = currentOrbital;
    let signChange = false;
    let explanation = '';
    
    // Calculer le résultat
    switch (currentOrbital) {
        case 's':
            newOrbital = 's';
            explanation = 'L\'orbitale <strong>s</strong> est <strong>totalement symétrique</strong> : elle reste inchangée.';
            break;
        case 'p_x':
            newOrbital = transformPOrbital('p_x', symmetry);
            signChange = newOrbital.startsWith('-');
            explanation = getPOrbitalExplanation('p_x', symmetry, signChange);
            break;
        case 'p_y':
            newOrbital = transformPOrbital('p_y', symmetry);
            signChange = newOrbital.startsWith('-');
            explanation = getPOrbitalExplanation('p_y', symmetry, signChange);
            break;
        case 'p_z':
            newOrbital = transformPOrbital('p_z', symmetry);
            signChange = newOrbital.startsWith('-');
            explanation = getPOrbitalExplanation('p_z', symmetry, signChange);
            break;
    }
    
    // RENDRE L'ORBITALE PRINCIPALE SEMI-TRANSPARENTE (au lieu de la masquer)
    setGroupOpacity(orbitalGroup, 0.3);
    
    // Cloner l'orbitale actuelle pour l'animation
    clearGroup(animatedOrbitalGroup);
    const animationGroup = cloneGroup(orbitalGroup);
    
    // Rendre l'animation opaque
    setGroupOpacity(animationGroup, 1.0);
    
    animatedOrbitalGroup.add(animationGroup);
    animatedOrbitalGroup.visible = true;
    
    // Préparer les données d'animation
    const originalPositions = [];
    const targetPositions = [];
    const originalColors = [];
    const targetColors = [];
    
    // Récupérer les positions des lobes DE L'ORBITALE ANIMÉE
    animationGroup.children.forEach(child => {
        if (child.type === 'Mesh' && child.geometry && child.geometry.type === 'SphereGeometry') {
            originalPositions.push(child.position.clone());
            targetPositions.push(transformPoint(child.position, symmetry));
            originalColors.push(child.material.color.getHex());
            
            if (signChange) {
                const currentColor = child.material.color.getHex();
                targetColors.push(currentColor === COLORS.positive ? COLORS.negative : COLORS.positive);
            } else {
                targetColors.push(child.material.color.getHex());
            }
        } else {
            originalPositions.push(null);
            targetPositions.push(null);
            originalColors.push(null);
            targetColors.push(null);
        }
    });
    
    animationData = {
        group: animationGroup,
        originalPositions: originalPositions,
        targetPositions: targetPositions,
        originalColors: originalColors,
        targetColors: targetColors,
        newOrbital: newOrbital,
        signChange: signChange,
        initialOrbital: initialOrbital,
        symmetry: symmetry
    };
    
    // Activer et initialiser le slider
    slider.disabled = false;
    slider.value = 0;
    
    showExplanation(initialOrbital, symmetry, newOrbital, explanation);
    updateSCORMStatus();
}

function endAnimation() {
    if (!animationData) return;
    
    animatedOrbitalGroup.visible = false;
    clearGroup(animatedOrbitalGroup);
    
    // Rétablir l'opacité de l'orbitale principale
    setGroupOpacity(orbitalGroup, 1.0);
    
    // Mettre à jour l'orbitale principale avec l'état final
    const newOrbital = animationData.newOrbital;
    const signChange = animationData.signChange;
    
    // Mettre à jour currentOrbital
    currentOrbital = newOrbital;
    document.getElementById('current-orbital').innerHTML = getOrbitalDisplayName(newOrbital);
    document.getElementById('orbital-select').value = newOrbital;
    
    // Appliquer les changements
    if (newOrbital !== animationData.initialOrbital && !newOrbital.startsWith('-')) {
        setOrbital(newOrbital);
    } else if (signChange) {
        invertOrbitalColors();
    }
    
    // Désactiver le slider
    animationSlider.disabled = true;
    animationData = null;
}

function setGroupOpacity(group, opacity) {
    group.traverse(child => {
        if (child.material) {
            if (child.material instanceof Array) {
                child.material.forEach(mat => {
                    mat.transparent = true;
                    mat.opacity = opacity;
                });
            } else {
                child.material.transparent = true;
                child.material.opacity = opacity;
            }
        }
    });
}

// ============================================
// CRÉATION DES ORBITALES
// ============================================

function createSOrbital() {
    clearGroup(orbitalGroup);
    
    const geometry = new THREE.SphereGeometry(LOBE_RADIUS * ORBITAL_SCALE, 32, 32);
    const material = new THREE.MeshPhongMaterial({
        color: COLORS.positive,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide
    });
    
    const sphere = new THREE.Mesh(geometry, material);
    orbitalGroup.add(sphere);
    
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(
        edges, 
        new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1, transparent: true, opacity: 0.5 })
    );
    orbitalGroup.add(line);
}

function createLobe(color) {
    const geometry = new THREE.SphereGeometry(LOBE_RADIUS * ORBITAL_SCALE, 32, 32);
    const material = new THREE.MeshPhongMaterial({
        color: color,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide
    });
    
    const lobe = new THREE.Mesh(geometry, material);
    
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(
        edges, 
        new THREE.LineBasicMaterial({ 
            color: 0x000000, 
            linewidth: 1,
            transparent: true,
            opacity: 0.5
        })
    );
    lobe.add(line);
    
    return lobe;
}

function createPOrbital(axis) {
    clearGroup(orbitalGroup);
    
    let posPositions, negPositions;
    if (axis === 'x') {
        posPositions = { x: LOBE_DISTANCE * ORBITAL_SCALE, y: 0, z: 0 };
        negPositions = { x: -LOBE_DISTANCE * ORBITAL_SCALE, y: 0, z: 0 };
    } else if (axis === 'y') {
        posPositions = { x: 0, y: LOBE_DISTANCE * ORBITAL_SCALE, z: 0 };
        negPositions = { x: 0, y: -LOBE_DISTANCE * ORBITAL_SCALE, z: 0 };
    } else if (axis === 'z') {
        posPositions = { x: 0, y: 0, z: LOBE_DISTANCE * ORBITAL_SCALE };
        negPositions = { x: 0, y: 0, z: -LOBE_DISTANCE * ORBITAL_SCALE };
    }
    
    const lobePositive = createLobe(COLORS.positive);
    lobePositive.position.set(posPositions.x, posPositions.y, posPositions.z);
    
    const lobeNegative = createLobe(COLORS.negative);
    lobeNegative.position.set(negPositions.x, negPositions.y, negPositions.z);
    
    orbitalGroup.add(lobePositive);
    orbitalGroup.add(lobeNegative);
}

function clearGroup(group) {
    while (group.children.length > 0) {
        const child = group.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (child.material instanceof Array) {
                child.material.forEach(m => m.dispose());
            } else {
                child.material.dispose();
            }
        }
        group.remove(child);
    }
}

function clearSymmetryGroup() {
    while (symmetryElementGroup.children.length > 0) {
        const child = symmetryElementGroup.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
        symmetryElementGroup.remove(child);
    }
}

// ============================================
// TRANSFORMATIONS
// ============================================

function transformPoint(point, symmetry) {
    const x = point.x, y = point.y, z = point.z;
    
    switch (symmetry) {
        case 'E': return new THREE.Vector3(x, y, z);
        case 'sigma_xz': return new THREE.Vector3(x, -y, z);
        case 'sigma_yz': return new THREE.Vector3(-x, y, z);
        case 'sigma_xy': return new THREE.Vector3(x, y, -z);
        case 'C2_x': return new THREE.Vector3(x, -y, -z);
        case 'C2_y': return new THREE.Vector3(-x, y, -z);
        case 'C2_z': return new THREE.Vector3(-x, -y, z);
        case 'C3_z': {
            const c = Math.cos(2 * Math.PI / 3), s = Math.sin(2 * Math.PI / 3);
            return new THREE.Vector3(x * c - y * s, x * s + y * c, z);
        }
        case 'C4_z': return new THREE.Vector3(-y, x, z);
        case 'i': return new THREE.Vector3(-x, -y, -z);
        default: return new THREE.Vector3(x, y, z);
    }
}

function transformPOrbital(orbital, symmetry) {
    const axis = orbital.split('_')[1];
    switch (symmetry) {
        case 'E': return orbital;
        case 'sigma_xz': return (axis === 'y') ? '-' + orbital : orbital;
        case 'sigma_yz': return (axis === 'x') ? '-' + orbital : orbital;
        case 'sigma_xy': return (axis === 'z') ? '-' + orbital : orbital;
        case 'C2_x': return (axis === 'y' || axis === 'z') ? '-' + orbital : orbital;
        case 'C2_y': return (axis === 'x' || axis === 'z') ? '-' + orbital : orbital;
        case 'C2_z': return (axis === 'x' || axis === 'y') ? '-' + orbital : orbital;
        case 'C3_z': return (axis === 'x') ? 'p_y' : (axis === 'y') ? '-p_x' : orbital;
        case 'C4_z': return (axis === 'x') ? 'p_y' : (axis === 'y') ? '-p_x' : orbital;
        case 'i': return '-' + orbital;
        default: return orbital;
    }
}

function getPOrbitalExplanation(orbital, symmetry, signChange) {
    const symmetryName = getSymmetryName(symmetry);
    return signChange 
        ? `L'orbitale <strong>${orbital}</strong> est <strong>antisymétrique</strong> par rapport à ${symmetryName} : elle change de signe.`
        : `L'orbitale <strong>${orbital}</strong> est <strong>symétrique</strong> par rapport à ${symmetryName} : elle reste inchangée.`;
}

function getSymmetryName(symmetry) {
    const names = {
        'E': 'l\'identité', 'sigma_xz': 'le plan miroir σ<sub>xz</sub>',
        'sigma_yz': 'le plan miroir σ<sub>yz</sub>', 'sigma_xy': 'le plan miroir σ<sub>xy</sub>',
        'C2_x': 'la rotation C<sub>2</sub> autour de x', 'C2_y': 'la rotation C<sub>2</sub> autour de y',
        'C2_z': 'la rotation C<sub>2</sub> autour de z', 'C3_z': 'la rotation C<sub>3</sub> autour de z',
        'C4_z': 'la rotation C<sub>4</sub> autour de z', 'i': 'l\'inversion'
    };
    return names[symmetry] || symmetry;
}

function invertOrbitalColors() {
    orbitalGroup.children.forEach(child => {
        if (child.type === 'Mesh' && child.geometry?.type === 'SphereGeometry') {
            const color = child.material.color.getHex();
            child.material.color.setHex(color === COLORS.positive ? COLORS.negative : COLORS.positive);
        }
    });
}

// ============================================
// VISUALISATION DES ÉLÉMENTS DE SYMÉTRIE
// ============================================

function visualizeSymmetryElement(symmetry) {
    clearSymmetryGroup();
    const color = COLORS.neutral, opacity = 0.3;
    
    switch (symmetry) {
        case 'E': break;
        case 'sigma_xz': addPlane(0, Math.PI/2, 'σ<sub>xz</sub>'); break;
        case 'sigma_yz': addPlane(0, 0, 'σ<sub>yz</sub>'); break;
        case 'sigma_xy': addPlane(Math.PI/2, 0, 'σ<sub>xy</sub>'); break;
        case 'C2_x': case 'C3_x': case 'C4_x': addAxis(0, 0, getSymmetryName(symmetry)); break;
        case 'C2_y': case 'C3_y': case 'C4_y': addAxis(Math.PI/2, 0, getSymmetryName(symmetry)); break;
        case 'C2_z': case 'C3_z': case 'C4_z': addAxis(0, 0, getSymmetryName(symmetry)); break;
        case 'i': addInversionCenter(); break;
    }
}

function addPlane(xRot, yRot, label) {
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.MeshBasicMaterial({ color: COLORS.neutral, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    plane.rotation.x = xRot;
    plane.rotation.y = yRot;
    symmetryElementGroup.add(plane);
    addSymmetryLabel(plane, label);
}

function addAxis(xRot, yRot, label) {
    const axis = createRotationAxis(10);
    axis.rotation.x = xRot;
    axis.rotation.y = yRot;
    symmetryElementGroup.add(axis);
    addSymmetryLabel(axis, label);
}

function addInversionCenter() {
    const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    symmetryElementGroup.add(center);
    addSymmetryLabel(center, 'i');
}

function createRotationAxis(length) {
    const axis = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, length, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })
    );
    const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.5, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })
    );
    arrow.position.y = length / 2;
    arrow.rotation.x = Math.PI;
    axis.add(arrow);
    return axis;
}

function addSymmetryLabel(object, text) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'Bold 14px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width/2, canvas.height/2);
    
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
    sprite.scale.set(1, 0.5, 1);
    
    const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
    sprite.position.copy(center);
    
    if (object.geometry?.type === 'PlaneGeometry') {
        sprite.position.y = object.rotation.x === Math.PI/2 ? 1 : -1;
    } else if (object.geometry?.type === 'CylinderGeometry') {
        sprite.position.y = -0.5;
    }
    
    symmetryElementGroup.add(sprite);
}

// ============================================
// INTERFACE
// ============================================

function setOrbital(orbital) {
    currentOrbital = orbital;
    document.getElementById('current-orbital').innerHTML = getOrbitalDisplayName(orbital);
    document.getElementById('orbital-select').value = orbital;
    
    animatedOrbitalGroup.visible = false;
    clearGroup(animatedOrbitalGroup);
    setGroupOpacity(orbitalGroup, 1.0);
    
    if (orbital === 's') createSOrbital();
    else createPOrbital(orbital.split('_')[1]);
    
    showExplanation(orbital, 'E', orbital, 'Sélectionnez une opération de symétrie et cliquez sur "Appliquer".');
}

function getOrbitalDisplayName(orbital) {
    return { 's': 's', 'p_x': 'p<sub>x</sub>', 'p_y': 'p<sub>y</sub>', 'p_z': 'p<sub>z</sub>' }[orbital] || orbital;
}

function showExplanation(initialOrbital, symmetry, newOrbital, explanation) {
    const html = `
        <h4>Résultat de ${getSymmetryName(symmetry)} sur ${getOrbitalDisplayName(initialOrbital)}</h4>
        <p>${explanation}</p>
        ${newOrbital.startsWith('-') ? 
            `<p><strong>Transformation : </strong>${getOrbitalDisplayName(initialOrbital)} → -${getOrbitalDisplayName(newOrbital.substring(1))}</p>` :
            newOrbital !== initialOrbital ? 
            `<p><strong>Transformation : </strong>${getOrbitalDisplayName(initialOrbital)} → ${getOrbitalDisplayName(newOrbital)}</p>` :
            '<p><strong>L\'orbitale reste inchangée.</strong></p>'}
    `;
    const div = document.getElementById('explanation');
    div.innerHTML = html;
    div.classList.add('fade-in');
    setTimeout(() => div.classList.remove('fade-in'), 500);
}

// ============================================
// SCORM
// ============================================

function initSCORM() {
    const statusText = document.getElementById('scorm-status-text');
    if (SCORM.api) {
        statusText.textContent = SCORM.getStudentName() ? `Connecté : ${SCORM.getStudentName()}` : 'Connecté au LMS';
        SCORM.setStatus(SCORM.status.INCOMPLETE);
        startSessionTimer();
    } else {
        statusText.textContent = 'Mode hors LMS';
    }
}

function updateSCORMStatus() {
    if (SCORM.api) {
        SCORM.setStatus(SCORM.status.COMPLETED);
        SCORM.commit();
    }
}

function finishModule() {
    if (SCORM.api) {
        SCORM.setSessionTime(getSessionTime());
        SCORM.setStatus(SCORM.status.COMPLETED);
        SCORM.setScore(1.0);
        SCORM.finish();
        alert('Module terminé ! Vos résultats ont été sauvegardés.');
    } else {
        alert('Module terminé ! (Mode hors LMS)');
    }
}

let startTime = null;
function startSessionTimer() { startTime = new Date(); }
function getSessionTime() { return startTime ? (new Date() - startTime) / 1000 : 0; }

// ============================================
// ÉVÉNEMENTS
// ============================================

function attachEvents() {
    document.getElementById('orbital-select').addEventListener('change', () => setOrbital(this.value));
    document.getElementById('symmetry-select').addEventListener('change', () => currentSymmetry = this.value);
    
    document.getElementById('apply-btn').addEventListener('click', () => startAnimation(currentSymmetry));
    
    document.getElementById('reset-btn').addEventListener('click', () => {
        clearSymmetryGroup();
        endAnimation();
        setOrbital(currentOrbital);
        document.getElementById('symmetry-select').value = 'E';
        currentSymmetry = 'E';
        animationSlider.disabled = true;
        animationSlider.value = 0;
    });
    
    document.getElementById('finish-btn').addEventListener('click', finishModule);
    document.getElementById('reset-camera').addEventListener('click', () => {
        camera.position.set(5, 5, 5);
        camera.lookAt(0, 0, 0);
        controls.reset();
    });
    
    animationSlider = document.getElementById('animation-slider');
    animationSlider.addEventListener('input', () => {
        if (animationData && parseInt(animationSlider.value) >= 100) endAnimation();
    });
    animationSlider.addEventListener('mouseup', () => {
        if (animationData && parseInt(animationSlider.value) >= 100) endAnimation();
    });
    animationSlider.addEventListener('touchend', () => {
        if (animationData && parseInt(animationSlider.value) >= 100) endAnimation();
    });
}

function cloneGroup(group) {
    const cloned = new THREE.Group();
    group.children.forEach(child => {
        let c;
        if (child.type === 'Mesh') {
            c = child.clone();
            c.material = child.material.clone();
        } else if (child.type === 'LineSegments') {
            c = child.clone();
            if (child.material) c.material = child.material.clone();
        } else {
            c = child.clone();
        }
        if (c) cloned.add(c);
    });
    return cloned;
}

// ============================================
// DÉMARRAGE
// ============================================

window.addEventListener('load', () => {
    initThreeJS();
    initSCORM();
    attachEvents();
    setOrbital('s');
    animationSlider = document.getElementById('animation-slider');
    animationSlider.disabled = true;
    animationSlider.value = 0;
});

window.addEventListener('resize', onWindowResize);
