import * as THREE from 'three';
import { initScene, animateShot, animateHit, animateRoundStart, animateShellReload, animateItemUse, animateStageTransition, animateVictory, animateDefeat, setDealerAnim, setSceneMood } from './scene.js';
import { checkAchievements, resetSessionStats, toggleAchievementPanel } from './achievements.js';
import { makeAIDecision } from './ai.js';
import {
    playShotgunBlast, playBlankShot, playShellLoad,
    playItemUse, playHit, playRoundStart,
    playVictory, playGameOver, startBGMusic, stopBGMusic,
    setMuted, getMuted
} from './audio.js';

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
    MAGNIFYING_GLASS: { id: 'magnifying_glass', name: '🔍', desc: '查看当前子弹' },
    BEER: { id: 'beer', name: '🍺', desc: '退出当前子弹' },
    HANDSAW: { id: 'handsaw', name: '🪚', desc: '双倍伤害' },
    CIGARETTE: { id: 'cigarette', name: '🚬', desc: '恢复1生命' },
    HANDCUFFS: { id: 'handcuffs', name: '⛓️', desc: '跳过对手回合' },
    EXPIRED_MEDICINE: { id: 'expired_medicine', name: '💊', desc: '40%回2血/60%扣1血' },
    INVERTER: { id: 'inverter', name: '🔄', desc: '反转当前子弹类型' },
    BURNER_PHONE: { id: 'burner_phone', name: '📱', desc: '随机揭示一发剩余子弹' },
    ADRENALINE: { id: 'adrenaline', name: '💉', desc: '偷取对手一个道具' }
};

const STAGE_CONFIG = {
    1: { hp: 2, items: 0 },
    2: { hp: 4, items: 3 },
    3: { hp: 5, items: 4 }
};

const ShotMessages = {
    live: {
        'player-dealer': (d) => `命中！庄家受到 ${d} 点伤害`,
        'player-player': (d) => `命中！你受到 ${d} 点伤害`,
        'dealer-player': (d) => `庄家射中你！${d} 点伤害！`,
        'dealer-dealer': (d) => `庄家射自己！${d} 点伤害！`
    },
    blank: {
        'player-player': '空弹！你的回合继续',
        'dealer-dealer': '空弹！庄家的回合继续',
        _default: '空弹！'
    }
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
    aiKnownShell: null
};

// Event Log System
const EventLog = {
    maxEntries: 50, // 增加到50条，基本不会删除
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

        // 保持滚动条在顶部（显示最新消息）
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
        pauseBtn.textContent = isMuted ? '🔇 音乐：关' : '🔊 音乐：开';
    }
}

// ====== Pause Menu ======

let pausedState = null;

function togglePauseMenu() {
    const panel = document.getElementById('pause-menu');
    if (panel.classList.contains('hidden')) {
        // Save current state and pause
        if (gameData.state !== GameState.MENU && gameData.state !== GameState.GAME_OVER && gameData.state !== GameState.VICTORY) {
            pausedState = gameData.state;
            gameData.state = GameState.ANIMATING; // Block input
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
    flashMessage(`调试：切换到阶段 ${stageNum}`, 1000);
    updateUI();
}

function handleDebugHP(action) {
    switch (action) {
        case 'heal-player':
            gameData.player.hp = Math.min(gameData.player.hp + 1, gameData.player.maxHp);
            flashMessage('调试：玩家 +1 生命', 800);
            break;
        case 'hurt-player':
            gameData.player.hp = Math.max(gameData.player.hp - 1, 0);
            flashMessage('调试：玩家 -1 生命', 800);
            break;
        case 'heal-dealer':
            gameData.dealer.hp = Math.min(gameData.dealer.hp + 1, gameData.dealer.maxHp);
            flashMessage('调试：庄家 +1 生命', 800);
            break;
        case 'hurt-dealer':
            gameData.dealer.hp = Math.max(gameData.dealer.hp - 1, 0);
            flashMessage('调试：庄家 -1 生命', 800);
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
            flashMessage(`调试：给予 ${count} 个随机道具`, 800);
            break;
        case 'clear':
            gameData.player.items = [];
            gameData.dealer.items = [];
            flashMessage('调试：清空所有道具', 800);
            break;
    }
    updateUI();
}

function handleDebugControl(action) {
    switch (action) {
        case 'skip-dealer':
            if (gameData.state === GameState.DEALER_TURN) {
                setTurn('player');
                flashMessage('调试：跳过庄家回合', 800);
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
                const shellText = currentShell === 'live' ? '实弹' : '空弹';
                flashMessage(`调试：当前子弹是${shellText}`, 1500);
            }
            break;
        case 'set-live':
            if (gameData.shotgun.currentIndex < gameData.shotgun.shells.length) {
                gameData.shotgun.shells[gameData.shotgun.currentIndex] = 'live';
                updateShellInfo();
                flashMessage('调试：设为实弹', 1000);
            }
            break;
        case 'set-blank':
            if (gameData.shotgun.currentIndex < gameData.shotgun.shells.length) {
                gameData.shotgun.shells[gameData.shotgun.currentIndex] = 'blank';
                updateShellInfo();
                flashMessage('调试：设为空弹', 1000);
            }
            break;
    }
    updateUI();
}

// ====== Init ======

function init() {
    initScene();
    setupEventListeners();
    updateUI();
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

    // Escape key to toggle pause
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') togglePauseMenu();
    });
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
    EventLog.add('游戏开始！阶段 1 - 无道具', 'stage', '🎮');
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
        `回合开始！${liveCount}发实弹 ${blankCount}发空弹`,
        'round',
        '🔄'
    );

    checkAchievements('round_start', {});

    await flashMessage(`回合开始！${liveCount} 实弹，${blankCount} 空弹`, DELAY.ROUND_START);

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

        const shooterText = shooter === 'player' ? '你' : '庄家';
        const targetText = target === 'player' ? '你' : '庄家';
        const isSelf = shooter === target;

        if (isSelf) {
            EventLog.add(
                `${shooterText}射自己 — 🔴 实弹！${damage} 点伤害`,
                'shoot-live',
                '💥'
            );
        } else {
            EventLog.add(
                `${shooterText}射${targetText} — 🔴 实弹！${damage} 点伤害`,
                'shoot-live',
                '💥'
            );
        }

        showMessage(ShotMessages.live[key](damage));
    } else {
        playBlankShot();

        const shooterText = shooter === 'player' ? '你' : '庄家';
        const targetText = target === 'player' ? '你' : '庄家';

        EventLog.add(
            `${shooterText}射${targetText} — ⚪ 空弹`,
            'shoot-blank',
            '💨'
        );

        showMessage(ShotMessages.blank[key] || ShotMessages.blank._default);
    }

    gameData.shotgun.sawedOff = false;
    gameData.shotgun.currentIndex++;
    updateShellInfo();
    if (shooter === 'dealer') gameData.aiKnownShell = null;

    // Achievement check
    const targetHpAfter = getEntity(target).hp;
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
            // DoN won — show victory with DoN round count
            gameData.state = GameState.VICTORY;
            stopBGMusic();
            playVictory();
            animateVictory();
            setSceneMood('victory');
            EventLog.add(`🎰 Double or Nothing — 第${gameData.donRound}轮胜利！`, 'victory', '🏆');
            document.getElementById('game-over-title').textContent = '赢了赌局！';
            document.getElementById('game-over-message').textContent = `Double or Nothing 连胜 ${gameData.donRound} 轮！`;
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
            // Both survived DoN round — re-load and continue
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
        const text = shooter === 'player' ? '你的回合继续' : '庄家的回合继续';
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
            ? '庄家被铐住了！你的回合继续'
            : '你被铐住了！庄家继续行动';
        EventLog.add(msg, 'turn-change', '⛓️');
        flashMessage(msg, DELAY.MESSAGE);
        return;
    }

    setTurn(opponent);
    const text = opponent === 'player' ? '你的回合' : '庄家的回合';
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

    const userName = isPlayer ? '你' : '庄家';
    let itemAchievementData = { itemId: item.id, success: true, ejected: null };

    switch (item.id) {
        case 'magnifying_glass':
            if (gameData.shotgun.currentIndex < gameData.shotgun.shells.length) {
                const shell = gameData.shotgun.shells[gameData.shotgun.currentIndex];
                const shellText = shell === 'live' ? '🔴 实弹' : '⚪ 空弹';
                EventLog.add(
                    `${userName}使用 🔍 — 当前子弹是${shellText}`,
                    'item-use',
                    '🔍'
                );
                if (isPlayer) {
                    showMessage(`当前子弹：${shellText}`);
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
                const shellText = ejected === 'live' ? '🔴 实弹' : '⚪ 空弹';
                EventLog.add(
                    `${userName}使用 🍺 — 退出了${shellText}`,
                    'item-use',
                    '🍺'
                );
                if (gameData.shotgun.currentIndex >= gameData.shotgun.shells.length) {
                    showMessage(`退弹：${shellText} — 重新装填...`);
                    setTimeout(() => { hideMessage(); startRound(); }, DELAY.MESSAGE);
                } else if (isPlayer) {
                    showMessage(`退弹：${shellText}`);
                    setTimeout(hideMessage, DELAY.MESSAGE);
                } else {
                    showMessage('庄家退出一发子弹');
                    setTimeout(hideMessage, DELAY.MESSAGE);
                }
            }
            break;

        case 'handsaw':
            gameData.shotgun.sawedOff = true;
            EventLog.add(
                `${userName}使用 🪚 — 下次射击伤害翻倍`,
                'item-use',
                '🪚'
            );
            if (isPlayer) { showMessage('锯短了！下次双倍伤害！'); setTimeout(hideMessage, DELAY.MESSAGE); }
            else { showMessage('庄家锯短了霰弹枪！'); setTimeout(hideMessage, DELAY.MESSAGE); }
            break;

        case 'cigarette':
            userData.hp = Math.min(userData.hp + 1, userData.maxHp);
            EventLog.add(
                `${userName}使用 🚬 — 恢复1点生命`,
                'item-use',
                '🚬'
            );
            if (isPlayer) { showMessage('生命恢复！'); setTimeout(hideMessage, DELAY.MESSAGE); }
            else { showMessage('庄家抽了一支烟'); setTimeout(hideMessage, DELAY.MESSAGE); }
            break;

        case 'handcuffs': {
            const opponent = isPlayer ? gameData.dealer : gameData.player;
            opponent.handcuffed = true;
            EventLog.add(
                `${userName}使用 ⛓️ — 对手跳过下一回合`,
                'item-use',
                '⛓️'
            );
            if (isPlayer) { showMessage('庄家被铐住了！'); setTimeout(hideMessage, DELAY.MESSAGE); }
            else { showMessage('庄家给你铐上了手铐！'); setTimeout(hideMessage, DELAY.MESSAGE); }
            break;
        }

        case 'expired_medicine': {
            const lucky = Math.random() < 0.4;
            itemAchievementData.success = lucky;
            if (lucky) {
                userData.hp = Math.min(userData.hp + 2, userData.maxHp);
                EventLog.add(
                    `${userName}使用 💊 — 幸运！恢复2点生命`,
                    'item-use',
                    '💊'
                );
                if (isPlayer) { showMessage('💊 幸运！恢复2点生命！'); setTimeout(hideMessage, DELAY.MESSAGE); }
                else { showMessage('庄家吃了药...恢复2点生命'); setTimeout(hideMessage, DELAY.MESSAGE); }
            } else {
                userData.hp = Math.max(userData.hp - 1, 0);
                EventLog.add(
                    `${userName}使用 💊 — 副作用！扣1点生命`,
                    'item-use',
                    '💊'
                );
                if (isPlayer) { showMessage('💊 副作用！扣1点生命'); setTimeout(hideMessage, DELAY.MESSAGE); }
                else { showMessage('庄家吃了药...扣1点生命'); setTimeout(hideMessage, DELAY.MESSAGE); }
            }
            break;
        }

        case 'inverter':
            if (gameData.shotgun.currentIndex < gameData.shotgun.shells.length) {
                const current = gameData.shotgun.shells[gameData.shotgun.currentIndex];
                const inverted = current === 'live' ? 'blank' : 'live';
                gameData.shotgun.shells[gameData.shotgun.currentIndex] = inverted;
                const fromText = current === 'live' ? '🔴 实弹' : '⚪ 空弹';
                const toText = inverted === 'live' ? '🔴 实弹' : '⚪ 空弹';
                // Update AI knowledge if it knew the shell
                if (gameData.aiKnownShell === current) {
                    gameData.aiKnownShell = inverted;
                }
                updateShellInfo();
                EventLog.add(
                    `${userName}使用 🔄 — ${fromText} → ${toText}`,
                    'item-use',
                    '🔄'
                );
                if (isPlayer) { showMessage(`🔄 反转！${fromText} → ${toText}`); setTimeout(hideMessage, DELAY.MESSAGE); }
                else { showMessage('庄家使用了逆转器！'); setTimeout(hideMessage, DELAY.MESSAGE); }
            }
            break;

        case 'burner_phone':
            if (gameData.shotgun.currentIndex < gameData.shotgun.shells.length - 1) {
                const remaining = gameData.shotgun.shells.slice(gameData.shotgun.currentIndex + 1);
                const liveIndices = [];
                remaining.forEach((s, i) => { if (s === 'live') liveIndices.push(i); });
                const blankIndices = [];
                remaining.forEach((s, i) => { if (s === 'blank') blankIndices.push(i); });

                // Pick a random remaining shell to reveal
                const allIndices = [];
                remaining.forEach((s, i) => allIndices.push(i));
                const revealIdx = allIndices[Math.floor(Math.random() * allIndices.length)];
                const revealedShell = remaining[revealIdx];
                const revealedPos = revealIdx + 1; // Position relative to current
                const shellText = revealedShell === 'live' ? '🔴 实弹' : '⚪ 空弹';

                EventLog.add(
                    `${userName}使用 📱 — 第${revealedPos}发之后是${shellText}`,
                    'item-use',
                    '📱'
                );
                if (isPlayer) {
                    showMessage(`📱 第${revealedPos}发之后：${shellText}`);
                    setTimeout(hideMessage, DELAY.MESSAGE);
                } else {
                    showMessage('庄家打了个电话...');
                    setTimeout(hideMessage, DELAY.MESSAGE);
                }
            } else {
                EventLog.add(
                    `${userName}使用 📱 — 没有更多子弹可查询`,
                    'item-use',
                    '📱'
                );
                if (isPlayer) { showMessage('📱 没有更多子弹了'); setTimeout(hideMessage, DELAY.MESSAGE); }
                else { showMessage('庄家打了个电话...'); setTimeout(hideMessage, DELAY.MESSAGE); }
            }
            break;

        case 'adrenaline': {
            const opponent = isPlayer ? gameData.dealer : gameData.player;
            if (opponent.items.length > 0) {
                const stolenIdx = Math.floor(Math.random() * opponent.items.length);
                const stolenItem = opponent.items[stolenIdx];
                opponent.items.splice(stolenIdx, 1);
                // Use the stolen item immediately (as the user)
                const opponentName = isPlayer ? '庄家' : '你';
                EventLog.add(
                    `${userName}使用 💉 — 偷走了${opponentName}的${stolenItem.name}！`,
                    'item-use',
                    '💉'
                );
                if (isPlayer) { showMessage(`💉 偷取了${opponentName}的${stolenItem.name}！`); setTimeout(hideMessage, DELAY.MESSAGE); }
                else { showMessage(`庄家偷走了你的${stolenItem.name}！`); setTimeout(hideMessage, DELAY.MESSAGE); }
                // Immediately use the stolen item (but don't recurse with adrenaline)
                if (stolenItem.id !== 'adrenaline') {
                    setTimeout(() => useItem(stolenItem, user), DELAY.MESSAGE);
                }
            } else {
                EventLog.add(
                    `${userName}使用 💉 — 对手没有道具可偷`,
                    'item-use',
                    '💉'
                );
                if (isPlayer) { showMessage('💉 对手没有道具！'); setTimeout(hideMessage, DELAY.MESSAGE); }
                else { showMessage('庄家使用了肾上腺素...但没东西可偷'); setTimeout(hideMessage, DELAY.MESSAGE); }
            }
            break;
        }
    }

    // Achievement check for item use
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
    checkAchievements('stage_clear', { stage: prevStage });
    gameData.stage++;
    const config = STAGE_CONFIG[gameData.stage];
    gameData.player.hp = gameData.player.maxHp = config.hp;
    gameData.dealer.hp = gameData.dealer.maxHp = config.hp;
    gameData.player.handcuffed = false;
    gameData.dealer.handcuffed = false;

    EventLog.add(
        `进入阶段 ${gameData.stage}！生命值设为 ${config.hp}`,
        'stage',
        '⏫'
    );

    animateStageTransition(gameData.stage);
    setSceneMood('tense');

    await flashMessage(`阶段 ${gameData.stage}！生命值：${config.hp}`, DELAY.ROUND_START);
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
        victory ? '🎉 胜利！你通过了全部3个阶段！' : `💀 游戏结束 — 阶段 ${gameData.stage}`,
        victory ? 'victory' : 'death',
        victory ? '🏆' : '💀'
    );

    document.getElementById('game-over-title').textContent = victory ? '胜利！' : '游戏结束';
    document.getElementById('game-over-message').textContent = victory
        ? '你通过了全部3个阶段！'
        : `你在第 ${gameData.stage} 阶段倒下了`;

    // Show/hide Double or Nothing button
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
        `🎰 Double or Nothing！第 ${gameData.donRound} 轮`,
        'stage',
        '🎰'
    );

    // Only 1 live and 1 blank in DoN — pure 50/50
    const shells = ['live', 'blank'].sort(() => Math.random() - 0.5);
    gameData.shotgun = { shells, currentIndex: 0, sawedOff: false };
    gameData.shellInfo = { live: 1, blank: 1 };
    gameData.aiKnownShell = null;

    // No items in DoN
    gameData.player.items = [];
    gameData.dealer.items = [];
    gameData.player.handcuffed = false;
    gameData.dealer.handcuffed = false;

    playShellLoad();
    animateRoundStart();
    animateShellReload();

    await flashMessage(`Double or Nothing！1实弹 vs 1空弹`, DELAY.ROUND_START);

    gameData.state = GameState.PLAYER_TURN;
    updateUI();
}

function donLost() {
    gameData.state = GameState.GAME_OVER;
    stopBGMusic();
    playGameOver();
    animateDefeat();
    setSceneMood('defeat');

    EventLog.add('🎰 Double or Nothing — 失败！一切归零', 'death', '💀');

    document.getElementById('game-over-title').textContent = '赌输了！';
    document.getElementById('game-over-message').textContent = 'Double or Nothing 失败，一切归零...';
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

    // Stage display
    const stageEl = document.getElementById('stage-num');
    if (stageEl) stageEl.textContent = gameData.stage;

    // Turn indicator
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
        card.innerHTML = `${item.name}<div class="item-name">${item.desc}</div>`;
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
