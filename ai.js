// AI difficulty: 'easy', 'normal', 'hard'
let aiDifficulty = 'normal';

export function getAIDifficulty() { return aiDifficulty; }
export function setAIDifficulty(d) { aiDifficulty = d; }

export function makeAIDecision(gameData) {
    const { dealer, player, shotgun, aiKnownShell } = gameData;

    const remainingLive = shotgun.shells.slice(shotgun.currentIndex).filter(s => s === 'live').length;
    const remainingTotal = shotgun.shells.length - shotgun.currentIndex;
    const liveProbability = remainingTotal > 0 ? remainingLive / remainingTotal : 0.5;

    // Easy mode: 30% chance of making a random sub-optimal decision
    if (aiDifficulty === 'easy' && Math.random() < 0.3) {
        return makeEasyDecision(gameData, liveProbability);
    }

    // Hard mode: extra optimizations
    if (aiDifficulty === 'hard') {
        const hardResult = makeHardExtras(gameData, aiKnownShell, liveProbability);
        if (hardResult) return hardResult;
    }

    // === Normal AI logic (same as before) ===

    // Priority 1: Use handcuffs if available and opponent not already cuffed
    const handcuffs = dealer.items.find(i => i.id === 'handcuffs');
    if (handcuffs && !player.handcuffed) {
        return { type: 'item', item: handcuffs };
    }

    // Priority 2: Use magnifying glass if available (gain knowledge)
    const magnifyingGlass = dealer.items.find(i => i.id === 'magnifying_glass');
    if (magnifyingGlass && aiKnownShell === null) {
        return { type: 'item', item: magnifyingGlass };
    }

    // Priority 3: Act on known shell knowledge
    if (aiKnownShell !== null) {
        if (aiKnownShell === 'live') {
            const inverter = dealer.items.find(i => i.id === 'inverter');
            if (inverter) {
                return { type: 'item', item: inverter };
            }
            const beer = dealer.items.find(i => i.id === 'beer');
            if (beer && dealer.hp <= 2) {
                return { type: 'item', item: beer };
            }
            const handsaw = dealer.items.find(i => i.id === 'handsaw');
            if (handsaw && !shotgun.sawedOff) {
                return { type: 'item', item: handsaw };
            }
            return { type: 'shoot', target: 'player' };
        } else {
            const inverter = dealer.items.find(i => i.id === 'inverter');
            if (inverter) {
                const handsaw = dealer.items.find(i => i.id === 'handsaw');
                if (handsaw && !shotgun.sawedOff) {
                    return { type: 'item', item: handsaw };
                }
                return { type: 'item', item: inverter };
            }
            return { type: 'shoot', target: 'dealer' };
        }
    }

    // Priority 4: Use adrenaline to steal a good item from player
    const adrenaline = dealer.items.find(i => i.id === 'adrenaline');
    if (adrenaline && player.items.length > 0) {
        return { type: 'item', item: adrenaline };
    }

    // Priority 5: Use burner phone when no knowledge
    const burnerPhone = dealer.items.find(i => i.id === 'burner_phone');
    if (burnerPhone && aiKnownShell === null) {
        return { type: 'item', item: burnerPhone };
    }

    // Priority 6: Use beer when live probability is high
    const beer = dealer.items.find(i => i.id === 'beer');
    if (beer && remainingTotal > 1 && liveProbability > 0.6) {
        return { type: 'item', item: beer };
    }

    // Priority 7: Use cigarette if hurt
    const cigarette = dealer.items.find(i => i.id === 'cigarette');
    if (cigarette && dealer.hp < dealer.maxHp) {
        return { type: 'item', item: cigarette };
    }

    // Priority 8: Use expired medicine if low HP
    const medicine = dealer.items.find(i => i.id === 'expired_medicine');
    if (medicine && dealer.hp <= dealer.maxHp * 0.5) {
        return { type: 'item', item: medicine };
    }

    // Priority 9: Blind inverter use
    const inverterBlind = dealer.items.find(i => i.id === 'inverter');
    if (inverterBlind && liveProbability > 0.65) {
        return { type: 'item', item: inverterBlind };
    }

    // Priority 10: Probability-based decision
    if (liveProbability > 0.6) {
        const handsaw = dealer.items.find(i => i.id === 'handsaw');
        if (handsaw && !shotgun.sawedOff && liveProbability > 0.75) {
            return { type: 'item', item: handsaw };
        }
        return { type: 'shoot', target: 'player' };
    } else if (liveProbability < 0.4) {
        return { type: 'shoot', target: 'dealer' };
    }

    return { type: 'shoot', target: 'player' };
}

// Easy mode: sometimes skips items, makes more random choices
function makeEasyDecision(gameData, liveProbability) {
    const { dealer, shotgun } = gameData;

    // Maybe use a random item (but not optimally)
    if (dealer.items.length > 0 && Math.random() < 0.3) {
        const item = dealer.items[Math.floor(Math.random() * dealer.items.length)];
        return { type: 'item', item };
    }

    // Random shoot target, slight bias toward player
    if (liveProbability > 0.5) {
        return { type: 'shoot', target: 'player' };
    }
    return { type: 'shoot', target: Math.random() < 0.5 ? 'player' : 'dealer' };
}

// Hard mode extras: more aggressive item usage
function makeHardExtras(gameData, aiKnownShell, liveProbability) {
    const { dealer, player, shotgun } = gameData;

    // Hard: always use handsaw before shooting player when live probability is high
    if (aiKnownShell === 'live' && !shotgun.sawedOff) {
        const handsaw = dealer.items.find(i => i.id === 'handsaw');
        if (handsaw) return { type: 'item', item: handsaw };
    }

    // Hard: use cigarette more aggressively (even at 1 HP lost)
    if (dealer.hp < dealer.maxHp && liveProbability < 0.5) {
        const cigarette = dealer.items.find(i => i.id === 'cigarette');
        if (cigarette) return { type: 'item', item: cigarette };
    }

    return null; // fall through to normal logic
}
