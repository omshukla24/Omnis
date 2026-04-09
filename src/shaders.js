/* ═══════════════════════════════════════════════════════════════
   OMNIS — GLSL Shader Library
   All procedural planet/star/exotic shaders
   ═══════════════════════════════════════════════════════════════ */

import { GLSL_NOISE } from './procedural.js';
import * as THREE from 'three';

// Shared vertex shader for all planets
const PLANET_VERT = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldNormal;
    varying vec3 vViewDir;

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

/* ═══ EARTH SHADER ═══ */
export const EARTH_SHADER = {
    uniforms: {
        time: { value: 0 },
        sunDir: { value: null },
    },
    vertexShader: PLANET_VERT,
    fragmentShader: `
        uniform float time;
        uniform vec3 sunDir;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewDir;

        ${GLSL_NOISE}

        void main() {
            vec2 p = vUv * vec2(8.0, 4.0) + vec2(0.3, 0.7);

            // Continental landmass
            float continent = fbm(p + vec2(1.7, 9.2), 7);
            float landMask = smoothstep(0.42, 0.52, continent);

            // Elevation detail
            float elevation = fbm(p * 3.0 + vec2(5.3, 2.1), 5);

            // Land colors: lowland green → highland brown → mountain gray → snow
            vec3 lowland = vec3(0.15, 0.42, 0.12);
            vec3 midland = vec3(0.35, 0.50, 0.18);
            vec3 highland = vec3(0.55, 0.42, 0.25);
            vec3 mountain = vec3(0.50, 0.45, 0.40);
            vec3 snow = vec3(0.92, 0.95, 0.98);

            vec3 land = mix(lowland, midland, smoothstep(0.3, 0.5, elevation));
            land = mix(land, highland, smoothstep(0.5, 0.65, elevation));
            land = mix(land, mountain, smoothstep(0.65, 0.75, elevation));
            land = mix(land, snow, smoothstep(0.78, 0.85, elevation));

            // Desert regions (near equator, low moisture)
            float latitude = abs(vUv.y - 0.5) * 2.0;
            float desert = smoothstep(0.2, 0.4, 1.0 - latitude) * smoothstep(0.5, 0.55, continent);
            float moisture = fbm(p * 2.0 + vec2(8.1, 3.4), 4);
            desert *= smoothstep(0.5, 0.3, moisture);
            land = mix(land, vec3(0.75, 0.65, 0.40), desert * 0.6);

            // Ocean: deep blue to lighter shallow
            vec3 deepOcean = vec3(0.01, 0.05, 0.25);
            vec3 shallowOcean = vec3(0.05, 0.18, 0.45);
            float shallowMask = smoothstep(0.35, 0.42, continent);
            vec3 ocean = mix(deepOcean, shallowOcean, shallowMask);
            // Specular highlight on ocean
            float specular = pow(max(dot(reflect(-sunDir, vNormal), vViewDir), 0.0), 40.0);

            // Polar ice caps
            float iceCap = smoothstep(0.78, 0.92, latitude);
            float iceNoise = fbm(p * 6.0, 3);
            iceCap *= smoothstep(0.3, 0.6, iceNoise);

            // Combine surface
            vec3 surface = mix(ocean, land, landMask);
            surface = mix(surface, vec3(0.90, 0.93, 0.98), iceCap);
            surface += specular * (1.0 - landMask) * vec3(0.3, 0.5, 0.8);

            // Lighting
            float NdotL = max(dot(vNormal, sunDir), 0.0);
            float ambient = 0.04;
            vec3 lit = surface * (ambient + NdotL * 0.96);

            // Atmosphere rim glow
            float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
            vec3 atmosGlow = vec3(0.3, 0.6, 1.0) * pow(rim, 3.5) * 0.7;

            // City lights on night side
            float nightMask = smoothstep(0.02, -0.08, NdotL);
            float cities = step(0.72, noise2D(p * 25.0)) * landMask * nightMask;
            cities *= smoothstep(0.6, 0.2, latitude); // More cities near equator
            vec3 cityGlow = vec3(1.0, 0.85, 0.45) * cities * 0.6;

            // Clouds (animated, separate layer with UV offset)
            float clouds = fbm(p * 2.5 + vec2(time * 0.02, 0.0), 5);
            clouds = smoothstep(0.45, 0.65, clouds) * 0.75;
            lit = mix(lit, vec3(0.85, 0.87, 0.90) * (ambient + NdotL), clouds);

            gl_FragColor = vec4(lit + atmosGlow + cityGlow, 1.0);
        }
    `
};

/* ═══ MARS SHADER ═══ */
export const MARS_SHADER = {
    uniforms: { time: { value: 0 }, sunDir: { value: null } },
    vertexShader: PLANET_VERT,
    fragmentShader: `
        uniform float time;
        uniform vec3 sunDir;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewDir;
        ${GLSL_NOISE}
        void main() {
            vec2 p = vUv * vec2(8.0, 4.0);
            float terrain = fbm(p + vec2(2.3, 7.1), 6);
            float craters = 1.0 - smoothstep(0.0, 0.15, voronoi(p * 8.0));
            // Valles / canyons
            float canyon = smoothstep(0.48, 0.50, abs(fbm(p * 3.0, 4) - 0.5));
            // Colors
            vec3 rust = vec3(0.72, 0.30, 0.12);
            vec3 darkRust = vec3(0.45, 0.18, 0.08);
            vec3 sand = vec3(0.80, 0.55, 0.30);
            vec3 col = mix(rust, darkRust, smoothstep(0.3, 0.6, terrain));
            col = mix(col, sand, smoothstep(0.6, 0.75, terrain));
            col = mix(col, darkRust * 0.5, craters * 0.4);
            col = mix(col, darkRust * 0.3, canyon * 0.5);
            // Polar caps
            float lat = abs(vUv.y - 0.5) * 2.0;
            float polar = smoothstep(0.82, 0.95, lat) * smoothstep(0.3, 0.5, fbm(p * 4.0, 3));
            col = mix(col, vec3(0.9, 0.92, 0.95), polar);
            // Lighting
            float NdotL = max(dot(vNormal, sunDir), 0.0);
            vec3 lit = col * (0.05 + NdotL * 0.95);
            // Thin atmosphere
            float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
            lit += vec3(0.8, 0.4, 0.2) * pow(rim, 4.0) * 0.25;
            gl_FragColor = vec4(lit, 1.0);
        }
    `
};

/* ═══ JUPITER SHADER ═══ */
export const JUPITER_SHADER = {
    uniforms: { time: { value: 0 }, sunDir: { value: null } },
    vertexShader: PLANET_VERT,
    fragmentShader: `
        uniform float time;
        uniform vec3 sunDir;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        ${GLSL_NOISE}
        void main() {
            vec2 p = vUv;
            // Banded structure
            float band = sin(p.y * 30.0) * 0.5 + 0.5;
            float turbulence = fbm(vec2(p.x * 12.0 + time * 0.015, p.y * 6.0), 5);
            band += turbulence * 0.2;
            // Color bands
            vec3 band1 = vec3(0.82, 0.72, 0.55);
            vec3 band2 = vec3(0.65, 0.45, 0.28);
            vec3 band3 = vec3(0.90, 0.82, 0.68);
            vec3 band4 = vec3(0.55, 0.35, 0.22);
            vec3 col = mix(band1, band2, smoothstep(0.3, 0.5, band));
            col = mix(col, band3, smoothstep(0.6, 0.75, band));
            col = mix(col, band4, smoothstep(0.8, 0.95, band));
            // Great Red Spot
            vec2 spotCenter = vec2(0.6, 0.6);
            float spotDist = length((p - spotCenter) * vec2(2.5, 4.0));
            float spot = smoothstep(0.12, 0.05, spotDist);
            float spotSwirl = fbm(vec2(atan(p.y - spotCenter.y, p.x - spotCenter.x) * 3.0 + time * 0.05, spotDist * 8.0), 4);
            col = mix(col, vec3(0.85, 0.25, 0.12) + spotSwirl * 0.15, spot);
            // Lighting
            float NdotL = max(dot(vNormal, sunDir), 0.0);
            vec3 lit = col * (0.06 + NdotL * 0.94);
            float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
            lit += vec3(0.6, 0.4, 0.2) * pow(rim, 5.0) * 0.15;
            gl_FragColor = vec4(lit, 1.0);
        }
    `
};

/* ═══ SATURN SHADER ═══ */
export const SATURN_SHADER = {
    uniforms: { time: { value: 0 }, sunDir: { value: null } },
    vertexShader: PLANET_VERT,
    fragmentShader: `
        uniform float time;
        uniform vec3 sunDir;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        ${GLSL_NOISE}
        void main() {
            vec2 p = vUv;
            float band = sin(p.y * 20.0) * 0.5 + 0.5;
            float turb = fbm(vec2(p.x * 10.0 + time * 0.01, p.y * 5.0), 4);
            band += turb * 0.15;
            vec3 band1 = vec3(0.88, 0.82, 0.65);
            vec3 band2 = vec3(0.78, 0.70, 0.50);
            vec3 band3 = vec3(0.92, 0.88, 0.72);
            vec3 col = mix(band1, band2, smoothstep(0.3, 0.5, band));
            col = mix(col, band3, smoothstep(0.7, 0.9, band));
            float NdotL = max(dot(vNormal, sunDir), 0.0);
            vec3 lit = col * (0.05 + NdotL * 0.95);
            float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
            lit += vec3(0.7, 0.6, 0.3) * pow(rim, 5.0) * 0.1;
            gl_FragColor = vec4(lit, 1.0);
        }
    `
};

/* ═══ VENUS SHADER ═══ */
export const VENUS_SHADER = {
    uniforms: { time: { value: 0 }, sunDir: { value: null } },
    vertexShader: PLANET_VERT,
    fragmentShader: `
        uniform float time;
        uniform vec3 sunDir;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        ${GLSL_NOISE}
        void main() {
            vec2 p = vUv * vec2(6.0, 3.0);
            float swirl = fbm(p + vec2(time * 0.008, time * 0.005), 6);
            float swirl2 = fbm(p * 1.5 + vec2(swirl * 2.0, time * 0.01), 4);
            vec3 col = mix(vec3(0.85, 0.65, 0.25), vec3(0.92, 0.78, 0.40), swirl);
            col = mix(col, vec3(0.75, 0.55, 0.20), swirl2 * 0.5);
            float NdotL = max(dot(vNormal, sunDir), 0.0);
            vec3 lit = col * (0.08 + NdotL * 0.92);
            float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
            lit += vec3(0.9, 0.7, 0.3) * pow(rim, 3.0) * 0.4;
            gl_FragColor = vec4(lit, 1.0);
        }
    `
};

/* ═══ ROCKY PLANET SHADER (Mercury & generic) ═══ */
export const ROCKY_SHADER = {
    uniforms: {
        time: { value: 0 },
        sunDir: { value: null },
        baseColor: { value: null },
        craterDensity: { value: 0.5 },
    },
    vertexShader: PLANET_VERT,
    fragmentShader: `
        uniform float time;
        uniform vec3 sunDir;
        uniform vec3 baseColor;
        uniform float craterDensity;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        ${GLSL_NOISE}
        void main() {
            vec2 p = vUv * vec2(8.0, 4.0);
            float terrain = fbm(p + vec2(3.7, 1.2), 6);
            float craters = 1.0 - smoothstep(0.0, 0.12, voronoi(p * 10.0 * craterDensity));
            vec3 col = baseColor * (0.7 + terrain * 0.6);
            col = mix(col, baseColor * 0.4, craters * 0.6);
            float NdotL = max(dot(vNormal, sunDir), 0.0);
            vec3 lit = col * (0.03 + NdotL * 0.97);
            gl_FragColor = vec4(lit, 1.0);
        }
    `
};

/* ═══ ICE GIANT SHADER (Uranus/Neptune) ═══ */
export const ICE_GIANT_SHADER = {
    uniforms: {
        time: { value: 0 },
        sunDir: { value: null },
        baseColor: { value: null },
        bandIntensity: { value: 0.2 },
    },
    vertexShader: PLANET_VERT,
    fragmentShader: `
        uniform float time;
        uniform vec3 sunDir;
        uniform vec3 baseColor;
        uniform float bandIntensity;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        ${GLSL_NOISE}
        void main() {
            vec2 p = vUv;
            float band = sin(p.y * 15.0 + fbm(vec2(p.x * 8.0, p.y * 4.0), 3) * 0.5) * 0.5 + 0.5;
            vec3 col = baseColor;
            col = mix(col, baseColor * 1.2, band * bandIntensity);
            // Storm spots
            float storm = smoothstep(0.08, 0.0, length((p - vec2(0.3, 0.55)) * vec2(3.0, 5.0)));
            col = mix(col, vec3(0.9, 0.95, 1.0), storm * 0.6);
            float NdotL = max(dot(vNormal, sunDir), 0.0);
            vec3 lit = col * (0.05 + NdotL * 0.95);
            float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
            lit += baseColor * pow(rim, 4.0) * 0.3;
            gl_FragColor = vec4(lit, 1.0);
        }
    `
};

/* ═══ STAR / SUN SHADER ═══ */
export const STAR_SHADER = {
    uniforms: {
        time: { value: 0 },
        starColor: { value: null },
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        void main() {
            vUv = uv;
            vPosition = position;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform vec3 starColor;
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        ${GLSL_NOISE}
        void main() {
            vec3 p3 = vPosition * 3.0 + time * 0.5;
            float n1 = fbm3(p3, 5);
            float n2 = fbm3(p3 * 2.0 + vec3(5.2, 1.3, 8.7), 4);
            // Plasma turbulence
            float plasma = n1 * 0.6 + n2 * 0.4;
            // Sunspots
            float spots = smoothstep(0.55, 0.65, fbm3(vPosition * 5.0 + time * 0.1, 4));
            vec3 hotColor = starColor * 1.0 + vec3(0.3, 0.15, 0.0);
            vec3 coolColor = starColor * 0.6;
            vec3 spotColor = starColor * 0.2;
            vec3 col = mix(coolColor, hotColor, plasma);
            col = mix(col, spotColor, spots * 0.5);
            // Edge brightening
            float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 1.5);
            col += starColor * fresnel * 0.15;
            // Core brightening
            col += vec3(0.1, 0.05, 0.0) * smoothstep(0.5, 0.0, fresnel);
            gl_FragColor = vec4(col * 0.6, 1.0);
        }
    `
};

/* ═══ ATMOSPHERE GLOW SHADER ═══ */
export const ATMOSPHERE_SHADER = {
    uniforms: {
        glowColor: { value: null },
        intensity: { value: 1.0 },
        sunDir: { value: null },
    },
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vViewDir = normalize(cameraPosition - worldPos.xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 glowColor;
        uniform float intensity;
        uniform vec3 sunDir;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
            float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
            float glow = pow(rim, 3.0) * intensity;
            // Day side brighter
            float dayFactor = max(dot(vNormal, sunDir), 0.0) * 0.5 + 0.5;
            gl_FragColor = vec4(glowColor * glow * dayFactor, glow * 0.8);
        }
    `
};

/* ═══ RING SHADER (Saturn, Uranus) ═══ */
export const RING_SHADER = {
    uniforms: {
        time: { value: 0 },
        sunDir: { value: null },
        innerRadius: { value: 1.2 },
        outerRadius: { value: 2.5 },
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform vec3 sunDir;
        uniform float innerRadius;
        uniform float outerRadius;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        ${GLSL_NOISE}
        void main() {
            vec2 centered = vUv * 2.0 - 1.0;
            float dist = length(centered);
            float ringPos = (dist - innerRadius / outerRadius) / (1.0 - innerRadius / outerRadius);
            if (ringPos < 0.0 || ringPos > 1.0) discard;
            // Ring bands
            float bands = noise2D(vec2(ringPos * 60.0, 0.5)) * 0.5 + 0.5;
            // Cassini Division (gap at ~0.6)
            float cassini = smoothstep(0.58, 0.60, ringPos) * smoothstep(0.64, 0.62, ringPos);
            // Encke gap
            float encke = smoothstep(0.78, 0.79, ringPos) * smoothstep(0.81, 0.80, ringPos);
            float density = bands * (1.0 - cassini * 0.9) * (1.0 - encke * 0.8);
            density *= smoothstep(0.0, 0.05, ringPos) * smoothstep(1.0, 0.95, ringPos);
            // Colors
            vec3 ringColor = mix(vec3(0.75, 0.65, 0.50), vec3(0.90, 0.85, 0.72), ringPos);
            ringColor *= 0.6 + density * 0.4;
            // Simple lighting
            float NdotL = abs(dot(vNormal, sunDir));
            ringColor *= 0.3 + NdotL * 0.7;
            float alpha = density * 0.85;
            gl_FragColor = vec4(ringColor, alpha);
        }
    `
};

/* ═══ BLACK HOLE ACCRETION DISK SHADER ═══ */
export const ACCRETION_SHADER = {
    uniforms: { time: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        ${GLSL_NOISE}
        void main() {
            vec2 uv = vUv - 0.5;
            float dist = length(uv) * 2.0;
            if (dist < 0.2 || dist > 1.0) discard;
            float angle = atan(uv.y, uv.x);
            float spin = angle + time * 4.0 - dist * 6.0;
            float rings = sin(dist * 30.0 - time * 8.0) * 0.5 + 0.5;
            float spirals = sin(spin * 5.0) * 0.5 + 0.5;
            float turb = noise2D(vec2(spin * 2.0, dist * 10.0 + time));
            float intensity = (1.0 - dist) * 3.0;
            intensity *= (rings * 0.5 + 0.5) * (spirals * 0.4 + 0.6) * (turb * 0.3 + 0.7);
            vec3 innerColor = vec3(1.0, 0.95, 0.8);
            vec3 midColor = vec3(1.0, 0.5, 0.1);
            vec3 outerColor = vec3(0.8, 0.15, 0.02);
            vec3 color = mix(outerColor, midColor, smoothstep(0.7, 0.4, dist));
            color = mix(color, innerColor, smoothstep(0.4, 0.22, dist));
            float alpha = smoothstep(1.0, 0.7, dist) * smoothstep(0.2, 0.25, dist) * intensity;
            gl_FragColor = vec4(color * intensity, alpha * 0.9);
        }
    `
};

/* ═══ GALAXY PARTICLE SHADER ═══ */
export const GALAXY_PARTICLE_SHADER = {
    vertexShader: `
        attribute float brightness;
        attribute vec3 starColor;
        varying vec3 vColor;
        varying float vBrightness;
        uniform float pointScale;
        void main() {
            vColor = starColor;
            vBrightness = brightness;
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = max(1.0, pointScale * brightness / -mvPos.z);
            gl_Position = projectionMatrix * mvPos;
        }
    `,
    fragmentShader: `
        varying vec3 vColor;
        varying float vBrightness;
        void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float alpha = smoothstep(1.0, 0.0, d) * vBrightness;
            vec3 col = vColor * (1.0 + (1.0 - d) * 0.5);
            gl_FragColor = vec4(col, alpha);
        }
    `
};

/* ═══ NEUTRON STAR SHADER ═══ */
export const NEUTRON_SHADER = {
    uniforms: { time: { value: 0 } },
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vPosition;
        ${GLSL_NOISE}
        void main() {
            float pulse = sin(time * 8.0) * 0.3 + 0.7;
            vec3 col = vec3(0.6, 0.7, 1.0) * 2.0 * pulse;
            float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
            col += vec3(0.3, 0.5, 1.0) * fresnel * 3.0;
            gl_FragColor = vec4(col, 1.0);
        }
    `
};

/* ═══ SURFACE TERRAIN SHADER ═══ */
export const TERRAIN_SHADER = {
    uniforms: {
        time: { value: 0 },
        sunDir: { value: null },
        baseColor: { value: new THREE.Vector3(0.5, 0.4, 0.3) },
    },
    vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        ${GLSL_NOISE}
        void main() {
            vec3 n = normalize(position); // direction from center
            float eps = 0.002;
            vec3 up = abs(n.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
            vec3 tangent = normalize(cross(up, n));
            vec3 bitangent = cross(n, tangent);

            float h  = fbm3(n * 5.0, 6) * 400.0;
            float hx = fbm3(normalize(n + tangent * eps) * 5.0, 6) * 400.0;
            float hy = fbm3(normalize(n + bitangent * eps) * 5.0, 6) * 400.0;
            
            vec3 pos = position + n * max(0.0, h);
            
            float dw = 6000.0;
            vec3 tx = normalize(tangent * eps * dw + n * (hx - h));
            vec3 ty = normalize(bitangent * eps * dw + n * (hy - h));
            vec3 localNormal = normalize(cross(tx, ty)); // tangent-space derived normal
            
            vNormal = normalize(normalMatrix * localNormal);
            vec4 worldPos = modelMatrix * vec4(pos, 1.0);
            vWorldPos = worldPos.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 sunDir;
        uniform vec3 baseColor;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
            vec3 n = normalize(vNormal);
            vec3 l = normalize(sunDir);
            float NdotL = max(dot(n, l), 0.0);
            float height = clamp((length(vWorldPos) - 6000.0) / 400.0, 0.0, 1.0);
            vec3 low   = baseColor * 0.45;
            vec3 mid   = baseColor * 0.85;
            vec3 high  = baseColor * 1.2;
            vec3 snow  = vec3(0.92, 0.95, 0.98);
            vec3 col = mix(low, mid, smoothstep(0.0, 0.4, height));
            col = mix(col, high, smoothstep(0.4, 0.7, height));
            col = mix(col, snow, smoothstep(0.75, 0.9, height));
            float slope = 1.0 - max(dot(n, normalize(vWorldPos)), 0.0);
            col = mix(col, col * 0.6, slope * 0.5);
            vec3 lit = col * (0.15 + NdotL * 0.85);
            gl_FragColor = vec4(lit, 1.0);
        }
    `
};

/* ═══ SURFACE WATER SHADER ═══ */
export const WATER_SHADER = {
    uniforms: {
        time: { value: 0 },
        sunDir: { value: null },
    },
    vertexShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;
        ${GLSL_NOISE}
        void main() {
            vec3 n = normalize(position);
            float eps = 0.002;
            vec3 up = abs(n.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
            vec3 tangent = normalize(cross(up, n));
            vec3 bitangent = cross(n, tangent);

            float t = time * 0.8;
            float getWater(vec3 p) {
                return fbm3(p * 8.0 + vec3(t * 0.05, 0.0, 0.0), 3) * 12.0 + fbm3(p * 20.0 - vec3(0.0, t * 0.02, 0.0), 2) * 5.0;
            }
            float hw = getWater(n);
            float hx = getWater(normalize(n + tangent * eps));
            float hy = getWater(normalize(n + bitangent * eps));

            vec3 pos = position + n * hw;
            float dw = 6000.0;
            vec3 tx = normalize(tangent * eps * dw + n * (hx - hw));
            vec3 ty = normalize(bitangent * eps * dw + n * (hy - hw));
            vec3 localNormal = normalize(cross(tx, ty));

            vNormal = normalize(normalMatrix * localNormal);
            vec4 worldPos = modelMatrix * vec4(pos, 1.0);
            vWorldPos = worldPos.xyz;
            vViewDir = normalize(cameraPosition - worldPos.xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform vec3 sunDir;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;
        void main() {
            vec3 n = normalize(vNormal);
            vec3 l = normalize(sunDir);
            float NdotL = max(dot(n, l), 0.0);
            vec3 h = normalize(l + vViewDir);
            float spec = pow(max(dot(n, h), 0.0), 64.0) * 0.6;
            vec3 deepColor    = vec3(0.02, 0.08, 0.22);
            vec3 shallowColor = vec3(0.06, 0.22, 0.48);
            vec3 waterColor = mix(deepColor, shallowColor, 0.5 + dot(n, normalize(vWorldPos)) * 0.5);
            vec3 lit = waterColor * (0.15 + NdotL * 0.85) + spec * vec3(0.6, 0.8, 1.0);
            gl_FragColor = vec4(lit, 0.92);
        }
    `
};

/* ═══ GIANT TIDAL WAVE SHADER (MILLER'S PLANET) ═══ */
export const GIANT_WAVE_SHADER = {
    uniforms: {
        time: { value: 0 },
        sunDir: { value: null },
    },
    vertexShader: `
        uniform float time;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;
        ${GLSL_NOISE}
        void main() {
            vec3 n = normalize(position);
            float eps = 0.003;
            float t = time * 0.4;
            vec3 up = abs(n.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
            vec3 tangent = normalize(cross(up, n));
            vec3 bitangent = cross(n, tangent);

            float getWave(vec3 p) {
                float lon = atan(p.z, p.x);
                float wave = sin(lon * 25.0 + t) * 280.0 + sin(lon * 15.0 + t * 0.6) * 120.0;
                float detail = fbm3(p * 6.0 + vec3(t * 0.1), 4) * 60.0;
                return wave + detail;
            }
            float hw = getWave(n);
            float hx = getWave(normalize(n + tangent * eps));
            float hy = getWave(normalize(n + bitangent * eps));

            vec3 pos = position + n * max(hw, -80.0);
            float dw = 6000.0;
            vec3 tx = normalize(tangent * eps * dw + n * (max(hx, -80.0) - max(hw, -80.0)));
            vec3 ty = normalize(bitangent * eps * dw + n * (max(hy, -80.0) - max(hw, -80.0)));
            vec3 localNormal = normalize(cross(tx, ty));

            vNormal = normalize(normalMatrix * localNormal);
            vec4 worldPos = modelMatrix * vec4(pos, 1.0);
            vWorldPos = worldPos.xyz;
            vViewDir = normalize(cameraPosition - worldPos.xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 sunDir;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;
        void main() {
            vec3 n = normalize(vNormal);
            vec3 l = normalize(sunDir);
            float NdotL = max(dot(n, l), 0.0);
            vec3 h = normalize(l + vViewDir);
            float spec = pow(max(dot(n, h), 0.0), 80.0) * 0.9;
            float height = clamp((length(vWorldPos) - 6000.0) / 300.0, 0.0, 1.0);
            vec3 trough = vec3(0.01, 0.05, 0.20);
            vec3 mid    = vec3(0.06, 0.22, 0.52);
            vec3 crest  = vec3(0.75, 0.88, 0.95); // foam
            vec3 wavCol = mix(trough, mid, smoothstep(0.0, 0.6, height));
            wavCol = mix(wavCol, crest, smoothstep(0.7, 1.0, height));
            vec3 lit = wavCol * (0.12 + NdotL * 0.88) + spec * vec3(0.8, 0.9, 1.0);
            gl_FragColor = vec4(lit, 0.95);
        }
    `
};

/* ═══ CLOUD DOME SHADER (GAS GIANTS SURFACE VIEW) ═══ */
export const CLOUD_DOME_SHADER = {
    uniforms: {
        time: { value: 0 },
        sunDir: { value: null },
        baseColor: { value: new THREE.Vector3(0.8, 0.7, 0.5) },
        cloudScale: { value: 5.0 },
    },
    vertexShader: `
        varying vec3 vPos;
        varying vec3 vNormal;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform vec3 sunDir;
        uniform vec3 baseColor;
        uniform float cloudScale;
        varying vec3 vPos;
        varying vec3 vNormal;
        ${GLSL_NOISE}
        void main() {
            vec3 n = normalize(vNormal);
            float NdotL = max(dot(-n, normalize(sunDir)), 0.0); // inner face
            vec3 p = normalize(vPos) * cloudScale + vec3(time * 0.05, 0.0, time * 0.03);
            float noise = fbm(p, 5);
            float band = sin(normalize(vPos).y * 12.0 + noise * 3.0) * 0.5 + 0.5;
            vec3 col = mix(baseColor * 0.5, baseColor * 1.4, band * 0.6 + noise * 0.4);
            col *= (0.4 + NdotL * 0.6);
            float alpha = clamp(0.5 + noise * 0.5, 0.3, 0.9);
            gl_FragColor = vec4(col, alpha);
        }
    `
};

/* ═══ SURFACE SKY SHADER ═══ */
export const SKY_SHADER = {
    uniforms: {
        skyColor: { value: new THREE.Vector3(0.3, 0.6, 1.0) },
        sunDir: { value: null },
    },
    vertexShader: `
        varying vec3 vDir;
        void main() {
            // Pass world-space direction for sky gradient
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vDir = normalize(worldPos.xyz - cameraPosition);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 skyColor;
        uniform vec3 sunDir;
        varying vec3 vDir;
        void main() {
            vec3 d = normalize(vDir);
            vec3 sd = normalize(sunDir);
            
            // Atmospheric day/night masking
            float sunPhase = dot(d, sd);
            float dayLighting = smoothstep(-0.2, 0.5, sunPhase);
            
            float up = max(d.y, 0.0);
            vec3 zenith  = skyColor * 0.6;
            vec3 midAtmo = skyColor;
            vec3 horiz   = skyColor * 1.3 + vec3(0.2, 0.1, 0.0);
            vec3 col = mix(horiz, midAtmo, smoothstep(0.0, 0.3, up));
            col = mix(col, zenith, smoothstep(0.3, 1.0, up));
            float sunDot = max(sunPhase, 0.0);
            float sunDisc = smoothstep(0.9994, 0.9998, sunDot);
            float sunHalo = pow(sunDot, 12.0) * 0.5;
            col += vec3(1.0, 0.95, 0.8) * (sunDisc + sunHalo);
            col = mix(vec3(0.05, 0.05, 0.06), col, smoothstep(-0.08, 0.04, d.y));
            
            // Fades alpha gracefully into night spaces so background stars dynamically show ONLY appropriately
            float alpha = clamp(dayLighting + smoothstep(0.1, 0.0, up), 0.0, 1.0);
            gl_FragColor = vec4(col * (0.1 + dayLighting * 0.9), alpha);
        }
    `
};

/* ═══ VOLUMETRIC CLOUDS SHADER ═══ */
export const PLANETARY_CLOUD_SHADER = {
    uniforms: {
        time: { value: 0 },
        sunDir: { value: null },
        baseColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) }
    },
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPos;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform vec3 sunDir;
        uniform vec3 baseColor;
        varying vec3 vNormal;
        varying vec3 vPos;
        ${GLSL_NOISE}
        void main() {
            vec3 n = normalize(vNormal);
            float NdotL = max(dot(n, normalize(sunDir)), 0.0);
            
            vec3 p = normalize(vPos);
            float noise1 = fbm3(p * 5.0 + vec3(time * 0.015), 5);
            float noise2 = fbm3(p * 12.0 - vec3(time * 0.005), 3);
            
            float coverage = smoothstep(0.42, 0.65, noise1 * 0.6 + noise2 * 0.4);
            vec3 col = baseColor * (0.3 + NdotL * 0.7);
            
            gl_FragColor = vec4(col, coverage * 0.85);
        }
    `
};

export const WATER_WORLD_SHADER = {
    uniforms: {
        time: { value: 0 },
        sunDir: { value: null }
    },
    vertexShader: PLANET_VERT,
    fragmentShader: `
        uniform float time;
        uniform vec3 sunDir;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        ${GLSL_NOISE}
        void main() {
            float wave = fbm(vUv * 20.0 + vec2(time * 0.5, 0.0), 4);
            vec3 col = vec3(0.1, 0.3, 0.6) + wave * 0.2;
            float NdotL = max(dot(vNormal, sunDir), 0.0);
            vec3 lit = col * (0.1 + NdotL * 0.9);
            gl_FragColor = vec4(lit, 1.0);
        }
    `
};

export const ICE_WORLD_SHADER = {
    uniforms: {
        time: { value: 0 },
        sunDir: { value: null }
    },
    vertexShader: PLANET_VERT,
    fragmentShader: `
        uniform float time;
        uniform vec3 sunDir;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        ${GLSL_NOISE}
        void main() {
            float ice = fbm(vUv * 15.0, 5);
            vec3 col = mix(vec3(0.8, 0.9, 0.95), vec3(1.0), ice);
            float NdotL = max(dot(vNormal, sunDir), 0.0);
            vec3 lit = col * (0.1 + NdotL * 0.9);
            gl_FragColor = vec4(lit, 1.0);
        }
    `
};
