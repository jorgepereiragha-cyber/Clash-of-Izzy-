// ============================================
// CLASH OF IZZY - SISTEMA DE EQUIPAMENTOS
// ============================================

window.playerState = window.playerState || {
    gold: 5000,
    sovereignLevel: 5,
    inventory: []
};

window.sovereignGearDB = {
    "coroa_izzy": {
        id: "coroa_izzy",
        name: "Coroa de Izzy",
        slot: "coroa",
        rarity: "lendario",
        level: 1,
        maxLevel: 20,
        isLocked: false,
        stats: { defense: 10, resourceBonus: 0.05 },
        nextLevelStats: { defense: 15, resourceBonus: 0.07 }
    },
    "manto_real": {
        id: "manto_real",
        name: "Manto Real",
        slot: "manto",
        rarity: "epico",
        level: 1,
        maxLevel: 15,
        isLocked: false,
        stats: { health: 50 },
        nextLevelStats: { health: 75 }
    },
    "anel_poder": {
        id: "anel_poder",
        name: "Anel do Poder",
        slot: "anel",
        rarity: "raro",
        level: 1,
        maxLevel: 10,
        isLocked: false,
        stats: { attack: 20 },
        nextLevelStats: { attack: 28 }
    }
};

window.heroGearDB = {
    "espada_guerreiro": {
        id: "espada_guerreiro",
        heroId: "hero_warrior",
        name: "Espada do Guerreiro",
        slot: "arma",
        level: 1,
        maxLevel: 30,
        isLocked: false,
        stats: { attack: 50, health: 100 }
    }
};

function calculateUpgradeCost(item) {
    const baseCost = 100;
    const rarityMultiplier = {
        'comum': 1.0, 'raro': 1.1, 'epico': 1.2, 'lendario': 1.5
    }[item.rarity] || 1.0;
    return Math.floor(baseCost * Math.pow(1.3, item.level) * rarityMultiplier);
}

function upgradeEquipment(itemId) {
    const item = window.sovereignGearDB[itemId] || window.heroGearDB[itemId];
    if (!item) return alert("❌ Item não encontrado!");

    if (item.isLocked) {
        alert("🔒 Item travado! Destrave antes.");
        return;
    }
    if (item.level >= item.maxLevel) {
        alert("⚠️ Nível máximo!");
        return;
    }

    const cost = calculateUpgradeCost(item);
    if (window.playerState.gold < cost) {
        alert("❌ Ouro insuficiente!");
        return;
    }

    window.playerState.gold -= cost;
    item.level += 1;

    if (item.nextLevelStats) {
        item.stats = { ...item.nextLevelStats };
        item.nextLevelStats = {
            defense: (item.stats.defense || 0) + 5,
            health: (item.stats.health || 0) + 25,
            attack: (item.stats.attack || 0) + 8,
            resourceBonus: (item.stats.resourceBonus || 0) + 0.02
        };
    }

    alert(`✅ ${item.name} evoluiu para Nível ${item.level}!`);
    renderEquipmentScreen(itemId);
    updateGoldDisplay();
}

function toggleLock(itemId) {
    const item = window.sovereignGearDB[itemId] || window.heroGearDB[itemId];
    if (!item) return;
    item.isLocked = !item.isLocked;
    renderEquipmentScreen(itemId);
}

function updateGoldDisplay() {
    const el = document.getElementById('player-gold');
    if (el) el.innerText = window.playerState.gold;
}

function renderEquipmentScreen(itemId) {
    const item = window.sovereignGearDB[itemId] || window.heroGearDB[itemId];
    if (!item) return;

    const cost = calculateUpgradeCost(item);
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    set('item-name', item.name);
    set('current-level', item.level);
    set('next-level', item.level + 1);
    set('current-def', item.stats.defense || 0);
    set('next-def', item.nextLevelStats?.defense || '—');
    set('current-res', Math.round((item.stats.resourceBonus || 0) * 100) + '%');
    set('next-res', Math.round((item.nextLevelStats?.resourceBonus || 0) * 100) + '%');
    set('upgrade-cost', cost);
    updateGoldDisplay();

    const lockBtn = document.getElementById('lock-btn');
    if (lockBtn) {
        lockBtn.innerText = item.isLocked ? '🔒 Travado' : '🔓 Destravado';
        lockBtn.classList.toggle('locked', item.isLocked);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.sovereignGearDB['coroa_izzy']) {
        renderEquipmentScreen('coroa_izzy');
    }
});