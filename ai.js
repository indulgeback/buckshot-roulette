export function makeAIDecision(gameData) {
    const { dealer, player, shotgun, aiKnownShell } = gameData;

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
            // Known live — use inverter to flip it to blank, then shoot self
            const inverter = dealer.items.find(i => i.id === 'inverter');
            if (inverter) {
                return { type: 'item', item: inverter };
            }
            // No inverter — use beer to eject it
            const beer = dealer.items.find(i => i.id === 'beer');
            if (beer && dealer.hp <= 2) {
                return { type: 'item', item: beer };
            }
            // Use handsaw then shoot player
            const handsaw = dealer.items.find(i => i.id === 'handsaw');
            if (handsaw && !shotgun.sawedOff) {
                return { type: 'item', item: handsaw };
            }
            return { type: 'shoot', target: 'player' };
        } else {
            // Known blank — use inverter to flip it to live, then shoot player
            const inverter = dealer.items.find(i => i.id === 'inverter');
            if (inverter) {
                const handsaw = dealer.items.find(i => i.id === 'handsaw');
                if (handsaw && !shotgun.sawedOff) {
                    return { type: 'item', item: handsaw };
                }
                return { type: 'item', item: inverter };
            }
            // No inverter — shoot self to keep turn
            return { type: 'shoot', target: 'dealer' };
        }
    }

    // Priority 4: Use adrenaline to steal a good item from player
    const adrenaline = dealer.items.find(i => i.id === 'adrenaline');
    if (adrenaline && player.items.length > 0) {
        return { type: 'item', item: adrenaline };
    }

    // Priority 5: Use burner phone when no knowledge (gain partial info)
    const burnerPhone = dealer.items.find(i => i.id === 'burner_phone');
    if (burnerPhone && aiKnownShell === null) {
        return { type: 'item', item: burnerPhone };
    }

    // Priority 6: Use beer when no knowledge and live probability is high
    const remainingLive = shotgun.shells.slice(shotgun.currentIndex).filter(s => s === 'live').length;
    const remainingTotal = shotgun.shells.length - shotgun.currentIndex;
    const liveProbability = remainingLive / remainingTotal;

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

    // Priority 9: Use inverter without knowledge (gamble: hope it helps)
    const inverterBlind = dealer.items.find(i => i.id === 'inverter');
    if (inverterBlind && liveProbability > 0.65) {
        // High live probability — invert to blank, then shoot self
        return { type: 'item', item: inverterBlind };
    }

    // Priority 10: Probability-based decision (no knowledge)
    if (liveProbability > 0.6) {
        const handsaw = dealer.items.find(i => i.id === 'handsaw');
        if (handsaw && !shotgun.sawedOff && liveProbability > 0.75) {
            return { type: 'item', item: handsaw };
        }
        return { type: 'shoot', target: 'player' };
    } else if (liveProbability < 0.4) {
        return { type: 'shoot', target: 'dealer' };
    }

    // 50/50 — default to shooting player
    return { type: 'shoot', target: 'player' };
}
