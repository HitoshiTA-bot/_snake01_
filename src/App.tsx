/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Zap, 
  Trophy, 
  Target, 
  Award,
  ChevronRight
} from 'lucide-react';
import { sound } from './utils/audio';
import { Point, Direction, GameStatus, Food } from './types';

// Game Dimensions and Constant Matrix Guidelines
const GRID_SIZE = 25; // Each cell is 25x25 px
const WIDTH = 800;    // 32 cells wide
const HEIGHT = 600;   // 24 cells tall
const COLS = WIDTH / GRID_SIZE; // 32
const ROWS = HEIGHT / GRID_SIZE; // 24

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;   // 1 to 0 (decay)
  decay: number;
}

export default function App() {
  // Game state representation for React UI HUD
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem('super_snake_highscore');
    return saved ? parseInt(saved, 10) : 1000;
  });
  const [status, setStatus] = useState<GameStatus>('IDLE');
  const [level, setLevel] = useState<number>(1);
  const [foodEatenCount, setFoodEatenCount] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [selectedSkin, setSelectedSkin] = useState<string>('neon-lime');

  // Multi-skin choice for extra visual customization
  const skins = [
    { id: 'neon-lime', name: '極光霓虹', head: '#84cc16', body: '#a3e635', accent: '#65a30d' },
    { id: 'cyber-cyan', name: '數碼幻藍', head: '#06b6d4', body: '#22d3ee', accent: '#0891b2' },
    { id: 'sunset-orange', name: '日落熔岩', head: '#ea580c', body: '#f97316', accent: '#c2410c' },
    { id: 'retro-pink', name: '復古芭比', head: '#db2777', body: '#f472b6', accent: '#be185d' }
  ];

  // Ref container to sustain real-time physics and animation loops safely without lag
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snakeRef = useRef<Point[]>([
    { x: 10, y: 12 },
    { x: 9, y: 12 },
    { x: 8, y: 12 },
    { x: 7, y: 12 }
  ]);
  const directionRef = useRef<Direction>('RIGHT');
  const nextDirectionRef = useRef<Direction>('RIGHT');
  const foodRef = useRef<Food>({ x: 22, y: 12, type: 'APPLE', points: 100 });
  const statusRef = useRef<GameStatus>('IDLE');
  const scoreRef = useRef<number>(0);
  const levelRef = useRef<number>(1);
  const foodEatenRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const shakeTimeRef = useRef<number>(0); // Screen shake power timer for juicing
  const frameCountRef = useRef<number>(0);

  // Sync state helpers to make HUD dynamic
  const updateReactHUD = () => {
    setScore(scoreRef.current);
    setLevel(levelRef.current);
    setStatus(statusRef.current);
    setFoodEatenCount(foodEatenRef.current);
  };

  // Toggle Mute setting and preserve audio class state
  const handleToggleMute = () => {
    const nextMute = sound.toggleMute();
    setIsMuted(nextMute);
  };

  // Sound triggers in response to active skin and actions
  const triggerMoveSound = () => {
    sound.playMove();
  };

  // Define Level details
  const getLevelInfo = (lvl: number) => {
    switch (lvl) {
      case 1: return { name: '綠野仙蹤 Forest Meadow', color: 'text-lime-300', speed: 140 };
      case 2: return { name: '金黃麥田 Golden Field', color: 'text-amber-300', speed: 120 };
      case 3: return { name: '炎熱峽谷 Desert Canyon', color: 'text-orange-300', speed: 100 };
      case 4: return { name: '霓虹科技 Neon Cybercity', color: 'text-cyan-300', speed: 85 };
      case 5: return { name: '岩漿煉獄 Lava Inferno', color: 'text-rose-400', speed: 70 };
      default: return { name: '天神殿堂 God Realm', color: 'text-fuchsia-400', speed: 55 };
    }
  };

  // Produce food at a random unoccupied grid coordinate
  const spawnFood = (snake: Point[]): Food => {
    let x = 0;
    let y = 0;
    let isColliding = true;
    let attempts = 0;

    while (isColliding && attempts < 500) {
      x = Math.floor(Math.random() * COLS);
      y = Math.floor(Math.random() * ROWS);
      // Ensure food doesn't land on snake
      isColliding = snake.some(seg => seg.x === x && seg.y === y);
      attempts++;
    }

    // Determine type: 72% Apple, 20% Gold Banana, 8% Cherry
    const roll = Math.random();
    let type: 'APPLE' | 'GOLD_BANANA' | 'CHERRY' = 'APPLE';
    let points = 100;

    if (roll > 0.92) {
      type = 'CHERRY';
      points = 500;
    } else if (roll > 0.72) {
      type = 'GOLD_BANANA';
      points = 250;
    }

    return { x, y, type, points };
  };

  // Create colorful particle bursts when snake eats or crashes
  const createConfetti = (x: number, y: number, color: string, count: number = 10) => {
    const px = x * GRID_SIZE + GRID_SIZE / 2;
    const py = y * GRID_SIZE + GRID_SIZE / 2;
    const newParticles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      newParticles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 3 + Math.random() * 4,
        life: 1,
        decay: 0.02 + Math.random() * 0.03
      });
    }
    particlesRef.current = [...particlesRef.current, ...newParticles];
  };

  // Reset the game metrics
  const resetGame = () => {
    snakeRef.current = [
      { x: 10, y: 12 },
      { x: 9, y: 12 },
      { x: 8, y: 12 },
      { x: 7, y: 12 }
    ];
    directionRef.current = 'RIGHT';
    nextDirectionRef.current = 'RIGHT';
    foodRef.current = spawnFood(snakeRef.current);
    particlesRef.current = [];
    scoreRef.current = 0;
    levelRef.current = 1;
    foodEatenRef.current = 0;
    shakeTimeRef.current = 0;
    statusRef.current = 'PLAYING';
    updateReactHUD();
    sound.playLevelUp();
  };

  // Pause toggle action
  const togglePause = () => {
    if (statusRef.current === 'PLAYING') {
      statusRef.current = 'PAUSED';
    } else if (statusRef.current === 'PAUSED') {
      statusRef.current = 'PLAYING';
    } else if (statusRef.current === 'IDLE') {
      statusRef.current = 'PLAYING';
      sound.playLevelUp();
    }
    updateReactHUD();
  };

  // Handle Canvas click to grab focus and quickstart instantly
  const handleCanvasClick = () => {
    if (canvasRef.current) {
      canvasRef.current.focus();
    }
    if (statusRef.current === 'IDLE') {
      statusRef.current = 'PLAYING';
      sound.playLevelUp();
      updateReactHUD();
    } else if (statusRef.current === 'PAUSED') {
      statusRef.current = 'PLAYING';
      updateReactHUD();
    } else if (statusRef.current === 'GAME_OVER') {
      resetGame();
    }
  };

  // Keep track of highscores in localStorage
  const checkHighScore = (finalScore: number) => {
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('super_snake_highscore', finalScore.toString());
      return true;
    }
    return false;
  };

  // Listen to keyboards and capture direction arrows / WASD / Aux controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      // Prevent browser layout scroll behavior with action buttons
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key)) {
        e.preventDefault();
      }

      // If game over, pressing R restarts
      if (statusRef.current === 'GAME_OVER') {
        if (key === 'r') {
          resetGame();
        }
        return;
      }

      // If game not started yet, any direction starts it
      if (statusRef.current === 'IDLE') {
        if (['arrowup', 'w', 'arrowdown', 's', 'arrowleft', 'a', 'arrowright', 'd', ' '].includes(key)) {
          statusRef.current = 'PLAYING';
          updateReactHUD();
          sound.playLevelUp();
        }
        return;
      }

      const currentDir = directionRef.current;

      if ((key === 'arrowup' || key === 'w') && currentDir !== 'DOWN') {
        nextDirectionRef.current = 'UP';
        triggerMoveSound();
      } else if ((key === 'arrowdown' || key === 's') && currentDir !== 'UP') {
        nextDirectionRef.current = 'DOWN';
        triggerMoveSound();
      } else if ((key === 'arrowleft' || key === 'a') && currentDir !== 'RIGHT') {
        nextDirectionRef.current = 'LEFT';
        triggerMoveSound();
      } else if ((key === 'arrowright' || key === 'd') && currentDir !== 'LEFT') {
        nextDirectionRef.current = 'RIGHT';
        triggerMoveSound();
      } else if (e.key === ' ') {
        togglePause();
      } else if (key === 'r') {
        resetGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [highScore]);

  // Main Canvas Render Loops & Physics ticks
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTickTime = 0;

    // Retrieve active skin colors
    const getSkinColors = () => {
      const current = skins.find(s => s.id === selectedSkin) || skins[0];
      return current;
    };

    const gameLoop = (timestamp: number) => {
      frameCountRef.current++;
      const skinColors = getSkinColors();

      // Clear Canvas Frame
      ctx.fillStyle = '#0f172a'; // Deep Navy Slate-900 background matching theme
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Handle Screen Shake
      ctx.save();
      if (shakeTimeRef.current > 0) {
        const dx = (Math.random() - 0.5) * shakeTimeRef.current * 4;
        const dy = (Math.random() - 0.5) * shakeTimeRef.current * 4;
        ctx.translate(dx, dy);
        shakeTimeRef.current -= 0.05;
      }

      // Draw subtle grid guides on Canvas in elegant gray dots
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      for (let c = 1; c < COLS; c++) {
        ctx.fillRect(c * GRID_SIZE, 0, 1, HEIGHT);
      }
      for (let r = 1; r < ROWS; r++) {
        ctx.fillRect(0, r * GRID_SIZE, WIDTH, 1);
      }

      const activeSpeed = getLevelInfo(levelRef.current).speed;

      // PHYSICS TICK (at dynamic level-based interval check)
      if (statusRef.current === 'PLAYING') {
        if (!lastTickTime) lastTickTime = timestamp;
        const elapsed = timestamp - lastTickTime;

        if (elapsed > activeSpeed) {
          lastTickTime = timestamp;

          // Lock direction choice for this frame step
          directionRef.current = nextDirectionRef.current;
          const currentDir = directionRef.current;
          const snake = [...snakeRef.current];
          const head = snake[0];

          // Compute moving vector coordinates
          let newHead: Point = { ...head };
          switch (currentDir) {
            case 'UP': newHead.y -= 1; break;
            case 'DOWN': newHead.y += 1; break;
            case 'LEFT': newHead.x -= 1; break;
            case 'RIGHT': newHead.x += 1; break;
          }

          // Game Over Condition A: Wall Collision check
          const hasCrashedWall = newHead.x < 0 || newHead.y < 0 || newHead.x >= COLS || newHead.y >= ROWS;
          
          // Game Over Condition B: Self Eating collision check (skip head node)
          const hasCrashedSelf = snake.some(segment => segment.x === newHead.x && segment.y === newHead.y);

          if (hasCrashedWall || hasCrashedSelf) {
            statusRef.current = 'GAME_OVER';
            shakeTimeRef.current = 4; // trigger punchy screen shake
            createConfetti(head.x, head.y, '#f43f5e', 24); // red blood particles
            createConfetti(head.x, head.y, '#eab308', 12); // gold sparkles
            sound.playGameOver();
            checkHighScore(scoreRef.current);
            updateReactHUD();
          } else {
            // Update snake coordinates by prepend head
            snake.unshift(newHead);

            // Food collision checkpoint
            const food = foodRef.current;
            if (newHead.x === food.x && newHead.y === food.y) {
              // Gained Points
              scoreRef.current += food.points;
              foodEatenRef.current += 1;

              // Visual feedback
              let foodTint = '#ef4444'; // Red Apples
              if (food.type === 'GOLD_BANANA') {
                foodTint = '#eab308';
                sound.playSpecialEat();
              } else if (food.type === 'CHERRY') {
                foodTint = '#ec4899';
                sound.playSpecialEat();
              } else {
                sound.playEat();
              }
              
              // Sparkle particle release
              createConfetti(food.x, food.y, foodTint, 16);

              // Relocate food spawn
              foodRef.current = spawnFood(snake);

              // Level up thresholds: Every 5 items eaten, level jumps and speed accelerates
              const nextLvl = Math.floor(foodEatenRef.current / 5) + 1;
              if (nextLvl > levelRef.current) {
                levelRef.current = nextLvl;
                sound.playLevelUp();
                // Spawn a double gold bonus effect at level up
                createConfetti(newHead.x, newHead.y, '#a855f7', 20);
              }

              updateReactHUD();
            } else {
              // Normal move: pull tail
              snake.pop();
            }
            snakeRef.current = snake;
          }
        }
      }

      // --- DRAW STAGE ---

      // 1. Draw Food item
      const food = foodRef.current;
      const fx = food.x * GRID_SIZE;
      const fy = food.y * GRID_SIZE;
      const foodPulse = Math.sin(timestamp * 0.008) * 2; // subtle breathe animation

      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = food.type === 'APPLE' ? '#ef4444' : (food.type === 'GOLD_BANANA' ? '#f59e0b' : '#ec4899');

      if (food.type === 'APPLE') {
        // Red juicy round apple with stem
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(fx + GRID_SIZE/2, fy + GRID_SIZE/2 + (foodPulse/2), (GRID_SIZE/2) - 2, 0, Math.PI * 2);
        ctx.fill();

        // Little green offset leaf
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.ellipse(fx + GRID_SIZE/2 + 2, fy + 4 + (foodPulse/2), 2, 4, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (food.type === 'GOLD_BANANA') {
        // Curved bright banana shape
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(fx + GRID_SIZE/2, fy + GRID_SIZE/2 + (foodPulse/2), (GRID_SIZE/2) - 3, 0.2 * Math.PI, 1.1 * Math.PI);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#f59e0b';
        ctx.stroke();
        ctx.fill();

        // Tip decoration
        ctx.fillStyle = '#78350f';
        ctx.fillRect(fx + 4, fy + GRID_SIZE/2 + 2 + (foodPulse/2), 3, 3);
      } else {
        // Sweet cherries: two spheres connected by stems
        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.arc(fx + 7, fy + 16 + (foodPulse/2), 5, 0, Math.PI * 2);
        ctx.arc(fx + 17, fy + 15 + (foodPulse/2), 5, 0, Math.PI * 2);
        ctx.fill();

        // Stems
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(fx + 7, fy + 12 + (foodPulse/2));
        ctx.quadraticCurveTo(fx + 12, fy + 5 + (foodPulse/2), fx + 15, fy + 4 + (foodPulse/2));
        ctx.moveTo(fx + 17, fy + 11 + (foodPulse/2));
        ctx.quadraticCurveTo(fx + 14, fy + 5 + (foodPulse/2), fx + 15, fy + 4 + (foodPulse/2));
        ctx.stroke();
      }
      ctx.restore();

      // 2. Draw Snake segments
      const snake = snakeRef.current;
      snake.forEach((segment, index) => {
        const sx = segment.x * GRID_SIZE;
        const sy = segment.y * GRID_SIZE;
        const isHead = index === 0;

        ctx.save();
        
        if (isHead) {
          // Draw high-contrast round head
          ctx.fillStyle = skinColors.head;
          ctx.beginPath();
          ctx.arc(sx + GRID_SIZE/2, sy + GRID_SIZE/2, (GRID_SIZE/2) - 0.5, 0, Math.PI * 2);
          ctx.fill();

          // Black border
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw eyes based on heading direction helper
          const eyeOffset = 5;
          const eyeSize = 3;
          ctx.fillStyle = '#ffffff';
          let eyeL = { x: 0, y: 0 };
          let eyeR = { x: 0, y: 0 };

          switch (directionRef.current) {
            case 'UP':
              eyeL = { x: sx + GRID_SIZE/2 - eyeOffset, y: sy + eyeOffset };
              eyeR = { x: sx + GRID_SIZE/2 + eyeOffset, y: sy + eyeOffset };
              break;
            case 'DOWN':
              eyeL = { x: sx + GRID_SIZE/2 - eyeOffset, y: sy + GRID_SIZE - eyeOffset };
              eyeR = { x: sx + GRID_SIZE/2 + eyeOffset, y: sy + GRID_SIZE - eyeOffset };
              break;
            case 'LEFT':
              eyeL = { x: sx + eyeOffset, y: sy + GRID_SIZE/2 - eyeOffset };
              eyeR = { x: sx + eyeOffset, y: sy + GRID_SIZE/2 + eyeOffset };
              break;
            case 'RIGHT':
              eyeL = { x: sx + GRID_SIZE - eyeOffset, y: sy + GRID_SIZE/2 - eyeOffset };
              eyeR = { x: sx + GRID_SIZE - eyeOffset, y: sy + GRID_SIZE/2 + eyeOffset };
              break;
          }

          // Eyes outer
          ctx.beginPath();
          ctx.arc(eyeL.x, eyeL.y, eyeSize, 0, Math.PI * 2);
          ctx.arc(eyeR.x, eyeR.y, eyeSize, 0, Math.PI * 2);
          ctx.fill();

          // Eyeballs
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(eyeL.x, eyeL.y, eyeSize - 1.5, 0, Math.PI * 2);
          ctx.arc(eyeR.x, eyeR.y, eyeSize - 1.5, 0, Math.PI * 2);
          ctx.fill();

        } else {
          // Draw standard scale block with visual breathing effect
          const pct = index / snake.length; // tail-end helper
          // Use sin wave to generate subtle wiggle look
          const breath = Math.sin((timestamp * 0.005) + (index * 0.45)) * 0.5;
          let cellShrink = 1.5 + (pct * 4) + breath; // tapers towards the tail
          if (cellShrink > 8) cellShrink = 8;
          
          ctx.fillStyle = skinColors.body;
          
          // Draw rounded rectangles
          ctx.beginPath();
          const rSize = GRID_SIZE - cellShrink;
          const rOffset = cellShrink / 2;
          ctx.roundRect(sx + rOffset, sy + rOffset, rSize, rSize, 4);
          ctx.fill();

          // Scale border
          ctx.strokeStyle = skinColors.accent;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.restore();
      });

      // 3. Update & render active background/eat confetti particles
      let activeParticles = particlesRef.current;
      activeParticles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98; // momentum friction
        p.vy *= 0.98;
        p.life -= p.decay;

        if (p.life > 0) {
          ctx.save();
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          const r = Math.max(0, p.size * p.life);
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
      // purge dead sparks
      particlesRef.current = activeParticles.filter(p => p.life > 0);

      // Restore clean transformation offset
      ctx.restore();

      // IF IDLE: Overlay instructional start card
      if (statusRef.current === 'IDLE') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Glowing title
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#84cc16';
        ctx.font = '900 38px "Inter", sans-serif';
        ctx.fillStyle = '#84cc16';
        ctx.fillText('SUPER SNAKE ARCADE', WIDTH / 2, HEIGHT / 2 - 40);

        // Sub description
        ctx.shadowBlur = 0;
        ctx.font = '500 16px "Inter", sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText('利用鍵盤 Ｗ、Ａ、Ｓ、Ｄ 或 方向鍵 進行移動', WIDTH / 2, HEIGHT / 2 + 10);
        ctx.fillStyle = '#ffd60a';
        ctx.font = '700 18px "Inter", sans-serif';
        ctx.fillText('按 [空白鍵] 或 [點擊畫面] 立即啟動遊戲！', WIDTH / 2, HEIGHT / 2 + 55);

        // Control info tips
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 14px "Inter", sans-serif';
        ctx.fillText('吃掉水果來獲得加分並不斷變長！每吃 5 個即可晉級提速！', WIDTH / 2, HEIGHT / 2 + 100);
        ctx.restore();
      }

      // IF PAUSED: Draw translucent dim mask
      if (statusRef.current === 'PAUSED') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.fillStyle = '#facc15';
        ctx.font = '900 48px "Inter", sans-serif';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#facc15';
        ctx.fillText('遊戲已暫停', WIDTH / 2, HEIGHT / 2 - 20);

        ctx.fillStyle = '#ffffff';
        ctx.font = '500 16px "Inter", sans-serif';
        ctx.shadowBlur = 0;
        ctx.fillText('按「空白鍵」繼續對決', WIDTH / 2, HEIGHT / 2 + 30);
        ctx.restore();
      }

      // IF GAME OVER: Show scoreboard cards inside Canvas
      if (statusRef.current === 'GAME_OVER') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Red intense bold banner
        ctx.fillStyle = '#ef4444';
        ctx.font = '900 52px "Inter", sans-serif';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#f43f5e';
        ctx.fillText('遊戲結束', WIDTH / 2, HEIGHT / 2 - 90);

        // Score summary container box
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(WIDTH / 2 - 180, HEIGHT / 2 - 50, 360, 150, 16);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Final score text
        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 16px "Inter", sans-serif';
        ctx.fillText('最終得分', WIDTH / 2, HEIGHT / 2 - 20);
        ctx.fillStyle = '#eab308';
        ctx.font = '900 36px "Inter", sans-serif';
        ctx.fillText(scoreRef.current.toLocaleString(), WIDTH / 2, HEIGHT / 2 + 15);

        // Info of Level achieved
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 14px "Inter", sans-serif';
        ctx.fillText(`晉級等級: Level ${levelRef.current}  |  水果總數: ${foodEatenRef.current}`, WIDTH / 2, HEIGHT / 2 + 70);

        // Helper guides
        ctx.fillStyle = '#38bdf8';
        ctx.font = '700 18px "Inter", sans-serif';
        ctx.fillText('按下 [ R 鍵 ] 重新開始遊戲', WIDTH / 2, HEIGHT / 2 + 130);

        ctx.restore();
      }

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [selectedSkin]);

  const levelInfo = getLevelInfo(level);

  return (
    <div className="w-full min-h-screen bg-teal-400 flex flex-col font-sans overflow-y-auto border-[12px] border-teal-600 p-4 md:p-6 lg:p-8 items-center justify-center">
      
      {/* Principal Arcade Chassis Panel */}
      <div className="w-full max-w-[1024px] bg-teal-400 flex flex-col rounded-3xl border-8 border-teal-600 shadow-[0_25px_60px_rgba(0,0,0,0.35)] overflow-hidden">
        
        {/* Core Header Area with Theme Colors */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-4 md:px-12 md:py-6 bg-white border-b-8 border-teal-600 shadow-[0_8px_0_0_rgba(0,0,0,0.1)]">
          <div className="flex items-center gap-4">
            <div className="bg-rose-500 p-3 rounded-2xl border-4 border-slate-900 shadow-[2px_2px_0_0_#0f172a] animate-bounce">
              <div className="w-5 h-5 bg-white rounded-full relative">
                <div className="w-2 h-2 bg-slate-900 rounded-full absolute top-1.5 left-1.5 animate-pulse"></div>
              </div>
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase select-none">
                Super Snake
              </h1>
              <p className="text-xs font-bold text-teal-800 tracking-widest uppercase leading-none mt-1">
                Arcade Edition v2.4
              </p>
            </div>
          </div>
          
          {/* Quick Skin Chooser on Arcade Header */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border-2 border-slate-900 my-1 md:my-0">
            <span className="text-[10px] font-black text-slate-600 uppercase px-2">蛇皮選擇</span>
            <div className="flex gap-1.5">
              {skins.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSkin(s.id)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    selectedSkin === s.id 
                    ? 'border-slate-900 scale-125 shadow-[0_0_8px_rgba(0,0,0,0.4)]' 
                    : 'border-transparent scale-95 opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: s.head }}
                  title={s.name}
                />
              ))}
            </div>
          </div>

          {/* Glowing Points HUD */}
          <div className="flex gap-4 md:gap-8">
            <div className="bg-yellow-300 px-4 py-1.5 md:px-6 md:py-2 rounded-xl border-4 border-slate-900 shadow-[4px_4px_0_0_#0f172a]">
              <p className="text-[10px] md:text-xs font-bold text-slate-700 uppercase leading-none mb-1">
                Current Score
              </p>
              <p className="text-xl md:text-3xl font-black text-slate-900 leading-none">
                {score.toLocaleString()}
              </p>
            </div>
            <div className="bg-indigo-400 px-4 py-1.5 md:px-6 md:py-2 rounded-xl border-4 border-slate-900 shadow-[4px_4px_0_0_#0f172a]">
              <p className="text-[10px] md:text-xs font-bold text-indigo-100 uppercase leading-none mb-1">
                High Score
              </p>
              <p className="text-xl md:text-3xl font-black text-white leading-none">
                {highScore.toLocaleString()}
              </p>
            </div>
          </div>
        </header>

        {/* Dynamic Gameplay Engine Box */}
        <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 bg-teal-500/10">
          <div className="relative bg-slate-950 w-full max-w-[800px] aspect-[4/3] rounded-3xl border-[8px] md:border-[12px] border-slate-900 shadow-2xl overflow-hidden flex items-center justify-center">
            
            {/* Grid Dots Overlay */}
            <div 
              className="absolute inset-0 opacity-10 pointer-events-none" 
              style={{
                backgroundImage: 'radial-gradient(#fff 1.5px, transparent 1.5px)',
                backgroundSize: '25px 25px'
              }}
            ></div>
            
            {/* Live Interactive Game Canvas */}
            <canvas
              id="game-canvas"
              ref={canvasRef}
              width={WIDTH}
              height={HEIGHT}
              className="w-full h-full block bg-transparent cursor-pointer focus:outline-none"
              onClick={handleCanvasClick}
              tabIndex={0}
            />

            {/* HUD floating overlays inside Canvas Container bottom */}
            <div className="absolute top-4 left-6 flex items-center gap-2 text-lime-400 font-mono text-xs md:text-sm tracking-widest opacity-85 uppercase pointer-events-none">
              <span className="w-2.5 h-2.5 rounded-full bg-lime-400 animate-ping"></span>
              <span>Level {level.toString().padStart(2, '0')} — {levelInfo.name}</span>
            </div>
            
            {/* Stat Counter overlay bottom left */}
            <div className="absolute bottom-4 left-6 text-white/30 font-mono text-[10px] md:text-xs pointer-events-none flex gap-4">
              <span>FRUITS: {foodEatenCount}</span>
              <span>SPEED: {levelInfo.speed}ms</span>
            </div>

            {/* Giant Level Indicator background stamp */}
            <div className="absolute bottom-4 right-8 pointer-events-none select-none">
              <span className="text-white/10 font-black text-6xl md:text-8xl italic">
                {level.toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        </main>

        {/* Footer Panel providing control handles */}
        <footer className="min-h-32 bg-teal-500 border-t-8 border-teal-600 flex flex-col lg:flex-row items-center justify-between gap-6 px-6 py-6 lg:px-16">
          
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 lg:gap-12 w-full lg:w-auto">
            
            {/* Keyboard Guide */}
            <div className="flex flex-col gap-2 items-center lg:items-start">
              <span className="text-[10px] font-black text-teal-950 uppercase tracking-widest">
                操作移動
              </span>
              <div className="flex gap-1.5">
                <kbd className="w-8 h-8 md:w-9 md:h-9 bg-white border-b-4 border-slate-300 rounded-lg flex items-center justify-center font-bold text-slate-700 shadow-sm text-sm">W</kbd>
                <kbd className="w-8 h-8 md:w-9 md:h-9 bg-white border-b-4 border-slate-300 rounded-lg flex items-center justify-center font-bold text-slate-700 shadow-sm text-sm">A</kbd>
                <kbd className="w-8 h-8 md:w-9 md:h-9 bg-white border-b-4 border-slate-300 rounded-lg flex items-center justify-center font-bold text-slate-700 shadow-sm text-sm">S</kbd>
                <kbd className="w-8 h-8 md:w-9 md:h-9 bg-white border-b-4 border-slate-300 rounded-lg flex items-center justify-center font-bold text-slate-700 shadow-sm text-sm">D</kbd>
                <span className="text-xs text-teal-900 font-bold self-center px-1">或</span>
                <kbd className="px-2 h-8 md:h-9 bg-white border-b-4 border-slate-300 rounded-lg flex items-center justify-center font-bold text-slate-700 shadow-sm text-xs">方向鍵 ↑↓←→</kbd>
              </div>
            </div>
            
            {/* Splitter bar */}
            <div className="hidden lg:block h-12 w-[3px] bg-teal-600/50"></div>

            {/* Quick Interactive Tool Actions */}
            <div className="flex flex-col gap-2 items-center lg:items-start">
              <span className="text-[10px] font-black text-teal-950 uppercase tracking-widest animate-pulse">
                主機動作
              </span>
              <div className="flex flex-wrap gap-2 md:gap-3">
                {status === 'PLAYING' ? (
                  <button 
                    onClick={togglePause}
                    className="flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-full border-b-4 border-slate-700 active:translate-y-[2px] active:border-b-0 cursor-pointer shadow-md transition-all text-xs"
                  >
                    <Pause size={13} className="fill-white" />
                    <span>暫停 (SPACE)</span>
                  </button>
                ) : (
                  <button 
                    onClick={status === 'GAME_OVER' ? resetGame : togglePause}
                    className="flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-full border-b-4 border-slate-700 active:translate-y-[2px] active:border-b-0 cursor-pointer shadow-md transition-all text-xs"
                  >
                    <Play size={13} className="fill-white" />
                    <span>{status === 'GAME_OVER' ? '開啟新一局' : '繼續 (SPACE)'}</span>
                  </button>
                )}
                
                <button 
                  onClick={resetGame}
                  className="flex items-center gap-2 px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-extrabold rounded-full border-b-4 border-rose-700 active:translate-y-[2px] active:border-b-0 cursor-pointer shadow-md transition-all text-xs"
                >
                  <RotateCcw size={13} />
                  <span>重設 (R)</span>
                </button>

                {/* Direct audio muter */}
                <button 
                  onClick={handleToggleMute}
                  className={`flex items-center gap-2 px-3.5 py-2 font-extrabold rounded-full border-b-4 cursor-pointer shadow-md transition-all text-xs ${
                    isMuted 
                    ? 'bg-slate-700 hover:bg-slate-600 border-slate-800 text-slate-350' 
                    : 'bg-yellow-400 hover:bg-yellow-500 border-yellow-600 text-slate-900'
                  }`}
                  title="切換音效"
                >
                  {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  <span>{isMuted ? '靜音' : '音效已開'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Build Info Stamp */}
          <div className="text-center lg:text-right">
            <p className="text-sm font-black text-teal-950 flex items-center justify-center lg:justify-end gap-1">
              <Zap size={14} className="fill-current text-yellow-300" />
              <span>Vite + React + TS</span>
            </p>
            <p className="text-[10px] text-teal-900 uppercase font-black tracking-widest opacity-70">
              VIBRANT NEON PALETTE
            </p>
          </div>
        </footer>
      </div>

      {/* Decorative Arcade Board Overlay Details */}
      <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-teal-900 font-semibold text-xs opacity-80 max-w-[800px] text-center">
        <span>★ 經典水果機制：🍎 蘋果 (100分) · 🍌 香蕉 (250分) · 🍒 櫻桃 (500分)</span>
        <span>★ 難度隨分數遞增加速，挑戰最高街機紀錄！</span>
      </div>
    </div>
  );
}
