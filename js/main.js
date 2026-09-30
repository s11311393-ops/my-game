// ==========================================
// 接水果 V2.0 - 高效能狂熱版 (Core Logic)
// 製作人：[11311393/蘇均容]
// ==========================================

const ASSETS = {
    images: {
        player: './assets/images/player.png',
        bg: './assets/images/background.png'
    },
    audio: {
        bgm: './assets/audio/bgm.mp3',
        catch: './assets/audio/catch.mp3', 
        bomb: './assets/audio/bomb.mp3'
    }
};

const loadedResources = { images: {}, audio: {} };

// 資源預載管理器
class Preloader {
    static async loadAll() {
        const imagePromises = Object.entries(ASSETS.images).map(([key, src]) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.src = src;
                img.onload = () => { loadedResources.images[key] = img; resolve(); };
                img.onerror = () => { console.warn(`Image missing: ${src}, using fallback.`); resolve(); };
            });
        });

        const audioPromises = Object.entries(ASSETS.audio).map(([key, src]) => {
            return new Promise((resolve) => {
                const audio = new Audio(src);
                audio.oncanplaythrough = () => { loadedResources.audio[key] = audio; resolve(); };
                audio.onerror = () => { console.warn(`Audio missing: ${src}, using synth fallback.`); resolve(); };
                // 強制觸發加載以避免無限等待
                setTimeout(resolve, 1500); 
            });
        });

        await Promise.all([...imagePromises, ...audioPromises]);
    }
}

// 混合式音效引擎 (實體檔案優先 + Procedural 合成音備案)
class SoundEngine {
    constructor() {
        this.enabled = true;
        this.ctx = null;
        this.bgmPlaying = false;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        // BGM 播放 (第一次互動後)
        if (this.enabled && loadedResources.audio.bgm && !this.bgmPlaying) {
            loadedResources.audio.bgm.loop = true;
            loadedResources.audio.bgm.volume = 0.4;
            loadedResources.audio.bgm.play().catch(e => console.warn('BGM Autoplay prevented', e));
            this.bgmPlaying = true;
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        if (loadedResources.audio.bgm) {
            if (this.enabled) loadedResources.audio.bgm.play();
            else loadedResources.audio.bgm.pause();
        }
        return this.enabled;
    }

    playCatch(comboCount = 1) {
        if (!this.enabled) return;
        if (loadedResources.audio.catch && loadedResources.audio.catch.readyState >= 2) {
            const sfx = loadedResources.audio.catch.cloneNode();
            sfx.volume = Math.min(0.8 + (comboCount * 0.05), 1.0);
            sfx.play().catch(e=>{});
            return;
        }
        // Fallback procedural sound[cite: 2]
        if (!this.ctx) return;
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
        } catch(e) {}
    }

    playBomb() {
        if (!this.enabled) return;
        if (loadedResources.audio.bomb && loadedResources.audio.bomb.readyState >= 2) {
            const sfx = loadedResources.audio.bomb.cloneNode();
            sfx.volume = 0.9;
            sfx.play().catch(e=>{});
            return;
        }
        // Fallback procedural noise[cite: 2]
        if (!this.ctx) return;
        try {
            const bufferSize = this.ctx.sampleRate * 0.4;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
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
        } catch(e) {}
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
        } catch(e) {}
    }
}

// 玩家動態精靈圖管理器
class SpriteEngine {
    constructor() {
        this.frameTimer = 0;
        this.currentFrame = 0;
        this.fps = 12; // 精靈圖動畫速度
        this.direction = 1; // 1: 右, -1: 左
        
        // 假設預設精靈圖為 4 幀水平排布 (可依據實際素材調整)
        this.totalFrames = 4;
    }

    update(dt, isMoving, targetX, currentX) {
        // 更新方向
        if (targetX < currentX - 1) this.direction = -1;
        else if (targetX > currentX + 1) this.direction = 1;

        // 動畫幀數計算
        if (isMoving) {
            this.frameTimer += dt;
            if (this.frameTimer >= 1 / this.fps) {
                this.currentFrame = (this.currentFrame + 1) % this.totalFrames;
                this.frameTimer = 0;
            }
        } else {
            this.currentFrame = 0; // 待機回到第0幀
        }
    }

    draw(ctx, img, x, y, w, h) {
        if (!img) return; // 保護機制
        ctx.save();
        
        // 計算切割寬度
        const frameW = img.width / this.totalFrames;
        const frameH = img.height;
        
        // 移動至繪製中心，進行鏡像翻轉
        ctx.translate(x + w / 2, y + h / 2);
        ctx.scale(this.direction, 1);
        
        // 繪製動態幀，微調圖片尺寸以覆蓋原始 Basket 碰撞箱[cite: 2]
        ctx.drawImage(
            img,
            this.currentFrame * frameW, 0, frameW, frameH,
            -w / 2 - 10, -h / 2 - 20, w + 20, h + 25 
        );
        ctx.restore();
    }
}

const soundEngine = new SoundEngine();
const spriteEngine = new SpriteEngine();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameWrapper = document.getElementById('gameWrapper');

// UI Elements
const startOverlay = document.getElementById('startOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreValEl = document.getElementById('scoreVal');
const levelValEl = document.getElementById('levelVal');
const comboValEl = document.getElementById('comboVal');
const livesContainer = document.getElementById('livesContainer');
const finalScoreEl = document.getElementById('finalScore');
const highScoreEl = document.getElementById('highScore');
const soundToggle = document.getElementById('soundToggle');
const frenzyBarContainer = document.getElementById('frenzyBarContainer');
const frenzyFill = document.getElementById('frenzyFill');

// Game State Variables
let gameState = 'LOADING'; // 新增 LOADING 狀態
let score = 0;
let lives = 3;
let level = 1;
let combo = 0;
let comboTimer = 0;
let frenzyTimeLeft = 0;
const FRENZY_DURATION = 5.0; 
let highScore = localStorage.getItem('catch_it_v2_highscore') || 0;

// Object Pool 機制維持原版高效能設定[cite: 2]
class ObjectPool {
    constructor(createFn, resetFn, initialSize = 30) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.pool = [];
        for (let i = 0; i < initialSize; i++) this.pool.push(createFn());
    }
    acquire() { return this.pool.length > 0 ? this.pool.pop() : this.createFn(); }
    release(obj) { this.resetFn(obj); this.pool.push(obj); }
}

let activeItems = [];
let activeParticles = [];
let activeFloatTexts = [];

const itemPool = new ObjectPool(() => ({ x: 0, y: 0, radius: 22, speed: 3, config: null, rotation: 0, rotSpeed: 0, active: false }), (item) => { item.active = false; }, 50);
const particlePool = new ObjectPool(() => ({ x: 0, y: 0, vx: 0, vy: 0, alpha: 1, color: '#fff', size: 4, shape: 'square', active: false }), (p) => { p.active = false; }, 200);
const floatTextPool = new ObjectPool(() => ({ x: 0, y: 0, text: '', color: '#fff', alpha: 1, vy: -1.5, active: false }), (ft) => { ft.active = false; }, 30);

// 嚴格維持原本物理手感尺寸[cite: 2]
let basket = { x: 0, y: 0, w: 100, h: 46, speed: 10, targetX: 0 };

const ITEM_TYPES = [
    { name: '紅蘋果', symbol: '🍎', points: 10, type: 'fruit', prob: 0.25, radius: 21, glowColor: '#ff2a5f', bgColor: '#ffeef2' },
    { name: '黃香蕉', symbol: '🍌', points: 15, type: 'fruit', prob: 0.25, radius: 21, glowColor: '#ffcc00', bgColor: '#fffbe6' },
    { name: '紫葡萄', symbol: '🍇', points: 20, type: 'fruit', prob: 0.20, radius: 21, glowColor: '#a855f7', bgColor: '#f5f3ff' },
    { name: '大西瓜', symbol: '🍉', points: 30, type: 'fruit', prob: 0.10, radius: 25, glowColor: '#22c55e', bgColor: '#f0fdf4' },
    { name: '黃金星', symbol: '⭐', points: 50, type: 'golden', prob: 0.05, radius: 19, glowColor: '#fbbf24', bgColor: '#fef3c7' },
    { name: '危險炸彈', symbol: '💣', points: 0, type: 'bomb', prob: 0.15, radius: 23, glowColor: '#ef4444', bgColor: '#fef2f2' }
];

let screenShakeTime = 0, screenShakeIntensity = 0;
function triggerScreenShake(intensity = 6, durationMs = 150) {
    screenShakeIntensity = intensity;
    screenShakeTime = durationMs;
}

const keys = { ArrowLeft: false, ArrowRight: false, KeyA: false, KeyD: false };
let isPointerDown = false;

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    basket.y = canvas.height - 65;
    if (gameState === 'START' || gameState === 'LOADING') {
        basket.x = canvas.width / 2 - basket.w / 2;
        basket.targetX = basket.x;
    }
}
window.addEventListener('resize', resizeCanvas);

window.addEventListener('keydown', e => { if (keys.hasOwnProperty(e.code)) { keys[e.code] = true; e.preventDefault(); } });
window.addEventListener('keyup', e => { if (keys.hasOwnProperty(e.code)) { keys[e.code] = false; e.preventDefault(); } });
canvas.addEventListener('pointerdown', e => { isPointerDown = true; updatePointerX(e); });
canvas.addEventListener('pointermove', e => { if (isPointerDown) updatePointerX(e); });
canvas.addEventListener('pointerup', () => { isPointerDown = false; });
canvas.addEventListener('pointercancel', () => { isPointerDown = false; });

function updatePointerX(e) {
    const rect = canvas.getBoundingClientRect();
    basket.targetX = (e.clientX - rect.left) - basket.w / 2;
}

function spawnParticles(x, y, color) {
    const count = Math.floor(Math.random() * 5) + 12;
    for (let i = 0; i < count; i++) {
        const p = particlePool.acquire();
        p.active = true; p.x = x; p.y = y;
        const angle = Math.random() * Math.PI * 2, speed = Math.random() * 7 + 2;
        p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed - 1.5;
        p.alpha = 1; p.color = color; p.size = Math.random() * 5 + 3; p.shape = Math.random() > 0.5 ? 'square' : 'circle';
        activeParticles.push(p);
    }
}

function addFloatText(x, y, text, color) {
    const ft = floatTextPool.acquire();
    ft.active = true; ft.x = x; ft.y = y; ft.text = text; ft.color = color; ft.alpha = 1; ft.vy = -1.8;
    activeFloatTexts.push(ft);
}

function updateLivesDisplay() {
    livesContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const heart = document.createElement('span');
        heart.className = `text-sm sm:text-base transition-all ${i < lives ? 'opacity-100 scale-100' : 'opacity-20 scale-75 grayscale'}`;
        heart.innerText = '❤️';
        livesContainer.appendChild(heart);
    }
}

let spawnTimer = null;
function scheduleNextSpawn() {
    if (gameState !== 'PLAYING') return;
    if (activeItems.length < 8) spawnItem();[cite: 2]
    const effectiveLevel = Math.min(level, 5);
    const frenzyMult = frenzyTimeLeft > 0 ? 0.75 : 1.0;
    const delay = Math.max(300, (1000 - (effectiveLevel * 100))) * frenzyMult;[cite: 2]
    spawnTimer = setTimeout(scheduleNextSpawn, delay + Math.random() * 200);
}

function startGame() {
    soundEngine.init();
    if (spawnTimer) clearTimeout(spawnTimer);
    score = 0; lives = 3; level = 1; combo = 0; comboTimer = 0; frenzyTimeLeft = 0;

    activeItems.forEach(i => itemPool.release(i));
    activeParticles.forEach(p => particlePool.release(p));
    activeFloatTexts.forEach(ft => floatTextPool.release(ft));
    activeItems = []; activeParticles = []; activeFloatTexts = [];

    scoreValEl.innerText = score;
    levelValEl.innerText = level;
    comboValEl.innerText = `x1`;
    frenzyBarContainer.classList.add('hidden');
    gameWrapper.classList.remove('frenzy-glow');
    updateLivesDisplay();
    
    startOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    gameState = 'PLAYING';
    
    scheduleNextSpawn();
}

function gameOver() {
    gameState = 'GAMEOVER';
    if (spawnTimer) clearTimeout(spawnTimer);
    soundEngine.playBomb();
    triggerScreenShake(8, 250);[cite: 2]
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('catch_it_v2_highscore', highScore);
    }
    finalScoreEl.innerText = score;
    highScoreEl.innerText = highScore;
    gameOverOverlay.classList.remove('hidden');
    gameWrapper.classList.remove('frenzy-glow');
}

function spawnItem() {
    if (gameState !== 'PLAYING') return;
    let rand = Math.random(), cumulative = 0, selectedType = ITEM_TYPES[0];
    for (let t of ITEM_TYPES) { cumulative += t.prob; if (rand <= cumulative) { selectedType = t; break; } }
    const item = itemPool.acquire();
    item.active = true; item.radius = selectedType.radius;
    item.x = Math.random() * (canvas.width - item.radius * 2.5) + item.radius * 1.25; item.y = -50;
    
    const baseSpeed = 2.5 + (level * 0.7);[cite: 2]
    const frenzyBoost = frenzyTimeLeft > 0 ? 1.2 : 1.0;
    item.speed = (baseSpeed + Math.random() * 1.2) * frenzyBoost;
    item.config = selectedType; item.rotation = Math.random() * Math.PI; item.rotSpeed = (Math.random() - 0.5) * 0.04;
    activeItems.push(item);
}

let lastTimestamp = performance.now();

function update(timestamp) {
    const dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    if (gameState !== 'PLAYING') return;

    if (combo > 0) {
        comboTimer -= dt;
        if (comboTimer <= 0) { combo = 0; comboValEl.innerText = `x1`; }
    }

    if (frenzyTimeLeft > 0) {
        frenzyTimeLeft -= dt;
        frenzyFill.style.width = `${Math.max(0, (frenzyTimeLeft / FRENZY_DURATION) * 100)}%`;[cite: 2]
        if (frenzyTimeLeft <= 0) { frenzyBarContainer.classList.add('hidden'); gameWrapper.classList.remove('frenzy-glow'); }
    }

    if (screenShakeTime > 0) screenShakeTime -= dt * 1000;

    const speedBoost = frenzyTimeLeft > 0 ? 1.2 : 1.0;
    const currentBasketSpeed = basket.speed * speedBoost;

    if (keys.ArrowLeft || keys.KeyA) basket.targetX -= currentBasketSpeed;
    if (keys.ArrowRight || keys.KeyD) basket.targetX += currentBasketSpeed;

    basket.targetX = Math.max(0, Math.min(canvas.width - basket.w, basket.targetX));
    let isMoving = Math.abs(basket.targetX - basket.x) > 1.5;
    basket.x += (basket.targetX - basket.x) * 0.25;
    
    // 更新精靈圖動畫 (計算位移與轉向)
    spriteEngine.update(dt, isMoving, basket.targetX, basket.x);

    for (let i = activeItems.length - 1; i >= 0; i--) {
        let item = activeItems[i];
        item.y += item.speed;
        item.rotation += item.rotSpeed;

        // 100% 完整的核心判定物理區域不變[cite: 2]
        const basketHitbox = { x: basket.x + 6, y: basket.y + 4, w: basket.w - 12, h: basket.h - 8 };

        if (item.x + item.radius >= basketHitbox.x && item.x - item.radius <= basketHitbox.x + basketHitbox.w &&
            item.y + item.radius >= basketHitbox.y && item.y - item.radius <= basketHitbox.y + basketHitbox.h) {
            
            if (item.config.type === 'bomb') {
                lives--; updateLivesDisplay(); soundEngine.playBomb(); triggerScreenShake(7, 200);
                addFloatText(item.x, item.y, '-1 ❤️ 💥', '#ef4444'); spawnParticles(item.x, item.y, '#ef4444');
                combo = 0; comboValEl.innerText = `x1`;
                if (lives <= 0) { itemPool.release(item); activeItems.splice(i, 1); gameOver(); return; }
            } else {
                combo++; comboTimer = 1.5; comboValEl.innerText = `x${combo}`;
                const earnedPoints = item.config.points * combo; score += earnedPoints; scoreValEl.innerText = score;
                soundEngine.playCatch(combo); triggerScreenShake(4, 100); spawnParticles(item.x, item.y, item.config.glowColor);
                
                if (combo === 5 && frenzyTimeLeft <= 0) {
                    frenzyTimeLeft = FRENZY_DURATION; frenzyBarContainer.classList.remove('hidden'); gameWrapper.classList.add('frenzy-glow');
                    soundEngine.playFrenzyStart(); addFloatText(canvas.width / 2, canvas.height / 3, '⚡ FRENZY 狂熱模式！', '#06b6d4');
                } else {
                    addFloatText(item.x, item.y, `+${earnedPoints}${combo > 1 ? ` (x${combo})` : ''}`, item.config.glowColor);
                }
                const newLevel = Math.floor(score / 150) + 1;
                if (newLevel > level) { level = newLevel; levelValEl.innerText = level; addFloatText(canvas.width / 2, canvas.height / 4, `LEVEL UP! Lv.${level}`, '#22d3ee'); }
            }
            itemPool.release(item); activeItems.splice(i, 1); continue;
        }
        if (item.y > canvas.height + 60) { itemPool.release(item); activeItems.splice(i, 1); }
    }

    for (let i = activeParticles.length - 1; i >= 0; i--) {
        let p = activeParticles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.alpha -= 0.035;
        if (p.alpha <= 0) { particlePool.release(p); activeParticles.splice(i, 1); }
    }
    for (let i = activeFloatTexts.length - 1; i >= 0; i--) {
        let ft = activeFloatTexts[i]; ft.y += ft.vy; ft.alpha -= 0.025;
        if (ft.alpha <= 0) { floatTextPool.release(ft); activeFloatTexts.splice(i, 1); }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    
    // 背景繪製 (如果資源有載入，則貼圖；否則回退原生)
    if (loadedResources.images.bg) {
        ctx.drawImage(loadedResources.images.bg, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.width; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
    }

    if (screenShakeTime > 0) ctx.translate((Math.random() - 0.5) * screenShakeIntensity, (Math.random() - 0.5) * screenShakeIntensity);

    // 【核心】玩家精靈圖渲染
    if (loadedResources.images.player) {
        spriteEngine.draw(ctx, loadedResources.images.player, basket.x, basket.y, basket.w, basket.h);
    } else {
        // Fallback 幾何圖形
        ctx.save();
        ctx.shadowColor = frenzyTimeLeft > 0 ? '#06b6d4' : 'rgba(99, 102, 241, 0.7)';
        ctx.shadowBlur = frenzyTimeLeft > 0 ? 25 : 18;
        const basketGradient = ctx.createLinearGradient(basket.x, basket.y, basket.x, basket.y + basket.h);
        basketGradient.addColorStop(0, frenzyTimeLeft > 0 ? '#22d3ee' : '#818cf8');
        basketGradient.addColorStop(1, frenzyTimeLeft > 0 ? '#0284c7' : '#4f46e5');
        ctx.fillStyle = basketGradient;
        ctx.beginPath(); ctx.roundRect(basket.x, basket.y, basket.w, basket.h, [10, 10, 22, 22]); ctx.fill();
        ctx.fillStyle = frenzyTimeLeft > 0 ? '#cffafe' : '#c7d2fe';
        ctx.beginPath(); ctx.roundRect(basket.x - 5, basket.y - 5, basket.w + 10, 9, 5); ctx.fill();
        ctx.restore();
    }

    // 掉落物渲染
    activeItems.forEach(item => {
        ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(item.rotation);
        ctx.shadowColor = item.config.glowColor; ctx.shadowBlur = item.config.type === 'bomb' ? 25 : 18;
        ctx.fillStyle = item.config.bgColor; ctx.beginPath(); ctx.arc(0, 0, item.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = item.config.glowColor; ctx.lineWidth = item.config.type === 'bomb' ? 4 : 3; ctx.stroke();
        ctx.font = `${item.radius * 1.3}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(item.config.symbol, 0, 0);
        if (item.config.type === 'bomb') {
            ctx.fillStyle = '#fde047'; ctx.beginPath();
            ctx.arc(item.radius * 0.6, -item.radius * 0.6, 5 + Math.sin(Date.now() * 0.02) * 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    });

    // 粒子渲染
    activeParticles.forEach(p => {
        ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
        if (p.shape === 'square') { ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); } 
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
    });

    // 浮動文字渲染
    activeFloatTexts.forEach(ft => {
        ctx.save(); ctx.globalAlpha = Math.max(0, ft.alpha); ctx.font = 'bold 15px "Press Start 2P", monospace';
        ctx.fillStyle = ft.color; ctx.shadowColor = ft.color; ctx.shadowBlur = 10; ctx.textAlign = 'center'; ctx.fillText(ft.text, ft.x, ft.y); ctx.restore();
    });

    // --- 製作人資訊浮水印 ---
    ctx.save();
    ctx.font = '12px "Noto Sans TC", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'left';
    ctx.fillText('製作人：[11311393/蘇均容]', 12, 24);
    ctx.restore();

    ctx.restore();
}

function gameLoop(timestamp) {
    if (gameState !== 'LOADING') {
        update(timestamp);
        draw();
    }
    requestAnimationFrame(gameLoop);
}

// 事件綁定
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
soundToggle.addEventListener('click', () => {
    const isEnabled = soundEngine.toggle();
    soundToggle.innerHTML = isEnabled ? '<span>🔊 音效開</span>' : '<span>🔇 音效關</span>';
});

// 啟動與預加載
resizeCanvas();
startBtn.innerText = "資源載入中...";
startBtn.disabled = true;

Preloader.loadAll().then(() => {
    gameState = 'START';
    startBtn.innerText = "開始遊戲 START";
    startBtn.disabled = false;
    // 預先繪製一次背景讓畫面不要全黑
    draw(); 
});

requestAnimationFrame(gameLoop);
