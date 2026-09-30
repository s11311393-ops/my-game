/**
 * 遊戲整體設定參數 (Game Configuration)
 * 包含畫布尺寸、分數計算、速度調節、血量與掉落物設定
 */

export const CONFIG = {
    // 遊戲基礎設定
    INITIAL_LIVES: 3,
    MAX_LIVES: 3,
    MAX_ACTIVE_ITEMS: 8,       // 掉落物數量上限（效能防卡頓優化）
    POINTS_PER_LEVEL: 150,     // 升級所需分數間距
    COMBO_TIMEOUT: 1.5,        // 連擊重置秒數
    FRENZY_DURATION: 5.0,      // 狂熱模式持續秒數
    FRENZY_TRIGGER_COMBO: 5,   // 觸發狂熱模式所需連擊數
    STORAGE_KEY: 'catch_it_v2_highscore',

    // 玩家籃子設定
    BASKET: {
        WIDTH: 100,
        HEIGHT: 46,
        SPEED: 10,
        SMOOTH_FACTOR: 0.25,   // 移動平滑插值係數
        BOTTOM_OFFSET: 65,     // 距離畫布底部的距離
        HITBOX_INSET: {
            x: 6,
            y: 4,
            w: 12,
            h: 8
        }
    },

    // 掉落物（水果/障礙物/炸彈）設定清單
    ITEM_TYPES: [
        { name: '紅蘋果', symbol: '🍎', points: 10, type: 'fruit', prob: 0.25, radius: 21, glowColor: '#ff2a5f', bgColor: '#ffeef2' },
        { name: '黃香蕉', symbol: '🍌', points: 15, type: 'fruit', prob: 0.25, radius: 21, glowColor: '#ffcc00', bgColor: '#fffbe6' },
        { name: '紫葡萄', symbol: '🍇', points: 20, type: 'fruit', prob: 0.20, radius: 21, glowColor: '#a855f7', bgColor: '#f5f3ff' },
        { name: '大西瓜', symbol: '🍉', points: 30, type: 'fruit', prob: 0.10, radius: 25, glowColor: '#22c55e', bgColor: '#f0fdf4' },
        { name: '黃金星', symbol: '⭐', points: 50, type: 'golden', prob: 0.05, radius: 19, glowColor: '#fbbf24', bgColor: '#fef3c7' },
        { name: '危險炸彈', symbol: '💣', points: 0, type: 'bomb', prob: 0.15, radius: 23, glowColor: '#ef4444', bgColor: '#fef2f2' }
    ]
};
