/**
 * 玩家控制與狀態模組 (Player / Basket Module)
 * 負責接水果籃子的位置、移動平滑性、命中範圍判定與繪製
 */

import { CONFIG } from './config.js';

export class Player {
    constructor() {
        this.w = CONFIG.BASKET.WIDTH;
        this.h = CONFIG.BASKET.HEIGHT;
        this.speed = CONFIG.BASKET.SPEED;
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
    }

    /**
     * 重設玩家籃子初始位置
     */
    reset(canvasWidth, canvasHeight) {
        this.w = CONFIG.BASKET.WIDTH;
        this.h = CONFIG.BASKET.HEIGHT;
        this.speed = CONFIG.BASKET.SPEED;
        this.x = canvasWidth / 2 - this.w / 2;
        this.targetX = this.x;
        this.y = canvasHeight - CONFIG.BASKET.BOTTOM_OFFSET;
    }

    /**
     * 畫面尺寸改變時更新籃子位置
     */
    resize(canvasWidth, canvasHeight, shouldCenter = false) {
        this.y = canvasHeight - CONFIG.BASKET.BOTTOM_OFFSET;
        if (shouldCenter) {
            this.x = canvasWidth / 2 - this.w / 2;
            this.targetX = this.x;
        } else {
            this.targetX = Math.max(0, Math.min(canvasWidth - this.w, this.targetX));
            this.x = Math.max(0, Math.min(canvasWidth - this.w, this.x));
        }
    }

    /**
     * 觸控或滑鼠設定目標 X 座標
     */
    setTargetPointerX(clientX, canvasRect) {
        const relativeX = clientX - canvasRect.left;
        this.targetX = relativeX - this.w / 2;
    }

    /**
     * 每幀更新籃子位置（鍵盤按鍵 + 平滑內插）
     */
    update(dt, canvasWidth, keys, isFrenzy) {
        const speedBoost = isFrenzy ? 1.2 : 1.0;
        const currentSpeed = this.speed * speedBoost;

        if (keys.ArrowLeft || keys.KeyA) {
            this.targetX -= currentSpeed;
        }
        if (keys.ArrowRight || keys.KeyD) {
            this.targetX += currentSpeed;
        }

        // 限制在邊界範圍內
        this.targetX = Math.max(0, Math.min(canvasWidth - this.w, this.targetX));

        // 慣性平滑內插
        this.x += (this.targetX - this.x) * CONFIG.BASKET.SMOOTH_FACTOR;
    }

    /**
     * 取得籃子有效碰撞範圍（Hitbox）
     */
    getHitbox() {
        return {
            x: this.x + CONFIG.BASKET.HITBOX_INSET.x,
            y: this.y + CONFIG.BASKET.HITBOX_INSET.y,
            w: this.w - CONFIG.BASKET.HITBOX_INSET.w,
            h: this.h - CONFIG.BASKET.HITBOX_INSET.h
        };
    }

    /**
     * 繪製高對比霓虹籃子
     */
    draw(ctx, isFrenzy) {
        ctx.save();
        ctx.shadowColor = isFrenzy ? '#06b6d4' : 'rgba(99, 102, 241, 0.7)';
        ctx.shadowBlur = isFrenzy ? 25 : 18;

        const basketGradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.h);
        basketGradient.addColorStop(0, isFrenzy ? '#22d3ee' : '#818cf8');
        basketGradient.addColorStop(1, isFrenzy ? '#0284c7' : '#4f46e5');
        ctx.fillStyle = basketGradient;

        // 籃子主體
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.w, this.h, [10, 10, 22, 22]);
        ctx.fill();

        // 籃子上緣把手/飾邊
        ctx.fillStyle = isFrenzy ? '#cffafe' : '#c7d2fe';
        ctx.beginPath();
        ctx.roundRect(this.x - 5, this.y - 5, this.w + 10, 9, 5);
        ctx.fill();

        ctx.restore();
    }
}
