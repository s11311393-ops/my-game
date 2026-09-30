/**
 * 障礙物與掉落物生成/碰撞邏輯模組 (Enemy / Items Module)
 * 負責水果、星星與危險炸彈的物件池管理、下落運動、自轉與命中判定
 */

import { CONFIG } from './config.js';

/**
 * 通用高效能物件池 (Object Pool)
 * 避免遊戲運行期間頻繁垃圾回收 (GC) 造成的微卡頓
 */
export class ObjectPool {
    constructor(createFn, resetFn, initialSize = 30) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.pool = [];
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(createFn());
        }
    }

    acquire() {
        if (this.pool.length > 0) {
            return this.pool.pop();
        }
        return this.createFn();
    }

    release(obj) {
        this.resetFn(obj);
        this.pool.push(obj);
    }
}

/**
 * 敵人與掉落物管理器
 */
export class EnemyManager {
    constructor() {
        this.activeItems = [];
        // 初始化掉落物物件池 (50 個預先分配)
        this.itemPool = new ObjectPool(
            () => ({
                x: 0,
                y: 0,
                radius: 22,
                speed: 3,
                config: null,
                rotation: 0,
                rotSpeed: 0,
                active: false
            }),
            (item) => {
                item.active = false;
                item.config = null;
            },
            50
        );
    }

    /**
     * 重設所有掉落物
     */
    reset() {
        this.activeItems.forEach(item => this.itemPool.release(item));
        this.activeItems = [];
    }

    /**
     * 當前畫面上的掉落物數量
     */
    getCount() {
        return this.activeItems.length;
    }

    /**
     * 生成新的掉落物（根據權重挑選水果或炸彈）
     */
    spawn(canvasWidth, level, isFrenzy) {
        // 依照機率權重隨機挑選物品類型
        const rand = Math.random();
        let cumulative = 0;
        let selectedType = CONFIG.ITEM_TYPES[0];

        for (const t of CONFIG.ITEM_TYPES) {
            cumulative += t.prob;
            if (rand <= cumulative) {
                selectedType = t;
                break;
            }
        }

        const item = this.itemPool.acquire();
        item.active = true;
        item.radius = selectedType.radius;
        item.x = Math.random() * (canvasWidth - item.radius * 2.5) + item.radius * 1.25;
        item.y = -50;

        // 核心難度與速度遞增機制：
        // Lv.1~5 隨等級提升速度；Lv.5 之後維持掉落物數量上限，以速度提升（每級 +0.7）
        const baseSpeed = 2.5 + (level * 0.7);
        const frenzyBoost = isFrenzy ? 1.2 : 1.0;
        item.speed = (baseSpeed + Math.random() * 1.2) * frenzyBoost;
        item.config = selectedType;
        item.rotation = Math.random() * Math.PI;
        item.rotSpeed = (Math.random() - 0.5) * 0.04;

        this.activeItems.push(item);
    }

    /**
     * 更新所有掉落物位置與碰撞檢測
     */
    update(dt, canvasHeight, basketHitbox, onHit, onMiss) {
        for (let i = this.activeItems.length - 1; i >= 0; i--) {
            const item = this.activeItems[i];
            item.y += item.speed;
            item.rotation += item.rotSpeed;

            // 碰撞檢測：掉落物圓形 vs 籃子 Hitbox 矩形
            const collides = (
                item.x + item.radius >= basketHitbox.x &&
                item.x - item.radius <= basketHitbox.x + basketHitbox.w &&
                item.y + item.radius >= basketHitbox.y &&
                item.y - item.radius <= basketHitbox.y + basketHitbox.h
            );

            if (collides) {
                onHit(item);
                this.itemPool.release(item);
                this.activeItems.splice(i, 1);
                continue;
            }

            // 掉出畫面底部
            if (item.y > canvasHeight + 60) {
                if (onMiss) onMiss(item);
                this.itemPool.release(item);
                this.activeItems.splice(i, 1);
            }
        }
    }

    /**
     * 繪製所有發光圓標與表情符號
     */
    draw(ctx) {
        this.activeItems.forEach(item => {
            ctx.save();
            ctx.translate(item.x, item.y);
            ctx.rotate(item.rotation);

            // 外發光
            ctx.shadowColor = item.config.glowColor;
            ctx.shadowBlur = item.config.type === 'bomb' ? 25 : 18;

            // 背景圓形
            ctx.fillStyle = item.config.bgColor;
            ctx.beginPath();
            ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
            ctx.fill();

            // 邊框
            ctx.strokeStyle = item.config.glowColor;
            ctx.lineWidth = item.config.type === 'bomb' ? 4 : 3;
            ctx.stroke();

            // 圖標 Symbol
            ctx.font = `${item.radius * 1.3}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.config.symbol, 0, 0);

            // 炸彈引信閃爍火花特效
            if (item.config.type === 'bomb') {
                ctx.fillStyle = '#fde047';
                ctx.beginPath();
                ctx.arc(item.radius * 0.6, -item.radius * 0.6, 5 + Math.sin(Date.now() * 0.02) * 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        });
    }
}
