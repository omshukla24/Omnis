/* ═══════════════════════════════════════════════════════════════
   OMNIS — Celestial Body Factory
   Creates Three.js meshes for all celestial object types
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import {
    EARTH_SHADER, MARS_SHADER, JUPITER_SHADER, SATURN_SHADER,
    VENUS_SHADER, ROCKY_SHADER, ICE_GIANT_SHADER, STAR_SHADER,
    ATMOSPHERE_SHADER, RING_SHADER, ACCRETION_SHADER, NEUTRON_SHADER,
    TERRAIN_SHADER, WATER_SHADER, SKY_SHADER, WATER_WORLD_SHADER, ICE_WORLD_SHADER,
    GIANT_WAVE_SHADER, CLOUD_DOME_SHADER, PLANETARY_CLOUD_SHADER
} from './shaders.js';

const SPHERE_HI = new THREE.SphereGeometry(1, 64, 64);
const SPHERE_MED = new THREE.SphereGeometry(1, 32, 32);
const SPHERE_LO = new THREE.SphereGeometry(1, 16, 16);

function cloneUniforms(src) {
    const out = {};
    for (const key in src) {
        if (src[key].value && src[key].value.clone) {
            out[key] = { value: src[key].value.clone() };
        } else {
            out[key] = { value: src[key].value };
        }
    }
    return out;
}

/* ═══ CREATE PLANET MESH ═══ */
export function createPlanet(data, sunDir) {
    const group = new THREE.Group();
    group.userData = { ...data, objectType: 'planet' };

    let material;
    const uSunDir = sunDir || new THREE.Vector3(1, 0.3, 0);

    switch (data.shaderType) {
        case 'earth':
            material = new THREE.ShaderMaterial({
                uniforms: { ...cloneUniforms(EARTH_SHADER.uniforms), sunDir: { value: uSunDir } },
                vertexShader: EARTH_SHADER.vertexShader,
                fragmentShader: EARTH_SHADER.fragmentShader,
            });
            break;
        case 'mars':
            material = new THREE.ShaderMaterial({
                uniforms: { ...cloneUniforms(MARS_SHADER.uniforms), sunDir: { value: uSunDir } },
                vertexShader: MARS_SHADER.vertexShader,
                fragmentShader: MARS_SHADER.fragmentShader,
            });
            break;
        case 'jupiter':
            material = new THREE.ShaderMaterial({
                uniforms: { ...cloneUniforms(JUPITER_SHADER.uniforms), sunDir: { value: uSunDir } },
                vertexShader: JUPITER_SHADER.vertexShader,
                fragmentShader: JUPITER_SHADER.fragmentShader,
            });
            break;
        case 'saturn':
            material = new THREE.ShaderMaterial({
                uniforms: { ...cloneUniforms(SATURN_SHADER.uniforms), sunDir: { value: uSunDir } },
                vertexShader: SATURN_SHADER.vertexShader,
                fragmentShader: SATURN_SHADER.fragmentShader,
            });
            break;
        case 'venus':
            material = new THREE.ShaderMaterial({
                uniforms: { ...cloneUniforms(VENUS_SHADER.uniforms), sunDir: { value: uSunDir } },
                vertexShader: VENUS_SHADER.vertexShader,
                fragmentShader: VENUS_SHADER.fragmentShader,
            });
            break;
        case 'iceGiant':
            material = new THREE.ShaderMaterial({
                uniforms: {
                    ...cloneUniforms(ICE_GIANT_SHADER.uniforms),
                    sunDir: { value: uSunDir },
                    baseColor: { value: new THREE.Vector3(...(data.shaderParams?.baseColor || [0.5, 0.7, 0.85])) },
                    bandIntensity: { value: data.shaderParams?.bandIntensity || 0.2 },
                },
                vertexShader: ICE_GIANT_SHADER.vertexShader,
                fragmentShader: ICE_GIANT_SHADER.fragmentShader,
            });
            break;
        case 'waterWorld':
            material = new THREE.ShaderMaterial({
                uniforms: { ...cloneUniforms(WATER_WORLD_SHADER.uniforms), sunDir: { value: uSunDir } },
                vertexShader: WATER_WORLD_SHADER.vertexShader,
                fragmentShader: WATER_WORLD_SHADER.fragmentShader,
            });
            break;
        case 'iceWorld':
            material = new THREE.ShaderMaterial({
                uniforms: { ...cloneUniforms(ICE_WORLD_SHADER.uniforms), sunDir: { value: uSunDir } },
                vertexShader: ICE_WORLD_SHADER.vertexShader,
                fragmentShader: ICE_WORLD_SHADER.fragmentShader,
            });
            break;
        case 'rocky':
        default:
            material = new THREE.ShaderMaterial({
                uniforms: {
                    ...cloneUniforms(ROCKY_SHADER.uniforms),
                    sunDir: { value: uSunDir },
                    baseColor: { value: new THREE.Vector3(...(data.shaderParams?.baseColor || [0.5, 0.5, 0.5])) },
                    craterDensity: { value: data.shaderParams?.craterDensity || 0.5 },
                },
                vertexShader: ROCKY_SHADER.vertexShader,
                fragmentShader: ROCKY_SHADER.fragmentShader,
            });
            break;
    }

    const mesh = new THREE.Mesh(SPHERE_HI, material);
    mesh.scale.setScalar(data.renderRadius);
    mesh.userData = group.userData;
    group.add(mesh);
    group.userData.mainMesh = mesh;
    group.userData.material = material;

    // Atmosphere glow (for planets with atmosphere)
    if (data.atmosphere && data.atmosphere !== 'None' && data.atmosphere !== 'None (exosphere)') {
        const atmosColor = data.shaderType === 'earth' ? new THREE.Color(0.3, 0.6, 1.0) :
            data.shaderType === 'mars' ? new THREE.Color(0.8, 0.4, 0.2) :
            data.shaderType === 'venus' ? new THREE.Color(0.9, 0.7, 0.3) :
            data.shaderType === 'jupiter' ? new THREE.Color(0.6, 0.4, 0.2) :
            data.shaderType === 'saturn' ? new THREE.Color(0.7, 0.6, 0.3) :
            new THREE.Color(0.4, 0.6, 0.9);

        const atmosMat = new THREE.ShaderMaterial({
            uniforms: {
                glowColor: { value: atmosColor },
                intensity: { value: data.shaderType === 'venus' ? 0.8 : 0.5 },
                sunDir: { value: uSunDir },
            },
            vertexShader: ATMOSPHERE_SHADER.vertexShader,
            fragmentShader: ATMOSPHERE_SHADER.fragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            depthWrite: false,
        });
        const atmosMesh = new THREE.Mesh(SPHERE_MED, atmosMat);
        atmosMesh.scale.setScalar(data.renderRadius * 1.12);
        group.add(atmosMesh);
        group.userData.atmosMaterial = atmosMat;
    }

    // Rings
    if (data.hasRings) {
        const innerR = data.renderRadius * 1.3;
        const outerR = data.renderRadius * 2.5;
        const ringGeo = new THREE.RingGeometry(innerR, outerR, 128, 1);
        const ringMat = new THREE.ShaderMaterial({
            uniforms: {
                ...cloneUniforms(RING_SHADER.uniforms),
                sunDir: { value: uSunDir },
                innerRadius: { value: innerR },
                outerRadius: { value: outerR },
            },
            vertexShader: RING_SHADER.vertexShader,
            fragmentShader: RING_SHADER.fragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2 + (data.axialTilt || 0) * Math.PI / 180 * 0.1;
        group.add(ringMesh);
        group.userData.ringMaterial = ringMat;
    }

    return group;
}

/* ═══ CREATE STAR MESH ═══ */
export function createStar(data) {
    const group = new THREE.Group();
    const color = new THREE.Color(data.color || 0xffcc44);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            starColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
        },
        vertexShader: STAR_SHADER.vertexShader,
        fragmentShader: STAR_SHADER.fragmentShader,
    });

    const mesh = new THREE.Mesh(SPHERE_HI, material);
    const radius = data.renderRadius || 4.0;
    mesh.scale.setScalar(radius);
    mesh.userData = { ...data, objectType: 'star' };
    group.add(mesh);

    // Corona glow
    const glowMat = new THREE.ShaderMaterial({
            uniforms: {
                glowColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
                intensity: { value: 0.8 },
                sunDir: { value: new THREE.Vector3(0, 0, 1) },
            },
        vertexShader: ATMOSPHERE_SHADER.vertexShader,
        fragmentShader: ATMOSPHERE_SHADER.fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
    });
    const glowMesh = new THREE.Mesh(SPHERE_MED, glowMat);
    glowMesh.scale.setScalar(radius * 1.2);
    group.add(glowMesh);

    // Point light
    const light = new THREE.PointLight(color, data.luminosity ? data.luminosity * 8 : 8, 500);
    group.add(light);

    group.userData = { ...data, objectType: 'star', mainMesh: mesh, material, light };
    return group;
}

/* ═══ CREATE BLACK HOLE ═══ */
export function createBlackHole(radius = 2.0) {
    const group = new THREE.Group();

    // Event horizon (pure black sphere)
    const horizonMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const horizon = new THREE.Mesh(SPHERE_HI, horizonMat);
    horizon.scale.setScalar(radius);
    group.add(horizon);

    // Accretion disk
    const diskMat = new THREE.ShaderMaterial({
        uniforms: cloneUniforms(ACCRETION_SHADER.uniforms),
        vertexShader: ACCRETION_SHADER.vertexShader,
        fragmentShader: ACCRETION_SHADER.fragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    const disk = new THREE.Mesh(new THREE.PlaneGeometry(radius * 10, radius * 10), diskMat);
    disk.rotation.x = Math.PI / 2;
    group.add(disk);

    // Gravitational lensing ring (simple torus)
    const lensMat = new THREE.MeshBasicMaterial({
        color: 0xffaa33, transparent: true, opacity: 0.15,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const lens = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.5, 0.05, 16, 64), lensMat);
    group.add(lens);

    group.userData = {
        name: 'Black Hole', type: 'EXOTIC', classification: 'Stellar Black Hole',
        objectType: 'blackhole', material: diskMat, renderRadius: radius,
    };
    return group;
}

export function createGargantua(radius = 8.0) {
    const group = createBlackHole(radius);
    group.userData.name = 'Gargantua';
    group.userData.classification = 'Supermassive Black Hole';
    
    // Scale up the accretion disk
    const disk = group.children.find(c => c.type === 'Mesh' && c.material instanceof THREE.ShaderMaterial);
    if (disk) {
        disk.scale.set(2.5, 2.5, 2.5);
    }
    
    // Scale up the lens
    const lens = group.children.find(c => c.geometry instanceof THREE.TorusGeometry);
    if (lens) {
        lens.scale.setScalar(1.5);
    }

    // Extra photon sphere glow
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffaa55, transparent: true, opacity: 0.15,
        blending: THREE.AdditiveBlending, side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(SPHERE_HI, glowMat);
    glow.scale.setScalar(radius * 1.8);
    group.add(glow);

    group.userData.isGargantua = true;
    return group;
}

/* ═══ CREATE NEUTRON STAR ═══ */
export function createNeutronStar(radius = 0.3) {
    const group = new THREE.Group();

    const mat = new THREE.ShaderMaterial({
        uniforms: cloneUniforms(NEUTRON_SHADER.uniforms),
        vertexShader: NEUTRON_SHADER.vertexShader,
        fragmentShader: NEUTRON_SHADER.fragmentShader,
    });
    const mesh = new THREE.Mesh(SPHERE_MED, mat);
    mesh.scale.setScalar(radius);
    group.add(mesh);

    // Pulsar beams
    const beamGeo = new THREE.CylinderGeometry(0.02, 0.5, radius * 20, 8, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
        color: 0x8888ff, transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const beam1 = new THREE.Mesh(beamGeo, beamMat);
    beam1.position.y = radius * 10;
    group.add(beam1);
    const beam2 = new THREE.Mesh(beamGeo, beamMat);
    beam2.position.y = -radius * 10;
    beam2.rotation.z = Math.PI;
    group.add(beam2);

    // Intense glow
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0xaabbff, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(SPHERE_LO, glowMat);
    glow.scale.setScalar(radius * 3);
    group.add(glow);

    const light = new THREE.PointLight(0x8888ff, 15, 100);
    group.add(light);

    group.userData = {
        name: 'Neutron Star', type: 'EXOTIC', classification: 'Magnetar',
        objectType: 'neutronstar', material: mat, renderRadius: radius,
    };
    return group;
}

/* ═══ CREATE MOON ═══ */
export function createMoon(moonData, sunDir) {
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            ...cloneUniforms(ROCKY_SHADER.uniforms),
            sunDir: { value: sunDir || new THREE.Vector3(1, 0.3, 0) },
            baseColor: { value: new THREE.Vector3(0.55, 0.53, 0.50) },
            craterDensity: { value: 0.8 },
        },
        vertexShader: ROCKY_SHADER.vertexShader,
        fragmentShader: ROCKY_SHADER.fragmentShader,
    });
    const mesh = new THREE.Mesh(SPHERE_MED, mat);
    mesh.scale.setScalar(moonData.renderRadius || 0.1);
    mesh.userData = { ...moonData, objectType: 'moon', material: mat };
    return mesh;
}

/* ═══ CREATE ASTEROID BELT ═══ */
export function createAsteroidBelt(innerDist, outerDist, count = 2000) {
    const geo = new THREE.DodecahedronGeometry(0.04, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9, metalness: 0.1 });
    const belt = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
        const dist = innerDist + Math.random() * (outerDist - innerDist);
        const theta = Math.random() * Math.PI * 2;
        const y = (Math.random() - 0.5) * 0.5;
        dummy.position.set(Math.cos(theta) * dist, y, Math.sin(theta) * dist);
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        const s = 0.3 + Math.random() * 1.2;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        belt.setMatrixAt(i, dummy.matrix);
    }

    belt.userData = { objectType: 'belt' };
    return belt;
}

/* ═══ CREATE PLANET SURFACE (PLANET SCALE) ═══ */
export function createPlanetSurface(data) {
    const group = new THREE.Group();
    group.userData = { ...data, objectType: 'planetsurface' };

    const type = data.shaderType || 'rocky';
    // Gas giants: jupiter, saturn — rendered as cloud domes from inside
    const isGas = type === 'jupiter' || type === 'saturn';
    // Ice giants: iceGiant — treated like gas for surface (you'd be in clouds)
    const isIceGiant = type === 'iceGiant';
    // Water types
    const isWaterWorld = type === 'waterWorld';
    const hasWater = type === 'earth' || isWaterWorld;
    // Ice surface (Mann's planet style)
    const isIceWorld = type === 'iceWorld';

    const sunDir = new THREE.Vector3(1, 0.6, 0.3).normalize();

    // ── TERRAIN BASE COLOUR ──────────────────────────────────────
    let baseColor = new THREE.Vector3(0.52, 0.44, 0.34); // default rocky
    if (type === 'mars')       baseColor = new THREE.Vector3(0.70, 0.28, 0.10);
    else if (type === 'venus') baseColor = new THREE.Vector3(0.80, 0.60, 0.28);
    else if (type === 'earth') baseColor = new THREE.Vector3(0.14, 0.38, 0.14);
    else if (isIceWorld)       baseColor = new THREE.Vector3(0.78, 0.88, 0.94);
    else if (isWaterWorld)     baseColor = new THREE.Vector3(0.04, 0.08, 0.18);
    else if (data.shaderParams?.baseColor) baseColor = new THREE.Vector3(...data.shaderParams.baseColor);

    // ── SPHERICAL GLOBE ─────────────────────────────────────
    // Generates a true spherical globe for exploration.
    const GROUND_RADIUS = 6000;
    const GROUND_SEGS_W = 256; // High density for curvature
    const GROUND_SEGS_H = 128;

    if (!isGas && !isIceGiant) {
        // --- Terrain ground ---
        const terrainMat = new THREE.ShaderMaterial({
            uniforms: {
                time:      { value: 0 },
                sunDir:    { value: sunDir.clone() },
                baseColor: { value: baseColor.clone() },
            },
            vertexShader:   TERRAIN_SHADER.vertexShader,
            fragmentShader: TERRAIN_SHADER.fragmentShader,
        });
        const terrain = new THREE.Mesh(
            new THREE.SphereGeometry(GROUND_RADIUS, GROUND_SEGS_W, GROUND_SEGS_H),
            terrainMat
        );
        group.add(terrain);
        group.userData.terrainMat = terrainMat;

        // --- Water layer ---
        if (hasWater) {
            const waterMat = new THREE.ShaderMaterial({
                uniforms: {
                    time:   { value: 0 },
                    sunDir: { value: sunDir.clone() },
                },
                vertexShader:   isWaterWorld ? GIANT_WAVE_SHADER.vertexShader : WATER_SHADER.vertexShader,
                fragmentShader: isWaterWorld ? GIANT_WAVE_SHADER.fragmentShader : WATER_SHADER.fragmentShader,
                transparent: true,
                depthWrite: false,
            });
            const waterSegsW = isWaterWorld ? 256 : 128;
            const waterSegsH = isWaterWorld ? 128 : 64;
            // Water sits at a slightly higher radius
            const waterRadius = GROUND_RADIUS + (isWaterWorld ? 10 : 120);
            const water = new THREE.Mesh(
                new THREE.SphereGeometry(waterRadius, waterSegsW, waterSegsH),
                waterMat
            );
            group.add(water);
            group.userData.waterMat = waterMat;
        }

        // --- Volumetric Clouds Phase ---
        if (type === 'earth' || isWaterWorld) {
            const cloudMat = new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 0 },
                    sunDir: { value: sunDir.clone() },
                    baseColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) }
                },
                vertexShader: PLANETARY_CLOUD_SHADER.vertexShader,
                fragmentShader: PLANETARY_CLOUD_SHADER.fragmentShader,
                transparent: true,
                depthWrite: false,
            });
            const cloudRadius = GROUND_RADIUS + 300; // Hovering above terrain/ocean
            const clouds = new THREE.Mesh(
                new THREE.SphereGeometry(cloudRadius, 128, 64),
                cloudMat
            );
            group.add(clouds);
            group.userData.cloudMat = cloudMat; // To be synced in animate()
        }
    } else {
        // ── GAS / ICE GIANT: Immersive cloud interior ──
        const cloudColors = isIceGiant
            ? new THREE.Vector3(0.4, 0.65, 0.85)   // blue-green ice giant
            : type === 'jupiter'
                ? new THREE.Vector3(0.78, 0.50, 0.28) // jupiter amber
                : new THREE.Vector3(0.72, 0.62, 0.42); // saturn gold

        const radii = [300, 600, 1000, 1600, 2500, 4000, 6000];
        group.userData.cloudMats = [];

        radii.forEach((r, i) => {
            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    time:       { value: i * 137.0 }, // golden-ratio offset
                    sunDir:     { value: sunDir.clone() },
                    baseColor:  { value: cloudColors.clone() },
                    cloudScale: { value: 2.0 + i * 0.8 },
                },
                vertexShader:   CLOUD_DOME_SHADER.vertexShader,
                fragmentShader: CLOUD_DOME_SHADER.fragmentShader,
                side:           THREE.BackSide,
                transparent:    true,
                depthWrite:     false,
                blending:       THREE.NormalBlending,
            });
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 48), mat);
            group.add(mesh);
            group.userData.cloudMats.push(mat);
        });

        // Haze floor plane so it doesn't look like floating in nothing
        const hazeMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(cloudColors.x * 0.3, cloudColors.y * 0.3, cloudColors.z * 0.3),
            transparent: true, opacity: 0.6,
        });
        const hazePlane = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), hazeMat);
        hazePlane.rotation.x = -Math.PI / 2;
        hazePlane.position.y = -200;
        group.add(hazePlane);
    }

    // ── SKY DOME ─────────────────────────────────────────────────
    const hasSky = data.atmosphere && data.atmosphere !== 'None' && data.atmosphere !== 'None (exosphere)';
    if (hasSky || isGas || isIceGiant) {
        const skyColor = type === 'earth' || isWaterWorld
            ? new THREE.Vector3(0.25, 0.55, 1.0)
            : type === 'mars'
                ? new THREE.Vector3(0.78, 0.38, 0.18)
                : type === 'venus'
                    ? new THREE.Vector3(0.88, 0.68, 0.28)
                    : isGas
                        ? new THREE.Vector3(0.55, 0.38, 0.20)
                        : isIceGiant
                            ? new THREE.Vector3(0.25, 0.48, 0.72)
                            : isIceWorld
                                ? new THREE.Vector3(0.55, 0.68, 0.80)
                                : new THREE.Vector3(0.40, 0.42, 0.55);

        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                skyColor: { value: skyColor },
                sunDir:   { value: sunDir.clone() },
            },
            vertexShader:   SKY_SHADER.vertexShader,
            fragmentShader: SKY_SHADER.fragmentShader,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false,
        });
        // Sky dome: large enough to always surround the camera
        const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 32), skyMat);
        group.add(sky);
        group.userData.skyMat = skyMat;
    } else {
        // No atmosphere — just a starfield tint
        const voidMat = new THREE.MeshBasicMaterial({
            color: 0x000005, side: THREE.BackSide,
        });
        group.add(new THREE.Mesh(new THREE.SphereGeometry(9000, 16, 16), voidMat));
    }

    // ── LIGHTING ─────────────────────────────────────────────────
    // Strong directional "sun" light
    const sunLight = new THREE.DirectionalLight(0xfff4e0, 2.0);
    sunLight.position.set(3000, 2000, 1000);
    group.add(sunLight);

    // Generous ambient so nothing is pitch black
    const ambient = new THREE.AmbientLight(0x223344, 1.2);
    group.add(ambient);

    // Hemisphere light for sky/ground gradient lighting
    const hemi = new THREE.HemisphereLight(0x88aacc, 0x443322, 0.6);
    group.add(hemi);

    return group;
}
