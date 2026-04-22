// Audio System for Buckshot Roulette
// Uses real audio files from audio/ directory, with Web Audio API synthesis as fallback

const AUDIO_DIR = 'audio/';
const AUDIO_FILES = {
    shotgunBlast: AUDIO_DIR + 'shotgun_blast.mp3',
    blankShot:    AUDIO_DIR + 'blank_shot.mp3',
    shellLoad:    AUDIO_DIR + 'shell_load.mp3',
    itemUse:      AUDIO_DIR + 'item_use.mp3',
    hit:          AUDIO_DIR + 'hit.mp3',
    roundStart:   AUDIO_DIR + 'round_start.mp3',
    victory:      AUDIO_DIR + 'victory.mp3',
    gameOver:     AUDIO_DIR + 'game_over.mp3',
    bgm:          AUDIO_DIR + 'bgm.mp3'
};

// Preloaded Audio elements
const sounds = {};
let bgmAudio = null;
let bgmPlaying = false;
let audioCtx = null;
let isMuted = false;

export function getMuted() { return isMuted; }

export function setMuted(muted) {
    isMuted = muted;
    if (isMuted) {
        // Pause all HTML Audio sounds
        Object.values(sounds).forEach(s => { if (s.pause) s.pause(); });
        stopBGMusic();
    }
}

function getCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        window._audioCtx = audioCtx;
    }
    return audioCtx;
}

function loadSound(name) {
    return new Promise((resolve) => {
        const audio = new Audio(AUDIO_FILES[name]);
        audio.preload = 'auto';
        audio.addEventListener('canplaythrough', () => resolve(audio), { once: true });
        audio.addEventListener('error', () => {
            console.warn(`Failed to load audio: ${AUDIO_FILES[name]}, using synthesis fallback`);
            resolve(null);
        });
        audio.load();
    });
}

async function preloadAll() {
    const entries = Object.entries(AUDIO_FILES).filter(([k]) => k !== 'bgm');
    await Promise.all(entries.map(([name]) =>
        loadSound(name).then(audio => { if (audio) sounds[name] = audio; })
    ));
    // BGM loaded separately when needed
    const bgm = await loadSound('bgm');
    if (bgm) bgmAudio = bgm;
}

preloadAll();

function playSound(name) {
    if (isMuted) return;
    if (sounds[name]) {
        const audio = sounds[name].cloneNode();
        audio.volume = 0.6;
        audio.play().catch(() => {});
    }
}

// ====== Synthesized Fallbacks ======

const noiseCache = new Map();

function createNoise(duration, volume = 0.3) {
    const key = `${duration}_${volume}`;
    if (noiseCache.has(key)) return noiseCache.get(key);
    const ctx = getCtx();
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * volume;
    }
    if (noiseCache.size > 10) noiseCache.clear();
    noiseCache.set(key, buffer);
    return buffer;
}

function synthShotgunBlast() {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = createNoise(0.4, 0.8);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(3000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.3);
    noiseSource.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
    noiseSource.start(now);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.8, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
}

function synthBlankShot() {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const click = ctx.createOscillator();
    click.type = 'square';
    click.frequency.setValueAtTime(800, now);
    click.frequency.exponentialRampToValueAtTime(100, now + 0.05);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.3, now);
    clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    click.connect(clickGain).connect(ctx.destination);
    click.start(now);
    click.stop(now + 0.05);
}

function synthHit() {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = createNoise(0.3, 0.6);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    noiseSource.connect(noiseGain).connect(ctx.destination);
    noiseSource.start(now);
}

function synthVictory() {
    const ctx = getCtx();
    const now = ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        const t = now + i * 0.2;
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.5);
    });
}

function synthGameOver() {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 2.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 2.5);
}

// ====== Exported Functions ======

export function playShotgunBlast() {
    if (sounds.shotgunBlast) { playSound('shotgunBlast'); return; }
    synthShotgunBlast();
}

export function playBlankShot() {
    if (sounds.blankShot) { playSound('blankShot'); return; }
    synthBlankShot();
}

export function playShellLoad() {
    if (sounds.shellLoad) { playSound('shellLoad'); return; }
    // Simple click fallback
    const ctx = getCtx();
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const t = now + i * 0.15;
        osc.frequency.setValueAtTime(2000 + Math.random() * 1000, t);
        osc.frequency.exponentialRampToValueAtTime(500, t + 0.08);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
    }
}

export function playItemUse() {
    if (sounds.itemUse) { playSound('itemUse'); return; }
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(900, now + 0.1);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
}

export function playHit() {
    if (sounds.hit) { playSound('hit'); return; }
    synthHit();
}

export function playRoundStart() {
    if (sounds.roundStart) { playSound('roundStart'); return; }
    const ctx = getCtx();
    const now = ctx.currentTime;
    [200, 250, 300].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const t = now + i * 0.3;
        osc.frequency.setValueAtTime(freq, t);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.8);
    });
}

export function playVictory() {
    if (sounds.victory) { playSound('victory'); return; }
    synthVictory();
}

export function playGameOver() {
    if (sounds.gameOver) { playSound('gameOver'); return; }
    synthGameOver();
}

// ====== Background Music ======

export function startBGMusic() {
    if (bgmPlaying) return;
    bgmPlaying = true;

    if (bgmAudio) {
        bgmAudio.loop = true;
        bgmAudio.volume = 0.3;
        bgmAudio.play().catch(() => {});
        return;
    }

    // Synthesis fallback - deep drone
    const ctx = getCtx();
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 55;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.08;
    drone.connect(droneGain).connect(ctx.destination);
    drone.start();
}

export function stopBGMusic() {
    bgmPlaying = false;
    if (bgmAudio) {
        bgmAudio.pause();
        bgmAudio.currentTime = 0;
    }
}
