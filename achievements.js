// ====== Achievement System ======

import { t } from './i18n.js';

const STORAGE_KEY = 'buckshot_roulette_achievements';

const AchievementCategory = {
    COMBAT: 'combat',
    SURVIVAL: 'survival',
    ITEMS: 'items',
    STAGES: 'stages',
    META: 'meta',
    SPECIAL: 'special'
};

const Achievements = {
    // === COMBAT ===
    FIRST_BLOOD: {
        id: 'firstBlood', nameKey: 'achievement.firstBlood.name', descKey: 'achievement.firstBlood.desc',
        icon: '🩸', category: AchievementCategory.COMBAT, hidden: false
    },
    SHARPSHOOTER: {
        id: 'sharpshooter', nameKey: 'achievement.sharpshooter.name', descKey: 'achievement.sharpshooter.desc',
        icon: '🎯', category: AchievementCategory.COMBAT, hidden: false
    },
    DOUBLE_TAP: {
        id: 'doubleTap', nameKey: 'achievement.doubleTap.name', descKey: 'achievement.doubleTap.desc',
        icon: '🪚', category: AchievementCategory.COMBAT, hidden: false
    },
    BLUFF_MASTER: {
        id: 'bluff', nameKey: 'achievement.bluff.name', descKey: 'achievement.bluff.desc',
        icon: '🃏', category: AchievementCategory.COMBAT, hidden: false
    },
    DEALER_SLAYER: {
        id: 'demonHunter', nameKey: 'achievement.demonHunter.name', descKey: 'achievement.demonHunter.desc',
        icon: '💀', category: AchievementCategory.COMBAT, hidden: false
    },

    // === SURVIVAL ===
    COMEBACK_KING: {
        id: 'comeback', nameKey: 'achievement.comeback.name', descKey: 'achievement.comeback.desc',
        icon: '👑', category: AchievementCategory.SURVIVAL, hidden: false
    },
    UNTOUCHABLE: {
        id: 'untouchable', nameKey: 'achievement.untouchable.name', descKey: 'achievement.untouchable.desc',
        icon: '🛡️', category: AchievementCategory.SURVIVAL, hidden: false
    },
    RISK_TAKER: {
        id: 'gambler', nameKey: 'achievement.gambler.name', descKey: 'achievement.gambler.desc',
        icon: '💊', category: AchievementCategory.SURVIVAL, hidden: false
    },
    SURVIVOR: {
        id: 'survivor', nameKey: 'achievement.survivor.name', descKey: 'achievement.survivor.desc',
        icon: '🚬', category: AchievementCategory.SURVIVAL, hidden: false
    },

    // === ITEMS ===
    KNOWLEDGE_IS_POWER: {
        id: 'knowledge', nameKey: 'achievement.knowledge.name', descKey: 'achievement.knowledge.desc',
        icon: '🔍', category: AchievementCategory.ITEMS, hidden: false
    },
    BOTTOMS_UP: {
        id: 'bottomsUp', nameKey: 'achievement.bottomsUp.name', descKey: 'achievement.bottomsUp.desc',
        icon: '🍺', category: AchievementCategory.ITEMS, hidden: false
    },
    ITEM_COLLECTOR: {
        id: 'collector', nameKey: 'achievement.collector.name', descKey: 'achievement.collector.desc',
        icon: '🎒', category: AchievementCategory.ITEMS, hidden: false
    },
    CHAIN_MASTER: {
        id: 'chainMaster', nameKey: 'achievement.chainMaster.name', descKey: 'achievement.chainMaster.desc',
        icon: '⛓️', category: AchievementCategory.ITEMS, hidden: false
    },
    SAW_SURGEON: {
        id: 'surgeon', nameKey: 'achievement.surgeon.name', descKey: 'achievement.surgeon.desc',
        icon: '🪚', category: AchievementCategory.ITEMS, hidden: false
    },

    // === STAGES ===
    STAGE_1_CLEAR: {
        id: 'stage1', nameKey: 'achievement.stage1.name', descKey: 'achievement.stage1.desc',
        icon: '⭐', category: AchievementCategory.STAGES, hidden: false
    },
    STAGE_2_CLEAR: {
        id: 'stage2', nameKey: 'achievement.stage2.name', descKey: 'achievement.stage2.desc',
        icon: '⭐', category: AchievementCategory.STAGES, hidden: false
    },
    STAGE_3_CLEAR: {
        id: 'stage3', nameKey: 'achievement.stage3.name', descKey: 'achievement.stage3.desc',
        icon: '🏆', category: AchievementCategory.STAGES, hidden: false
    },
    SPEED_RUN: {
        id: 'speedrun', nameKey: 'achievement.speedrun.name', descKey: 'achievement.speedrun.desc',
        icon: '⚡', category: AchievementCategory.STAGES, hidden: false
    },

    // === META ===
    FIRST_GAME: {
        id: 'firstGame', nameKey: 'achievement.firstGame.name', descKey: 'achievement.firstGame.desc',
        icon: '🎮', category: AchievementCategory.META, hidden: false
    },
    VETERAN: {
        id: 'veteran', nameKey: 'achievement.veteran.name', descKey: 'achievement.veteran.desc',
        icon: '🎖️', category: AchievementCategory.META, hidden: false
    },
    WIN_STREAK_3: {
        id: 'winStreak3', nameKey: 'achievement.winStreak3.name', descKey: 'achievement.winStreak3.desc',
        icon: '🔥', category: AchievementCategory.META, hidden: false
    },
    TOTAL_WINS_5: {
        id: 'winStreak5', nameKey: 'achievement.winStreak5.name', descKey: 'achievement.winStreak5.desc',
        icon: '🏆', category: AchievementCategory.META, hidden: false
    },

    // === SPECIAL / HIDDEN ===
    SELF_SHOT_BLANK_3: {
        id: 'selfShot', nameKey: 'achievement.selfShot.name', descKey: 'achievement.selfShot.desc',
        icon: '🤪', category: AchievementCategory.SPECIAL, hidden: true
    },
    MEDICINE_FAIL: {
        id: 'medicineDeath', nameKey: 'achievement.medicineDeath.name', descKey: 'achievement.medicineDeath.desc',
        icon: '☠️', category: AchievementCategory.SPECIAL, hidden: true
    },
    PERFECT_GAME: {
        id: 'perfectGame', nameKey: 'achievement.perfectGame.name', descKey: 'achievement.perfectGame.desc',
        icon: '✨', category: AchievementCategory.SPECIAL, hidden: true
    },
};

// ====== Session Stats (reset each game) ======

let sessionStats = resetSessionStatsObject();

function resetSessionStatsObject() {
    return {
        consecutiveHits: 0,
        damageTaken: 0,
        itemsUsedThisGame: new Set(),
        roundsThisStage: 0,
        selfShotBlanks: 0,
        sawedOffHits: 0,
        handcuffUses: 0,
        medicineSuccess: 0,
        medicineFails: 0,
        correctGlassDecisions: 0,
        beerEjectedLive: 0,
        cigaretteUses: 0,
        usedAnyItem: false,
    };
}

// ====== Persistent Stats (survive across games) ======

let persistentStats = loadPersistentStats();

function loadPersistentStats() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (data && typeof data.unlocked === 'object') return data;
    } catch (e) { /* ignore */ }
    return {
        gamesPlayed: 0,
        gamesWon: 0,
        winStreak: 0,
        maxWinStreak: 0,
        totalCigaretteHeals: 0,
        totalHandcuffUses: 0,
        totalSawHits: 0,
        maxDonStreak: 0,
        stageClears: { 1: 0, 2: 0, 3: 0 },
        totalShotsFired: 0,
        totalItemsUsed: 0,
        unlocked: {}
    };
}

function savePersistentStats() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persistentStats));
    } catch (e) { /* ignore */ }
}

// ====== Exported Functions ======

export function resetSessionStats() {
    sessionStats = resetSessionStatsObject();
}

export function checkAchievements(event, data) {
    switch (event) {
        case 'round_start': {
            sessionStats.roundsThisStage++;
            break;
        }

        case 'shot_fired': {
            if (data.shell === 'live') {
                tryUnlock('FIRST_BLOOD');
                sessionStats.consecutiveHits++;
                if (sessionStats.consecutiveHits >= 3) tryUnlock('SHARPSHOOTER');
                if (data.sawedOff) {
                    sessionStats.sawedOffHits++;
                    tryUnlock('DOUBLE_TAP');
                    if (sessionStats.sawedOffHits >= 3) tryUnlock('SAW_SURGEON');
                    if (data.targetHpAfter <= 0 && data.target === 'dealer') tryUnlock('DEALER_SLAYER');
                }
                if (data.target === 'player') {
                    sessionStats.damageTaken += data.damage || 1;
                }
            } else {
                sessionStats.consecutiveHits = 0;
                if (data.shooter === data.target) {
                    sessionStats.selfShotBlanks++;
                    if (data.liveProbability > 0.75) tryUnlock('BLUFF_MASTER');
                    if (sessionStats.selfShotBlanks >= 3) tryUnlock('SELF_SHOT_BLANK_3');
                }
            }
            break;
        }

        case 'item_used': {
            sessionStats.itemsUsedThisGame.add(data.itemId);
            sessionStats.usedAnyItem = true;

            switch (data.itemId) {
                case 'cigarette':
                    sessionStats.cigaretteUses++;
                    persistentStats.totalCigaretteHeals++;
                    if (persistentStats.totalCigaretteHeals >= 10) tryUnlock('SURVIVOR');
                    break;
                case 'handcuffs':
                    sessionStats.handcuffUses++;
                    persistentStats.totalHandcuffUses++;
                    if (persistentStats.totalHandcuffUses >= 3) tryUnlock('CHAIN_MASTER');
                    break;
                case 'expired_medicine':
                    if (data.success) {
                        sessionStats.medicineSuccess++;
                        tryUnlock('RISK_TAKER');
                    } else {
                        sessionStats.medicineFails++;
                    }
                    break;
                case 'beer':
                    if (data.ejected === 'live') {
                        sessionStats.beerEjectedLive++;
                        tryUnlock('BOTTOMS_UP');
                    }
                    break;
            }

            if (sessionStats.itemsUsedThisGame.size >= 6) tryUnlock('ITEM_COLLECTOR');
            savePersistentStats();
            break;
        }

        case 'glass_correct_decision': {
            sessionStats.correctGlassDecisions++;
            tryUnlock('KNOWLEDGE_IS_POWER');
            break;
        }

        case 'stage_clear': {
            if (data.stage === 1) tryUnlock('STAGE_1_CLEAR');
            if (data.stage === 2) tryUnlock('STAGE_2_CLEAR');
            if (sessionStats.roundsThisStage <= 5 && data.stage < 3) tryUnlock('SPEED_RUN');
            sessionStats.roundsThisStage = 0;
            break;
        }

        case 'game_end': {
            persistentStats.gamesPlayed++;

            if (data.victory) {
                persistentStats.gamesWon++;
                persistentStats.winStreak++;
                persistentStats.maxWinStreak = Math.max(
                    persistentStats.maxWinStreak,
                    persistentStats.winStreak
                );

                tryUnlock('STAGE_3_CLEAR');
                tryUnlock('FIRST_GAME');
                if (persistentStats.gamesWon >= 5) tryUnlock('TOTAL_WINS_5');
                if (persistentStats.winStreak >= 3) tryUnlock('WIN_STREAK_3');
                if (persistentStats.gamesPlayed >= 10) tryUnlock('VETERAN');

                if (sessionStats.damageTaken === 0) tryUnlock('UNTOUCHABLE');
                if (sessionStats.damageTaken === 0 && !sessionStats.usedAnyItem) tryUnlock('PERFECT_GAME');
                if (data.playerHp === 1) tryUnlock('COMEBACK_KING');
            } else {
                persistentStats.winStreak = 0;
                tryUnlock('FIRST_GAME');
                if (persistentStats.gamesPlayed >= 10) tryUnlock('VETERAN');
            }

            savePersistentStats();
            break;
        }

        case 'medicine_death': {
            tryUnlock('MEDICINE_FAIL');
            break;
        }
    }
}

// ====== Unlock Logic ======

function tryUnlock(achievementKey) {
    const ach = Achievements[achievementKey];
    if (!ach) return;
    if (persistentStats.unlocked[ach.id]) return;

    persistentStats.unlocked[ach.id] = { unlockedAt: Date.now() };
    savePersistentStats();
    showAchievementNotification(ach);
}

// ====== Notification UI ======

let notificationQueue = [];
let notificationActive = false;

function showAchievementNotification(achievement) {
    notificationQueue.push(achievement);
    if (!notificationActive) processNotificationQueue();
}

function processNotificationQueue() {
    if (notificationQueue.length === 0) {
        notificationActive = false;
        return;
    }
    notificationActive = true;
    const ach = notificationQueue.shift();

    const container = document.getElementById('achievement-notifications');
    if (!container) { notificationActive = false; return; }

    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
        <div class="achievement-toast-icon">${ach.icon}</div>
        <div class="achievement-toast-text">
            <div class="achievement-toast-label">${t('achievement.unlock')}</div>
            <div class="achievement-toast-name">${t(ach.nameKey)}</div>
        </div>
    `;
    container.appendChild(toast);

    playAchievementSound();

    requestAnimationFrame(() => {
        toast.classList.add('achievement-toast-show');
    });

    setTimeout(() => {
        toast.classList.remove('achievement-toast-show');
        toast.classList.add('achievement-toast-hide');
        setTimeout(() => {
            toast.remove();
            processNotificationQueue();
        }, 500);
    }, 3000);
}

function playAchievementSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const now = ctx.currentTime;
        [523, 659, 784].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            const t = now + i * 0.12;
            osc.frequency.value = freq;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.15, t + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.3);
        });
    } catch (e) { /* ignore */ }
}

// ====== Achievement Gallery ======

export function renderAchievementGallery() {
    const gallery = document.getElementById('achievement-gallery-content');
    if (!gallery) return;

    const categories = [
        { key: AchievementCategory.COMBAT, nameKey: 'achievement.category.combat' },
        { key: AchievementCategory.SURVIVAL, nameKey: 'achievement.category.survival' },
        { key: AchievementCategory.ITEMS, nameKey: 'achievement.category.items' },
        { key: AchievementCategory.STAGES, nameKey: 'achievement.category.stages' },
        { key: AchievementCategory.META, nameKey: 'achievement.category.stats' },
        { key: AchievementCategory.SPECIAL, nameKey: 'achievement.category.special' },
    ];

    let html = '';

    // Stats header
    const total = Object.keys(Achievements).length;
    const unlocked = Object.keys(persistentStats.unlocked).length;
    html += `<div class="achievement-stats">
        <span>${t('achievement.unlocked', { unlocked, total })}</span>
        <div class="achievement-progress-bar">
            <div class="achievement-progress-fill" style="width: ${(unlocked / total) * 100}%"></div>
        </div>
    </div>`;

    for (const cat of categories) {
        const catAchievements = Object.values(Achievements).filter(a => a.category === cat.key);
        const catUnlocked = catAchievements.filter(a => persistentStats.unlocked[a.id]).length;

        html += `<div class="achievement-category">
            <div class="achievement-category-header">${t(cat.nameKey)} (${catUnlocked}/${catAchievements.length})</div>
            <div class="achievement-grid">`;

        for (const ach of catAchievements) {
            const isUnlocked = !!persistentStats.unlocked[ach.id];
            const isHidden = ach.hidden && !isUnlocked;

            html += `<div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
                <div class="achievement-icon">${isHidden ? '❓' : ach.icon}</div>
                <div class="achievement-info">
                    <div class="achievement-name">${isHidden ? '???' : t(ach.nameKey)}</div>
                    <div class="achievement-desc">${isHidden ? t('achievement.hidden') : t(ach.descKey)}</div>
                </div>
            </div>`;
        }

        html += '</div></div>';
    }

    gallery.innerHTML = html;

    const counter = document.getElementById('achievement-counter');
    if (counter) counter.textContent = `${unlocked}/${total}`;
}

export function toggleAchievementPanel() {
    const panel = document.getElementById('achievement-panel');
    if (!panel) return;
    if (panel.classList.contains('hidden')) {
        renderAchievementGallery();
        panel.classList.remove('hidden');
    } else {
        panel.classList.add('hidden');
    }
}

export function getUnlockCount() {
    return Object.keys(persistentStats.unlocked).length;
}

export function getStats() {
    return persistentStats;
}

export function trackStat(key, value) {
    if (key === 'donStreak') {
        persistentStats.maxDonStreak = Math.max(persistentStats.maxDonStreak || 0, value);
    } else if (key === 'stageClear') {
        if (!persistentStats.stageClears) persistentStats.stageClears = { 1: 0, 2: 0, 3: 0 };
        persistentStats.stageClears[value] = (persistentStats.stageClears[value] || 0) + 1;
    } else if (key === 'shotFired') {
        persistentStats.totalShotsFired = (persistentStats.totalShotsFired || 0) + 1;
    } else if (key === 'itemUsed') {
        persistentStats.totalItemsUsed = (persistentStats.totalItemsUsed || 0) + 1;
    }
    savePersistentStats();
}
