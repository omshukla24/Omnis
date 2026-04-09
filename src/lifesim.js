/* ═══════════════════════════════════════════════════════════════
   OMNIS — Life Simulation Engine
   Calculates habitability, biosphere, and civilization levels
   ═══════════════════════════════════════════════════════════════ */

const TECH_LEVELS = [
    'None', 'Prebiotic', 'Microbial', 'Multicellular', 'Pre-Industrial',
    'Industrial', 'Atomic Age', 'Space Age', 'Interplanetary',
    'Type I', 'Type II', 'Type III'
];

const BIOSPHERE_LEVELS = [
    'Barren', 'Prebiotic Chemistry', 'Microbial Mats', 'Simple Multicellular',
    'Complex Multicellular', 'Diverse Ecosystem', 'Intelligent Life', 'Civilization'
];

const ATMOSPHERE_TYPES = [
    'None', 'Trace (CO₂)', 'Thin CO₂', 'Dense CO₂',
    'N₂/O₂ Mix', 'H₂/He', 'CH₄/N₂', 'Exotic'
];

export class LifeSimulator {
    /**
     * Compute full life simulation data for a planet
     * @param {object} planet - Planet data with tempK, distAU, etc.
     * @param {object} rng - SeededRandom instance
     * @returns {object} Life simulation data
     */
    static analyze(planet, rng) {
        // Habitability score (0-100)
        let hab = 0;

        // Temperature factor (most habitable around 250-320K)
        const tempK = planet.tempK || 200;
        const tempScore = Math.max(0, 1.0 - Math.pow((tempK - 288) / 150, 2)) * 35;
        hab += tempScore;

        // Atmosphere factor
        const hasAtmo = planet.atmosphere && planet.atmosphere !== 'None' && planet.atmosphere !== 'None (exosphere)';
        const atmoScore = hasAtmo ? 20 : 0;
        hab += atmoScore;

        // Water factor
        const waterCoverage = planet.waterCoverage || (hasAtmo && tempK > 250 && tempK < 370 ? rng.range(0, 80) : 0);
        const waterScore = Math.min(waterCoverage / 100, 1.0) * 25;
        hab += waterScore;

        // Star distance factor (goldilocks zone ~ 0.8-1.5 AU for G-type)
        const dist = planet.distAU || 1.0;
        const zoneScore = Math.max(0, 1.0 - Math.pow((dist - 1.0) / 0.8, 2)) * 20;
        hab += zoneScore;

        hab = Math.min(100, Math.max(0, Math.round(hab)));

        // Override for known planets
        if (planet.habitability !== undefined) {
            hab = planet.habitability;
        }

        // Biosphere level based on habitability
        let bioIndex = 0;
        if (hab > 10) bioIndex = 1;
        if (hab > 25) bioIndex = 2;
        if (hab > 40) bioIndex = 3;
        if (hab > 55) bioIndex = 4;
        if (hab > 70) bioIndex = 5;
        if (hab > 85) bioIndex = 6;
        if (hab > 92) bioIndex = 7;

        // Use planet's biosphere if specified
        const biosphere = planet.biosphere || BIOSPHERE_LEVELS[bioIndex];

        // Population (only if hab > 60)
        let population = '0';
        if (planet.population) {
            population = planet.population;
        } else if (hab > 85) {
            population = (rng.range(1, 15)).toFixed(1) + ' billion';
        } else if (hab > 70) {
            population = Math.round(rng.range(1, 999)) + ' million';
        } else if (hab > 55) {
            population = Math.round(rng.range(1, 999)) + ' thousand';
        }

        // Tech level
        let techIndex = 0;
        if (planet.techLevel) {
            // Find closest match
            techIndex = TECH_LEVELS.findIndex(t =>
                planet.techLevel.toLowerCase().includes(t.toLowerCase())
            );
            if (techIndex < 0) techIndex = 0;
        } else if (hab > 92) {
            techIndex = rng.int(4, 9);
        } else if (hab > 80) {
            techIndex = rng.int(2, 5);
        } else if (hab > 60) {
            techIndex = rng.int(1, 3);
        }

        const techLevel = planet.techLevel || TECH_LEVELS[techIndex];

        // Atmosphere display
        const atmosphere = planet.atmosphere || ATMOSPHERE_TYPES[Math.min(Math.floor(hab / 15), ATMOSPHERE_TYPES.length - 1)];

        // Surface temperature display
        const tempDisplay = planet.tempDisplay || `${Math.round(tempK - 273)} °C`;

        // Water display
        const waterDisplay = waterCoverage > 0 ? `${Math.round(waterCoverage)}%` : 'None detected';

        return {
            habitability: hab,
            biosphere,
            population,
            techLevel,
            atmosphere,
            waterCoverage: waterDisplay,
            temperature: tempDisplay,
        };
    }
}
