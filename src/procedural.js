/* ═══════════════════════════════════════════════════════════════
   OMNIS — Procedural Generation Utilities
   Seeded RNG, noise functions, fractal Brownian motion
   ═══════════════════════════════════════════════════════════════ */

// Seeded pseudorandom number generator (Mulberry32)
export class SeededRandom {
    constructor(seed = 42) {
        this.seed = seed;
        this.state = seed;
    }

    next() {
        this.state |= 0;
        this.state = (this.state + 0x6D2B79F5) | 0;
        let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    range(min, max) {
        return min + this.next() * (max - min);
    }

    int(min, max) {
        return Math.floor(this.range(min, max + 1));
    }

    pick(arr) {
        return arr[Math.floor(this.next() * arr.length)];
    }

    chance(probability) {
        return this.next() < probability;
    }

    gaussian(mean = 0, stddev = 1) {
        const u1 = this.next();
        const u2 = this.next();
        return mean + stddev * Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
    }

    // Generate a deterministic hash from a string
    static hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return Math.abs(hash);
    }
}

// GLSL noise library (shared across all shaders)
export const GLSL_NOISE = `
    // --- Hash & Noise Primitives ---
    float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
    }

    float hash31(vec3 p) {
        p = fract(p * vec3(0.1031, 0.1030, 0.0973));
        p += dot(p, p.yxz + 33.33);
        return fract((p.x + p.y) * p.z);
    }

    vec3 hash33(vec3 p) {
        p = vec3(dot(p,vec3(127.1,311.7,74.7)),
                 dot(p,vec3(269.5,183.3,246.1)),
                 dot(p,vec3(113.5,271.9,124.6)));
        return fract(sin(p)*43758.5453123);
    }

    float noise2D(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float noise3D(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n = mix(
            mix(mix(hash31(i), hash31(i+vec3(1,0,0)), f.x),
                mix(hash31(i+vec3(0,1,0)), hash31(i+vec3(1,1,0)), f.x), f.y),
            mix(mix(hash31(i+vec3(0,0,1)), hash31(i+vec3(1,0,1)), f.x),
                mix(hash31(i+vec3(0,1,1)), hash31(i+vec3(1,1,1)), f.x), f.y),
            f.z);
        return n;
    }

    // Fractal Brownian Motion
    float fbm(vec2 p, int octaves) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        for (int i = 0; i < 8; i++) {
            if (i >= octaves) break;
            value += amplitude * noise2D(p * frequency);
            frequency *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }

    float fbm3(vec3 p, int octaves) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        for (int i = 0; i < 8; i++) {
            if (i >= octaves) break;
            value += amplitude * noise3D(p * frequency);
            frequency *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }

    // Voronoi / cellular noise (for craters)
    float voronoi(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float minDist = 1.0;
        for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
                vec2 neighbor = vec2(float(x), float(y));
                vec2 point = vec2(hash21(i + neighbor));
                vec2 diff = neighbor + point - f;
                minDist = min(minDist, length(diff));
            }
        }
        return minDist;
    }
`;

// Planet name generator parts
const PREFIXES = ['Kep', 'Gal', 'Ori', 'Nel', 'Zan', 'Vor', 'Pyx', 'Lyr', 'Aqu', 'Dra', 'Sig', 'Tau', 'Vel', 'Cas', 'And', 'Eri', 'Hya', 'Leo', 'Vir', 'Lib'];
const SUFFIXES = ['on', 'is', 'ar', 'us', 'en', 'ax', 'ix', 'or', 'um', 'ia', 'os', 'el', 'an', 'er'];
const GALAXY_PREFIXES = ['NGC', 'IC', 'UGC', 'PGC', 'MCG', 'ESO', 'Abell', 'Mrk'];
const GALAXY_NAMES = ['Andromeda', 'Whirlpool', 'Sombrero', 'Pinwheel', 'Cartwheel', 'Sunflower', 'Tadpole', 'Cigar', 'Black Eye', 'Sculptor'];

export function generateStarName(rng) {
    if (rng.chance(0.3)) {
        return rng.pick(PREFIXES) + rng.pick(SUFFIXES) + '-' + rng.int(1, 999);
    }
    return 'HD ' + rng.int(10000, 999999);
}

export function generatePlanetName(rng, starName, index) {
    const letters = 'bcdefghijklmn';
    if (rng.chance(0.4)) {
        return rng.pick(PREFIXES) + rng.pick(SUFFIXES);
    }
    return starName + ' ' + letters[index % letters.length];
}

export function generateGalaxyName(rng) {
    if (rng.chance(0.2)) {
        return rng.pick(GALAXY_NAMES);
    }
    return rng.pick(GALAXY_PREFIXES) + ' ' + rng.int(100, 99999);
}

const UNIVERSE_PREFIXES = ['Cosmos', 'Realm', 'Dimension', 'Sector', 'Nexus', 'Continuum', 'Expanse', 'Void'];
const UNIVERSE_SUFFIXES = ['Alpha', 'Beta', 'Prime', 'Zero', 'Omega', 'Epsilon', 'Zeta', 'Sigma'];

export function generateSystemName(rng) {
    if (rng.chance(0.3)) {
        return rng.pick(PREFIXES) + rng.pick(SUFFIXES) + ' System';
    }
    return rng.pick(PREFIXES) + ' Prime System';
}

export function generateUniverseName(rng) {
    if (rng.chance(0.5)) {
        return rng.pick(UNIVERSE_PREFIXES) + ' ' + rng.pick(UNIVERSE_SUFFIXES);
    }
    return 'Universe ' + rng.pick(UNIVERSE_SUFFIXES) + '-' + rng.int(1, 99);
}
