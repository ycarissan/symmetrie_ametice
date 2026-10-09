/**
 * Symétrie des Orbitales Atomiques - Module 3 : Atome Isolé
 * Prototype SCORM pour Moodle
 *
 * L'état d'une orbitale p est représenté par le vecteur unitaire pointant vers
 * son lobe positif : appliquer une opération de symétrie revient à transformer
 * ce vecteur. Cela gère correctement les changements de signe (−p_x) comme les
 * combinaisons linéaires produites par C3 (−½ p_x + √3/2 p_y).
 */

// ============================================
// VARIABLES GLOBALES
// ============================================

let scene, camera, renderer, controls;
let orbitalGroup, symmetryElementGroup, animatedOrbitalGroup;

// { type: 's' } ou { type: 'p', dir: THREE.Vector3 }
let orbitalState = { type: 's' };
let currentSymmetry = 'E';

// 'spheres' (diagramme polaire de |Y|) ou 'analytic' (diagramme polaire de |Y|²)
let representation = 'spheres';

// Animation
let animationData = null;
let animationSlider;
const ANIMATION_DURATION = 1500; // ms

// Harmoniques sphériques réelles : Y(s) = 1/(2√π), Y(p) = √(3/4π)·cos θ
const Y_S = 1 / (2 * Math.sqrt(Math.PI));
const Y_P = Math.sqrt(3 / (4 * Math.PI));

// Représentation « sphères » : le diagramme polaire de |Y| d'une orbitale p est
// exactement deux sphères de diamètre Y_P tangentes au noyau
const POLAR_SCALE = 5;
const S_RADIUS = Y_S * POLAR_SCALE;          // ≈ 1,41
const LOBE_RADIUS = Y_P * POLAR_SCALE / 2;   // ≈ 1,22
const LOBE_DISTANCE = LOBE_RADIUS;           // sphères tangentes au noyau

// Représentation « analytique » : r = |Y|², lobes p de longueur 3
const DENSITY_SCALE = 3 / (Y_P * Y_P);

const EPSILON = 1e-6;

const REPRESENTATION_HELP = {
    spheres: 'Diagramme polaire de |Y| : une orbitale p est exactement deux sphères tangentes au noyau.',
    analytic: 'Diagramme polaire de |Y|² (densité angulaire) : r = |Y(θ,φ)|², couleur = signe de Y.'
};

// Couleurs
const COLORS = {
    positive: 0xE63946,
    negative: 0x4A6FA5,
    neutral: 0x6C757D,
    background: 0xF8F9FA,
    grid: 0xE9ECEF
};

const AXES = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1)
};

// Définition géométrique des opérations de symétrie
const OPERATIONS = {
    E:        { kind: 'identity' },
    sigma_xz: { kind: 'reflection', normal: AXES.y, label: 'σ(xz)', labelPos: [3.5, 0, 3.5] },
    sigma_yz: { kind: 'reflection', normal: AXES.x, label: 'σ(yz)', labelPos: [0, 3.5, 3.5] },
    sigma_xy: { kind: 'reflection', normal: AXES.z, label: 'σ(xy)', labelPos: [3.5, 3.5, 0] },
    C2_x:     { kind: 'rotation', axis: AXES.x, angle: Math.PI,         label: 'C₂(x)' },
    C2_y:     { kind: 'rotation', axis: AXES.y, angle: Math.PI,         label: 'C₂(y)' },
    C2_z:     { kind: 'rotation', axis: AXES.z, angle: Math.PI,         label: 'C₂(z)' },
    C3_z:     { kind: 'rotation', axis: AXES.z, angle: 2 * Math.PI / 3, label: 'C₃(z)' },
    C4_z:     { kind: 'rotation', axis: AXES.z, angle: Math.PI / 2,     label: 'C₄(z)' },
    i:        { kind: 'inversion', label: 'i' }
};

// ============================================
// INITIALISATION
// ============================================

function initThreeJS() {
    const canvas = document.getElementById('three-canvas');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.background);

    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);

    // Lumière
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 5, 5);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-5, -5, -5);
    scene.add(directionalLight2);

    // Grille et axes (x rouge, y vert, z bleu)
    scene.add(new THREE.GridHelper(10, 10, COLORS.grid, COLORS.grid));
    scene.add(new THREE.AxesHelper(5));

    // Groupes
    orbitalGroup = new THREE.Group();
    scene.add(orbitalGroup);

    animatedOrbitalGroup = new THREE.Group();
    animatedOrbitalGroup.visible = false;
    scene.add(animatedOrbitalGroup);

    symmetryElementGroup = new THREE.Group();
    scene.add(symmetryElementGroup);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 20;

    onWindowResize();
    window.addEventListener('resize', onWindowResize);
    if (window.ResizeObserver) {
        new ResizeObserver(onWindowResize).observe(canvas.parentElement);
    }
    animate();
}

function onWindowResize() {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // false : ne pas imposer de taille CSS, le canvas suit son conteneur
    renderer.setSize(width, height, false);
}

function animate() {
    requestAnimationFrame(animate);
    if (animationData) updateAnimation();
    controls.update();
    renderer.render(scene, camera);
}

// ============================================
// TRANSFORMATIONS
// ============================================

/**
 * Matrice de l'opération `symmetry` avec une progression t ∈ [0, 1]
 * (t = 1 : opération complète). Les rotations suivent un arc de cercle ;
 * pour les réflexions et l'inversion, la composante concernée passe
 * linéairement de +1 à −1 (trajectoire rectiligne).
 */
function operationMatrix(symmetry, t = 1) {
    const op = OPERATIONS[symmetry] || OPERATIONS.E;
    const m = new THREE.Matrix4();

    switch (op.kind) {
        case 'rotation':
            return m.makeRotationAxis(op.axis, op.angle * t);
        case 'reflection': {
            // I − 2t·n·nᵀ
            const n = op.normal, k = -2 * t;
            return m.set(
                1 + k * n.x * n.x, k * n.x * n.y,     k * n.x * n.z,     0,
                k * n.y * n.x,     1 + k * n.y * n.y, k * n.y * n.z,     0,
                k * n.z * n.x,     k * n.z * n.y,     1 + k * n.z * n.z, 0,
                0,                 0,                 0,                 1
            );
        }
        case 'inversion': {
            const scale = 1 - 2 * t;
            return m.makeScale(scale, scale, scale);
        }
        default:
            return m;
    }
}

function transformPoint(point, symmetry, t = 1) {
    return new THREE.Vector3(point.x, point.y, point.z).applyMatrix4(operationMatrix(symmetry, t));
}

function cleanVector(v) {
    ['x', 'y', 'z'].forEach(c => {
        if (Math.abs(v[c]) < EPSILON) v[c] = 0;
        else if (Math.abs(Math.abs(v[c]) - 1) < EPSILON) v[c] = Math.sign(v[c]);
    });
    return v;
}

function transformState(state, symmetry) {
    if (state.type === 's') return { type: 's' };
    return { type: 'p', dir: cleanVector(transformPoint(state.dir, symmetry)) };
}

// ============================================
// NOMS ET EXPLICATIONS
// ============================================

const NICE_COEFFICIENTS = [
    [0.5, '½'],
    [Math.sqrt(3) / 2, '√3/2'],
    [Math.SQRT1_2, '1/√2']
];

function formatCoefficient(abs) {
    const nice = NICE_COEFFICIENTS.find(([value]) => Math.abs(abs - value) < 1e-4);
    return nice ? nice[1] : abs.toFixed(2);
}

function getOrbitalDisplayName(state) {
    if (state.type === 's') return 's';

    let html = '';
    ['x', 'y', 'z'].forEach(c => {
        const coef = state.dir[c];
        if (Math.abs(coef) < EPSILON) return;
        const abs = Math.abs(coef);
        const sign = coef < 0 ? '−' : (html ? '+' : '');
        const factor = Math.abs(abs - 1) < EPSILON ? '' : formatCoefficient(abs) + ' ';
        html += `${html ? ' ' : ''}${sign}${html && sign ? ' ' : ''}${factor}p<sub>${c}</sub>`;
    });
    return html;
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

// Contracte « de le » → « du » et « à le » → « au »
function withPreposition(preposition, name) {
    if (name.startsWith('le ')) return (preposition === 'de' ? 'du ' : 'au ') + name.slice(3);
    return preposition + ' ' + name;
}

function getExplanation(initialState, newState, symmetry) {
    const relativeTo = 'par rapport ' + withPreposition('à', getSymmetryName(symmetry));
    const name = getOrbitalDisplayName(initialState);

    if (initialState.type === 's') {
        return `L'orbitale <strong>s</strong> est <strong>totalement symétrique</strong> : elle reste inchangée.`;
    }

    const overlap = initialState.dir.dot(newState.dir);
    if (overlap > 1 - EPSILON) {
        return `L'orbitale <strong>${name}</strong> est <strong>symétrique</strong> ${relativeTo} : elle reste inchangée (caractère +1).`;
    }
    if (overlap < -1 + EPSILON) {
        return `L'orbitale <strong>${name}</strong> est <strong>antisymétrique</strong> ${relativeTo} : elle change de signe (caractère −1).`;
    }
    return `L'orbitale <strong>${name}</strong> n'est ni symétrique ni antisymétrique ${relativeTo} : `
        + `elle est transformée en une autre orbitale (sa composante sur elle-même vaut ${overlap.toFixed(2)}).`;
}

function showExplanation(initialState, symmetry, newState, explanation) {
    const before = getOrbitalDisplayName(initialState);
    const after = getOrbitalDisplayName(newState);
    const html = `
        <h4>Résultat ${withPreposition('de', getSymmetryName(symmetry))} sur ${before}</h4>
        <p>${explanation}</p>
        ${after !== before
            ? `<p><strong>Transformation : </strong>${before} → ${after}</p>`
            : '<p><strong>L\'orbitale reste inchangée.</strong></p>'}
    `;
    const div = document.getElementById('explanation');
    div.innerHTML = html;
    div.classList.add('fade-in');
    setTimeout(() => div.classList.remove('fade-in'), 500);
}

function updateCurrentOrbitalLabel() {
    document.getElementById('current-orbital').innerHTML = getOrbitalDisplayName(orbitalState);
}

// ============================================
// CRÉATION DES ORBITALES
// ============================================

function createLobe(color, radius) {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshPhongMaterial({
        color: color,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide
    });
    material.userData.baseOpacity = 1.0;
    const lobe = new THREE.Mesh(geometry, material);
    lobe.userData.isLobe = true;

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    lineMaterial.userData.baseOpacity = 0.5;
    lobe.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), lineMaterial));

    return lobe;
}

/**
 * Diagramme polaire de |Y|² : chaque sommet d'une sphère unité est placé à la
 * distance r = |Y(θ,φ)|² dans sa direction, et coloré selon le signe de Y.
 * L'orbitale p est construite le long de +z puis orientée selon state.dir.
 */
function createAnalyticOrbital(state) {
    const geometry = new THREE.SphereGeometry(1, 96, 64);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const positive = new THREE.Color(COLORS.positive);
    const negative = new THREE.Color(COLORS.negative);
    const u = new THREE.Vector3();

    for (let k = 0; k < position.count; k++) {
        u.fromBufferAttribute(position, k).normalize();
        const y = state.type === 's' ? Y_S : Y_P * u.z;
        (y >= 0 ? positive : negative).toArray(colors, 3 * k);
        u.multiplyScalar(DENSITY_SCALE * y * y);
        position.setXYZ(k, u.x, u.y, u.z);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide
    });
    material.userData.baseOpacity = 1.0;

    const mesh = new THREE.Mesh(geometry, material);
    if (state.type === 'p') mesh.quaternion.setFromUnitVectors(AXES.z, state.dir);
    return mesh;
}

function buildOrbital(state) {
    clearGroup(orbitalGroup);

    if (representation === 'analytic') {
        orbitalGroup.add(createAnalyticOrbital(state));
        return;
    }

    if (state.type === 's') {
        orbitalGroup.add(createLobe(COLORS.positive, S_RADIUS));
        return;
    }

    const lobePositive = createLobe(COLORS.positive, LOBE_RADIUS);
    lobePositive.position.copy(state.dir).multiplyScalar(LOBE_DISTANCE);

    const lobeNegative = createLobe(COLORS.negative, LOBE_RADIUS);
    lobeNegative.position.copy(state.dir).multiplyScalar(-LOBE_DISTANCE);

    orbitalGroup.add(lobePositive);
    orbitalGroup.add(lobeNegative);
}

function disposeObject(object) {
    object.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(m => {
                if (m.map) m.map.dispose();
                m.dispose();
            });
        }
    });
}

function clearGroup(group) {
    while (group.children.length > 0) {
        const child = group.children[0];
        disposeObject(child);
        group.remove(child);
    }
}

function clearSymmetryGroup() {
    clearGroup(symmetryElementGroup);
}

// Copie profonde : géométries et matériaux ne sont pas partagés avec l'original
function cloneGroup(group) {
    const cloned = group.clone(true);
    cloned.traverse(child => {
        if (child.geometry) child.geometry = child.geometry.clone();
        if (child.material) {
            const material = child.material.clone();
            material.userData = Object.assign({}, child.material.userData);
            child.material = material;
        }
    });
    return cloned;
}

// L'opacité est relative à l'opacité de base de chaque matériau
function setGroupOpacity(group, factor) {
    group.traverse(child => {
        if (!child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(mat => {
            const base = mat.userData.baseOpacity !== undefined ? mat.userData.baseOpacity : 1.0;
            mat.transparent = true;
            mat.opacity = base * factor;
        });
    });
}

// ============================================
// ANIMATION
// ============================================

function startAnimation(symmetry) {
    // Une opération encore en cours est menée à son terme avant d'enchaîner
    endAnimation();
    visualizeSymmetryElement(symmetry);

    const initialState = orbitalState;
    const newState = transformState(initialState, symmetry);
    const explanation = getExplanation(initialState, newState, symmetry);

    // Orbitale de départ semi-transparente en arrière-plan
    setGroupOpacity(orbitalGroup, 0.3);

    // Copie opaque qui va subir l'opération
    const animationGroup = cloneGroup(orbitalGroup);
    setGroupOpacity(animationGroup, 1.0);
    animatedOrbitalGroup.add(animationGroup);
    animatedOrbitalGroup.visible = true;

    // Les lobes emportent leur couleur (phase) avec eux : pas d'inversion de couleur
    const lobes = animationGroup.children
        .filter(child => child.userData.isLobe)
        .map(mesh => ({ mesh: mesh, start: mesh.position.clone() }));

    // En mode analytique, c'est l'orbitale entière qui subit la transformation
    animationGroup.matrixAutoUpdate = false;

    animationData = {
        mode: representation,
        group: animationGroup,
        lobes: lobes,
        symmetry: symmetry,
        initialState: initialState,
        newState: newState,
        progress: 0,
        // Lecture automatique ; le curseur permet de reprendre la main à tout moment
        playing: true,
        startTime: performance.now()
    };

    animationSlider.disabled = false;
    animationSlider.value = 0;

    showExplanation(initialState, symmetry, newState, explanation);
    updateSCORMStatus();
}

function easeInOut(x) {
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function updateAnimation() {
    if (animationData.playing) {
        const elapsed = (performance.now() - animationData.startTime) / ANIMATION_DURATION;
        animationData.progress = easeInOut(Math.min(elapsed, 1));
        animationSlider.value = Math.round(animationData.progress * 100);
        // En fin de lecture, l'opération reste ouverte : le curseur permet de la parcourir à nouveau
        if (elapsed >= 1) animationData.playing = false;
    }

    const t = animationData.progress;
    updateAnimatedOrbitalLabel(t);
    const op = OPERATIONS[animationData.symmetry];

    if (animationData.mode === 'analytic') {
        // Évite la matrice singulière (orbitale aplatie) à mi-parcours
        const safeT = op.kind !== 'rotation' && Math.abs(t - 0.5) < 0.01 ? (t < 0.5 ? 0.49 : 0.51) : t;
        animationData.group.matrix.copy(operationMatrix(animationData.symmetry, safeT));
        animationData.group.matrixWorldNeedsUpdate = true;
        return;
    }

    animationData.lobes.forEach(({ mesh, start }) => {
        mesh.position.copy(transformPoint(start, animationData.symmetry, t));
        // Fait aussi tourner le maillage pour que la rotation soit visible (orbitale s)
        if (op.kind === 'rotation') {
            mesh.quaternion.setFromAxisAngle(op.axis, op.angle * t);
        }
    });
}

// L'orbitale affichée est l'état de départ tant que l'opération n'est pas allée à son terme
function updateAnimatedOrbitalLabel(t) {
    const state = t >= 1 ? animationData.newState : animationData.initialState;
    if (animationData.labelState === state) return;
    animationData.labelState = state;
    document.getElementById('current-orbital').innerHTML = getOrbitalDisplayName(state);
}

// Abandonne l'animation en cours sans modifier l'état de l'orbitale
function cancelAnimation() {
    animatedOrbitalGroup.visible = false;
    clearGroup(animatedOrbitalGroup);
    setGroupOpacity(orbitalGroup, 1.0);
    animationData = null;
    animationSlider.disabled = true;
}

// Termine l'animation : l'orbitale transformée devient le nouvel état si l'opération
// est allée à son terme (ou est en cours de lecture) ; si l'utilisateur a ramené
// le curseur en arrière, l'opération est annulée et on repart de l'état de départ
function endAnimation() {
    if (!animationData) return;
    const completed = animationData.playing || animationData.progress >= 1;
    const newState = animationData.newState;
    cancelAnimation();

    if (completed) {
        orbitalState = newState;
        buildOrbital(orbitalState);
    } else {
        showExplanation(orbitalState, 'E', orbitalState, 'Opération annulée. Sélectionnez une opération de symétrie et cliquez sur "Appliquer".');
    }
    updateCurrentOrbitalLabel();
    // La sélection a pu changer pendant l'animation
    visualizeSymmetryElement(currentSymmetry);
}

// ============================================
// VISUALISATION DES ÉLÉMENTS DE SYMÉTRIE
// ============================================

function visualizeSymmetryElement(symmetry) {
    clearSymmetryGroup();
    const op = OPERATIONS[symmetry];
    if (!op) return;

    switch (op.kind) {
        case 'reflection': addPlane(op); break;
        case 'rotation': addAxis(op); break;
        case 'inversion': addInversionCenter(op); break;
    }
}

function addPlane(op) {
    // PlaneGeometry est dans le plan xy (normale +z) : on l'oriente vers la normale
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshBasicMaterial({
            color: COLORS.neutral, transparent: true, opacity: 0.3,
            side: THREE.DoubleSide, depthWrite: false
        })
    );
    plane.lookAt(op.normal);
    symmetryElementGroup.add(plane);
    addSymmetryLabel(op.label, new THREE.Vector3(...op.labelPos));
}

function addAxis(op) {
    const length = 10;
    const material = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });

    // CylinderGeometry est orientée selon y : on l'aligne sur l'axe de rotation
    const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, length, 32), material);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 32), material.clone());
    arrow.position.y = length / 2;
    axis.add(arrow);
    axis.quaternion.setFromUnitVectors(AXES.y, op.axis);
    symmetryElementGroup.add(axis);

    addSymmetryLabel(op.label, op.axis.clone().multiplyScalar(length / 2 + 0.8));
}

function addInversionCenter(op) {
    const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    symmetryElementGroup.add(center);
    addSymmetryLabel(op.label, new THREE.Vector3(0.6, 0.6, 0.6));
}

// Le texte est dessiné dans un canvas : il doit être en texte brut (pas de HTML)
function addSymmetryLabel(text, position) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 56px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas),
        depthTest: false
    }));
    sprite.scale.set(1, 0.5, 1);
    sprite.position.copy(position);
    symmetryElementGroup.add(sprite);
}

// ============================================
// INTERFACE
// ============================================

function stateFromName(name) {
    if (name === 's') return { type: 's' };
    return { type: 'p', dir: AXES[name.split('_')[1]].clone() };
}

function setRepresentation(mode) {
    representation = mode;
    document.querySelectorAll('.segmented-btn').forEach(btn => {
        const active = btn.dataset.mode === mode;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
    });
    document.getElementById('representation-help').textContent = REPRESENTATION_HELP[mode];
    endAnimation();
    buildOrbital(orbitalState);
}

function setOrbital(name) {
    cancelAnimation();
    orbitalState = stateFromName(name);
    document.getElementById('orbital-select').value = name;
    buildOrbital(orbitalState);
    updateCurrentOrbitalLabel();
    showExplanation(orbitalState, 'E', orbitalState, 'Sélectionnez une opération de symétrie et cliquez sur "Appliquer".');
}

// ============================================
// SCORM
// ============================================

function initSCORM() {
    const statusText = document.getElementById('scorm-status-text');
    if (SCORM.api) {
        const studentName = SCORM.getStudentName();
        statusText.textContent = studentName ? `Connecté : ${studentName}` : 'Connecté au LMS';
        // Ne pas rétrograder un module déjà terminé lors d'une nouvelle tentative
        const status = SCORM.getValue('cmi.core.lesson_status');
        if (status !== SCORM.status.COMPLETED && status !== SCORM.status.PASSED) {
            SCORM.setStatus(SCORM.status.INCOMPLETE);
        }
    } else {
        statusText.textContent = 'Mode hors LMS';
    }
}

function updateSCORMStatus() {
    if (SCORM.api) SCORM.setStatus(SCORM.status.COMPLETED);
}

function finishModule() {
    if (SCORM.api && !SCORM.terminated) {
        SCORM.setStatus(SCORM.status.COMPLETED);
        SCORM.setScore(100);
        SCORM.finish();
        alert('Module terminé ! Vos résultats ont été sauvegardés.');
    } else if (SCORM.api) {
        alert('Module déjà terminé.');
    } else {
        alert('Module terminé ! (Mode hors LMS)');
    }
}

// ============================================
// ÉVÉNEMENTS
// ============================================

function attachEvents() {
    const orbitalSelect = document.getElementById('orbital-select');
    const symmetrySelect = document.getElementById('symmetry-select');

    orbitalSelect.addEventListener('change', () => setOrbital(orbitalSelect.value));
    // L'élément de symétrie est affiché dès qu'il est sélectionné
    symmetrySelect.addEventListener('change', () => {
        currentSymmetry = symmetrySelect.value;
        // Une opération en pause est validée (curseur au bout) ou annulée avant de passer à la suivante
        if (animationData && !animationData.playing) endAnimation();
        else if (!animationData) visualizeSymmetryElement(currentSymmetry);
    });

    document.querySelectorAll('.segmented-btn').forEach(btn => {
        btn.addEventListener('click', () => setRepresentation(btn.dataset.mode));
    });

    document.getElementById('apply-btn').addEventListener('click', () => startAnimation(currentSymmetry));

    document.getElementById('reset-btn').addEventListener('click', () => {
        clearSymmetryGroup();
        symmetrySelect.value = 'E';
        currentSymmetry = 'E';
        setOrbital(orbitalSelect.value);
        animationSlider.value = 0;
    });

    document.getElementById('finish-btn').addEventListener('click', finishModule);
    document.getElementById('reset-camera').addEventListener('click', () => controls.reset());

    // Déplacer le curseur met la lecture en pause et permet de parcourir l'opération
    animationSlider.addEventListener('input', () => {
        if (!animationData) return;
        animationData.playing = false;
        animationData.progress = parseInt(animationSlider.value, 10) / 100;
    });
}

// ============================================
// DÉMARRAGE
// ============================================

window.addEventListener('load', () => {
    animationSlider = document.getElementById('animation-slider');
    initThreeJS();
    initSCORM();
    attachEvents();
    setOrbital('s');
    setRepresentation('spheres');
});
