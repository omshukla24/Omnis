/* ═══════════════════════════════════════════════════════════════
   OMNIS — Cinematic Breathing Space Audio Engine
   Pure sine waves, heavy low-pass filtering, slow LFO modulation.
   Designed to feel like distant gravitational pressure, not noise.
   ═══════════════════════════════════════════════════════════════ */

export class SpaceAudioEngine {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;
        this.initialized = false;

        // Node references for cleanup
        this._nodes = [];
    }

    init() {
        if (this.initialized) return;

        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.audioCtx.createGain();
        // Max master volume is 12%. This is a background FEELING, not a sound.
        this.masterGain.gain.value = 0.0;
        this.masterGain.connect(this.audioCtx.destination);

        this._createDeepSpaceDrone();
        this._createBlackHoleRumble();

        this.initialized = true;
    }

    /* ── Deep Space Ambient ──────────────────────────────────────
       An ultra-low sine drone that plays whenever you are in
       system/galaxy view. Barely perceptible, like tinnitus in
       the cosmic void.
    ────────────────────────────────────────────────────────────── */
    _createDeepSpaceDrone() {
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 55; // A1, just below threshold of conscious hearing

        // Low-pass to muffle it into pure sub-bass
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 120;
        filter.Q.value = 1.0;

        // Slow breathing LFO: 1 full swell every 20 seconds
        const lfo = this.audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.05;

        const lfoGain = this.audioCtx.createGain();
        lfoGain.gain.value = 0.04; // Very subtle volume swell

        // Wire: osc → filter → lfoGain → master
        lfo.connect(lfoGain.gain);
        osc.connect(filter);
        filter.connect(lfoGain);

        this._spaceDroneGain = this.audioCtx.createGain();
        this._spaceDroneGain.gain.value = 0.0;
        lfoGain.connect(this._spaceDroneGain);
        this._spaceDroneGain.connect(this.masterGain);

        osc.start();
        lfo.start();
        this._nodes.push(osc, lfo);
    }

    /* ── Black Hole Gravitational Rumble ─────────────────────────
       45Hz sine + 30Hz sub-harmonic. Activates dynamically when
       camera approaches a black hole. The closer you get, the
       louder and deeper the chest-pressure becomes.
    ────────────────────────────────────────────────────────────── */
    _createBlackHoleRumble() {
        // Primary rumble
        const rumble = this.audioCtx.createOscillator();
        rumble.type = 'sine';
        rumble.frequency.value = 45;

        // Sub-harmonic for visceral chest pressure
        const sub = this.audioCtx.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = 30;

        // Heavy low-pass: nothing above 100Hz
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 100;
        filter.Q.value = 2.0;

        // Breathing LFO: 1 cycle every 15 seconds
        const lfo = this.audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.067;

        const lfoGain = this.audioCtx.createGain();
        lfoGain.gain.value = 0.06;

        // Dedicated gain node for proximity-based volume
        this._bhGain = this.audioCtx.createGain();
        this._bhGain.gain.value = 0.0; // Starts silent

        // Wire
        lfo.connect(lfoGain.gain);
        rumble.connect(filter);
        sub.connect(filter);
        filter.connect(lfoGain);
        lfoGain.connect(this._bhGain);
        this._bhGain.connect(this.masterGain);

        rumble.start();
        sub.start();
        lfo.start();
        this._nodes.push(rumble, sub, lfo);
    }

    /* ── Public API ──────────────────────────────────────────── */

    /**
     * Enable the ambient space drone.
     * @param {number} intensity 0.0–1.0
     */
    setSpaceDrone(intensity) {
        if (!this.initialized || !this._spaceDroneGain) return;
        const vol = Math.max(0, Math.min(intensity, 1.0)) * 0.12;
        this._spaceDroneGain.gain.setTargetAtTime(vol, this.audioCtx.currentTime, 2.0);
        this.masterGain.gain.setTargetAtTime(1.0, this.audioCtx.currentTime, 0.5);
    }

    /**
     * Set black hole rumble intensity based on camera distance.
     * @param {number} distance  — distance from camera to black hole
     * @param {number} maxRange — distance at which volume = 0
     */
    setBlackHoleProximity(distance, maxRange = 500) {
        if (!this.initialized || !this._bhGain) return;
        let intensity = 1.0 - (distance / maxRange);
        intensity = Math.max(0.0, Math.min(intensity, 1.0));
        // Never exceed 0.25 absolute volume
        const vol = intensity * 0.25;
        this._bhGain.gain.setTargetAtTime(vol, this.audioCtx.currentTime, 1.0);
        this.masterGain.gain.setTargetAtTime(1.0, this.audioCtx.currentTime, 0.5);
    }

    /**
     * Fade everything to silence smoothly.
     */
    fadeOut() {
        if (!this.initialized) return;
        this.masterGain.gain.setTargetAtTime(0.0, this.audioCtx.currentTime, 2.0);
    }

    /**
     * Suspend the audio context entirely (saves CPU).
     */
    suspend() {
        if (this.audioCtx && this.audioCtx.state === 'running') {
            this.audioCtx.suspend();
        }
    }

    resume() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }
}
