/**
 * Symétrie des orbitales dans les petites molécules (H₂O, NH₃, CH₄)
 * Prototype SCORM pour Moodle
 *
 * Une fonction est une combinaison linéaire des orbitales de valence des atomes.
 * Elle est stockée atome par atome : coefficient de l'orbitale s et vecteur des
 * coefficients (p_x, p_y, p_z). Une opération de symétrie envoie chaque atome sur
 * un atome équivalent et transforme le vecteur p comme un vecteur de l'espace :
 * 1s(H₁) devient 1s(H₂), et C₃ produit des combinaisons comme −½ p_x + √3/2 p_y.
 */

// ============================================
// VARIABLES GLOBALES
// ============================================

let scene, camera, renderer, controls;
let moleculeGroup, orbitalGroup, symmetryElementGroup, animatedOrbitalGroup;

// Molécule affichée (voir MOLECULES)
let molecule;
// Fonction affichée : [{ s: nombre, p: THREE.Vector3 }], un élément par atome
let orbitalState;
// Dernière fonction choisie par l'utilisateur, rétablie par « Réinitialiser »
let chosenState;
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
// exactement deux sphères de diamètre Y_P tangentes au noyau. La taille de chaque
// orbitale est proportionnelle à son coefficient (le plus grand est à l'échelle 1).
const POLAR_SCALE = 2.6;
const S_RADIUS = Y_S * POLAR_SCALE;          // ≈ 0,73
const LOBE_RADIUS = Y_P * POLAR_SCALE / 2;   // ≈ 0,64, sphères tangentes au noyau

// Représentation « analytique » : r = |Y|², lobes p de longueur 1,4
const DENSITY_SCALE = 1.4 / (Y_P * Y_P);

// Légèrement transparentes pour laisser voir les atomes
const ORBITAL_OPACITY = 0.85;
// Opacité relative de la fonction de départ au début de l'animation ; elle décroît
// jusqu'à 0 à la fin, sinon ses faces transparentes se mêlent à celles du résultat
const GHOST_OPACITY = 0.3;

const EPSILON = 1e-6;
const DEG = Math.PI / 180;

const REPRESENTATION_HELP = {
    spheres: 'Diagramme polaire de |Y| : une orbitale p est exactement deux sphères tangentes au noyau. La taille de chaque orbitale est proportionnelle à son coefficient.',
    analytic: 'Diagramme polaire de |Y|² (densité angulaire) : r = |Y(θ,φ)|², couleur = signe de Y.'
};

// Couleurs
const COLORS = {
    positive: 0xE63946,
    negative: 0x4A6FA5,
    neutral: 0x6C757D,
    background: 0xF8F9FA,
    grid: 0xDEE2E6,
    bond: 0xADB5BD
};

const AXES = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1)
};

const AXIS_STYLE = [
    { name: 'x', dir: AXES.x, color: '#B91C1C' },
    { name: 'y', dir: AXES.y, color: '#15803D' },
    { name: 'z', dir: AXES.z, color: '#1D4ED8' }
];
const AXIS_LENGTH = 4.5;

// shell : couche de valence ; hasP : l'atome porte des orbitales p de valence
const ELEMENTS = {
    X: { shell: '', hasP: true, color: 0x343A40, radius: 0.12 },
    H: { shell: 1, hasP: false, color: 0xCED4DA, radius: 0.15 },
    C: { shell: 2, hasP: true, color: 0x343A40, radius: 0.25 },
    N: { shell: 2, hasP: true, color: 0x343A40, radius: 0.25 },
    O: { shell: 2, hasP: true, color: 0x343A40, radius: 0.25 }
};

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

// ============================================
// MOLÉCULES ET OPÉRATIONS DE SYMÉTRIE
// ============================================

function vec(x, y, z) {
    return new THREE.Vector3(x, y, z);
}

// index 0 : atome central, sans numéro
function atom(element, index, position) {
    return {
        element: element,
        label: element + (index ? SUBSCRIPT_DIGITS[index] : ''),
        html: element + (index ? `<sub>${index}</sub>` : ''),
        position: position
    };
}

const IDENTITY = { id: 'E', kind: 'identity', label: 'E', name: 'l\'identité', description: 'identité' };

function rotationOp(id, axis, angle, label, html, axisText) {
    return {
        id, kind: 'rotation', axis: axis.clone().normalize(), angle: angle * DEG, label,
        name: `la rotation ${html}`,
        description: `rotation de ${angle}° autour de ${axisText}`
    };
}

function reflectionOp(id, normal, label, html, planeText) {
    return {
        id, kind: 'reflection', normal: normal.clone().normalize(), label,
        name: `le plan miroir ${html}`,
        description: `plan miroir ${planeText}`
    };
}

// Rotation suivie d'une réflexion dans le plan perpendiculaire à l'axe
function improperOp(id, axis, angle, label, html, axisText, planeText) {
    return {
        id, kind: 'improper', axis: axis.clone().normalize(), angle: angle * DEG, label,
        name: `la rotation impropre ${html}`,
        description: `rotation de ${angle}° autour de ${axisText} puis réflexion dans le plan ${planeText}`
    };
}

function inversionOp() {
    return { id: 'i', kind: 'inversion', label: 'i', name: 'l\'inversion', description: 'inversion par rapport au centre' };
}

// Termes d'une combinaison : [indice de l'atome, 's' | 'x' | 'y' | 'z', coefficient]
function sumOfHydrogens(signs) {
    return signs.map((sign, k) => [k + 1, 's', sign]);
}

// Atome isolé : orbitales s et p sur un seul centre, sans nom d'atome ni numéro de couche
function buildIsolatedAtom() {
    return {
        name: 'atome isolé',
        pointGroup: 'K<sub>h</sub> (symétrie sphérique)',
        bareNames: true,
        // Orbitales plus grosses : il n'y a pas de voisins à ménager
        orbitalScale: 1.9,
        atoms: [atom('X', 0, vec(0, 0, 0))],
        operationClasses: [
            {
                title: 'Plans miroirs (σ)', ops: [
                    reflectionOp('s_xz', AXES.y, 'σ(xz)', 'σ<sub>xz</sub>', 'xz'),
                    reflectionOp('s_yz', AXES.x, 'σ(yz)', 'σ<sub>yz</sub>', 'yz'),
                    reflectionOp('s_xy', AXES.z, 'σ(xy)', 'σ<sub>xy</sub>', 'xy')
                ]
            },
            {
                title: 'Rotations (Cₙ)', ops: [
                    rotationOp('C2_x', AXES.x, 180, 'C₂(x)', 'C<sub>2</sub>(x)', 'x'),
                    rotationOp('C2_y', AXES.y, 180, 'C₂(y)', 'C<sub>2</sub>(y)', 'y'),
                    rotationOp('C2_z', AXES.z, 180, 'C₂(z)', 'C<sub>2</sub>(z)', 'z'),
                    rotationOp('C3_z', AXES.z, 120, 'C₃(z)', 'C<sub>3</sub>(z)', 'z'),
                    rotationOp('C4_z', AXES.z, 90, 'C₄(z)', 'C<sub>4</sub>(z)', 'z')
                ]
            },
            { title: 'Autres', ops: [inversionOp()] }
        ],
        combinations: []
    };
}

// H₂O (C2v) : axe C2 selon z, molécule dans le plan yz
function buildWater() {
    const r = 1.9, half = 104.5 / 2 * DEG;
    return {
        name: 'H₂O',
        pointGroup: 'C<sub>2v</sub>',
        atoms: [
            atom('O', 0, vec(0, 0, 0)),
            atom('H', 1, vec(0, r * Math.sin(half), -r * Math.cos(half))),
            atom('H', 2, vec(0, -r * Math.sin(half), -r * Math.cos(half)))
        ],
        operationClasses: [
            { title: 'Rotation', ops: [rotationOp('C2', AXES.z, 180, 'C₂(z)', 'C<sub>2</sub>(z)', 'z')] },
            {
                title: 'Plans miroirs (σv)', ops: [
                    reflectionOp('sv_xz', AXES.y, 'σv(xz)', 'σ<sub>v</sub>(xz)', 'xz, perpendiculaire à la molécule'),
                    reflectionOp('sv_yz', AXES.x, 'σv\'(yz)', 'σ\'<sub>v</sub>(yz)', 'yz, plan de la molécule')
                ]
            }
        ],
        combinations: [
            sumOfHydrogens([1, 1]),
            sumOfHydrogens([1, -1])
        ]
    };
}

// NH₃ (C3v) : axe C3 selon z, H₁ dans le plan xz
function buildAmmonia() {
    const r = 2.0, theta = 68 * DEG; // angle entre N–H et −z
    const phis = [0, 120, 240];
    const atoms = [atom('N', 0, vec(0, 0, 0))].concat(phis.map((phi, k) => atom('H', k + 1, vec(
        r * Math.sin(theta) * Math.cos(phi * DEG),
        r * Math.sin(theta) * Math.sin(phi * DEG),
        -r * Math.cos(theta)
    ))));
    return {
        name: 'NH₃',
        pointGroup: 'C<sub>3v</sub>',
        atoms: atoms,
        operationClasses: [
            {
                title: 'Rotations (C₃)', ops: [
                    rotationOp('C3', AXES.z, 120, 'C₃(z)', 'C<sub>3</sub>(z)', 'z'),
                    rotationOp('C3sq', AXES.z, 240, 'C₃²(z)', 'C<sub>3</sub><sup>2</sup>(z)', 'z')
                ]
            },
            {
                title: 'Plans miroirs (σv)', ops: phis.map((phi, k) => reflectionOp(
                    `sv_${k + 1}`, vec(-Math.sin(phi * DEG), Math.cos(phi * DEG), 0),
                    `σv(${atoms[k + 1].label})`, `σ<sub>v</sub>(${atoms[k + 1].html})`,
                    `contenant N et ${atoms[k + 1].label}`
                ))
            }
        ],
        combinations: [
            sumOfHydrogens([1, 1, 1]),
            sumOfHydrogens([2, -1, -1]),
            sumOfHydrogens([0, 1, -1])
        ]
    };
}

// CH₄ (Td) : C au centre d'un cube, H sur un sommet sur deux ; axes C2 et S4 selon x, y, z
function buildMethane() {
    const d = 2.2 / Math.sqrt(3);
    const corners = [vec(1, 1, 1), vec(-1, -1, 1), vec(-1, 1, -1), vec(1, -1, -1)];
    const atoms = [atom('C', 0, vec(0, 0, 0))].concat(corners.map((c, k) => atom('H', k + 1, c.multiplyScalar(d))));
    const hydrogens = atoms.slice(1);

    const c3 = [];
    hydrogens.forEach((h, k) => {
        const axisText = `l'axe C–${h.label}`;
        c3.push(rotationOp(`C3_${k + 1}`, h.position, 120, `C₃(${h.label})`, `C<sub>3</sub>(${h.html})`, axisText));
        c3.push(rotationOp(`C3sq_${k + 1}`, h.position, 240, `C₃²(${h.label})`, `C<sub>3</sub><sup>2</sup>(${h.html})`, axisText));
    });

    const c2 = AXIS_STYLE.map(({ name, dir }) =>
        rotationOp(`C2_${name}`, dir, 180, `C₂(${name})`, `C<sub>2</sub>(${name})`, name));

    const s4 = [];
    AXIS_STYLE.forEach(({ name, dir }) => {
        const plane = 'xyz'.replace(name, '');
        s4.push(improperOp(`S4_${name}`, dir, 90, `S₄(${name})`, `S<sub>4</sub>(${name})`, name, plane));
        s4.push(improperOp(`S4cube_${name}`, dir, 270, `S₄³(${name})`, `S<sub>4</sub><sup>3</sup>(${name})`, name, plane));
    });

    const sigma = [];
    hydrogens.forEach((hi, i) => hydrogens.slice(i + 1).forEach(hj => {
        sigma.push(reflectionOp(
            `sd_${i + 1}_${hydrogens.indexOf(hj) + 1}`,
            new THREE.Vector3().crossVectors(hi.position, hj.position),
            `σd(${hi.label},${hj.label})`, `σ<sub>d</sub>(${hi.html}, ${hj.html})`,
            `contenant C, ${hi.label} et ${hj.label}`
        ));
    }));

    return {
        name: 'CH₄',
        pointGroup: 'T<sub>d</sub>',
        atoms: atoms,
        operationClasses: [
            { title: 'Rotations (C₃)', ops: c3 },
            { title: 'Rotations (C₂)', ops: c2 },
            { title: 'Rotations impropres (S₄)', ops: s4 },
            { title: 'Plans miroirs (σd)', ops: sigma }
        ],
        combinations: [
            sumOfHydrogens([1, 1, 1, 1]),
            sumOfHydrogens([1, 1, -1, -1]),
            sumOfHydrogens([1, -1, 1, -1]),
            sumOfHydrogens([1, -1, -1, 1])
        ]
    };
}

// Complète la description : base d'orbitales, index des opérations, fonctions proposées
function finalizeMolecule(mol) {
    mol.basis = [];
    mol.atoms.forEach((a, index) => {
        const el = ELEMENTS[a.element];
        const on = name => mol.bareNames ? '' : `(${name})`;
        mol.basis.push({ atom: index, comp: 's', label: `${el.shell}s${on(a.label)}`, html: `${el.shell}s${on(a.html)}` });
        if (!el.hasP) return;
        ['x', 'y', 'z'].forEach(c => mol.basis.push({
            atom: index, comp: c, label: `${el.shell}p${c}${on(a.label)}`, html: `${el.shell}p<sub>${c}</sub>${on(a.html)}`
        }));
    });

    mol.orbitalScale = mol.orbitalScale || 1;
    mol.operationClasses.unshift({ title: null, ops: [IDENTITY] });
    mol.operations = {};
    mol.operationClasses.forEach(cls => cls.ops.forEach(op => { mol.operations[op.id] = op; }));

    // Chaque orbitale atomique seule, puis les combinaisons linéaires
    mol.presets = mol.basis.map((f, k) => ({
        value: `ao_${k}`, group: 'atomic', state: stateFromTerms(mol, [[f.atom, f.comp, 1]])
    })).concat(mol.combinations.map((terms, k) => ({
        value: `lc_${k}`, group: 'combination', state: stateFromTerms(mol, terms)
    })));
    return mol;
}

const MOLECULES = {
    atom: finalizeMolecule(buildIsolatedAtom()),
    H2O: finalizeMolecule(buildWater()),
    NH3: finalizeMolecule(buildAmmonia()),
    CH4: finalizeMolecule(buildMethane())
};

// ============================================
// INITIALISATION
// ============================================

function initThreeJS() {
    const canvas = document.getElementById('three-canvas');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.background);

    // z vertical : l'axe principal des molécules est dirigé vers le haut
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.up.set(0, 0, 1);
    camera.position.set(13, 6, 5.5);
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

    // Grille horizontale (plan xy) sous la molécule
    const grid = new THREE.GridHelper(10, 10, COLORS.grid, COLORS.grid);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -2.6;
    scene.add(grid);
    scene.add(createAxes());

    // Groupes
    moleculeGroup = new THREE.Group();
    scene.add(moleculeGroup);

    orbitalGroup = new THREE.Group();
    scene.add(orbitalGroup);

    animatedOrbitalGroup = new THREE.Group();
    animatedOrbitalGroup.visible = false;
    scene.add(animatedOrbitalGroup);

    symmetryElementGroup = new THREE.Group();
    scene.add(symmetryElementGroup);

    // Après camera.up : OrbitControls tourne autour de cet axe
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 4;
    controls.maxDistance = 25;

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

// Demi-axe positif plein terminé par une flèche (sens croissant de la variable),
// demi-axe négatif estompé, nom de l'axe au bout de la flèche
function createAxes() {
    const group = new THREE.Group();
    AXIS_STYLE.forEach(({ name, dir, color }) => {
        const material = new THREE.MeshBasicMaterial({ color: color });
        const faded = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.3 });

        // Les géométries sont construites selon y puis orientées selon l'axe
        const positive = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, AXIS_LENGTH, 16), material);
        positive.position.y = AXIS_LENGTH / 2;
        const negative = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, AXIS_LENGTH, 16), faded);
        negative.position.y = -AXIS_LENGTH / 2;
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.45, 24), material);
        head.position.y = AXIS_LENGTH + 0.2;

        const axis = new THREE.Group();
        axis.add(positive, negative, head);
        axis.quaternion.setFromUnitVectors(AXES.y, dir);
        group.add(axis);

        const label = createTextSprite(name, { color: color, background: null, height: 0.75, italic: true });
        label.position.copy(dir).multiplyScalar(AXIS_LENGTH + 0.9);
        group.add(label);
    });
    return group;
}

// ============================================
// FONCTIONS (COMBINAISONS LINÉAIRES)
// ============================================

function emptyState(mol) {
    return mol.atoms.map(() => ({ s: 0, p: new THREE.Vector3() }));
}

function getComponent(state, atomIndex, comp) {
    return comp === 's' ? state[atomIndex].s : state[atomIndex].p[comp];
}

function setComponent(state, atomIndex, comp, value) {
    if (comp === 's') state[atomIndex].s = value;
    else state[atomIndex].p[comp] = value;
}

function stateFromTerms(mol, terms) {
    const state = emptyState(mol);
    terms.forEach(([atomIndex, comp, coef]) => {
        setComponent(state, atomIndex, comp, getComponent(state, atomIndex, comp) + coef);
    });
    return state;
}

// Produit scalaire (orbitales atomiques supposées orthonormées)
function dot(a, b) {
    return a.reduce((sum, f, k) => sum + f.s * b[k].s + f.p.dot(b[k].p), 0);
}

// a = sign·b, composante par composante
function statesEqual(a, b, sign = 1) {
    return a.every((f, k) => Math.abs(f.s - sign * b[k].s) < EPSILON
        && f.p.clone().addScaledVector(b[k].p, -sign).lengthSq() < EPSILON * EPSILON);
}

function largestCoefficient(state) {
    return state.reduce((max, f) => Math.max(max, Math.abs(f.s), f.p.length()), 0);
}

// ============================================
// TRANSFORMATIONS
// ============================================

// I − 2t·n·nᵀ : t = 1 donne la réflexion, t = ½ la projection sur le plan
function reflectionMatrix(n, t) {
    const k = -2 * t;
    return new THREE.Matrix4().set(
        1 + k * n.x * n.x, k * n.x * n.y,     k * n.x * n.z,     0,
        k * n.y * n.x,     1 + k * n.y * n.y, k * n.y * n.z,     0,
        k * n.z * n.x,     k * n.z * n.y,     1 + k * n.z * n.z, 0,
        0,                 0,                 0,                 1
    );
}

/**
 * Matrice de l'opération `op` avec une progression t ∈ [0, 1]
 * (t = 1 : opération complète). Les rotations suivent un arc de cercle ;
 * pour les réflexions, la composante normale au plan passe linéairement
 * de +1 à −1 (trajectoire rectiligne).
 */
function operationMatrix(op, t = 1) {
    switch (op.kind) {
        case 'rotation':
            return new THREE.Matrix4().makeRotationAxis(op.axis, op.angle * t);
        case 'reflection':
            return reflectionMatrix(op.normal, t);
        case 'improper':
            return new THREE.Matrix4().makeRotationAxis(op.axis, op.angle * t)
                .multiply(reflectionMatrix(op.axis, t));
        case 'inversion': {
            const scale = 1 - 2 * t;
            return new THREE.Matrix4().makeScale(scale, scale, scale);
        }
        default:
            return new THREE.Matrix4();
    }
}

function transformPoint(point, op, t = 1) {
    return point.clone().applyMatrix4(operationMatrix(op, t));
}

// Arrondit les erreurs d'arrondi (0,9999999 → 1)
function cleanVector(v) {
    ['x', 'y', 'z'].forEach(c => {
        const rounded = Math.round(v[c]);
        if (Math.abs(v[c] - rounded) < EPSILON) v[c] = rounded;
    });
    return v;
}

// Atome sur lequel chaque atome est envoyé par l'opération
function atomPermutation(op) {
    const m = operationMatrix(op);
    return molecule.atoms.map(a => {
        const image = a.position.clone().applyMatrix4(m);
        const target = molecule.atoms.findIndex(b => b.element === a.element && b.position.distanceTo(image) < 1e-3);
        if (target < 0) throw new Error(`${op.label} n'est pas une opération de symétrie de ${molecule.name}`);
        return target;
    });
}

function transformState(state, op) {
    const m = operationMatrix(op);
    const permutation = atomPermutation(op);
    const result = emptyState(molecule);
    state.forEach((f, a) => {
        const image = result[permutation[a]];
        image.s = f.s;
        image.p.copy(f.p).applyMatrix4(m);
        cleanVector(image.p);
    });
    return result;
}

function getOperation(id) {
    return molecule.operations[id] || IDENTITY;
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
    if (Math.abs(abs - Math.round(abs)) < 1e-4) return String(Math.round(abs));
    const nice = NICE_COEFFICIENTS.find(([value]) => Math.abs(abs - value) < 1e-4);
    return nice ? nice[1] : abs.toFixed(2);
}

function formatSigned(value) {
    return (value < -1e-4 ? '−' : '') + formatCoefficient(Math.abs(value));
}

// Écriture de la combinaison, en HTML (html = true) ou en texte brut (listes déroulantes)
function formatState(state, html = true) {
    let text = '';
    molecule.basis.forEach(f => {
        const coef = getComponent(state, f.atom, f.comp);
        if (Math.abs(coef) < EPSILON) return;
        const abs = Math.abs(coef);
        const factor = Math.abs(abs - 1) < EPSILON ? '' : formatCoefficient(abs) + '·';
        const term = factor + (html ? f.html : f.label);
        if (!text) text = (coef < 0 ? '−' : '') + term;
        else text += (coef < 0 ? ' − ' : ' + ') + term;
    });
    return text || '0';
}

function getOrbitalDisplayName(state) {
    return formatState(state, true);
}

// Contracte « de le » → « du » et « à le » → « au »
function withPreposition(preposition, name) {
    if (name.startsWith('le ')) return (preposition === 'de' ? 'du ' : 'au ') + name.slice(3);
    return preposition + ' ' + name;
}

function getExplanation(initialState, newState, op) {
    const norm = dot(initialState, initialState);
    if (norm < EPSILON) {
        return 'La combinaison est nulle : donnez au moins un coefficient non nul.';
    }

    const relativeTo = 'par rapport ' + withPreposition('à', op.name);
    if (statesEqual(newState, initialState, 1)) {
        return `La fonction est <strong>symétrique</strong> ${relativeTo} : elle reste inchangée (caractère +1).`;
    }
    if (statesEqual(newState, initialState, -1)) {
        return `La fonction est <strong>antisymétrique</strong> ${relativeTo} : elle change de signe (caractère −1).`;
    }
    const overlap = dot(initialState, newState) / norm;
    return `La fonction n'est ni symétrique ni antisymétrique ${relativeTo} : `
        + `elle est transformée en une autre fonction (sa composante sur elle-même vaut ${formatSigned(overlap)}).`;
}

function showExplanation(initialState, op, newState, explanation) {
    const before = getOrbitalDisplayName(initialState);
    const after = getOrbitalDisplayName(newState);
    const html = `
        <h4>Résultat ${withPreposition('de', op.name)} sur ${before}</h4>
        <p>${explanation}</p>
        ${after !== before
            ? `<p><strong>Transformation : </strong>${before} → ${after}</p>`
            : '<p><strong>La fonction reste inchangée.</strong></p>'}
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
// CRÉATION DE LA MOLÉCULE ET DES ORBITALES
// ============================================

function createBond(from, to) {
    const direction = to.clone().sub(from);
    const bond = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, direction.length(), 16),
        new THREE.MeshPhongMaterial({ color: COLORS.bond })
    );
    bond.position.copy(from).addScaledVector(direction, 0.5);
    bond.quaternion.setFromUnitVectors(AXES.y, direction.normalize());
    return bond;
}

function buildMolecule() {
    clearGroup(moleculeGroup);
    const center = molecule.atoms[0].position;

    molecule.atoms.forEach((a, index) => {
        const el = ELEMENTS[a.element];
        const ball = new THREE.Mesh(
            new THREE.SphereGeometry(el.radius, 24, 24),
            new THREE.MeshPhongMaterial({ color: el.color })
        );
        ball.position.copy(a.position);
        moleculeGroup.add(ball);
        if (index > 0) moleculeGroup.add(createBond(center, a.position));

        // Étiquette à l'extérieur de la molécule (au-dessus pour l'atome central) ;
        // pas d'étiquette pour l'atome isolé
        if (molecule.bareNames) return;
        const outward = a.position.lengthSq() > EPSILON ? a.position.clone().normalize() : AXES.z.clone();
        const label = createTextSprite(a.label, { color: '#212529', background: 'rgba(255,255,255,0.85)', height: 0.5 });
        label.position.copy(a.position).addScaledVector(outward, 1.0);
        moleculeGroup.add(label);
    });
}

function createLobe(color, radius) {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshPhongMaterial({
        color: color,
        transparent: true,
        opacity: ORBITAL_OPACITY,
        side: THREE.DoubleSide
    });
    material.userData.baseOpacity = ORBITAL_OPACITY;
    const lobe = new THREE.Mesh(geometry, material);
    lobe.userData.isLobe = true;

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    lineMaterial.userData.baseOpacity = 0.3;
    lobe.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), lineMaterial));

    return lobe;
}

/**
 * Diagramme polaire de |Y|² de la partie portée par un atome :
 * Y(u) = s·Y_S + Y_P·(p·u), chaque sommet d'une sphère unité est placé à la
 * distance r = |Y(u)|² dans sa direction u, et coloré selon le signe de Y.
 */
function createAnalyticOrbital(f, center, scale) {
    const geometry = new THREE.SphereGeometry(1, 64, 48);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const positive = new THREE.Color(COLORS.positive);
    const negative = new THREE.Color(COLORS.negative);
    const u = new THREE.Vector3();

    for (let k = 0; k < position.count; k++) {
        u.fromBufferAttribute(position, k).normalize();
        const y = (f.s * Y_S + Y_P * f.p.dot(u)) / scale;
        (y >= 0 ? positive : negative).toArray(colors, 3 * k);
        u.multiplyScalar(DENSITY_SCALE * molecule.orbitalScale * y * y);
        position.setXYZ(k, u.x, u.y, u.z);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
        vertexColors: true,
        transparent: true,
        opacity: ORBITAL_OPACITY,
        side: THREE.DoubleSide
    });
    material.userData.baseOpacity = ORBITAL_OPACITY;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(center);
    return mesh;
}

function buildOrbital(state) {
    clearGroup(orbitalGroup);
    const largest = largestCoefficient(state);
    if (largest < EPSILON) return;
    // Le plus grand coefficient est dessiné à la taille de référence de la molécule
    const scale = largest / molecule.orbitalScale;

    state.forEach((f, index) => {
        const center = molecule.atoms[index].position;
        const pLength = f.p.length();
        if (Math.abs(f.s) < EPSILON && pLength < EPSILON) return;

        if (representation === 'analytic') {
            orbitalGroup.add(createAnalyticOrbital(f, center, largest));
            return;
        }

        if (Math.abs(f.s) > EPSILON) {
            const sphere = createLobe(f.s > 0 ? COLORS.positive : COLORS.negative, S_RADIUS * Math.abs(f.s) / scale);
            sphere.position.copy(center);
            orbitalGroup.add(sphere);
        }

        // Les composantes p d'un même atome forment une orbitale p orientée selon f.p
        if (pLength > EPSILON) {
            const dir = f.p.clone().divideScalar(pLength);
            const radius = LOBE_RADIUS * pLength / scale;
            [[COLORS.positive, 1], [COLORS.negative, -1]].forEach(([color, sign]) => {
                const lobe = createLobe(color, radius);
                lobe.position.copy(center).addScaledVector(dir, sign * radius);
                orbitalGroup.add(lobe);
            });
        }
    });
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

    const op = getOperation(symmetry);
    const initialState = orbitalState;
    const newState = transformState(initialState, op);
    const explanation = getExplanation(initialState, newState, op);

    // Fonction de départ semi-transparente en arrière-plan (s'efface pendant l'animation)
    setGroupOpacity(orbitalGroup, GHOST_OPACITY);

    // Copie opaque qui va subir l'opération
    const animationGroup = cloneGroup(orbitalGroup);
    setGroupOpacity(animationGroup, 1.0);
    animatedOrbitalGroup.add(animationGroup);
    animatedOrbitalGroup.visible = true;

    // Les lobes emportent leur couleur (phase) avec eux : pas d'inversion de couleur
    const lobes = animationGroup.children
        .filter(child => child.userData.isLobe)
        .map(mesh => ({ mesh: mesh, start: mesh.position.clone() }));

    // En mode analytique, c'est la fonction entière qui subit la transformation
    animationGroup.matrixAutoUpdate = false;

    animationData = {
        mode: representation,
        group: animationGroup,
        lobes: lobes,
        op: op,
        initialState: initialState,
        newState: newState,
        progress: 0,
        // Lecture automatique ; le curseur permet de reprendre la main à tout moment
        playing: true,
        startTime: performance.now()
    };

    animationSlider.disabled = false;
    animationSlider.value = 0;

    showExplanation(initialState, op, newState, explanation);
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
    updateGhostOpacity(t);
    const op = animationData.op;

    if (animationData.mode === 'analytic') {
        // Évite la matrice singulière (fonction aplatie) à mi-parcours
        const safeT = op.kind !== 'rotation' && Math.abs(t - 0.5) < 0.01 ? (t < 0.5 ? 0.49 : 0.51) : t;
        animationData.group.matrix.copy(operationMatrix(op, safeT));
        animationData.group.matrixWorldNeedsUpdate = true;
        return;
    }

    animationData.lobes.forEach(({ mesh, start }) => {
        mesh.position.copy(transformPoint(start, op, t));
        // Fait aussi tourner le maillage pour que la rotation soit visible (orbitale s)
        if (op.kind === 'rotation' || op.kind === 'improper') {
            mesh.quaternion.setFromAxisAngle(op.axis, op.angle * t);
        }
    });
}

function updateGhostOpacity(t) {
    if (animationData.ghostProgress === t) return;
    animationData.ghostProgress = t;
    setGroupOpacity(orbitalGroup, GHOST_OPACITY * (1 - t));
    // Totalement transparente : on la retire du rendu
    orbitalGroup.visible = t < 1;
}

// La fonction affichée est l'état de départ tant que l'opération n'est pas allée à son terme
function updateAnimatedOrbitalLabel(t) {
    const state = t >= 1 ? animationData.newState : animationData.initialState;
    if (animationData.labelState === state) return;
    animationData.labelState = state;
    document.getElementById('current-orbital').innerHTML = getOrbitalDisplayName(state);
}

// Abandonne l'animation en cours sans modifier l'état de la fonction
function cancelAnimation() {
    animatedOrbitalGroup.visible = false;
    clearGroup(animatedOrbitalGroup);
    setGroupOpacity(orbitalGroup, 1.0);
    orbitalGroup.visible = true;
    animationData = null;
    animationSlider.disabled = true;
}

// Termine l'animation : la fonction transformée devient le nouvel état si l'opération
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
        syncOrbitalControls();
    } else {
        showExplanation(orbitalState, IDENTITY, orbitalState, 'Opération annulée. Sélectionnez une opération de symétrie et cliquez sur "Appliquer".');
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
    const op = getOperation(symmetry);

    switch (op.kind) {
        case 'reflection': addPlane(op); break;
        case 'rotation': addAxis(op); break;
        case 'improper': addAxis(op); addAxisPlane(op); break;
        case 'inversion': addInversionCenter(op); break;
    }
}

function translucentMaterial(opacity) {
    return new THREE.MeshBasicMaterial({
        color: COLORS.neutral, transparent: true, opacity: opacity,
        side: THREE.DoubleSide, depthWrite: false
    });
}

function addPlane(op) {
    // PlaneGeometry est dans le plan xy (normale +z) : on l'oriente vers la normale
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), translucentMaterial(0.3));
    plane.lookAt(op.normal);
    symmetryElementGroup.add(plane);

    // Étiquette dans un coin du plan, du côté des z positifs si possible
    const up = Math.abs(op.normal.z) < 0.9 ? AXES.z : AXES.x;
    const w = up.clone().addScaledVector(op.normal, -up.dot(op.normal)).normalize();
    const u = new THREE.Vector3().crossVectors(op.normal, w);
    addSymmetryLabel(op.label, w.multiplyScalar(3.2).addScaledVector(u, 3.2));
}

function addInversionCenter(op) {
    const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    symmetryElementGroup.add(center);
    addSymmetryLabel(op.label, new THREE.Vector3(0.6, 0.6, 0.6));
}

// Plan de la réflexion d'une rotation impropre (perpendiculaire à l'axe)
function addAxisPlane(op) {
    const disk = new THREE.Mesh(new THREE.CircleGeometry(2.8, 64), translucentMaterial(0.25));
    disk.lookAt(op.axis);
    symmetryElementGroup.add(disk);
}

function addAxis(op) {
    const length = 9;
    const material = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });

    // CylinderGeometry est orientée selon y : on l'aligne sur l'axe de rotation
    const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, length, 32), material);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 32), material.clone());
    arrow.position.y = length / 2;
    axis.add(arrow);
    axis.quaternion.setFromUnitVectors(AXES.y, op.axis);
    symmetryElementGroup.add(axis);

    // Étiquette à l'extrémité opposée à la flèche, pour ne pas masquer le nom de l'axe z
    addSymmetryLabel(op.label, op.axis.clone().multiplyScalar(-(length / 2 + 0.6)));
}

function addSymmetryLabel(text, position) {
    const sprite = createTextSprite(text, { height: 0.5 });
    sprite.position.copy(position);
    symmetryElementGroup.add(sprite);
}

// Le texte est dessiné dans un canvas : il doit être en texte brut (pas de HTML).
// La largeur du sprite s'adapte à la longueur du texte ; il reste visible devant les objets.
function createTextSprite(text, { color = 'white', background = 'rgba(0,0,0,0.7)', height = 0.5, italic = false } = {}) {
    const fontSize = 64, padding = background ? 20 : 6;
    const font = `${italic ? 'italic ' : ''}bold ${fontSize}px Arial`;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = font;
    canvas.width = Math.ceil(ctx.measureText(text).width) + 2 * padding;
    canvas.height = fontSize + 2 * padding;

    // Redimensionner le canvas réinitialise le contexte
    if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
    sprite.renderOrder = 10;
    sprite.scale.set(height * canvas.width / canvas.height, height, 1);
    return sprite;
}

// ============================================
// INTERFACE
// ============================================

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

function createOption(value, text) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    return option;
}

function createOptgroup(label) {
    const group = document.createElement('optgroup');
    group.label = label;
    return group;
}

// Remplit les listes et l'éditeur de coefficients pour la molécule courante
function populateMoleculeControls() {
    document.getElementById('point-group').innerHTML = `Groupe ponctuel : ${molecule.pointGroup}`;

    const orbitalSelect = document.getElementById('orbital-select');
    orbitalSelect.innerHTML = '';
    const atomic = createOptgroup('Orbitales atomiques');
    const combinations = createOptgroup('Combinaisons linéaires');
    molecule.presets.forEach(preset => {
        (preset.group === 'atomic' ? atomic : combinations)
            .append(createOption(preset.value, formatState(preset.state, false)));
    });
    // Affichée seulement quand la fonction ne correspond à aucune fonction proposée
    const custom = createOption('custom', 'Combinaison personnalisée');
    custom.disabled = true;
    orbitalSelect.append(atomic);
    if (combinations.children.length) orbitalSelect.append(combinations);
    orbitalSelect.append(custom);

    const coefList = document.getElementById('coef-list');
    coefList.innerHTML = '';
    molecule.basis.forEach((f, k) => {
        const row = document.createElement('label');
        row.className = 'coef-row';
        const name = document.createElement('span');
        name.innerHTML = f.html;
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.5';
        input.dataset.index = k;
        input.addEventListener('input', onCoefficientInput);
        row.append(name, input);
        coefList.append(row);
    });

    const symmetrySelect = document.getElementById('symmetry-select');
    symmetrySelect.innerHTML = '';
    molecule.operationClasses.forEach(cls => {
        const options = cls.ops.map(op => createOption(op.id,
            op.kind === 'identity' ? 'Identité (E)' : `${op.label} — ${op.description}`));
        if (cls.title) {
            const group = createOptgroup(cls.title);
            group.append(...options);
            symmetrySelect.append(group);
        } else {
            symmetrySelect.append(...options);
        }
    });
}

// Met la liste et l'éditeur en accord avec la fonction affichée
function syncOrbitalControls(updateEditor = true) {
    const preset = molecule.presets.find(p => statesEqual(p.state, orbitalState));
    document.getElementById('orbital-select').value = preset ? preset.value : 'custom';
    if (!updateEditor) return;
    document.querySelectorAll('#coef-list input').forEach(input => {
        const f = molecule.basis[input.dataset.index];
        input.value = String(Math.round(getComponent(orbitalState, f.atom, f.comp) * 1000) / 1000);
    });
}

function setOrbitalState(state, { updateEditor = true } = {}) {
    cancelAnimation();
    orbitalState = state;
    chosenState = state;
    buildOrbital(orbitalState);
    syncOrbitalControls(updateEditor);
    updateCurrentOrbitalLabel();
    showExplanation(orbitalState, IDENTITY, orbitalState, 'Sélectionnez une opération de symétrie et cliquez sur "Appliquer".');
}

function onCoefficientInput() {
    const state = emptyState(molecule);
    document.querySelectorAll('#coef-list input').forEach(input => {
        const value = parseFloat(input.value);
        const f = molecule.basis[input.dataset.index];
        setComponent(state, f.atom, f.comp, Number.isFinite(value) ? value : 0);
    });
    // Ne pas réécrire le champ en cours de saisie
    setOrbitalState(state, { updateEditor: false });
}

function setSymmetry(id) {
    currentSymmetry = id;
    document.getElementById('symmetry-select').value = id;
    visualizeSymmetryElement(id);
}

function setMolecule(key) {
    cancelAnimation();
    molecule = MOLECULES[key];
    document.getElementById('molecule-select').value = key;
    buildMolecule();
    populateMoleculeControls();
    setSymmetry('E');
    setOrbitalState(molecule.presets[0].state);
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
    const moleculeSelect = document.getElementById('molecule-select');
    const orbitalSelect = document.getElementById('orbital-select');
    const symmetrySelect = document.getElementById('symmetry-select');

    moleculeSelect.addEventListener('change', () => setMolecule(moleculeSelect.value));
    orbitalSelect.addEventListener('change', () => {
        const preset = molecule.presets.find(p => p.value === orbitalSelect.value);
        if (preset) setOrbitalState(preset.state);
    });
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
        setSymmetry('E');
        setOrbitalState(chosenState);
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
    setMolecule('atom');
    setRepresentation('spheres');
});
