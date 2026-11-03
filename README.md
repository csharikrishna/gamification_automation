# 🚀 Burstpoint — AI Physics Simulation & Automated Shorts Engine

An end-to-end automated production engine that pairs an **AI Director Model** with **multiple viral physics environments** to formulate, simulate, and render unique vertical (1080×1920 60 FPS) videos every day for YouTube Shorts, TikTok, and Instagram Reels.

---

## 🎮 4 Distinct Physics Environments & Game Modes

### 1. ⚡ Multiplier Ball Cascade Race (`multi_race`)
- **Premise:** Split-lane competition (Underdog exponential growth vs Linear lead).
- **Physics:** Gravity, wall bouncing, pachinko deflection pins, glowing multiplier gates (`×3`, `+2`, `-20`).
- **Hook:** Dynamic live score counters that punch up with spring scale animation when new balls spawn.

### 2. 🎰 Mega Plinko 1,000× Jackpot Pyramid (`mega_plinko`)
- **Premise:** 200–500 balls dropped from a top funnel down a 14-tier triangle peg pyramid.
- **Physics:** Elastic restitution bouncing through hundreds of pachinko pins into bottom multiplier bins (`[ 1000× | 100× | 25× | 5× | 1× | 0.2× | 1× | 5× | 25× | 100× | 1000× ]`).
- **Hook:** Golden screen flash, explosive particle burst, and celebration chimes whenever a marble lands in the golden 1,000× slot.

### 3. 👑 Sumo Battle Royale Arena (`sumo_arena`)
- **Premise:** 32–50 colored marbles or team tokens inside a circular shrinking neon arena.
- **Physics:** 2D elastic momentum collision impulse. Balls knock each other off the rim into the dark void.
- **Hook:** Live alive counter (`18 / 32 ALIVE`), kill feed notifications (`💀 TITAN GOLD ELIMINATED`), dramatic slow-mo 1v1 showdown, and Sole Survivor trophy ceremony.

### 4. 💥 Neon Brick Breaker Swarm (`brick_breaker`)
- **Premise:** 300 glowing physics balls fired upwards into a wall of high-HP numbered neon bricks (`25`, `50`, `100`, `250`).
- **Physics:** High-speed continuous ricochet with ASMR audio feedback.
- **Hook:** Bricks shatter into neon crystal shards upon reaching 0 HP. Giant board clearance percentage meter (`88% CLEARED`).

---

## 🤖 The AI Director Model (`src/ai_director.js`)

The **AI Director** acts as the automated showrunner:
1. **Daily Formulation:** Devises new concepts every day, cycling game modes, physics constants, viewer prompts, and color palettes.
2. **Psychological Hooks:** Generates high-retention questions ("Pick your color before second 3!", "Can 1 underdog beat 500?").
3. **Automated Publishing Package:** Creates optimized YouTube Shorts titles with emojis, algorithm-targeted descriptions, pinned comment prompts, and tags.
4. **Dual-AI Architecture:**
   - Supports Google Gemini API (`GEMINI_API_KEY`) for open-ended LLM creativity.
   - Built-in **Autonomous Combinatorial Engine** that guarantees 100% offline reliability with thousands of unique permutations.

---

## 📁 Project Structure

```
Gamification/
├── index.html                   # Unified Interactive Web Studio & Live Simulator
├── auto_daily.js                # AI Director Daily Automated Production Runner
├── render.js                    # Universal 1080×1920 60FPS Video Renderer (Puppeteer + FFmpeg)
├── generate_scenarios.js        # Procedural variation generator for mass batching
├── pipeline.js                  # Batch video pipeline
├── src/
│   ├── ai_director.js           # AI Director (LLM + autonomous creative brain)
│   ├── game_manager.js          # Universal game factory & adapter
│   ├── engine.js                # Multiplier race physics engine
│   ├── renderer.js              # Multiplier race canvas renderer
│   ├── sound.js                 # Web Audio API real-time synthesizer
│   ├── audio_generator.js       # 44.1kHz stereo audio synthesizer for headless MP4
│   └── games/
│       ├── mega_plinko.js       # Plinko 1,000× jackpot pyramid environment
│       ├── sumo_arena.js        # Battle Royale sumo arena environment
│       └── brick_breaker.js     # Neon brick breaker swarm demolition environment
├── configs/                     # Game configurations & presets
├── daily_queue/                 # Automated daily outputs organized by YYYY-MM-DD
└── output/                      # Rendered 1080×1920 MP4 videos & metadata JSON files
```

---

## ⚡ Quick Start & Commands

### 1. Launch the Interactive Studio
```bash
npm start
# Opens http://localhost:8080
```
- Switch between all 4 game environments with one click.
- Click **"🤖 AI Director: Formulate New Game"** to have the AI invent a brand new game live in your browser.
- Record `.webm` / `.mp4` directly from the browser.

### 2. Run Daily Automation (Simulate & Render Today's Video)
```bash
npm run daily
# or: node auto_daily.js
```
The AI Director:
1. Formulates today's unique game concept & rules.
2. Sets up the physics environment.
3. Renders the 1080×1920 60 FPS MP4 video with synced audio.
4. Saves everything to `daily_queue/YYYY-MM-DD/`.
5. Updates the master `calendar_schedule.json`.

### 3. Generate a Full Week of Daily Videos
```bash
npm run daily:week
# or: node auto_daily.js --days 7
```

### 4. Render Specific Presets Directly
```bash
npm run render          # Multiplier Underdog Race
npm run render:sumo     # Sumo Battle Royale
npm run render:plinko   # 1,000× Plinko Jackpot
npm run render:brick    # Neon Brick Breaker
```
