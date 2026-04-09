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

/* ═══ TRUE RAYMARCHED GRAVITATIONAL LENSING (BLACK HOLE) ═══ */
export const RAYMARCHED_BLACKHOLE_SHADER = {
    uniforms: { time: { value: 0 } },
    vertexShader: `
        varying vec3 vWorldPos;
        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
    `,
    fragmentShader: `
        uniform float time;
        varying vec3 vWorldPos;
        
        ${GLSL_NOISE}

        // Mathematical Volumetric Disk
        float disk(vec3 p) {
            float r = length(p.xz);
            float h = abs(p.y);
            float inner = 2.4;
            float outer = 9.0;
            if(r < inner || r > outer) return 0.0;
            
            float wedge = 0.08 * r;
            if(h > wedge) return 0.0;
            
            float angle = atan(p.z, p.x);
            float spin = angle + time * 3.0 - r * 1.5;
            float turb = noise2D(vec2(spin * 2.0, r * 2.0 + time));
            
            float falloff = smoothstep(wedge, 0.0, h) * smoothstep(outer, outer-2.0, r) * smoothstep(inner, inner+0.5, r);
            return turb * falloff;
        }

        void main() {
            vec3 ro = cameraPosition;
            vec3 rd = normalize(vWorldPos - cameraPosition);
            
            vec3 p = cameraPosition;
            
            // Check if camera is way far away outside the proxy limits, if so we jump ray forward to save steps
            float distToOrigin = length(cameraPosition);
            if(distToOrigin > 15.0) {
                p = cameraPosition + rd * (distToOrigin - 14.0); 
            }

            vec3 v = rd;
            
            vec3 col = vec3(0.0);
            float alpha = 0.0;
            
            // Schwarzschild logic
            float mass = 1.0;
            float rs = 2.0 * mass;
            float rs2 = rs * rs;
            
            float dt = 0.1;
            bool hitHorizon = false;
            
            for(int i=0; i<75; i++) {
                float r2 = dot(p, p);
                if(r2 < rs2) {
                    hitHorizon = true;
                    break;
                }
                
                // Gravity Ray Bending (Euler integration of geodesics)
                // v' = v + (G * p / r^3)
                vec3 g = -normalize(p) * mass / (r2);
                v = normalize(v + g * dt * 2.2);
                p += v * dt;
                
                // Sample Volumetric Accretion Disk
                if(abs(p.y) < 1.0) {
                    float d = disk(p);
                    if(d > 0.0) {
                        float distNorm = length(p.xz);
                        // Temperature color gradient (Blue/white hot inner -> orange/red outer)
                        vec3 ringCol = mix(vec3(1.0, 0.9, 0.8), vec3(0.9, 0.3, 0.05), (distNorm - 2.4)/6.6);
                        float glow = d * 0.15;
                        col += ringCol * glow * (1.0 - alpha);
                        alpha += glow;
                    }
                }
                
                if(alpha >= 0.99) break;
                if(r2 > 400.0) break; // Escaped local lens bounds
                
                dt = 0.02 + sqrt(r2)*0.04;
            }
            
            if(hitHorizon && alpha < 0.2) {
                // Event Horizon
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            } else if (alpha > 0.01) {
                // Superheated core bloom
                col += vec3(1.0, 0.9, 0.6) * smoothstep(0.7, 1.0, alpha) * 0.5;
                gl_FragColor = vec4(col, alpha);
            } else {
                discard;
            }
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
        isEarthLike: { value: 0.0 }, // 1.0 for earth/water
        waterLevel: { value: 0.0 },  // Sets sea level
    },
    vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPos;
        varying vec3 vWorldPos;
        
        // No GLSL_NOISE in vertex shader, we pass raw positions for infinite resolution texturing
        void main() {
            vec3 n = normalize(position);
            vNormal = normalize(normalMatrix * n);
            vPos = position;
            
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos; // MUST INCLUDE viewMatrix!
        }
    `,
    fragmentShader: `
        uniform vec3 sunDir;
        uniform vec3 baseColor;
        uniform float isEarthLike;
        uniform float waterLevel;
        varying vec3 vNormal;
        varying vec3 vPos;
        varying vec3 vWorldPos;
        
        ${GLSL_NOISE}
        
        void main() {
            vec3 n = normalize(vNormal);
            vec3 l = normalize(sunDir);
            float NdotL = max(dot(n, l), 0.0);
            
            vec3 posNorm = normalize(vPos);
            float noiseHeight = fbm3(posNorm * 2.5, 7); 
            float detailHeight = fbm3(posNorm * 12.0, 5) * 0.15;
            float finalHeight = noiseHeight + detailHeight;
            
            vec3 albedo = vec3(0.0);
            float specular = 0.0;
            
            if (finalHeight < waterLevel) {
                if (isEarthLike > 0.5) {
                    // True Oceans
                    float depthStr = smoothstep(waterLevel - 0.1, waterLevel, finalHeight);
                    vec3 deepWater = vec3(0.02, 0.08, 0.20);
                    vec3 shallowWater = vec3(0.05, 0.30, 0.45);
                    albedo = mix(deepWater, shallowWater, depthStr);
                    
                    vec3 viewDir = normalize(cameraPosition - vWorldPos);
                    vec3 halfVector = normalize(l + viewDir);
                    float NdotH = max(dot(n, halfVector), 0.0);
                    specular = pow(NdotH, 200.0) * 1.5;
                } else {
                    // Dark alien flatlands/basins
                    albedo = baseColor * 0.5;
                    specular = 0.0;
                }
            } else {
                float landHeight = clamp((finalHeight - waterLevel) / (1.0 - waterLevel), 0.0, 1.0);
                
                if (isEarthLike > 0.5) {
                    vec3 sand = vec3(0.76, 0.70, 0.50);
                    vec3 forest = baseColor;
                    vec3 rock = vec3(0.40, 0.38, 0.35);
                    vec3 snow = vec3(0.95, 0.98, 1.00);
                    
                    albedo = sand;
                    albedo = mix(albedo, forest, smoothstep(0.0, 0.05, landHeight));
                    albedo = mix(albedo, rock, smoothstep(0.4, 0.5, landHeight));
                    albedo = mix(albedo, snow, smoothstep(0.75, 0.85, landHeight));
                    
                    float lat = abs(posNorm.y);
                    albedo = mix(albedo, snow, smoothstep(0.85, 0.95, lat)); 
                } else {
                    // Alien rocky procedural terrain
                    vec3 darkRock = baseColor * 0.7;
                    vec3 lightRock = mix(baseColor, vec3(1.0), 0.2);
                    albedo = baseColor;
                    albedo = mix(albedo, darkRock, smoothstep(0.0, 0.1, landHeight));
                    albedo = mix(albedo, lightRock, smoothstep(0.6, 0.8, landHeight));
                    
                    // Simple white poles if it resembles Mars
                    float lat = abs(posNorm.y);
                    if (baseColor.r > 0.6 && baseColor.g < 0.4) {
                        albedo = mix(albedo, vec3(0.95), smoothstep(0.92, 0.96, lat));
                    }
                }
                specular = 0.0;
            }
            
            // Final Lighting
            vec3 ambient = albedo * 0.05;
            vec3 diffuse = albedo * NdotL * 0.95;
            vec3 lit = ambient + diffuse + (vec3(1.0) * specular * NdotL);
            
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
            float NdotL = max(dot(-n, normalize(sunDir)), 0.0);
            
            // MATH FOR ZONAL WINDS 
            // Swirling bands driven in opposite directions based on Latitude (vPos.y)
            vec3 p = normalize(vPos) * cloudScale;
            float lat = p.y;
            float flow = sin(lat * 15.0); // positive or negative direction based on band
            p.x += flow * time * 0.25; 
            p.z += flow * time * 0.15;
            
            // Add vertical convective turbulence slowly
            p.y -= time * 0.08;
            
            float noise = fbm3(p, 6);
            
            // Belt boundaries
            float band = sin(lat * 20.0 + noise * 4.0) * 0.5 + 0.5;
            vec3 stormColor = baseColor * 0.5;
            vec3 cloudColor = baseColor * 1.4;
            
            vec3 col = mix(stormColor, cloudColor, band * 0.7 + noise * 0.3);
            col *= (0.3 + NdotL * 0.7);
            
            float alpha = clamp(0.5 + noise * 0.5, 0.2, 0.95);
            gl_FragColor = vec4(col, alpha);
        }
    `
};

/* ═══ TRUE OPTICAL DEPTH ATMOSPHERE SHADER ═══ */
export const SKY_SHADER = {
    uniforms: {
        skyColor: { value: new THREE.Vector3(0.3, 0.6, 1.0) },
        sunDir: { value: null },
    },
    vertexShader: `
        varying vec3 vDir;
        void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vDir = normalize(worldPos.xyz - cameraPosition);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 skyColor;
        uniform vec3 sunDir;
        varying vec3 vDir;
        
        #define PLANET_RADIUS 6000.0
        #define ATMOS_RADIUS 9000.0
        #define RAY_STEPS 16
        #define LIGHT_STEPS 4

        // Ray-Sphere Intersection
        vec2 rsi(vec3 r0, vec3 rd, float sr) {
            float a = dot(rd, rd);
            float b = 2.0 * dot(rd, r0);
            float c = dot(r0, r0) - (sr * sr);
            float d = (b*b) - 4.0*a*c;
            if (d < 0.0) return vec2(1e5, -1e5);
            return vec2(
                (-b - sqrt(d))/(2.0*a),
                (-b + sqrt(d))/(2.0*a)
            );
        }

        void main() {
            vec3 rd = normalize(vDir);
            vec3 ro = cameraPosition; // Since planet is at (0,0,0) locally relative to camera
            vec3 pSun = normalize(sunDir);
            
            vec2 p = rsi(ro, rd, ATMOS_RADIUS);
            if (p.x > p.y) discard; // Escaped bounding atmospheric sphere
            
            p.y = min(p.y, rsi(ro, rd, PLANET_RADIUS).x);
            
            float stepSize = (p.y - max(p.x, 0.0)) / float(RAY_STEPS);
            float stepLen = max(p.x, 0.0) + stepSize * 0.5;
            
            // Dynamic Rayleigh properties based on generated planet biome skyColor
            vec3 betaR = skyColor * 0.00003; 
            float betaM = 0.000006;
            float hR = 400.0; // Rayleigh threshold altitude map
            float hM = 200.0; // Mie thick dust boundary
            
            float odR = 0.0, odM = 0.0;
            vec3 scatterR = vec3(0.0);
            vec3 scatterM = vec3(0.0);
            
            float mu = dot(rd, pSun);
            float mumu = mu * mu;
            float phaseR = 3.0 / (16.0 * 3.14159) * (1.0 + mumu);
            float g = 0.76;
            float phaseM = 3.0 / (8.0 * 3.14159) * ((1.0 - g*g) * (1.0 + mumu)) / ((2.0 + g*g) * pow(1.0 + g*g - 2.0*g*mu, 1.5));
            
            for (int i = 0; i < RAY_STEPS; i++) {
                vec3 iPos = ro + rd * stepLen;
                float height = length(iPos) - PLANET_RADIUS;
                if (height < 0.0) break;
                
                // Density calculation relative to altitude
                float hr = exp(-height / hR) * stepSize;
                float hm = exp(-height / hM) * stepSize;
                odR += hr;
                odM += hm;
                
                // Secondary check for optical occlusion against sun penetration (Planet shadow/dusk cutoff)
                vec2 ls = rsi(iPos, pSun, ATMOS_RADIUS);
                float lStepSize = ls.y / float(LIGHT_STEPS);
                float lStepLen = lStepSize * 0.5;
                float lodR = 0.0, lodM = 0.0;
                
                bool eclipsed = false;
                for (int j = 0; j < LIGHT_STEPS; j++) {
                    vec3 jPos = iPos + pSun * lStepLen;
                    float jHeight = length(jPos) - PLANET_RADIUS;
                    if (jHeight < 0.0) { eclipsed = true; break; }
                    lodR += exp(-jHeight / hR) * lStepSize;
                    lodM += exp(-jHeight / hM) * lStepSize;
                    lStepLen += lStepSize;
                }
                
                // Additive in-scattering evaluation
                if (!eclipsed) {
                    vec3 attn = exp(-(betaR * (odR + lodR) + betaM * 1.1 * (odM + lodM)));
                    scatterR += hr * attn;
                    scatterM += hm * attn;
                }
                
                stepLen += stepSize;
            }
            
            vec3 col = scatterR * betaR * phaseR + scatterM * betaM * phaseM;
            
            // Over-exposure mapping (HDR emulation inside specific gas limits)
            col *= 50.0;
            col = 1.0 - exp(-col);
            
            // Pure optical day/night transparency
            // As particles thin out, the physical visual light drops, fading identically off to reveal the true starry volume
            float luminance = dot(col, vec3(0.2126, 0.7152, 0.0722));
            float alpha = smoothstep(0.005, 0.08, luminance);
            
            gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.95));
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
