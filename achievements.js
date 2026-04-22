// ====== Achievement System ======

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
        id: 'first_blood', name: '初次流血', desc: '第一次命中对手',
        icon: '🩸', category: AchievementCategory.COMBAT, hidden: false
    },
    SHARPSHOOTER: {
        id: 'sharpshooter', name: '神枪手', desc: '连续3发实弹全部命中',
        icon: '🎯', category: AchievementCategory.COMBAT, hidden: false
    },
    DOUBLE_TAP: {
        id: 'double_tap', name: '双重打击', desc: '使用手锯后命中对手',
        icon: '🪚', category: AchievementCategory.COMBAT, hidden: false
    },
    BLUFF_MASTER: {
        id: 'bluff_master', name: '虚张声势', desc: '实弹概率超过75%时射自己且是空弹',
        icon: '🃏', category: AchievementCategory.COMBAT, hidden: false
    },
    DEALER_SLAYER: {
        id: 'dealer_slayer', name: '恶魔猎手', desc: '使用手锯一枪击杀庄家',
        icon: '💀', category: AchievementCategory.COMBAT, hidden: false
    },

    // === SURVIVAL ===
    COMEBACK_KING: {
        id: 'comeback_king', name: '绝地反击', desc: '在只剩1点生命时赢得游戏',
        icon: '👑', category: AchievementCategory.SURVIVAL, hidden: false
    },
    UNTOUCHABLE: {
        id: 'untouchable', name: '不可触碰', desc: '完成整场游戏未受任何伤害',
        icon: '🛡️', category: AchievementCategory.SURVIVAL, hidden: false
    },
    RISK_TAKER: {
        id: 'risk_taker', name: '赌徒', desc: '使用过期药物且成功恢复',
        icon: '💊', category: AchievementCategory.SURVIVAL, hidden: false
    },
    SURVIVOR: {
        id: 'survivor', name: '幸存者', desc: '累计使用香烟恢复10次',
        icon: '🚬', category: AchievementCategory.SURVIVAL, hidden: false
    },

    // === ITEMS ===
    KNOWLEDGE_IS_POWER: {
        id: 'knowledge_is_power', name: '知识就是力量', desc: '使用放大镜后根据信息做出正确决定',
        icon: '🔍', category: AchievementCategory.ITEMS, hidden: false
    },
    BOTTOMS_UP: {
        id: 'bottoms_up', name: '一饮而尽', desc: '使用啤酒退出实弹',
        icon: '🍺', category: AchievementCategory.ITEMS, hidden: false
    },
    ITEM_COLLECTOR: {
        id: 'item_collector', name: '道具收藏家', desc: '在单场游戏中使用所有6种道具',
        icon: '🎒', category: AchievementCategory.ITEMS, hidden: false
    },
    CHAIN_MASTER: {
        id: 'chain_master', name: '锁链大师', desc: '累计成功使用手铐3次',
        icon: '⛓️', category: AchievementCategory.ITEMS, hidden: false
    },
    SAW_SURGEON: {
        id: 'saw_surgeon', name: '锯子外科医生', desc: '使用手锯命中对手3次',
        icon: '🪚', category: AchievementCategory.ITEMS, hidden: false
    },

    // === STAGES ===
    STAGE_1_CLEAR: {
        id: 'stage_1_clear', name: '初试身手', desc: '通过阶段1',
        icon: '⭐', category: AchievementCategory.STAGES, hidden: false
    },
    STAGE_2_CLEAR: {
        id: 'stage_2_clear', name: '越来越难', desc: '通过阶段2',
        icon: '⭐', category: AchievementCategory.STAGES, hidden: false
    },
    STAGE_3_CLEAR: {
        id: 'stage_3_clear', name: '最终胜利', desc: '通过阶段3，赢得游戏',
        icon: '🏆', category: AchievementCategory.STAGES, hidden: false
    },
    SPEED_RUN: {
        id: 'speed_run', name: '速通大师', desc: '在5回合内完成一个阶段',
        icon: '⚡', category: AchievementCategory.STAGES, hidden: false
    },

    // === META ===
    FIRST_GAME: {
        id: 'first_game', name: '初次登场', desc: '完成第一场游戏',
        icon: '🎮', category: AchievementCategory.META, hidden: false
    },
    VETERAN: {
        id: 'veteran', name: '老练玩家', desc: '完成10场游戏',
        icon: '🎖️', category: AchievementCategory.META, hidden: false
    },
    WIN_STREAK_3: {
        id: 'win_streak_3', name: '三连胜', desc: '连续赢得3场游戏',
        icon: '🔥', category: AchievementCategory.META, hidden: false
    },
    TOTAL_WINS_5: {
        id: 'total_wins_5', name: '常胜将军', desc: '累计赢得5场游戏',
        icon: '🏆', category: AchievementCategory.META, hidden: false
    },

    // === SPECIAL / HIDDEN ===
    SELF_SHOT_BLANK_3: {
        id: 'self_shot_blank_3', name: '自射达人', desc: '单局游戏射自己空弹3次',
        icon: '🤪', category: AchievementCategory.SPECIAL, hidden: true
    },
    MEDICINE_FAIL: {
        id: 'medicine_fail', name: '药不对症', desc: '使用过期药物副作用致死',
        icon: '☠️', category: AchievementCategory.SPECIAL, hidden: true
    },
    PERFECT_GAME: {
        id: 'perfect_game', name: '完美游戏', desc: '不使用任何道具赢得整场游戏',
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
            <div class="achievement-toast-label">成就解锁！</div>
            <div class="achievement-toast-name">${ach.name}</div>
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
        { key: AchievementCategory.COMBAT, name: '⚔️ 战斗' },
        { key: AchievementCategory.SURVIVAL, name: '🛡️ 生存' },
        { key: AchievementCategory.ITEMS, name: '🎒 道具' },
        { key: AchievementCategory.STAGES, name: '⭐ 阶段' },
        { key: AchievementCategory.META, name: '📊 统计' },
        { key: AchievementCategory.SPECIAL, name: '❓ 特殊' },
    ];

    let html = '';

    // Stats header
    const total = Object.keys(Achievements).length;
    const unlocked = Object.keys(persistentStats.unlocked).length;
    html += `<div class="achievement-stats">
        <span>已解锁: ${unlocked} / ${total}</span>
        <div class="achievement-progress-bar">
            <div class="achievement-progress-fill" style="width: ${(unlocked / total) * 100}%"></div>
        </div>
    </div>`;

    for (const cat of categories) {
        const catAchievements = Object.values(Achievements).filter(a => a.category === cat.key);
        const catUnlocked = catAchievements.filter(a => persistentStats.unlocked[a.id]).length;

        html += `<div class="achievement-category">
            <div class="achievement-category-header">${cat.name} (${catUnlocked}/${catAchievements.length})</div>
            <div class="achievement-grid">`;

        for (const ach of catAchievements) {
            const isUnlocked = !!persistentStats.unlocked[ach.id];
            const isHidden = ach.hidden && !isUnlocked;

            html += `<div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
                <div class="achievement-icon">${isHidden ? '❓' : ach.icon}</div>
                <div class="achievement-info">
                    <div class="achievement-name">${isHidden ? '???' : ach.name}</div>
                    <div class="achievement-desc">${isHidden ? '隐藏成就' : ach.desc}</div>
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
