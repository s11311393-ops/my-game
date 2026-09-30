/**
 * 遊戲主循環與狀態管理模組 (Game Engine & State Management Module)
 * 負責主循環、狀態流轉、Web Audio 音效、粒子特效、浮動文字與震動效果
 */

import { CONFIG } from './config.js';
import { Player } from './player.js';
import { EnemyManager, ObjectPool } from './enemy.js';

/**
 * Web Audio API 程序化音效引擎（免外部音檔，跨平台穩定低延遲）
 */
export class SoundEngine {
    constructor() {
        this.enabled = true;
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playCatch(comboCount = 1) {
        if (!this.enabled || !this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            const now = this.ctx.currentTime;
            const baseFreq = 440 * Math.pow(1.12, Math.min(comboCount, 10));
            osc.type = comboCount >= 5 ? 'triangle' : 'sine';
            osc.frequency.setValueAtTime(baseFreq, now);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.12);

            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

            osc.start(now);
            osc.stop(now + 0.15);
        } catch (e) {
            console.warn('Audio playback error:', e);
        }
    }

    playBomb() {
        if (!this.enabled || !this.ctx) return;
        try {
            const bufferSize = this.ctx.sampleRate * 0.4;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(350, this.ctx.currentTime);
            filter.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.4);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            noise.start();
        } catch (e) {
            console.warn('Audio playback error:', e);
        }
    }

    playFrenzyStart() {
        if (!this.enabled || !this.ctx) return;
        try {
            const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
            notes.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                const now = this.ctx.currentTime + (idx * 0.06);
                osc.frequency.setValueAtTime(freq, now);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
                osc.start(now);
                osc.stop(now + 0.12);
            });
        } catch (e) {
            console.warn('Audio playback error:', e);
        }
    }
}

/**
 * 遊戲主控制器類別 (Game Controller)
 */
export class Game {
    constructor(canvas, uiElements) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ui = uiElements;

        // 核心子系統
        this.soundEngine = new SoundEngine();
        this.player = new Player();
        this.enemyManager = new EnemyManager();

        // 幾何粒子特效物件池 (12-16 顆幾何粒子/次)
        this.activeParticles = [];
        this.particlePool = new ObjectPool(
            () => ({ x: 0, y: 0, vx: 0, vy: 0, alpha: 1, color: '#fff', size: 4, shape: 'square', active: false }),
            (p) => { p.active = false; },
            200
        );

        // 浮動文字特效物件池
        this.activeFloatTexts = [];
        this.floatTextPool = new ObjectPool(
            () => ({ x: 0, y: 0, text: '', color: '#fff', alpha: 1, vy: -1.8, active: false }),
            (ft) => { ft.active = false; },
            30
        );

        // 遊戲運行狀態
        this.gameState = 'START'; // 'START' | 'PLAYING' | 'GAMEOVER'
        this.score = 0;
        this.lives = CONFIG.INITIAL_LIVES;
        this.level = 1;
        this.combo = 0;
        this.comboTimer = 0;
        this.frenzyTimeLeft = 0;
        this.highScore = parseInt(localStorage.getItem(CONFIG.STORAGE_KEY), 10) || 0;

        // 震動特效狀態
        this.screenShakeTime = 0;
        this.screenShakeIntensity = 0;

        // 定時生成計時器
        this.spawnTimer = null;
        this.lastTimestamp = performance.now();

        // 綁定主循環
        this.loop = this.loop.bind(this);
    }

    /**
     * 啟動震動效果
     */
    triggerScreenShake(intensity = 6, durationMs = 150) {
        this.screenShakeIntensity = intensity;
        this.screenShakeTime = durationMs;
    }

    /**
     * 碰撞產生幾何粒子特效
     */
    spawnParticles(x, y, color) {
        const count = Math.floor(Math.random() * 5) + 12;
        for (let i = 0; i < count; i++) {
            const p = this.particlePool.acquire();
            p.active = true;
            p.x = x;
            p.y = y;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 7 + 2;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed - 1.5;
            p.alpha = 1;
            p.color = color;
            p.size = Math.random() * 5 + 3;
            p.shape = Math.random() > 0.5 ? 'square' : 'circle';
            this.activeParticles.push(p);
        }
    }

    /**
     * 產生浮動文字（得分、連擊、升級）
     */
    addFloatText(x, y, text, color) {
        const ft = this.floatTextPool.acquire();
        ft.active = true;
        ft.x = x;
        ft.y = y;
        ft.text = text;
        ft.color = color;
        ft.alpha = 1;
        ft.vy = -1.8;
        this.activeFloatTexts.push(ft);
    }

    /**
     * 更新生命值愛心顯示
     */
    updateLivesDisplay() {
        if (!this.ui.livesContainer) return;
        this.ui.livesContainer.innerHTML = '';
        for (let i = 0; i < CONFIG.MAX_LIVES; i++) {
            const heart = document.createElement('span');
            heart.className = `text-sm sm:text-base transition-all ${i < this.lives ? 'opacity-100 scale-100' : 'opacity-20 scale-75 grayscale'}`;
            heart.innerText = '❤️';
            this.ui.livesContainer.appendChild(heart);
        }
    }

    /**
     * 排程下一個掉落物生成（含效能限制與速度調整）
     */
    scheduleNextSpawn() {
        if (this.gameState !== 'PLAYING') return;

        // 效能優化：限制畫面上的最大掉落物數量（超過 8 個時暫緩生成，防止卡頓）
        if (this.enemyManager.getCount() < CONFIG.MAX_ACTIVE_ITEMS) {
            const isFrenzy = this.frenzyTimeLeft > 0;
            this.enemyManager.spawn(this.canvas.width, this.level, isFrenzy);
        }

        // 超過 Lv.5 以後，生成間隔維持不變，僅靠掉落速度提升難度
        const effectiveLevel = Math.min(this.level, 5);
        const frenzyMult = this.frenzyTimeLeft > 0 ? 0.75 : 1.0;
        const delay = Math.max(300, (1000 - (effectiveLevel * 100))) * frenzyMult;

        this.spawnTimer = setTimeout(() => {
            this.scheduleNextSpawn();
        }, delay + Math.random() * 200);
    }

    /**
     * 開始 / 重新開始遊戲
     */
    start() {
        this.soundEngine.init();
        if (this.spawnTimer) clearTimeout(this.spawnTimer);

        this.score = 0;
        this.lives = CONFIG.INITIAL_LIVES;
        this.level = 1;
        this.combo = 0;
        this.comboTimer = 0;
        this.frenzyTimeLeft = 0;

        // 清空所有活躍物件回物件池
        this.enemyManager.reset();
        this.activeParticles.forEach(p => this.particlePool.release(p));
        this.activeFloatTexts.forEach(ft => this.floatTextPool.release(ft));
        this.activeParticles = [];
        this.activeFloatTexts = [];

        // 重設玩家位置
        this.player.reset(this.canvas.width, this.canvas.height);

        // 更新 UI
        if (this.ui.scoreVal) this.ui.scoreVal.innerText = this.score;
        if (this.ui.levelVal) this.ui.levelVal.innerText = this.level;
        if (this.ui.comboVal) this.ui.comboVal.innerText = 'x1';
        if (this.ui.frenzyBarContainer) this.ui.frenzyBarContainer.classList.add('hidden');
        if (this.ui.gameWrapper) this.ui.gameWrapper.classList.remove('frenzy-glow');
        this.updateLivesDisplay();

        if (this.ui.startOverlay) this.ui.startOverlay.classList.add('hidden');
        if (this.ui.gameOverOverlay) this.ui.gameOverOverlay.classList.add('hidden');

        this.gameState = 'PLAYING';
        this.lastTimestamp = performance.now();
        this.scheduleNextSpawn();
    }

    /**
     * 遊戲結束判定與介面顯示
     */
    gameOver() {
        this.gameState = 'GAMEOVER';
        if (this.spawnTimer) clearTimeout(this.spawnTimer);

        this.soundEngine.playBomb();
        this.triggerScreenShake(8, 250);

        if (this.score > this.highScore) {
            this.highScore = this.score;
            try {
                localStorage.setItem(CONFIG.STORAGE_KEY, this.highScore);
            } catch (e) {
                console.warn('LocalStorage access error:', e);
            }
        }

        if (this.ui.finalScore) this.ui.finalScore.innerText = this.score;
        if (this.ui.highScore) this.ui.highScore.innerText = this.highScore;
        if (this.ui.gameOverOverlay) this.ui.gameOverOverlay.classList.remove('hidden');
        if (this.ui.gameWrapper) this.ui.gameWrapper.classList.remove('frenzy-glow');
    }

    /**
     * 處理物品與籃子的命中判定
     */
    handleItemHit(item) {
        if (item.config.type === 'bomb') {
            // 吃到炸彈
            this.lives--;
            this.updateLivesDisplay();
            this.soundEngine.playBomb();
            this.triggerScreenShake(7, 200);
            this.addFloatText(item.x, item.y, '-1 ❤️ 💥', '#ef4444');
            this.spawnParticles(item.x, item.y, '#ef4444');
            this.combo = 0;
            if (this.ui.comboVal) this.ui.comboVal.innerText = 'x1';

            if (this.lives <= 0) {
                this.gameOver();
            }
        } else {
            // 吃到水果或黃金星
            this.combo++;
            this.comboTimer = CONFIG.COMBO_TIMEOUT;
            if (this.ui.comboVal) this.ui.comboVal.innerText = `x${this.combo}`;

            const earnedPoints = item.config.points * this.combo;
            this.score += earnedPoints;
            if (this.ui.scoreVal) this.ui.scoreVal.innerText = this.score;

            this.soundEngine.playCatch(this.combo);
            this.triggerScreenShake(4, 100);
            this.spawnParticles(item.x, item.y, item.config.glowColor);

            // 連擊達到 5 次觸發狂熱模式 (Frenzy Mode)
            if (this.combo === CONFIG.FRENZY_TRIGGER_COMBO && this.frenzyTimeLeft <= 0) {
                this.frenzyTimeLeft = CONFIG.FRENZY_DURATION;
                if (this.ui.frenzyBarContainer) this.ui.frenzyBarContainer.classList.remove('hidden');
                if (this.ui.gameWrapper) this.ui.gameWrapper.classList.add('frenzy-glow');
                this.soundEngine.playFrenzyStart();
                this.addFloatText(this.canvas.width / 2, this.canvas.height / 3, '⚡ FRENZY 狂熱模式！', '#06b6d4');
            } else {
                const suffix = this.combo > 1 ? ` (x${this.combo})` : '';
                this.addFloatText(item.x, item.y, `+${earnedPoints}${suffix}`, item.config.glowColor);
            }

            // 等級提升檢查
            const newLevel = Math.floor(this.score / CONFIG.POINTS_PER_LEVEL) + 1;
            if (newLevel > this.level) {
                this.level = newLevel;
                if (this.ui.levelVal) this.ui.levelVal.innerText = this.level;
                this.addFloatText(this.canvas.width / 2, this.canvas.height / 4, `LEVEL UP! Lv.${this.level}`, '#22d3ee');
            }
        }
    }

    /**
     * 切換靜音開關
     */
    toggleSound() {
        this.soundEngine.init();
        this.soundEngine.enabled = !this.soundEngine.enabled;
        return this.soundEngine.enabled;
    }

    /**
     * 調整畫面尺寸更新
     */
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.player.resize(this.canvas.width, this.canvas.height, this.gameState === 'START');
    }

    /**
     * 每幀邏輯更新
     */
    update(timestamp, keys) {
        const dt = (timestamp - this.lastTimestamp) / 1000;
        this.lastTimestamp = timestamp;

        if (this.gameState !== 'PLAYING') return;

        // 連擊計時倒數
        if (this.combo > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 0;
                if (this.ui.comboVal) this.ui.comboVal.innerText = 'x1';
            }
        }

        // 狂熱模式計時倒數與進度條更新
        const isFrenzy = this.frenzyTimeLeft > 0;
        if (isFrenzy) {
            this.frenzyTimeLeft -= dt;
            const pct = (this.frenzyTimeLeft / CONFIG.FRENZY_DURATION) * 100;
            if (this.ui.frenzyFill) {
                this.ui.frenzyFill.style.width = `${Math.max(0, pct)}%`;
            }
            if (this.frenzyTimeLeft <= 0) {
                if (this.ui.frenzyBarContainer) this.ui.frenzyBarContainer.classList.add('hidden');
                if (this.ui.gameWrapper) this.ui.gameWrapper.classList.remove('frenzy-glow');
            }
        }

        // 震動時間倒數
        if (this.screenShakeTime > 0) {
            this.screenShakeTime -= dt * 1000;
        }

        // 更新玩家
        this.player.update(dt, this.canvas.width, keys, isFrenzy);

        // 更新掉落物並執行碰撞判定
        const basketHitbox = this.player.getHitbox();
        this.enemyManager.update(
            dt,
            this.canvas.height,
            basketHitbox,
            (item) => this.handleItemHit(item),
            null
        );

        // 更新粒子效果
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15; // 重力
            p.alpha -= 0.035; // 淡出
            if (p.alpha <= 0) {
                this.particlePool.release(p);
                this.activeParticles.splice(i, 1);
            }
        }

        // 更新浮動文字
        for (let i = this.activeFloatTexts.length - 1; i >= 0; i--) {
            const ft = this.activeFloatTexts[i];
            ft.y += ft.vy;
            ft.alpha -= 0.025; // 淡出
            if (ft.alpha <= 0) {
                this.floatTextPool.release(ft);
                this.activeFloatTexts.splice(i, 1);
            }
        }
    }

    /**
     * 畫布繪製渲染
     */
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();

        // 畫面震動位移
        if (this.screenShakeTime > 0) {
            const offsetX = (Math.random() - 0.5) * this.screenShakeIntensity;
            const offsetY = (Math.random() - 0.5) * this.screenShakeIntensity;
            this.ctx.translate(offsetX, offsetY);
        }

        // 背景微弱科技感格線
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < this.canvas.width; i += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(i, 0);
            this.ctx.lineTo(i, this.canvas.height);
            this.ctx.stroke();
        }

        // 繪製玩家籃子
        const isFrenzy = this.frenzyTimeLeft > 0;
        this.player.draw(this.ctx, isFrenzy);

        // 繪製掉落物
        this.enemyManager.draw(this.ctx);

        // 繪製幾何粒子
        this.activeParticles.forEach(p => {
            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, p.alpha);
            this.ctx.fillStyle = p.color;
            this.ctx.shadowColor = p.color;
            this.ctx.shadowBlur = 8;
            if (p.shape === 'square') {
                this.ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            } else {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.restore();
        });

        // 繪製浮動文字
        this.activeFloatTexts.forEach(ft => {
            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, ft.alpha);
            this.ctx.font = 'bold 15px "Press Start 2P", monospace';
            this.ctx.fillStyle = ft.color;
            this.ctx.shadowColor = ft.color;
            this.ctx.shadowBlur = 10;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(ft.text, ft.x, ft.y);
            this.ctx.restore();
        });

        this.ctx.restore();
    }

    /**
     * 主遊戲循環
     */
    loop(timestamp, keys) {
        this.update(timestamp, keys);
        this.draw();
    }
}
