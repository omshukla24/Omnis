/* ═══════════════════════════════════════════════════════════════
   OMNIS — Multiverse Space Simulator
   Main Entry Point & Orchestrator
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { SOLAR_SYSTEM, SPECTRAL_TYPES, GALAXY_TYPES, INTERSTELLAR_SYSTEM } from './src/data.js';
import { SeededRandom, generateStarName, generatePlanetName, generateGalaxyName, generateSystemName, generateUniverseName } from './src/procedural.js';
import { GALAXY_PARTICLE_SHADER } from './src/shaders.js';
import { createPlanet, createStar, createBlackHole, createNeutronStar, createMoon, createAsteroidBelt, createPlanetSurface, createGargantua } from './src/celestials.js';
import { LifeSimulator } from './src/lifesim.js';
import { SpaceAudioEngine } from './src/audio.js';

/* ═══════════════════════════════════════════════════════════════
   SCALE HIERARCHY
   ═══════════════════════════════════════════════════════════════ */
const SCALES = {
    MULTIVERSE: 'multiverse',
    UNIVERSE: 'universe',
    GALAXY: 'galaxy',
    SYSTEM: 'system',
    PLANET: 'planet',
};

let currentScale = SCALES.MULTIVERSE;
let scaleHistory = []; // Breadcrumb trail: [{scale, name, data}]
let selectedObject = null;
let globalTime = 0;

/* ═══════════════════════════════════════════════════════════════
   THREE.JS SCENE SETUP
   ═══════════════════════════════════════════════════════════════ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010103);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 50000);
camera.position.set(0, 80, 150);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.7;
document.body.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.3, 0.8);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.1;
controls.maxDistance = 10000;

// Global lighting
scene.add(new THREE.AmbientLight(0x111122, 0.5));

/* ═══════════════════════════════════════════════════════════════
   HIERARCHY GROUPS
   ═══════════════════════════════════════════════════════════════ */
const multiverseGroup = new THREE.Group(); multiverseGroup.name = 'multiverse';
const universeGroup = new THREE.Group(); universeGroup.name = 'universe';
const galaxyGroup = new THREE.Group(); galaxyGroup.name = 'galaxy';
const systemGroup = new THREE.Group(); systemGroup.name = 'system';
const planetGroup = new THREE.Group(); planetGroup.name = 'planet';

scene.add(multiverseGroup);
scene.add(universeGroup);
scene.add(galaxyGroup);
scene.add(systemGroup);
scene.add(planetGroup);

// Starfield backdrop (always visible)
const starsGeo = new THREE.BufferGeometry();
const starCount = 12000;
const starPositions = new Float32Array(starCount * 3);
const starColors = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    // Push stars out incredibly far so the camera never clips through them
    const r = 30000 + Math.random() * 40000;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = r * Math.cos(phi);
    const brightness = 0.3 + Math.random() * 0.7;
    const tint = Math.random();
    starColors[i * 3] = brightness * (0.8 + tint * 0.2);
    starColors[i * 3 + 1] = brightness * (0.85 + tint * 0.15);
    starColors[i * 3 + 2] = brightness;
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starsGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({
    size: 0.8, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: false,
})));

/* ═══════════════════════════════════════════════════════════════
   SOLAR SYSTEM BUILDER
   ═══════════════════════════════════════════════════════════════ */
const solarSystemObjects = []; // All planet groups in the solar system
const allShaderMaterials = []; // All materials that need time updates
let sunGroup = null;
const sunDirection = new THREE.Vector3(1, 0.3, 0).normalize();

function buildSolarSystem() {
    // Clear previous
    while (systemGroup.children.length) systemGroup.remove(systemGroup.children[0]);
    solarSystemObjects.length = 0;

    // Sun
    sunGroup = createStar(SOLAR_SYSTEM.star);
    systemGroup.add(sunGroup);
    allShaderMaterials.push(sunGroup.userData.material);

    // Planets
    SOLAR_SYSTEM.planets.forEach((pData, i) => {
        const planetGroup = createPlanet(pData, sunDirection);
        allShaderMaterials.push(planetGroup.userData.material);
        if (planetGroup.userData.atmosMaterial) allShaderMaterials.push(planetGroup.userData.atmosMaterial);
        if (planetGroup.userData.ringMaterial) allShaderMaterials.push(planetGroup.userData.ringMaterial);

        // Create orbit pivot
        const orbitPivot = new THREE.Group();
        orbitPivot.userData = { orbitSpeed: 0.2 / (pData.distAU || 1), orbitRadius: pData.renderDist };
        planetGroup.position.x = pData.renderDist;
        orbitPivot.add(planetGroup);

        // Orbit line
        const orbitCurve = new THREE.EllipseCurve(0, 0, pData.renderDist, pData.renderDist, 0, Math.PI * 2, false, 0);
        const orbitPoints = orbitCurve.getPoints(128);
        const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints.map(p => new THREE.Vector3(p.x, 0, p.y)));
        const orbitLine = new THREE.Line(orbitGeo, new THREE.LineBasicMaterial({
            color: 0x334466, transparent: true, opacity: 0.2,
        }));
        systemGroup.add(orbitLine);

        // Moons
        if (pData.moonData) {
            pData.moonData.forEach((mData, mi) => {
                const moonMesh = createMoon(mData, sunDirection);
                allShaderMaterials.push(moonMesh.userData.material);
                const moonPivot = new THREE.Group();
                moonPivot.userData = { orbitSpeed: 0.5 + mi * 0.15 };
                moonMesh.position.x = mData.renderDist;
                moonPivot.add(moonMesh);
                planetGroup.add(moonPivot);
            });
        }

        // Axial tilt
        if (pData.axialTilt) {
            planetGroup.rotation.z = (pData.axialTilt * Math.PI) / 180 * 0.3;
        }

        systemGroup.add(orbitPivot);
        solarSystemObjects.push({ pivot: orbitPivot, group: planetGroup, data: pData });
    });

    // Asteroid belt (between Mars and Jupiter)
    const belt = createAsteroidBelt(25, 30, 3000);
    systemGroup.add(belt);

    // Kuiper belt (beyond Neptune)
    const kuiper = createAsteroidBelt(88, 110, 2000);
    systemGroup.add(kuiper);
}

/* ═══════════════════════════════════════════════════════════════
   GALAXY GENERATOR
   ═══════════════════════════════════════════════════════════════ */
function generateGalaxy(seed, particleCount = 25000, radius = 200) {
    const rng = new SeededRandom(seed);
    const group = new THREE.Group();
    const name = seed === 42 ? 'Milky Way' : generateGalaxyName(rng);
    const galaxyType = seed === 42 ? 'Spiral' : rng.pick(GALAXY_TYPES).type;

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const brightness = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
        let x, y, z;

        if (galaxyType === 'Spiral') {
            // Spiral arm structure
            const arm = rng.int(0, 3);
            const armAngle = (arm / 4) * Math.PI * 2;
            const dist = rng.range(0.1, 1.0);
            const spiralAngle = armAngle + dist * 3.0 + rng.gaussian(0, 0.3);
            const r = dist * radius;
            x = Math.cos(spiralAngle) * r + rng.gaussian(0, radius * 0.04);
            z = Math.sin(spiralAngle) * r + rng.gaussian(0, radius * 0.04);
            y = rng.gaussian(0, radius * 0.02 * (1 - dist * 0.5));
        } else if (galaxyType === 'Elliptical') {
            const r = rng.range(0, radius) * rng.range(0, 1);
            const theta = rng.range(0, Math.PI * 2);
            const phi = Math.acos(2 * rng.next() - 1);
            x = r * Math.sin(phi) * Math.cos(theta) * 1.2;
            y = r * Math.sin(phi) * Math.sin(theta) * 0.7;
            z = r * Math.cos(phi);
        } else {
            x = rng.gaussian(0, radius * 0.4);
            y = rng.gaussian(0, radius * 0.2);
            z = rng.gaussian(0, radius * 0.4);
        }

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        // Star color based on temperature distribution
        const spectral = rng.pick(SPECTRAL_TYPES);
        const c = new THREE.Color(spectral.color);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
        brightness[i] = 0.3 + rng.next() * 0.7;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('starColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('brightness', new THREE.BufferAttribute(brightness, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: { pointScale: { value: 60.0 } },
        vertexShader: GALAXY_PARTICLE_SHADER.vertexShader,
        fragmentShader: GALAXY_PARTICLE_SHADER.fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    group.add(points);

    // Galactic core glow
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffeecc, transparent: true, opacity: 0.06,
        blending: THREE.NormalBlending,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.08, 16, 16), coreMat);
    group.add(core);

    // Nebula dust patches
    for (let n = 0; n < 5; n++) {
        const nebMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(rng.range(0, 1), 0.6, 0.15),
            transparent: true, opacity: 0.04,
            blending: THREE.NormalBlending, side: THREE.DoubleSide,
        });
        const nebMesh = new THREE.Mesh(new THREE.SphereGeometry(radius * rng.range(0.1, 0.25), 8, 8), nebMat);
        nebMesh.position.set(rng.gaussian(0, radius * 0.3), rng.gaussian(0, radius * 0.05), rng.gaussian(0, radius * 0.3));
        group.add(nebMesh);
    }

    // Star system interaction points (clickable)
    const systemPoints = [];
    const solSystemSeed = seed === 42 ? 0 : -1; // Sol in Milky Way
    for (let s = 0; s < 60; s++) {
        const idx = Math.floor(rng.next() * particleCount);
        const px = positions[idx * 3];
        const py = positions[idx * 3 + 1];
        const pz = positions[idx * 3 + 2];

        const pointGeo = new THREE.SphereGeometry(radius * 0.02, 8, 8);
        const isSol = (s === 0 && seed === 42);
        const isInterstellar = (seed === 9999);
        const isGargantua = (s === 0 && isInterstellar);
        if (isInterstellar && s > 0) continue;

        const pointColor = isSol ? 0xffcc44 : isGargantua ? 0xffaa55 : new THREE.Color(colors[idx * 3], colors[idx * 3 + 1], colors[idx * 3 + 2]).getHex();
        const pointMat = new THREE.MeshBasicMaterial({
            color: pointColor, transparent: true, opacity: 0.7,
            blending: THREE.AdditiveBlending,
        });
        const point = new THREE.Mesh(pointGeo, pointMat);
        point.position.set(px, py, pz);

        const systemRng = new SeededRandom(seed * 1000 + s);
        const sName = isSol ? 'Sol' : isGargantua ? 'Gargantua System' : generateSystemName(systemRng);
        point.userData = {
            objectType: 'starsystem',
            name: sName,
            isSol,
            systemSeed: isGargantua ? 9999 : seed * 1000 + s,
            classification: isSol ? 'G2V Main Sequence' : isGargantua ? 'Black Hole System' : rng.pick(SPECTRAL_TYPES).type + '-type',
        };
        group.add(point);
        systemPoints.push(point);
    }

    group.userData = {
        objectType: 'galaxy', name, galaxyType, seed, systemPoints,
        classification: galaxyType + ' Galaxy',
        radiusKm: (radius * 500).toLocaleString() + ' ly',
    };

    return group;
}

/* ═══════════════════════════════════════════════════════════════
   UNIVERSE GENERATOR
   ═══════════════════════════════════════════════════════════════ */
function generateUniverse(seed, galaxyCount = 80) {
    if (seed === 9999) galaxyCount = 1;
    const rng = new SeededRandom(seed);
    const group = new THREE.Group();
    const name = seed === 1 ? 'Observable Universe' : seed === 9999 ? 'Interstellar Universe' : generateUniverseName(rng);

    const galaxyPoints = [];

    for (let i = 0; i < galaxyCount; i++) {
        const isMilkyWay = (i === 0 && seed === 1);
        const isInterstellar = (i === 0 && seed === 9999);
        const gSeed = isMilkyWay ? 42 : isInterstellar ? 9999 : Math.floor(rng.next() * 999999);
        const r = rng.range(20, 400);
        const theta = rng.range(0, Math.PI * 2);
        const phi = Math.acos(2 * rng.next() - 1);
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta) * 0.6;
        const z = r * Math.cos(phi);

        // Galaxy representation at universe scale (small glowing blob)
        const gType = rng.pick(GALAXY_TYPES);
        const gColor = new THREE.Color().setHSL(rng.range(0, 0.15), 0.3, 0.5 + rng.range(0, 0.3));
        if (isMilkyWay) gColor.set(0xffeedd);
        if (isInterstellar) gColor.set(0xffaa55);

        const blobMat = new THREE.MeshBasicMaterial({
            color: gColor, transparent: true, opacity: 0.25,
            blending: THREE.AdditiveBlending,
        });
        const blobSize = isMilkyWay ? 6 : isInterstellar ? 8 : 2 + rng.range(0, 5);
        const blob = new THREE.Mesh(new THREE.SphereGeometry(blobSize, 12, 12), blobMat);
        blob.position.set(x, y, z);

        const gName = isMilkyWay ? 'Milky Way' : isInterstellar ? 'Gargantua Galaxy' : generateGalaxyName(rng);
        blob.userData = {
            objectType: 'galaxypoint', name: gName,
            galaxySeed: gSeed, galaxyType: gType.type, isMilkyWay,
            classification: isInterstellar ? 'Active Galactic Nucleus' : gType.type + ' Galaxy',
        };

        group.add(blob);
        galaxyPoints.push(blob);

        // Faint halo
        const haloMat = new THREE.MeshBasicMaterial({
            color: gColor, transparent: true, opacity: 0.03,
            blending: THREE.AdditiveBlending, side: THREE.BackSide,
        });
        const halo = new THREE.Mesh(new THREE.SphereGeometry(blobSize * 2.5, 8, 8), haloMat);
        halo.position.copy(blob.position);
        group.add(halo);
    }

    // Cosmic web filaments
    for (let f = 0; f < 20; f++) {
        const points = [];
        let p = new THREE.Vector3(rng.gaussian(0, 200), rng.gaussian(0, 100), rng.gaussian(0, 200));
        for (let s = 0; s < 10; s++) {
            points.push(p.clone());
            p = p.clone().add(new THREE.Vector3(rng.gaussian(0, 40), rng.gaussian(0, 20), rng.gaussian(0, 40)));
        }
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.5, 4, false);
        const tubeMat = new THREE.MeshBasicMaterial({
            color: 0x223355, transparent: true, opacity: 0.04,
            blending: THREE.AdditiveBlending,
        });
        group.add(new THREE.Mesh(tubeGeo, tubeMat));
    }

    group.userData = { objectType: 'universe', name, seed, galaxyPoints };
    return group;
}

/* ═══════════════════════════════════════════════════════════════
   MULTIVERSE GENERATOR
   ═══════════════════════════════════════════════════════════════ */
function generateMultiverse() {
    const rng = new SeededRandom(777);
    const group = multiverseGroup;

    const universeCount = 24;
    const universeBubbles = [];

    for (let i = 0; i < universeCount; i++) {
        const isOurs = (i === 0);
        const r = isOurs ? 0 : 30 + rng.range(0, 200);
        const theta = rng.range(0, Math.PI * 2);
        const phi = Math.acos(2 * rng.next() - 1);
        const x = isOurs ? 0 : r * Math.sin(phi) * Math.cos(theta);
        const y = isOurs ? 0 : r * Math.sin(phi) * Math.sin(theta);
        const z = isOurs ? 0 : r * Math.cos(phi);

        const bubbleSize = isOurs ? 18 : 8 + rng.range(0, 14);
        const hue = isOurs ? 0.6 : (i === 23 ? 0.08 : rng.range(0, 1));
        const bubbleColor = new THREE.Color().setHSL(hue, 0.5, 0.3);

        // Bubble shell
        const shellMat = new THREE.MeshBasicMaterial({
            color: bubbleColor, transparent: true, opacity: 0.06,
            blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        });
        const shell = new THREE.Mesh(new THREE.SphereGeometry(bubbleSize, 32, 32), shellMat);
        shell.position.set(x, y, z);

        // Inner glow
        const innerMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(hue, 0.7, 0.5),
            transparent: true, opacity: 0.03, blending: THREE.AdditiveBlending,
        });
        const inner = new THREE.Mesh(new THREE.SphereGeometry(bubbleSize * 0.6, 16, 16), innerMat);
        inner.position.copy(shell.position);

        // Sparkles inside
        const sparkGeo = new THREE.BufferGeometry();
        const sparkCount = 200;
        const sparkPos = new Float32Array(sparkCount * 3);
        for (let s = 0; s < sparkCount; s++) {
            const sr = rng.range(0, bubbleSize * 0.85);
            const st = rng.range(0, Math.PI * 2);
            const sp = Math.acos(2 * rng.next() - 1);
            sparkPos[s * 3] = x + sr * Math.sin(sp) * Math.cos(st);
            sparkPos[s * 3 + 1] = y + sr * Math.sin(sp) * Math.sin(st);
            sparkPos[s * 3 + 2] = z + sr * Math.cos(sp);
        }
        sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
        const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
            color: new THREE.Color().setHSL(hue, 0.8, 0.7),
            size: 0.4, transparent: true, opacity: 0.25,
            blending: THREE.AdditiveBlending, sizeAttenuation: true,
        }));

        const uSeed = isOurs ? 1 : (i === 23 ? 9999 : rng.int(2, 999998));
        const uRng = new SeededRandom(uSeed);
        const uName = isOurs ? 'Our Universe' : (i === 23 ? 'Interstellar Universe' : generateUniverseName(uRng));
        shell.userData = {
            objectType: 'universebubble',
            name: uName,
            universeSeed: uSeed,
            isOurs,
            classification: 'Universe',
        };

        group.add(shell);
        group.add(inner);
        group.add(sparks);
        universeBubbles.push(shell);
    }

    group.userData = { universeBubbles };
}

/* ═══════════════════════════════════════════════════════════════
   PROCEDURAL STAR SYSTEM GENERATOR
   ═══════════════════════════════════════════════════════════════ */
function generateStarSystem(seed) {
    const rng = new SeededRandom(seed);
    while (systemGroup.children.length) systemGroup.remove(systemGroup.children[0]);
    solarSystemObjects.length = 0;

    // Generate star
    const spectral = rng.pick(SPECTRAL_TYPES);
    const starName = generateStarName(rng);
    const starData = {
        name: starName,
        type: 'STAR',
        spectralClass: spectral.type + '-type',
        color: spectral.color,
        renderRadius: 1.5 + spectral.radius * 1.5,
        luminosity: spectral.luminosity,
        tempK: spectral.temp,
        tempDisplay: spectral.temp.toLocaleString() + ' K',
        massKg: (spectral.radius * 2).toFixed(1) + ' M☉',
        radiusKm: (spectral.radius * 696340).toLocaleString() + ' km',
        age: rng.range(0.1, 12).toFixed(1) + ' Gyr',
    };
    const starGroup = createStar(starData);
    systemGroup.add(starGroup);
    allShaderMaterials.push(starGroup.userData.material);
    
    // Dynamic Bloom based on Star Luminosity/Mass
    if (bloom) {
        // M-class (weak red) ~ 0.4. O-class (hyper blue) ~ 0.9. High threshold prevents planets from catching it.
        bloom.strength = 0.35 + (spectral.luminosity * 0.55);
        bloom.threshold = 0.85;
    }

    // Possibly add exotic objects
    if (rng.chance(0.05)) {
        const bh = createBlackHole(1.5);
        bh.position.set(rng.range(-30, 30), rng.range(-5, 5), rng.range(-30, 30));
        systemGroup.add(bh);
        allShaderMaterials.push(bh.userData.material);
    }

    // Generate 1-8 planets
    const planetCount = rng.int(1, 8);
    for (let p = 0; p < planetCount; p++) {
        const dist = 6 + p * rng.range(4, 10);
        const pName = generatePlanetName(rng, starName, p);
        const isGasGiant = rng.chance(0.3);
        const isIceGiant = !isGasGiant && rng.chance(0.15);

        const radius = isGasGiant ? rng.range(0.8, 1.8) :
            isIceGiant ? rng.range(0.5, 0.9) :
            rng.range(0.15, 0.6);

        // Temperature based on distance and star luminosity
        const tempK = Math.round(spectral.temp * Math.sqrt(spectral.radius / (2 * dist)) * 0.7);
        const hasAtmo = isGasGiant || isIceGiant || rng.chance(0.5);
        const moonCount = isGasGiant ? rng.int(2, 20) : isIceGiant ? rng.int(1, 8) : rng.int(0, 2);

        let shaderType, shaderParams;
        if (isGasGiant) {
            shaderType = rng.chance(0.5) ? 'jupiter' : 'saturn';
            shaderParams = {};
        } else if (isIceGiant) {
            shaderType = 'iceGiant';
            shaderParams = {
                baseColor: [rng.range(0.1, 0.6), rng.range(0.3, 0.8), rng.range(0.5, 0.9)],
                bandIntensity: rng.range(0.1, 0.3),
            };
        } else {
            const types = ['rocky', 'mars', 'venus'];
            shaderType = rng.pick(types);
            shaderParams = shaderType === 'rocky' ? {
                baseColor: [rng.range(0.2, 0.8), rng.range(0.2, 0.7), rng.range(0.2, 0.6)],
                craterDensity: rng.range(0.2, 0.9),
            } : {};
        }

        const pData = {
            name: pName,
            type: 'PLANET',
            classification: isGasGiant ? 'Gas Giant' : isIceGiant ? 'Ice Giant' : 'Terrestrial',
            radiusKm: Math.round(radius * 6371).toLocaleString() + ' km',
            radiusEarth: radius,
            tempK,
            tempDisplay: Math.round(tempK - 273) + ' °C',
            distAU: (dist / 16).toFixed(2),
            moons: moonCount,
            atmosphere: hasAtmo ? (isGasGiant ? 'H₂/He' : 'N₂/CO₂ Mix') : 'None',
            renderDist: dist,
            renderRadius: radius,
            shaderType,
            shaderParams: shaderParams || {},
            hasRings: isGasGiant && rng.chance(0.4),
        };

        const planetGroup = createPlanet(pData, sunDirection);
        allShaderMaterials.push(planetGroup.userData.material);
        if (planetGroup.userData.atmosMaterial) allShaderMaterials.push(planetGroup.userData.atmosMaterial);
        if (planetGroup.userData.ringMaterial) allShaderMaterials.push(planetGroup.userData.ringMaterial);

        const orbitPivot = new THREE.Group();
        orbitPivot.userData = { orbitSpeed: 0.15 / Math.sqrt(dist), orbitRadius: dist };
        planetGroup.position.x = dist;
        orbitPivot.add(planetGroup);

        // Orbit line
        const orbitCurve = new THREE.EllipseCurve(0, 0, dist, dist, 0, Math.PI * 2);
        const orbitPoints = orbitCurve.getPoints(128);
        const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints.map(pt => new THREE.Vector3(pt.x, 0, pt.y)));
        systemGroup.add(new THREE.Line(orbitGeo, new THREE.LineBasicMaterial({
            color: 0x334466, transparent: true, opacity: 0.15,
        })));

        systemGroup.add(orbitPivot);
        solarSystemObjects.push({ pivot: orbitPivot, group: planetGroup, data: pData });
    }
}

/* ═══════════════════════════════════════════════════════════════
   INTERSTELLAR SYSTEM BUILDER
   ═══════════════════════════════════════════════════════════════ */
function buildInterstellarSystem() {
    while (systemGroup.children.length) systemGroup.remove(systemGroup.children[0]);
    solarSystemObjects.length = 0;

    sunGroup = createGargantua(INTERSTELLAR_SYSTEM.star.renderRadius);
    systemGroup.add(sunGroup);
    allShaderMaterials.push(sunGroup.userData.material);

    // Deep heavy bloom for Black Hole accretion disk exposure limits
    if (bloom) bloom.strength = 1.0;

    INTERSTELLAR_SYSTEM.planets.forEach((pData) => {
        const planetGroup = createPlanet(pData, sunDirection);
        allShaderMaterials.push(planetGroup.userData.material);
        if (planetGroup.userData.atmosMaterial) allShaderMaterials.push(planetGroup.userData.atmosMaterial);

        const orbitPivot = new THREE.Group();
        const baseSpeed = 0.2 / (pData.distAU || 1);
        orbitPivot.userData = { orbitSpeed: Math.min(baseSpeed, 0.3), orbitRadius: pData.renderDist };
        planetGroup.position.x = pData.renderDist;
        orbitPivot.add(planetGroup);

        const orbitCurve = new THREE.EllipseCurve(0, 0, pData.renderDist, pData.renderDist, 0, Math.PI * 2, false, 0);
        const orbitPoints = orbitCurve.getPoints(128);
        const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints.map(p => new THREE.Vector3(p.x, 0, p.y)));
        const orbitLine = new THREE.Line(orbitGeo, new THREE.LineBasicMaterial({
            color: 0xaa5533, transparent: true, opacity: 0.3,
        }));
        systemGroup.add(orbitLine);

        systemGroup.add(orbitPivot);
        solarSystemObjects.push({ pivot: orbitPivot, group: planetGroup, data: pData });
    });
}

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION SYSTEM
   ═══════════════════════════════════════════════════════════════ */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isTransitioning = false;
const zoomOverlay = document.getElementById('zoom-overlay');

function getClickableObjects() {
    switch (currentScale) {
        case SCALES.MULTIVERSE:
            return multiverseGroup.userData.universeBubbles || [];
        case SCALES.UNIVERSE:
            return (universeGroup.children[0]?.userData?.galaxyPoints) || [];
        case SCALES.GALAXY:
            return (galaxyGroup.children[0]?.userData?.systemPoints) || [];
        case SCALES.SYSTEM:
            return solarSystemObjects.map(o => o.group.userData.mainMesh).filter(Boolean);
        default:
            return [];
    }
}

function navigateInto(object) {
    if (isTransitioning) return;
    const data = object.userData;

    isTransitioning = true;
    zoomOverlay.classList.remove('hidden');
    zoomOverlay.classList.add('active');

    setTimeout(() => {
        switch (data.objectType) {
            case 'universebubble':
                enterUniverse(data);
                break;
            case 'galaxypoint':
                enterGalaxy(data);
                break;
            case 'starsystem':
                enterSystem(data);
                break;
            case 'planet':
                enterPlanet(data);
                break;
        }
        setTimeout(() => {
            zoomOverlay.classList.remove('active');
            setTimeout(() => zoomOverlay.classList.add('hidden'), 600);
            isTransitioning = false;
        }, 300);
    }, 600);
}

function enterUniverse(data) {
    currentScale = SCALES.UNIVERSE;
    scaleHistory.push({ scale: SCALES.MULTIVERSE, name: 'Multiverse', data: {} });

    multiverseGroup.visible = false;
    universeGroup.visible = true;
    galaxyGroup.visible = false;
    systemGroup.visible = false;

    // Generate universe
    while (universeGroup.children.length) universeGroup.remove(universeGroup.children[0]);
    const universe = generateUniverse(data.universeSeed);
    universeGroup.add(universe);

    // Store seed for back navigation
    universeGroup.userData.universeSeed = data.universeSeed;

    camera.position.set(0, 200, 500);
    controls.target.set(0, 0, 0);
    updateBreadcrumb();
    updateScaleDisplay();
}

function enterGalaxy(data) {
    currentScale = SCALES.GALAXY;
    scaleHistory.push({
        scale: SCALES.UNIVERSE,
        name: universeGroup.children[0]?.userData?.name || 'Universe',
        data: { universeSeed: universeGroup.userData?.universeSeed || 1 }
    });

    multiverseGroup.visible = false;
    universeGroup.visible = false;
    galaxyGroup.visible = true;
    systemGroup.visible = false;

    while (galaxyGroup.children.length) galaxyGroup.remove(galaxyGroup.children[0]);
    const galaxy = generateGalaxy(data.galaxySeed);
    galaxyGroup.add(galaxy);

    camera.position.set(0, 100, 250);
    controls.target.set(0, 0, 0);
    updateBreadcrumb();
    updateScaleDisplay();
}

function enterSystem(data) {
    currentScale = SCALES.SYSTEM;
    const galaxyData = galaxyGroup.children[0]?.userData;
    scaleHistory.push({
        scale: SCALES.GALAXY,
        name: galaxyData?.name || 'Galaxy',
        data: { galaxySeed: galaxyData?.seed || 42 }
    });

    multiverseGroup.visible = false;
    universeGroup.visible = false;
    galaxyGroup.visible = false;
    systemGroup.visible = true;

    if (data.isSol) {
        buildSolarSystem();
    } else if (data.systemSeed === 9999) {
        buildInterstellarSystem();
    } else {
        generateStarSystem(data.systemSeed);
    }

    camera.position.set(0, 40, 80);
    controls.target.set(0, 0, 0);
    updateBreadcrumb();
    updateScaleDisplay();
}

function enterPlanet(data) {
    currentScale = SCALES.PLANET;
    const systemData = systemGroup.children.find(c => c.userData?.name === 'The Sun' || c.userData?.objectType === 'star') || { userData: { name: 'System' } };
    
    scaleHistory.push({
        scale: SCALES.SYSTEM,
        name: systemData.userData?.name || 'System',
        data: {}
    });

    multiverseGroup.visible = false;
    universeGroup.visible = false;
    galaxyGroup.visible = false;
    systemGroup.visible = false;
    planetGroup.visible = true;

    while (planetGroup.children.length) planetGroup.remove(planetGroup.children[0]);
    const surface = createPlanetSurface(data);
    planetGroup.add(surface);

    // Adjust camera near/far for planetary surface scale
    // Near must be > 0 but large enough for good depth precision at this scale
    camera.near = 1;
    camera.far = 80000;
    camera.updateProjectionMatrix();

    // Diverge camera placement based on planet type
    // Rocky/Water worlds: Orbit from exterior (R=6000).
    // Gas/Ice giants: View from interior of the cloud dome (Y=120).
    const shType = data.shaderType || '';
    const isGas = shType === 'jupiter' || shType === 'saturn' || shType === 'iceGiant';
    
    if (isGas) {
        // Interior gas giant view — camera inside the nested cloud dome spheres
        camera.position.set(0, 120, 400);
        controls.target.set(0, 120, 0);
    } else {
        // Exterior sphere exploration view (above North Pole)
        camera.position.set(0, 6800, 1500);
        controls.target.set(0, 6000, 0);
    }

    controls.minDistance = 5;
    controls.maxDistance = 15000;
    controls.update();

    updateBreadcrumb();
    updateScaleDisplay();
}

function navigateBack() {
    if (isTransitioning || scaleHistory.length === 0) return;

    isTransitioning = true;
    zoomOverlay.classList.remove('hidden');
    zoomOverlay.classList.add('active');

    setTimeout(() => {
        const prev = scaleHistory.pop();
        currentScale = prev.scale;

        multiverseGroup.visible = currentScale === SCALES.MULTIVERSE;
        universeGroup.visible = currentScale === SCALES.UNIVERSE;
        galaxyGroup.visible = currentScale === SCALES.GALAXY;
        systemGroup.visible = currentScale === SCALES.SYSTEM;
        planetGroup.visible = currentScale === SCALES.PLANET;

        // Regenerate if needed
        if (currentScale === SCALES.UNIVERSE && prev.data?.universeSeed) {
            while (universeGroup.children.length) universeGroup.remove(universeGroup.children[0]);
            universeGroup.add(generateUniverse(prev.data.universeSeed));
        }
        if (currentScale === SCALES.GALAXY && prev.data?.galaxySeed) {
            while (galaxyGroup.children.length) galaxyGroup.remove(galaxyGroup.children[0]);
            galaxyGroup.add(generateGalaxy(prev.data.galaxySeed));
        }

        // Reset camera for each scale
        switch (currentScale) {
            case SCALES.MULTIVERSE:
                camera.position.set(0, 80, 150); break;
            case SCALES.UNIVERSE:
                camera.position.set(0, 200, 500); break;
            case SCALES.GALAXY:
                camera.position.set(0, 100, 250); break;
            case SCALES.SYSTEM:
                camera.position.set(0, 40, 80); break;
            case SCALES.PLANET:
                camera.position.set(0, 120, 350); break;
        }
        // Restore camera clip planes for non-planet scales
        if (currentScale !== SCALES.PLANET) {
            camera.near = 0.01;
            camera.far = 50000;
            camera.updateProjectionMatrix();
            controls.minDistance = 0.1;
            controls.maxDistance = 10000;
        }
        controls.target.set(0, 0, 0);

        selectedObject = null;
        hideInfoPanel();
        hideLifePanel();

        updateBreadcrumb();
        updateScaleDisplay();

        setTimeout(() => {
            zoomOverlay.classList.remove('active');
            setTimeout(() => zoomOverlay.classList.add('hidden'), 600);
            isTransitioning = false;
        }, 300);
    }, 600);
}

/* ═══════════════════════════════════════════════════════════════
   UI MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */
const breadcrumbEl = document.getElementById('breadcrumb');
const scaleValueEl = document.getElementById('scale-value');
const infoPanelEl = document.getElementById('info-panel');
const infoTitleEl = document.getElementById('info-title');
const enterObjectBtn = document.getElementById('enter-object-btn');
const lifePanelEl = document.getElementById('life-panel');
const labelContainer = document.getElementById('label-container');

const infoFields = {
    type: document.getElementById('info-type'),
    class: document.getElementById('info-class'),
    mass: document.getElementById('info-mass'),
    radius: document.getElementById('info-radius'),
    temp: document.getElementById('info-temp'),
    dist: document.getElementById('info-dist'),
    moons: document.getElementById('info-moons'),
};

const lifeFields = {
    atmo: document.getElementById('life-atmo'),
    water: document.getElementById('life-water'),
    temp: document.getElementById('life-temp'),
    bio: document.getElementById('life-bio'),
    civ: document.getElementById('life-civ'),
    pop: document.getElementById('life-pop'),
    tech: document.getElementById('life-tech'),
};

function updateBreadcrumb() {
    const crumbs = [{ name: 'MULTIVERSE', scale: SCALES.MULTIVERSE }];
    scaleHistory.forEach(h => crumbs.push({ name: h.name.toUpperCase(), scale: h.scale }));

    const currentName = currentScale === SCALES.MULTIVERSE ? null :
        currentScale === SCALES.UNIVERSE ? (universeGroup.children[0]?.userData?.name || 'Universe') :
        currentScale === SCALES.GALAXY ? (galaxyGroup.children[0]?.userData?.name || 'Galaxy') :
        currentScale === SCALES.PLANET ? (planetGroup.children[0]?.userData?.name || 'Planet Surface') :
        'System';
    if (currentName) crumbs.push({ name: currentName.toUpperCase(), scale: currentScale, active: true });

    breadcrumbEl.innerHTML = crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        const sep = i > 0 ? '<span class="crumb-sep">›</span>' : '';
        return `${sep}<span class="crumb ${isLast ? 'active' : ''}" data-index="${i}">${c.name}</span>`;
    }).join('');

    // Click handlers for breadcrumbs
    breadcrumbEl.querySelectorAll('.crumb').forEach((el, i) => {
        el.addEventListener('click', () => {
            const stepsBack = (crumbs.length - 1) - i;
            for (let s = 0; s < stepsBack; s++) navigateBack();
        });
    });
}

function updateScaleDisplay() {
    const labels = {
        [SCALES.MULTIVERSE]: '∞ MULTIVERSE',
        [SCALES.UNIVERSE]: '~ 93 Gly',
        [SCALES.GALAXY]: '~ 100,000 ly',
        [SCALES.SYSTEM]: '~ 100 AU',
        [SCALES.PLANET]: '~ 12,742 km',
    };
    scaleValueEl.textContent = labels[currentScale] || '—';
}

function showInfoPanel(data) {
    infoTitleEl.textContent = data.name || '—';
    infoFields.type.textContent = data.type || data.objectType || '—';
    infoFields.class.textContent = data.classification || data.spectralClass || '—';
    infoFields.mass.textContent = data.massKg || data.massEarth ? (data.massEarth + ' M⊕') : '—';
    infoFields.radius.textContent = data.radiusKm || '—';
    infoFields.temp.textContent = data.tempDisplay || '—';
    infoFields.dist.textContent = data.distAU ? data.distAU + ' AU' : data.radiusKm || '—';
    infoFields.moons.textContent = data.moons !== undefined ? data.moons + ' detected' : '—';

    // Show enter button for navigable objects
    const canEnter = ['universebubble', 'galaxypoint', 'starsystem', 'planet'].includes(data.objectType);
    enterObjectBtn.classList.toggle('hidden', !canEnter);
    enterObjectBtn.onclick = canEnter ? () => navigateInto(selectedObject) : null;

    infoPanelEl.classList.remove('hidden');
}

function hideInfoPanel() {
    infoPanelEl.classList.add('hidden');
}

function showLifePanel(data) {
    const rng = new SeededRandom(SeededRandom.hashString(data.name || 'x'));
    const life = LifeSimulator.analyze(data, rng);

    document.getElementById('hab-pct').textContent = life.habitability;
    const circle = document.getElementById('hab-circle');
    const circumference = 2 * Math.PI * 42;
    circle.style.strokeDashoffset = circumference * (1 - life.habitability / 100);

    // Color based on habitability
    const hue = life.habitability > 60 ? 140 : life.habitability > 30 ? 60 : 0;
    circle.style.stroke = `hsl(${hue}, 80%, 50%)`;

    lifeFields.atmo.textContent = life.atmosphere;
    lifeFields.water.textContent = life.waterCoverage;
    lifeFields.temp.textContent = life.temperature;
    lifeFields.bio.textContent = life.biosphere;
    lifeFields.civ.textContent = life.habitability > 85 ? 'Present' : 'None detected';
    lifeFields.pop.textContent = life.population;
    lifeFields.tech.textContent = life.techLevel;

    lifePanelEl.classList.remove('hidden');
}

function hideLifePanel() {
    lifePanelEl.classList.add('hidden');
}

/* ═══════════════════════════════════════════════════════════════
   FLOATING LABELS
   ═══════════════════════════════════════════════════════════════ */
const labelPool = [];
function updateLabels() {
    // Clear old labels
    labelPool.forEach(l => l.style.display = 'none');

    let items = [];
    if (currentScale === SCALES.MULTIVERSE && multiverseGroup.userData?.universeBubbles) {
        items = multiverseGroup.userData.universeBubbles.map(u => ({
            name: u.userData.name,
            position: new THREE.Vector3().setFromMatrixPosition(u.matrixWorld)
        }));
    } else if (currentScale === SCALES.UNIVERSE && universeGroup.children[0]?.userData?.galaxyPoints) {
        items = universeGroup.children[0].userData.galaxyPoints.map(g => ({
            name: g.userData.name,
            position: new THREE.Vector3().setFromMatrixPosition(g.matrixWorld)
        }));
    } else if (currentScale === SCALES.GALAXY && galaxyGroup.children[0]?.userData?.systemPoints) {
        items = galaxyGroup.children[0].userData.systemPoints.map(s => ({
            name: s.userData.name,
            position: new THREE.Vector3().setFromMatrixPosition(s.matrixWorld)
        }));
    } else if (currentScale === SCALES.SYSTEM) {
        items = solarSystemObjects.map(o => ({
            name: o.group.userData.name || o.data?.name || 'Planet',
            position: new THREE.Vector3().setFromMatrixPosition(o.group.matrixWorld)
        }));
        
        // Find the central star/blackhole dynamically instead of hardcoding Solar System reference
        const star = systemGroup.children.find(c => c.userData && (c.userData.objectType === 'star' || c.userData.objectType === 'blackhole' || c.userData.objectType === 'neutronstar'));
        if (star) {
            items.unshift({ 
                name: star.userData.name || 'System Primary', 
                position: new THREE.Vector3().setFromMatrixPosition(star.matrixWorld) 
            });
        }
    }

    items.forEach((item, i) => {
        const screenPos = item.position.clone().project(camera);
        if (screenPos.z > 1.0) return; // Behind camera

        const x = (screenPos.x * 0.5 + 0.5) * innerWidth;
        const y = (-(screenPos.y * 0.5) + 0.5) * innerHeight;

        if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) return;

        let label = labelPool[i];
        if (!label) {
            label = document.createElement('div');
            label.className = 'object-label';
            labelContainer.appendChild(label);
            labelPool.push(label);
        }

        label.textContent = item.name.toUpperCase();
        label.style.left = x + 'px';
        label.style.top = (y + 15) + 'px';
        label.style.display = 'block';
    });
}

/* ═══════════════════════════════════════════════════════════════
   EVENT HANDLERS
   ═══════════════════════════════════════════════════════════════ */
// Intro
document.getElementById('enter-btn').addEventListener('click', () => {
    const overlay = document.getElementById('intro-overlay');
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.display = 'none';
        document.querySelectorAll('.ui-element').forEach(el => el.classList.remove('hidden'));
    }, 1200);
    initScene();
});

function initScene() {
    generateMultiverse();
    currentScale = SCALES.MULTIVERSE;
    multiverseGroup.visible = true;
    universeGroup.visible = false;
    galaxyGroup.visible = false;
    systemGroup.visible = false;
    hideInfoPanel();
    hideLifePanel();
    updateBreadcrumb();
    updateScaleDisplay();
    document.getElementById('stat-location').textContent = 'MULTIVERSE VIEW';
}

// Click to select
renderer.domElement.addEventListener('click', (event) => {
    if (isTransitioning) return;

    mouse.x = (event.clientX / innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const clickables = getClickableObjects();
    const intersects = raycaster.intersectObjects(clickables, true);

    if (intersects.length > 0) {
        let hit = intersects[0].object;
        // Walk up to find userData
        while (hit && !hit.userData?.objectType && hit.parent) hit = hit.parent;

        if (hit?.userData?.objectType) {
            selectedObject = hit;
            showInfoPanel(hit.userData);

            // Show life panel for planets
            if (hit.userData.objectType === 'planet') {
                showLifePanel(hit.userData);
            } else {
                hideLifePanel();
            }
        }
    } else {
        selectedObject = null;
        hideInfoPanel();
        hideLifePanel();
    }
});

// Double-click to enter
renderer.domElement.addEventListener('dblclick', (event) => {
    if (isTransitioning || !selectedObject) return;
    const data = selectedObject.userData;
    if (['universebubble', 'galaxypoint', 'starsystem', 'planet'].includes(data.objectType)) {
        navigateInto(selectedObject);
    }
});

// ESC to go back
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') navigateBack();
});

// Resize
addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
});

/* ═══════════════════════════════════════════════════════════════
   ANIMATION LOOP
   ═══════════════════════════════════════════════════════════════ */
const clock = new THREE.Clock();

function animate() {
    const delta = Math.min(clock.getDelta(), 0.1);
    globalTime += delta;

    // Update all shader uniforms
    allShaderMaterials.forEach(mat => {
        if (mat.uniforms?.time) mat.uniforms.time.value = globalTime;
    });

    if (currentScale === SCALES.PLANET && planetGroup.visible && planetGroup.children[0]) {
        const pSurface = planetGroup.children[0];
        if (pSurface.userData.terrainMat && pSurface.userData.terrainMat.uniforms.time) pSurface.userData.terrainMat.uniforms.time.value = globalTime;
        if (pSurface.userData.waterMat && pSurface.userData.waterMat.uniforms.time) pSurface.userData.waterMat.uniforms.time.value = globalTime;
        if (pSurface.userData.skyMat && pSurface.userData.skyMat.uniforms.time) pSurface.userData.skyMat.uniforms.time.value = globalTime;
        if (pSurface.userData.cloudMat && pSurface.userData.cloudMat.uniforms.time) pSurface.userData.cloudMat.uniforms.time.value = globalTime;
        if (pSurface.userData.cloudMats) {
            pSurface.userData.cloudMats.forEach((mat, i) => {
                if (mat.uniforms && mat.uniforms.time) {
                    mat.uniforms.time.value = globalTime + i * 100.0;
                }
            });
        }
    }

    // Rotate planets in system view
    if (currentScale === SCALES.SYSTEM && systemGroup.visible) {
        solarSystemObjects.forEach(obj => {
            // Orbit rotation
            const speed = obj.pivot.userData.orbitSpeed || 0.01;
            obj.pivot.rotation.y += speed * delta;

            // Planet self-rotation
            const mainMesh = obj.group.userData.mainMesh;
            if (mainMesh) mainMesh.rotation.y += 0.2 * delta;

            // Moon rotations
            obj.group.children.forEach(child => {
                if (child.isGroup && child.userData.orbitSpeed) {
                    child.rotation.y += child.userData.orbitSpeed * delta;
                }
            });
        });

        // Update sun direction for lighting
        // (sun is at origin, direction from planet to sun)
        solarSystemObjects.forEach(obj => {
            const wp = new THREE.Vector3();
            obj.group.getWorldPosition(wp);
            const dir = wp.negate().normalize();
            const mat = obj.group.userData.material;
            if (mat?.uniforms?.sunDir) mat.uniforms.sunDir.value.copy(dir);
            if (obj.group.userData.atmosMaterial?.uniforms?.sunDir) {
                obj.group.userData.atmosMaterial.uniforms.sunDir.value.copy(dir);
            }
        });
    }

    updateLabels();

    // Slow rotation for multiverse bubbles
    if (currentScale === SCALES.MULTIVERSE) {
        multiverseGroup.rotation.y += 0.01 * delta;
    }

    // Galaxy rotation
    if (currentScale === SCALES.GALAXY && galaxyGroup.children[0]) {
        galaxyGroup.children[0].rotation.y += 0.005 * delta;
    }

    // Stats
    const statLoc = document.getElementById('stat-location');
    const statObj = document.getElementById('stat-objects');
    if (statLoc) {
        const scaleLabels = {
            [SCALES.MULTIVERSE]: 'MULTIVERSE VIEW',
            [SCALES.UNIVERSE]: 'UNIVERSE VIEW',
            [SCALES.GALAXY]: 'GALAXY VIEW',
            [SCALES.SYSTEM]: 'SYSTEM VIEW',
            [SCALES.PLANET]: 'SURFACE EXPLORATION',
        };
        statLoc.textContent = scaleLabels[currentScale] || '—';
    }
    if (statObj) {
        const planetName = planetGroup.children[0]?.userData?.name;
        const counts = {
            [SCALES.MULTIVERSE]: (multiverseGroup.userData.universeBubbles?.length || 0) + ' universes',
            [SCALES.UNIVERSE]: (universeGroup.children[0]?.userData?.galaxyPoints?.length || 0) + ' galaxies',
            [SCALES.GALAXY]: (galaxyGroup.children[0]?.userData?.systemPoints?.length || 0) + ' star systems',
            [SCALES.SYSTEM]: solarSystemObjects.length + ' bodies',
            [SCALES.PLANET]: planetName ? planetName : 'Planet Surface',
        };
        statObj.textContent = counts[currentScale] || '0 objects';
    }

    // ── Audio Engine ──
    if (spaceAudio.initialized) {
        if (currentScale === SCALES.SYSTEM || currentScale === SCALES.GALAXY) {
            spaceAudio.setSpaceDrone(0.8);
            // Check proximity to any black hole in system
            if (sunGroup && sunGroup.userData?.objectType === 'blackhole') {
                const bhPos = new THREE.Vector3();
                sunGroup.getWorldPosition(bhPos);
                const dist = camera.position.distanceTo(bhPos);
                spaceAudio.setBlackHoleProximity(dist, 100);
            }
        } else if (currentScale === SCALES.PLANET) {
            spaceAudio.fadeOut();
        } else {
            spaceAudio.setSpaceDrone(0.3);
        }
    }

    controls.update();
    composer.render();
    
    updateLabels();

    requestAnimationFrame(animate);
}

// Initialize audio on first user interaction (browser policy)
document.addEventListener('click', () => {
    spaceAudio.init();
}, { once: true });

const spaceAudio = new SpaceAudioEngine();

animate();
