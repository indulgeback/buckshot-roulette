import * as THREE from 'three';
import { initScene, animateShot, animateHit, animateRoundStart, animateShellReload, animateItemUse, animateStageTransition, animateVictory, animateDefeat, setDealerAnim, setSceneMood } from './scene.js';
import { checkAchievements, resetSessionStats, toggleAchievementPanel, getStats, trackStat } from './achievements.js';
import { makeAIDecision, getAIDifficulty, setAIDifficulty } from './ai.js';
import {
    playShotgunBlast, playBlankShot, playShellLoad,
    playItemUse, playHit, playRoundStart,
    playVictory, playGameOver, startBGMusic, stopBGMusic,
    setMuted, getMuted, getSfxVolume, setSfxVolume, getBgmVolume, setBgmVolume
} from './audio.js';
import { t, setLang, getLang, initI18n, updateDOM, onLangChange } from './i18n.js';

// ====== Constants ======

const GameState = {
    MENU: 'menu',
    ROUND_START: 'round_start',
    PLAYER_TURN: 'player_turn',
    DEALER_TURN: 'dealer_turn',
    ANIMATING: 'animating',
    GAME_OVER: 'game_over',
    VICTORY: 'victory'
};

const Items = {
    MAGNIFYING_GLASS: { id: 'magnifying_glass' },
    BEER: { id: 'beer' },
    HANDSAW: { id: 'handsaw' },
    CIGARETTE: { id: 'cigarette' },
    HANDCUFFS: { id: 'handcuffs' },
    EXPIRED_MEDICINE: { id: 'expired_medicine' },
    INVERTER: { id: 'inverter' },
    BURNER_PHONE: { id: 'burner_phone' },
    ADRENALINE: { id: 'adrenaline' }
};

const STAGE_CONFIG = {
    1: { hp: 2, items: 0 },
    2: { hp: 4, items: 3 },
    3: { hp: 5, items: 4 }
};

const DELAY = {
    ANIM: 500,
    MESSAGE: 1500,
    ROUND_START: 2000,
    DEALER_THINK: 1000
};

// ====== Game State ======

let gameData = {
    state: GameState.MENU,
    stage: 1,
    player: { hp: 2, maxHp: 2, items: [], handcuffed: false },
    dealer: { hp: 2, maxHp: 2, items: [], handcuffed: false },
    shotgun: { shells: [], currentIndex: 0, sawedOff: false },
    shellInfo: { live: 0, blank: 0 },
    aiKnownShell: null,
    donRound: 0
};

// Event Log System
const EventLog = {
    maxEntries: 50,
    entries: [],

    add(text, type = 'info', icon = '•') {
        const now = new Date();
        const time = `${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        this.entries.unshift({ text, type, icon, time });
        if (this.entries.length > this.maxEntries) {
            this.entries.pop();
        }
        this.render();
    },

    render() {
        const container = document.getElementById('event-log-content');
        if (!container) return;

        container.innerHTML = this.entries.map(entry => `
            <div class="event-log-entry ${entry.type}">
                <div class="event-time">${entry.time}</div>
                <div><span class="event-icon">${entry.icon}</span>${entry.text}</div>
            </div>
        `).join('');

        container.scrollTop = 0;
    },

    clear() {
        this.entries = [];
        this.render();
    }
};

// ====== Audio Control ======

let isMuted = false;

function toggleMute() {
    isMuted = !isMuted;
    setMuted(isMuted);
    if (!isMuted && gameData.state !== GameState.MENU) {
        startBGMusic();
    }
    updateMuteButtons();
}

function updateMuteButtons() {
    const icon = isMuted ? '🔇' : '🔊';
    const menuBtn = document.getElementById('menu-mute-btn');
    if (menuBtn) {
        menuBtn.textContent = icon;
        menuBtn.classList.toggle('muted', isMuted);
    }
    const pauseBtn = document.getElementById('pause-mute-btn');
    if (pauseBtn) {
        pauseBtn.textContent = isMuted ? t('ui.musicOff') : t('ui.musicOn');
    }
}

// ====== Pause Menu ======

let pausedState = null;

function togglePauseMenu() {
    const panel = document.getElementById('pause-menu');
    if (panel.classList.contains('hidden')) {
        if (gameData.state !== GameState.MENU && gameData.state !== GameState.GAME_OVER && gameData.state !== GameState.VICTORY) {
            pausedState = gameData.state;
            gameData.state = GameState.ANIMATING;
        }
        panel.classList.remove('hidden');
        updateMuteButtons();
    } else {
        closePauseMenu();
    }
}

function closePauseMenu() {
    const panel = document.getElementById('pause-menu');
    panel.classList.add('hidden');
    if (pausedState) {
        gameData.state = pausedState;
        pausedState = null;
        updateUI();
    }
}

function pauseRestart() {
    document.getElementById('pause-menu').classList.add('hidden');
    pausedState = null;
    setSceneMood('calm');
    startGame();
}

function pauseQuitToMenu() {
    document.getElementById('pause-menu').classList.add('hidden');
    pausedState = null;
    gameData.state = GameState.MENU;
    stopBGMusic();
    setSceneMood('calm');
    document.getElementById('menu').classList.remove('hidden');
    updateUI();
}

// ====== Helpers ======

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showMessage(text) {
    const msg = document.getElementById('game-message');
    msg.textContent = text;
    msg.style.display = 'block';
}

function hideMessage() {
    document.getElementById('game-message').style.display = 'none';
}

async function flashMessage(text, duration = DELAY.MESSAGE) {
    showMessage(text);
    await delay(duration);
    hideMessage();
}

function updateShellInfo() {
    const remaining = gameData.shotgun.shells.slice(gameData.shotgun.currentIndex);
    gameData.shellInfo.live = remaining.filter(s => s === 'live').length;
    gameData.shellInfo.blank = remaining.filter(s => s === 'blank').length;
}

function getEntity(who) {
    return who === 'player' ? gameData.player : gameData.dealer;
}

function generateItems(count) {
    const pool = Object.values(Items);
    return Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)]);
}

function getShellText(shell) {
    return shell === 'live' ? t('shell.live') : t('shell.blank');
}

function getShellShort(shell) {
    return shell === 'live' ? t('shell.liveShort') : t('shell.blankShort');
}

function getActorName(who) {
    return who === 'player' ? t('actor.you') : t('actor.dealer');
}

// ====== Debug Panel ======

function toggleDebugPanel() {
    const panel = document.getElementById('debug-panel');
    panel.classList.toggle('hidden');
}

function handleDebugAction(e) {
    const btn = e.target;
    const stage = btn.dataset.stage;
    const hp = btn.dataset.hp;
    const item = btn.dataset.item;
    const control = btn.dataset.control;
    const shells = btn.dataset.shells;

    if (stage) {
        setDebugStage(parseInt(stage));
    } else if (hp) {
        handleDebugHP(hp);
    } else if (item) {
        handleDebugItem(item);
    } else if (control) {
        handleDebugControl(control);
    } else if (shells) {
        handleDebugShells(shells);
    }
}

function setDebugStage(stageNum) {
    gameData.stage = stageNum;
    const config = STAGE_CONFIG[stageNum];
    gameData.player.maxHp = config.hp;
    gameData.dealer.maxHp = config.hp;
    gameData.player.hp = config.hp;
    gameData.dealer.hp = config.hp;
    flashMessage(t('debug.msg.switchStage', { stage: stageNum }), 1000);
    updateUI();
}

function handleDebugHP(action) {
    switch (action) {
        case 'heal-player':
            gameData.player.hp = Math.min(gameData.player.hp + 1, gameData.player.maxHp);
            flashMessage(t('debug.msg.healPlayer'), 800);
            break;
        case 'hurt-player':
            gameData.player.hp = Math.max(gameData.player.hp - 1, 0);
            flashMessage(t('debug.msg.hurtPlayer'), 800);
            break;
        case 'heal-dealer':
            gameData.dealer.hp = Math.min(gameData.dealer.hp + 1, gameData.dealer.maxHp);
            flashMessage(t('debug.msg.healDealer'), 800);
            break;
        case 'hurt-dealer':
            gameData.dealer.hp = Math.max(gameData.dealer.hp - 1, 0);
            flashMessage(t('debug.msg.hurtDealer'), 800);
            break;
    }
    updateUI();
}

function handleDebugItem(action) {
    switch (action) {
        case 'random':
            const count = STAGE_CONFIG[gameData.stage].items || 3;
            gameData.player.items = generateItems(count);
            gameData.dealer.items = generateItems(count);
            flashMessage(t('debug.msg.randomItem', { count }), 800);
            break;
        case 'clear':
            gameData.player.items = [];
            gameData.dealer.items = [];
            flashMessage(t('debug.msg.clearItems'), 800);
            break;
    }
    updateUI();
}

function handleDebugControl(action) {
    switch (action) {
        case 'skip-dealer':
            if (gameData.state === GameState.DEALER_TURN) {
                setTurn('player');
                flashMessage(t('debug.msg.skipDealer'), 800);
            }
            break;
        case 'new-round':
            startRound();
            break;
    }
}

function handleDebugShells(action) {
    const currentShell = gameData.shotgun.shells[gameData.shotgun.currentIndex];
    switch (action) {
        case 'peek':
            if (currentShell) {
                flashMessage(t('debug.msg.peekShell', { shell: getShellShort(currentShell) }), 1500);
            }
            break;
        case 'set-live':
            if (gameData.shotgun.currentIndex < gameData.shotgun.shells.length) {
                gameData.shotgun.shells[gameData.shotgun.currentIndex] = 'live';
                updateShellInfo();
                flashMessage(t('debug.msg.setLive'), 1000);
            }
            break;
        case 'set-blank':
            if (gameData.shotgun.currentIndex < gameData.shotgun.shells.length) {
                gameData.shotgun.shells[gameData.shotgun.currentIndex] = 'blank';
                updateShellInfo();
                flashMessage(t('debug.msg.setBlank'), 1000);
            }
            break;
    }
    updateUI();
}

// ====== Init ======

async function init() {
    await initI18n();
    initScene();
    setupEventListeners();
    setupSettingsListeners();
    updateUI();
    updateLangSwitchUI();
}

function setupEventListeners() {
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', restartGame);
    document.getElementById('don-btn').addEventListener('click', startDoubleOrNothing);
    document.getElementById('shoot-self-btn').addEventListener('click', () => executeShot('player', 'player'));
    document.getElementById('shoot-dealer-btn').addEventListener('click', () => executeShot('player', 'dealer'));

    // Debug panel
    document.getElementById('debug-toggle').addEventListener('click', toggleDebugPanel);
    document.getElementById('debug-close').addEventListener('click', () => {
        document.getElementById('debug-panel').classList.add('hidden');
    });

    // Debug buttons
    document.querySelectorAll('.debug-btn').forEach(btn => {
        btn.addEventListener('click', handleDebugAction);
    });

    // Event log toggle (mobile)
    const logToggle = document.getElementById('event-log-toggle');
    const sidebar = document.getElementById('right-sidebar');
    if (logToggle && sidebar) {
        logToggle.addEventListener('click', () => {
            sidebar.classList.toggle('log-open');
        });
    }

    // Achievement panel buttons
    const achBtn = document.getElementById('achievement-btn');
    if (achBtn) achBtn.addEventListener('click', toggleAchievementPanel);

    const achToggle = document.getElementById('achievement-toggle');
    if (achToggle) achToggle.addEventListener('click', toggleAchievementPanel);

    const achClose = document.getElementById('achievement-close');
    if (achClose) achClose.addEventListener('click', toggleAchievementPanel);

    // Pause menu
    document.getElementById('pause-btn').addEventListener('click', togglePauseMenu);
    document.getElementById('pause-resume-btn').addEventListener('click', closePauseMenu);
    document.getElementById('pause-restart-btn').addEventListener('click', pauseRestart);
    document.getElementById('pause-quit-btn').addEventListener('click', pauseQuitToMenu);
    document.getElementById('pause-mute-btn').addEventListener('click', toggleMute);

    // How to play panel
    const htpBtn = document.getElementById('how-to-play-btn');
    const htpPanel = document.getElementById('how-to-play');
    const htpClose = document.getElementById('how-to-play-close');
    if (htpBtn) htpBtn.addEventListener('click', () => {
        if (htpPanel) htpPanel.classList.remove('hidden');
    });
    if (htpClose) htpClose.addEventListener('click', () => {
        if (htpPanel) htpPanel.classList.add('hidden');
    });

    // Menu mute button
    document.getElementById('menu-mute-btn').addEventListener('click', toggleMute);

    // Language switch
    document.querySelectorAll('#lang-switch button').forEach(btn => {
        btn.addEventListener('click', async () => {
            const lang = btn.dataset.lang;
            await setLang(lang);
            updateLangSwitchUI();
            updateUI();
            // Re-render event log entries (they were logged with translated strings)
        });
    });

    // Escape key to toggle pause
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') togglePauseMenu();
    });
}

function updateLangSwitchUI() {
    const current = getLang();
    document.querySelectorAll('#lang-switch button, #settings-lang-switch button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === current);
    });
}

// ====== Settings ======

const SETTINGS_KEY = 'buckshot_settings';
let appSettings = loadSettings();

function loadSettings() {
    try {
        const data = JSON.parse(localStorage.getItem(SETTINGS_KEY));
        if (data) return data;
    } catch (e) { /* ignore */ }
    return { screenShake: true, bloom: true };
}

function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings)); } catch (e) { /* ignore */ }
}

function openSettingsPanel() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;
    panel.classList.remove('hidden');
    syncSettingsUI();
}

function closeSettingsPanel() {
    document.getElementById('settings-panel').classList.add('hidden');
}

function syncSettingsUI() {
    // Volume sliders
    const bgmSlider = document.getElementById('bgm-volume');
    const sfxSlider = document.getElementById('sfx-volume');
    if (bgmSlider) {
        bgmSlider.value = Math.round(getBgmVolume() * 100);
        document.getElementById('bgm-volume-val').textContent = bgmSlider.value + '%';
    }
    if (sfxSlider) {
        sfxSlider.value = Math.round(getSfxVolume() * 100);
        document.getElementById('sfx-volume-val').textContent = sfxSlider.value + '%';
    }
    // Toggle buttons
    syncToggle('toggle-shake', appSettings.screenShake);
    syncToggle('toggle-bloom', appSettings.bloom);
    // Language
    updateLangSwitchUI();
    // Difficulty
    syncDifficultyUI();
}

function syncToggle(id, active) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.toggle('active', active);
    btn.textContent = active ? 'ON' : 'OFF';
}

function setupSettingsListeners() {
    // Open/close
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) settingsBtn.addEventListener('click', openSettingsPanel);
    const settingsClose = document.getElementById('settings-close');
    if (settingsClose) settingsClose.addEventListener('click', closeSettingsPanel);

    // Volume sliders
    document.getElementById('bgm-volume').addEventListener('input', (e) => {
        const v = parseInt(e.target.value);
        setBgmVolume(v / 100);
        document.getElementById('bgm-volume-val').textContent = v + '%';
    });
    document.getElementById('sfx-volume').addEventListener('input', (e) => {
        const v = parseInt(e.target.value);
        setSfxVolume(v / 100);
        document.getElementById('sfx-volume-val').textContent = v + '%';
    });

    // Toggles
    document.getElementById('toggle-shake').addEventListener('click', (e) => {
        appSettings.screenShake = !appSettings.screenShake;
        syncToggle('toggle-shake', appSettings.screenShake);
        saveSettings();
    });
    document.getElementById('toggle-bloom').addEventListener('click', (e) => {
        appSettings.bloom = !appSettings.bloom;
        syncToggle('toggle-bloom', appSettings.bloom);
        saveSettings();
    });

    // Stats panel
    const statsBtn = document.getElementById('stats-btn');
    if (statsBtn) statsBtn.addEventListener('click', openStatsPanel);
    const statsClose = document.getElementById('stats-close');
    if (statsClose) statsClose.addEventListener('click', closeStatsPanel);

    // Language switch inside settings
    document.querySelectorAll('#settings-lang-switch button').forEach(btn => {
        btn.addEventListener('click', async () => {
            await setLang(btn.dataset.lang);
            updateLangSwitchUI();
            updateUI();
            syncSettingsUI(); // refresh ON/OFF text in current language
        });
    });

    // Difficulty switch
    document.querySelectorAll('#difficulty-switch button').forEach(btn => {
        btn.addEventListener('click', () => {
            setAIDifficulty(btn.dataset.diff);
            syncDifficultyUI();
        });
    });
}

function syncDifficultyUI() {
    const current = getAIDifficulty();
    document.querySelectorAll('#difficulty-switch button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.diff === current);
    });
}

// ====== Stats Panel ======

function openStatsPanel() {
    const panel = document.getElementById('stats-panel');
    if (!panel) return;
    panel.classList.remove('hidden');
    renderStats();
}

function closeStatsPanel() {
    document.getElementById('stats-panel').classList.add('hidden');
}

function renderStats() {
    const body = document.getElementById('stats-body');
    if (!body) return;
    const s = getStats();
    const played = s.gamesPlayed || 0;
    const won = s.gamesWon || 0;
    const lost = played - won;
    const rate = played > 0 ? Math.round((won / played) * 100) : 0;
    const sc = s.stageClears || {};

    if (played === 0) {
        body.innerHTML = `<div class="stats-empty">${t('stats.notEnough')}</div>`;
        return;
    }

    body.innerHTML = `
        <div class="stats-overview">
            <div class="stats-big"><span class="stats-big-num">${played}</span><span class="stats-big-label">${t('stats.totalGames')}</span></div>
            <div class="stats-big"><span class="stats-big-num" style="color:#4ade80">${won}</span><span class="stats-big-label">${t('stats.wins')}</span></div>
            <div class="stats-big"><span class="stats-big-num" style="color:#f87171">${lost}</span><span class="stats-big-label">${t('stats.losses')}</span></div>
            <div class="stats-big"><span class="stats-big-num" style="color:var(--color-accent)">${rate}%</span><span class="stats-big-label">${t('stats.winRate')}</span></div>
        </div>
        <div class="stats-details">
            ${statsRow(t('stats.bestStreak'), s.maxWinStreak || 0)}
            ${statsRow(t('stats.currentStreak'), s.winStreak || 0)}
            ${statsRow(t('stats.stageClears'), `S1:${sc[1]||0} S2:${sc[2]||0} S3:${sc[3]||0}`)}
            ${statsRow(t('stats.donBest'), s.maxDonStreak || 0)}
            ${statsRow(t('stats.totalShots'), s.totalShotsFired || 0)}
            ${statsRow(t('stats.totalItems'), s.totalItemsUsed || 0)}
            ${statsRow(t('stats.cigaretteHeals'), s.totalCigaretteHeals || 0)}
            ${statsRow(t('stats.handcuffUses'), s.totalHandcuffUses || 0)}
            ${statsRow(t('stats.sawHits'), s.totalSawHits || 0)}
        </div>
    `;
}

function statsRow(label, value) {
    return `<div class="stats-row"><span>${label}</span><span>${value}</span></div>`;
}

// ====== Game Flow ======

function startGame() {
    document.getElementById('menu').classList.add('hidden');
    gameData.stage = 1;
    gameData.player = { hp: 2, maxHp: 2, items: [], handcuffed: false };
    gameData.dealer = { hp: 2, maxHp: 2, items: [], handcuffed: false };
    gameData.aiKnownShell = null;
    EventLog.clear();
    resetSessionStats();
    gameData.donRound = 0;
    EventLog.add(t('event.gameStart'), 'stage', '🎮');
    startBGMusic();
    startRound();
}

function restartGame() {
    document.getElementById('game-over').classList.add('hidden');
    startGame();
}

async function startRound() {
    gameData.state = GameState.ROUND_START;

    const liveCount = Math.floor(Math.random() * 3) + 2;
    const blankCount = Math.floor(Math.random() * 3) + 2;

    const shells = Array.from({ length: liveCount }, () => 'live')
        .concat(Array.from({ length: blankCount }, () => 'blank'));
    shells.sort(() => Math.random() - 0.5);

    gameData.shotgun = { shells, currentIndex: 0, sawedOff: false };
    gameData.shellInfo = { live: liveCount, blank: blankCount };
    gameData.aiKnownShell = null;

    playShellLoad();
    playRoundStart();
    animateRoundStart();
    animateShellReload();

    const config = STAGE_CONFIG[gameData.stage];
    if (config.items > 0) {
        gameData.player.items = generateItems(config.items);
        gameData.dealer.items = generateItems(config.items);
    }

    EventLog.add(
        t('event.roundStart', { live: liveCount, blank: blankCount }),
        'round',
        '🔄'
    );

    checkAchievements('round_start', {});

    await flashMessage(t('event.roundStartFlash', { live: liveCount, blank: blankCount }), DELAY.ROUND_START);

    gameData.state = GameState.PLAYER_TURN;
    updateUI();
}

// ====== Core Shooting ======

async function executeShot(shooter, target) {
    if (shooter === 'player' && gameData.state !== GameState.PLAYER_TURN) return;
    gameData.state = GameState.ANIMATING;

    const shell = gameData.shotgun.shells[gameData.shotgun.currentIndex];
    const damage = gameData.shotgun.sawedOff ? 2 : 1;
    const key = `${shooter}-${target}`;

    // Calculate live probability for achievements
    const remaining = gameData.shotgun.shells.length - gameData.shotgun.currentIndex;
    const liveRemaining = gameData.shotgun.shells.slice(gameData.shotgun.currentIndex).filter(s => s === 'live').length;
    const liveProbability = remaining > 0 ? liveRemaining / remaining : 0;

    animateShot();
    await delay(DELAY.ANIM);

    if (shell === 'live') {
        const targetData = getEntity(target);
        targetData.hp -= damage;
        playShotgunBlast();
        animateHit(target);
        playHit();

        // Dealer reactions
        if (target === 'dealer') setDealerAnim('hit', 800);
        else setDealerAnim('taunting', 1500);

        const shooterName = getActorName(shooter);
        const targetName = getActorName(target);
        const isSelf = shooter === target;

        if (isSelf) {
            EventLog.add(
                t('event.liveShotSelf', { damage }),
                'shoot-live',
                '💥'
            );
        } else {
            EventLog.add(
                t('event.liveShotOther', { target: targetName, damage }),
                'shoot-live',
                '💥'
            );
        }

        // Show message based on who shot whom
        if (shooter === 'player' && target === 'dealer') {
            showMessage(t('event.liveHitDealer', { damage }));
        } else if (shooter === 'player' && target === 'player') {
            showMessage(t('event.liveHitPlayer', { damage }));
        } else if (shooter === 'dealer' && target === 'player') {
            showMessage(t('event.dealerShotPlayer', { damage }));
        } else {
            showMessage(t('event.dealerShotSelf', { damage }));
        }
    } else {
        playBlankShot();

        const shooterName = getActorName(shooter);
        const targetName = getActorName(target);

        EventLog.add(
            `${shooterName}${t('event.blankShot')}${targetName === t('actor.you') ? '' : ' ' + targetName}`,
            'shoot-blank',
            '💨'
        );

        // Show appropriate blank message
        if (shooter === target && shooter === 'player') {
            showMessage(t('event.blankShotSelfContinue'));
        } else if (shooter === target && shooter === 'dealer') {
            showMessage(t('event.blankShotDealerContinue'));
        } else {
            showMessage(t('event.blankShot'));
        }
    }

    gameData.shotgun.sawedOff = false;
    gameData.shotgun.currentIndex++;
    updateShellInfo();
    if (shooter === 'dealer') gameData.aiKnownShell = null;

    // Achievement check
    const targetHpAfter = getEntity(target).hp;
    trackStat('shotFired');
    checkAchievements('shot_fired', {
        shell, shooter, target,
        sawedOff: damage > 1,
        damage,
        targetHpAfter,
        liveProbability
    });

    await delay(DELAY.MESSAGE);
    hideMessage();
    resolveAfterShot(shooter, target, shell);
}

// ====== Post-Shot Resolution ======

function resolveAfterShot(shooter, target, shellType) {
    // Priority 1: Death check
    if (gameData.player.hp <= 0) {
        if (gameData.donRound) { donLost(); return; }
        endGame(false); return;
    }
    if (gameData.dealer.hp <= 0) {
        if (gameData.donRound) {
            gameData.state = GameState.VICTORY;
            stopBGMusic();
            playVictory();
            animateVictory();
            setSceneMood('victory');
            EventLog.add(t('don.win', { round: gameData.donRound }), 'victory', '🏆');
            trackStat('donStreak', gameData.donRound);
            document.getElementById('game-over-title').textContent = t('gameOver.donWin');
            document.getElementById('game-over-message').textContent = t('gameOver.donWinMsg', { round: gameData.donRound });
            document.getElementById('don-btn').style.display = 'block';
            document.getElementById('game-over').classList.remove('hidden');
            return;
        }
        gameData.stage >= 3 ? endGame(true) : nextStage();
        return;
    }
    // Priority 2: Shells spent
    if (gameData.shotgun.currentIndex >= gameData.shotgun.shells.length) {
        if (gameData.donRound) {
            startDoubleOrNothing();
            return;
        }
        startRound();
        return;
    }
    // Priority 3: Turn switch
    switchTurn(shooter, target, shellType);
}

function switchTurn(shooter, target, shellType) {
    const shotSelf = (shooter === target);

    // Blank + shot self → keep turn
    if (shellType === 'blank' && shotSelf) {
        setTurn(shooter);
        const text = shooter === 'player' ? t('event.continueTurn') : t('event.dealerContinue');
        EventLog.add(text, 'turn-change', '↪️');
        return;
    }

    // Turn passes to opponent
    const opponent = shooter === 'player' ? 'dealer' : 'player';
    const opponentData = getEntity(opponent);

    if (opponentData.handcuffed) {
        opponentData.handcuffed = false;
        setTurn(shooter);
        const msg = shooter === 'player'
            ? t('event.handcuffed')
            : t('event.playerHandcuffed');
        EventLog.add(msg, 'turn-change', '⛓️');
        flashMessage(msg, DELAY.MESSAGE);
        return;
    }

    setTurn(opponent);
    const text = opponent === 'player' ? t('event.yourTurn') : t('event.dealerTurn');
    EventLog.add(text, 'turn-change', opponent === 'player' ? '👤' : '🎭');
}

function setTurn(who) {
    gameData.state = who === 'player' ? GameState.PLAYER_TURN : GameState.DEALER_TURN;
    updateUI();
    if (who === 'dealer') {
        setTimeout(dealerTurn, DELAY.DEALER_THINK);
    }
}

// ====== Dealer AI ======

async function dealerTurn() {
    if (gameData.state !== GameState.DEALER_TURN) return;

    const action = makeAIDecision(gameData);
    if (action.type === 'item') {
        useItem(action.item, 'dealer');
        if (action.item.id === 'magnifying_glass') {
            gameData.aiKnownShell = gameData.shotgun.shells[gameData.shotgun.currentIndex];
        }
        await delay(DELAY.DEALER_THINK);
        await dealerTurn();
    } else {
        const target = action.target === 'dealer' ? 'dealer' : 'player';
        await executeShot('dealer', target);
    }
}

// ====== Items ======

function useItem(item, user) {
    const isPlayer = user === 'player';
    if (isPlayer && gameData.state !== GameState.PLAYER_TURN) return;

    const userData = getEntity(user);
    const index = userData.items.findIndex(i => i.id === item.id);
    if (index === -1) return;

    userData.items.splice(index, 1);
    playItemUse();
    animateItemUse(item.id);

    const userName = getActorName(user);
    const itemName = t(`item.${item.id}.name`);
    let itemAchievementData = { itemId: item.id, success: true, ejected: null };

    switch (item.id) {
        case 'magnifying_glass':
            if (gameData.shotgun.currentIndex < gameData.shotgun.shells.length) {
                const shell = gameData.shotgun.shells[gameData.shotgun.currentIndex];
                const shellText = getShellText(shell);
                EventLog.add(
                    t('itemMsg.magnifying_glass', { shell: shellText }),
                    'item-use',
                    '🔍'
                );
                if (isPlayer) {
                    showMessage(t('itemMsg.magnifying_glass_show', { shell: shellText }));
                    setTimeout(hideMessage, DELAY.MESSAGE);
                }
            }
            break;

        case 'beer':
            if (gameData.shotgun.currentIndex < gameData.shotgun.shells.length) {
                const ejected = gameData.shotgun.shells[gameData.shotgun.currentIndex];
                itemAchievementData.ejected = ejected;
                gameData.shotgun.currentIndex++;
                updateShellInfo();
                const shellText = getShellText(ejected);
                EventLog.add(
                    t('itemMsg.beer', { shell: shellText }),
                    'item-use',
                    '🍺'
                );
                if (gameData.shotgun.currentIndex >= gameData.shotgun.shells.length) {
                    showMessage(t('itemMsg.beer_show', { shell: shellText }));
                    setTimeout(() => { hideMessage(); startRound(); }, DELAY.MESSAGE);
                } else if (isPlayer) {
                    showMessage(t('itemMsg.beer_showShort', { shell: shellText }));
                    setTimeout(hideMessage, DELAY.MESSAGE);
                } else {
                    showMessage(t('itemMsg.beer_dealer'));
                    setTimeout(hideMessage, DELAY.MESSAGE);
                }
            }
            break;

        case 'handsaw':
            gameData.shotgun.sawedOff = true;
            EventLog.add(
                t('itemMsg.handsaw'),
                'item-use',
                '🪚'
            );
            if (isPlayer) { showMessage(t('itemMsg.handsaw_show')); setTimeout(hideMessage, DELAY.MESSAGE); }
            else { showMessage(t('itemMsg.handsaw_dealer')); setTimeout(hideMessage, DELAY.MESSAGE); }
            break;

        case 'cigarette':
            userData.hp = Math.min(userData.hp + 1, userData.maxHp);
            EventLog.add(
                t('itemMsg.cigarette'),
                'item-use',
                '🚬'
            );
            if (isPlayer) { showMessage(t('itemMsg.cigarette_show')); setTimeout(hideMessage, DELAY.MESSAGE); }
            else { showMessage(t('itemMsg.cigarette_dealer')); setTimeout(hideMessage, DELAY.MESSAGE); }
            break;

        case 'handcuffs': {
            const opponent = isPlayer ? gameData.dealer : gameData.player;
            opponent.handcuffed = true;
            EventLog.add(
                t('itemMsg.handcuffs'),
                'item-use',
                '⛓️'
            );
            if (isPlayer) { showMessage(t('itemMsg.handcuffs_show')); setTimeout(hideMessage, DELAY.MESSAGE); }
            else { showMessage(t('itemMsg.handcuffs_dealer')); setTimeout(hideMessage, DELAY.MESSAGE); }
            break;
        }

        case 'expired_medicine': {
            const lucky = Math.random() < 0.4;
            itemAchievementData.success = lucky;
            if (lucky) {
                userData.hp = Math.min(userData.hp + 2, userData.maxHp);
                EventLog.add(
                    t('itemMsg.medicine_good'),
                    'item-use',
                    '💊'
                );
                if (isPlayer) { showMessage(t('itemMsg.medicine_good_show')); setTimeout(hideMessage, DELAY.MESSAGE); }
                else { showMessage(t('itemMsg.medicine_good_dealer')); setTimeout(hideMessage, DELAY.MESSAGE); }
            } else {
                userData.hp = Math.max(userData.hp - 1, 0);
                EventLog.add(
                    t('itemMsg.medicine_bad'),
                    'item-use',
                    '💊'
                );
                if (isPlayer) { showMessage(t('itemMsg.medicine_bad_show')); setTimeout(hideMessage, DELAY.MESSAGE); }
                else { showMessage(t('itemMsg.medicine_bad_dealer')); setTimeout(hideMessage, DELAY.MESSAGE); }
            }
            break;
        }

        case 'inverter':
            if (gameData.shotgun.currentIndex < gameData.shotgun.shells.length) {
                const current = gameData.shotgun.shells[gameData.shotgun.currentIndex];
                const inverted = current === 'live' ? 'blank' : 'live';
                gameData.shotgun.shells[gameData.shotgun.currentIndex] = inverted;
                const fromText = getShellText(current);
                const toText = getShellText(inverted);
                if (gameData.aiKnownShell === current) {
                    gameData.aiKnownShell = inverted;
                }
                updateShellInfo();
                EventLog.add(
                    t('itemMsg.inverter', { from: fromText, to: toText }),
                    'item-use',
                    '🔄'
                );
                if (isPlayer) { showMessage(t('itemMsg.inverter_show', { from: fromText, to: toText })); setTimeout(hideMessage, DELAY.MESSAGE); }
                else { showMessage(t('itemMsg.inverter_dealer')); setTimeout(hideMessage, DELAY.MESSAGE); }
            }
            break;

        case 'burner_phone':
            if (gameData.shotgun.currentIndex < gameData.shotgun.shells.length - 1) {
                const remaining = gameData.shotgun.shells.slice(gameData.shotgun.currentIndex + 1);
                const allIndices = [];
                remaining.forEach((s, i) => allIndices.push(i));
                const revealIdx = allIndices[Math.floor(Math.random() * allIndices.length)];
                const revealedShell = remaining[revealIdx];
                const revealedPos = revealIdx + 1;
                const shellText = getShellText(revealedShell);

                EventLog.add(
                    t('itemMsg.burner_phone', { pos: revealedPos, shell: shellText }),
                    'item-use',
                    '📱'
                );
                if (isPlayer) {
                    showMessage(t('itemMsg.burner_phone_show', { pos: revealedPos, shell: shellText }));
                    setTimeout(hideMessage, DELAY.MESSAGE);
                } else {
                    showMessage(t('itemMsg.burner_phone_dealer'));
                    setTimeout(hideMessage, DELAY.MESSAGE);
                }
            } else {
                EventLog.add(
                    t('itemMsg.burner_phone_empty'),
                    'item-use',
                    '📱'
                );
                if (isPlayer) { showMessage(t('itemMsg.burner_phone_empty_show')); setTimeout(hideMessage, DELAY.MESSAGE); }
                else { showMessage(t('itemMsg.burner_phone_dealer')); setTimeout(hideMessage, DELAY.MESSAGE); }
            }
            break;

        case 'adrenaline': {
            const opponent = isPlayer ? gameData.dealer : gameData.player;
            if (opponent.items.length > 0) {
                const stolenIdx = Math.floor(Math.random() * opponent.items.length);
                const stolenItem = opponent.items[stolenIdx];
                opponent.items.splice(stolenIdx, 1);
                const opponentName = isPlayer ? t('actor.dealer') : t('actor.you');
                const stolenItemName = t(`item.${stolenItem.id}.name`);
                EventLog.add(
                    t('itemMsg.adrenaline', { target: opponentName, item: stolenItemName }),
                    'item-use',
                    '💉'
                );
                if (isPlayer) { showMessage(t('itemMsg.adrenaline_show', { target: opponentName, item: stolenItemName })); setTimeout(hideMessage, DELAY.MESSAGE); }
                else { showMessage(t('itemMsg.adrenaline_dealer', { item: stolenItemName })); setTimeout(hideMessage, DELAY.MESSAGE); }
                if (stolenItem.id !== 'adrenaline') {
                    setTimeout(() => useItem(stolenItem, user), DELAY.MESSAGE);
                }
            } else {
                EventLog.add(
                    t('itemMsg.adrenaline_empty'),
                    'item-use',
                    '💉'
                );
                if (isPlayer) { showMessage(t('itemMsg.adrenaline_empty_show')); setTimeout(hideMessage, DELAY.MESSAGE); }
                else { showMessage(t('itemMsg.adrenaline_empty_dealer')); setTimeout(hideMessage, DELAY.MESSAGE); }
            }
            break;
        }
    }

    trackStat('itemUsed');
    checkAchievements('item_used', itemAchievementData);
    updateUI();

    // Check if expired medicine killed someone
    if (item.id === 'expired_medicine') {
        if (gameData.player.hp <= 0) {
            checkAchievements('medicine_death', {});
            setTimeout(() => endGame(false), DELAY.MESSAGE); return;
        }
        if (gameData.dealer.hp <= 0) {
            setTimeout(() => {
                gameData.stage >= 3 ? endGame(true) : nextStage();
            }, DELAY.MESSAGE);
            return;
        }
    }
}

// ====== Stage & Game End ======

async function nextStage() {
    const prevStage = gameData.stage;
    trackStat('stageClear', prevStage);
    checkAchievements('stage_clear', { stage: prevStage });
    gameData.stage++;
    const config = STAGE_CONFIG[gameData.stage];
    gameData.player.hp = gameData.player.maxHp = config.hp;
    gameData.dealer.hp = gameData.dealer.maxHp = config.hp;
    gameData.player.handcuffed = false;
    gameData.dealer.handcuffed = false;

    EventLog.add(
        t('stage.enter', { stage: gameData.stage, hp: config.hp }),
        'stage',
        '⏫'
    );

    animateStageTransition(gameData.stage);
    setSceneMood('tense');

    await flashMessage(t('stage.flash', { stage: gameData.stage, hp: config.hp }), DELAY.ROUND_START);
    startRound();
}

function endGame(victory) {
    gameData.state = victory ? GameState.VICTORY : GameState.GAME_OVER;
    stopBGMusic();
    if (victory) { playVictory(); animateVictory(); setSceneMood('victory'); }
    else { playGameOver(); animateDefeat(); setSceneMood('defeat'); }

    checkAchievements('game_end', {
        victory,
        playerHp: gameData.player.hp,
        stage: gameData.stage,
    });

    EventLog.add(
        victory ? t('stage.victory') : t('stage.defeat', { stage: gameData.stage }),
        victory ? 'victory' : 'death',
        victory ? '🏆' : '💀'
    );

    document.getElementById('game-over-title').textContent = victory ? t('gameOver.victory') : t('gameOver.defeat');
    document.getElementById('game-over-message').textContent = victory
        ? t('gameOver.victoryMsg')
        : t('gameOver.defeatMsg', { stage: gameData.stage });

    const donBtn = document.getElementById('don-btn');
    if (donBtn) donBtn.style.display = victory ? 'block' : 'none';

    document.getElementById('game-over').classList.remove('hidden');
}

// ====== Double or Nothing ======

async function startDoubleOrNothing() {
    document.getElementById('game-over').classList.add('hidden');
    gameData.donRound = (gameData.donRound || 0) + 1;
    gameData.state = GameState.ROUND_START;

    EventLog.add(
        t('don.round', { round: gameData.donRound }),
        'stage',
        '🎰'
    );

    const shells = ['live', 'blank'].sort(() => Math.random() - 0.5);
    gameData.shotgun = { shells, currentIndex: 0, sawedOff: false };
    gameData.shellInfo = { live: 1, blank: 1 };
    gameData.aiKnownShell = null;

    gameData.player.items = [];
    gameData.dealer.items = [];
    gameData.player.handcuffed = false;
    gameData.dealer.handcuffed = false;

    playShellLoad();
    animateRoundStart();
    animateShellReload();

    await flashMessage(t('don.flash'), DELAY.ROUND_START);

    gameData.state = GameState.PLAYER_TURN;
    updateUI();
}

function donLost() {
    gameData.state = GameState.GAME_OVER;
    stopBGMusic();
    playGameOver();
    animateDefeat();
    setSceneMood('defeat');

    EventLog.add(t('don.lose'), 'death', '💀');

    document.getElementById('game-over-title').textContent = t('gameOver.donLose');
    document.getElementById('game-over-message').textContent = t('gameOver.donLoseMsg');
    document.getElementById('don-btn').style.display = 'none';
    document.getElementById('game-over').classList.remove('hidden');
}

// ====== UI ======

function updateUI() {
    const ph = Math.max(0, gameData.player.hp);
    const dh = Math.max(0, gameData.dealer.hp);
    document.getElementById('player-hp').textContent = '⚡'.repeat(ph);
    document.getElementById('dealer-hp').textContent = '⚡'.repeat(dh);
    document.getElementById('live-count').textContent = gameData.shellInfo.live;
    document.getElementById('blank-count').textContent = gameData.shellInfo.blank;

    const stageEl = document.getElementById('stage-num');
    if (stageEl) stageEl.textContent = gameData.stage;

    const playerInfo = document.getElementById('player-info');
    const dealerInfo = document.getElementById('dealer-info');
    playerInfo.classList.toggle('active-turn', gameData.state === GameState.PLAYER_TURN);
    dealerInfo.classList.toggle('active-turn', gameData.state === GameState.DEALER_TURN);

    // Player items
    const playerItems = document.getElementById('player-items');
    playerItems.innerHTML = '';
    gameData.player.items.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'item-card';
        const name = t(`item.${item.id}.name`);
        const desc = t(`item.${item.id}.desc`);
        card.innerHTML = `${name}<div class="item-name">${desc}</div>`;
        card.onclick = () => useItem(item, 'player');
        playerItems.appendChild(card);
    });

    // Dealer items (hidden)
    const dealerItems = document.getElementById('dealer-items');
    dealerItems.innerHTML = '';
    gameData.dealer.items.forEach(() => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = '❓';
        dealerItems.appendChild(card);
    });

    const canAct = gameData.state === GameState.PLAYER_TURN;
    document.getElementById('shoot-self-btn').disabled = !canAct;
    document.getElementById('shoot-dealer-btn').disabled = !canAct;
}

init();
