/**
 * 遊戲啟動入口模組 (Main Entry Point)
 * 負責 DOM 綁定、事件監聽（鍵盤、觸控拖曳、視窗縮放）與啟動動畫循環
 */

import { Game } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
    // 獲取 Canvas 與介面元素
    const canvas = document.getElementById('gameCanvas');
    const uiElements = {
        gameWrapper: document.getElementById('gameWrapper'),
        startOverlay: document.getElementById('startOverlay'),
        gameOverOverlay: document.getElementById('gameOverOverlay'),
        startBtn: document.getElementById('startBtn'),
        restartBtn: document.getElementById('restartBtn'),
        scoreVal: document.getElementById('scoreVal'),
        levelVal: document.getElementById('levelVal'),
        comboVal: document.getElementById('comboVal'),
        livesContainer: document.getElementById('livesContainer'),
        finalScore: document.getElementById('finalScore'),
        highScore: document.getElementById('highScore'),
        soundToggle: document.getElementById('soundToggle'),
        frenzyBarContainer: document.getElementById('frenzyBarContainer'),
        frenzyFill: document.getElementById('frenzyFill')
    };

    // 初始化遊戲主控制器
    const game = new Game(canvas, uiElements);

    // 鍵盤狀態記錄
    const keys = {
        ArrowLeft: false,
        ArrowRight: false,
        KeyA: false,
        KeyD: false
    };

    // 鍵盤監聽事件
    window.addEventListener('keydown', (e) => {
        if (Object.prototype.hasOwnProperty.call(keys, e.code)) {
            keys[e.code] = true;
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (Object.prototype.hasOwnProperty.call(keys, e.code)) {
            keys[e.code] = false;
            e.preventDefault();
        }
    });

    // 觸控與滑鼠拖曳操控監聽
    let isPointerDown = false;

    const handlePointerMove = (e) => {
        const rect = canvas.getBoundingClientRect();
        game.player.setTargetPointerX(e.clientX, rect);
    };

    canvas.addEventListener('pointerdown', (e) => {
        isPointerDown = true;
        handlePointerMove(e);
    });

    canvas.addEventListener('pointermove', (e) => {
        if (isPointerDown) {
            handlePointerMove(e);
        }
    });

    canvas.addEventListener('pointerup', () => {
        isPointerDown = false;
    });

    window.addEventListener('pointerup', () => {
        isPointerDown = false;
    });

    canvas.addEventListener('pointercancel', () => {
        isPointerDown = false;
    });

    // 視窗尺寸適應調整
    window.addEventListener('resize', () => {
        game.resize();
    });
    // 初始調整一次畫布大小
    game.resize();

    // 按鈕點擊事件綁定
    if (uiElements.startBtn) {
        uiElements.startBtn.addEventListener('click', () => {
            game.start();
        });
    }

    if (uiElements.restartBtn) {
        uiElements.restartBtn.addEventListener('click', () => {
            game.start();
        });
    }

    if (uiElements.soundToggle) {
        uiElements.soundToggle.addEventListener('click', () => {
            const isEnabled = game.toggleSound();
            uiElements.soundToggle.innerHTML = isEnabled ? '<span>🔊 音效開</span>' : '<span>🔇 音效關</span>';
        });
    }

    // 遊戲主循環動畫
    function gameLoop(timestamp) {
        game.loop(timestamp, keys);
        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
});
