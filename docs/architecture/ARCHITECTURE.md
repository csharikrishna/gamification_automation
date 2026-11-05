# Burstpoint Architecture & Modularization Specification

## 1. Architectural Overview & Modular Structure

Burstpoint is an AI-guided deterministic physics simulation and automated short-form video production engine. The repository is organized into cleanly decoupled subsystems with strict separation of concerns, eliminating circular dependencies, monolithic files, and parallel code duplication:

```
burstpoint/
├── core/                         # Shared core engine contracts, utilities & infrastructure
│   ├── ai-director/              # AI Director model, autonomous creative scenario generation & LLM interface
│   ├── contracts/                # Universal contracts & schemas (GameAdapter, ScenarioSchema, Lifecycle)
│   ├── simulation/               # Deterministic Mulberry32 PRNG & simulation primitives
│   ├── utilities/                # Mathematical AST parser, formula evaluators & geometry
│   ├── audio/                    # Waveform synthesis, multi-track mixing, ducking & WebAudio synthesizer
│   ├── production/               # Video vault, render manager & media validation
│   └── publishing/               # Queue repository, scheduler & platform publishers (YouTube)
│
├── games/                        # Autonomous simulation games adhering to GameAdapter
│   ├── multiplying-ball-race/    # Flagship multiplying marble race (physics, audio, modular renderer)
│   │   ├── engine/               # Physics simulation, spatial hash collisions, population accounting
│   │   ├── rendering/            # Modular layer-based canvas renderer, themes & camera director
│   │   │   └── layers/           # Isolated rendering passes (background, header, tracks, obstacles, balls, particles, celebration)
│   │   └── audio/                # Sound events & frequency configs
│   ├── mega-plinko/              # 1,000x jackpot plinko physics environment
│   ├── sumo-battle-royale/       # 16-competitor ring-out battle royale
│   ├── neon-brick-breaker/       # High-speed brick destruction swarm
│   └── marble-run/               # Rube Goldberg mechanical course with seesaws & rotary wheels
│
├── orchestrator/                 # Autonomous production & proof-of-work pipeline
│   ├── index.js                  # Unified CLI orchestrator entry point
│   ├── registry.js               # Central game adapter registry & factory
│   ├── pipeline.js               # Orchestrator coordinating lifecycle transitions
│   └── stages/                   # Decomposed lifecycle stage workers:
│       ├── scenario-generator.js # Stage 1: Archetype discovery & scenario synthesis
│       ├── simulation-runner.js  # Stage 2: Headless simulation stepping & bounds check
│       ├── candidate-scorer.js   # Stage 4: Replay verification, tension scoring & contrast audit
│       └── approval-authorizer.js# Stage 8: Cryptographic HMAC token & approval authorization
│
├── src/                          # Backward-compatibility re-export shims for legacy callers & studio
├── test/                         # Comprehensive qualification & unit regression harnesses
├── configs/                      # Representative scenario configurations & mathematical showdowns
├── storage/                      # Persistent VideoVault indices, perceptual hash catalog & backups
└── output/                       # Generated media, qualification reports & publishing queues
```

---

## 2. Important Module Boundaries

1. **Simulation vs. Rendering:**
   Physical simulation state (`step`, `observe`) is completely detached from rendering (`render(ctx)`). Simulators advance deterministically with fixed delta-time (`dt = 1 / 60`) independent of display frame rate, screen dimensions, or canvas availability.
2. **Deterministic Replay vs. Production Orchestration:**
   Every game emits a bit-exact Replay package (`getReplay()`) containing initial seed, configuration, and chronological events. The Candidate Scorer and Video Renderer replay simulation outcomes offline with byte-level parity without re-running random numbers.
3. **Approval Security & Zero Credential Leakage:**
   Approval tokens use cryptographic HMAC-SHA256 signatures evaluated in constant-time (`crypto.timingSafeEqual`). Unapproved clips fail closed in `PENDING_HUMAN_REVIEW` and never enter the publishing queue. Validation logs redact sensitive secrets.
4. **Authoritative Queue Repository vs. Platform Publisher:**
   `QueueRepository` enforces transactional file locking, corruption isolation (`.corrupt.<timestamp>.json`), monotonic backoff, and duplicate prevention. `YouTubePublisher` performs strictly verified DRY_RUN and LIVE uploads with real SHA-256 and media dimension validation.

---

## 3. Main Application Entry Points

- **CLI Production Orchestrator:** `node orchestrator/index.js [command]`
  - `games:list` — Inspect registered game adapters and statuses
  - `game:run --game <type>` — Run autonomous simulation match
  - `production:generate --count <n>` — Run multi-game batch production
  - `publishing:dry-run` — Pre-flight next queued item with real media verification
  - `report` — Output system status, vault metrics, and qualification logs
- **Offline Video Renderer:** `node render.js --config <path> --output <path>`
  - Headless Puppeteer browser renderer streaming canvas video through FFmpeg to MP4.
- **Interactive Browser Studio:** `npm start` / `npm run studio`
  - Local HTTP server hosting `index.html` for real-time visual playback, game switching, and theme auditioning.
- **Release Qualification Harness:** `npm run qualify`
  - 12-gate deep qualification audit covering schema validation, float bit-exact determinism, spatial grid stress, memory leaks, and browser-node parity.

---

## 4. How to Add a New Game

Adding a new game to Burstpoint requires zero modifications to the core orchestrator or publishing pipelines:

1. **Create Game Directory:**
   Create `games/<new-game-name>/game-adapter.js` inheriting from `_GameAdapter` (found in `core/contracts/game-adapter.js`).
2. **Implement Universal GameAdapter Contract:**
   ```javascript
   const { GameAdapter } = require('../../core/contracts/game-adapter');
   const { PRNG } = require('../../core/simulation/prng');

   class MyNewGame extends GameAdapter {
     constructor(config = {}, seed = null) {
       super(config, seed);
       this.gameType = 'my_new_game';
       this.initialize(config, seed);
     }
     initialize(config, seed) { /* Initialize state & seeded PRNG */ }
     step(deltaTime = 1 / 60) { /* Advance physical simulation */ }
     observe() { return { simTime: this.simTime, isFinished: this.isFinished, result: this.getResult() }; }
     getEvents() { return this.events; }
     getResult() { return { winner: this.winner?.name, score: this.winner?.score, isFinished: this.isFinished }; }
     getReplay() { return { gameType: this.gameType, seed: this.seed, events: this.events, result: this.getResult() }; }
     render(ctx) { /* Draw 1080x1920 frame to HTML5 Canvas context */ }
   }
   ```
3. **Register in GameRegistry:**
   Add game metadata and factory mapping to `orchestrator/registry.js`:
   ```javascript
   { id: 'my_new_game', name: 'My New Game', alias: 'my-new-game', status: 'ADAPTED' }
   ```
4. **Verify Seeded Determinism:**
   Run `npm run test:adapters` to ensure two independent executions with identical seeds produce bit-exact replay outputs.

---

## 5. How to Extend Rendering, Physics, and Production Modules

- **Extending Rendering:**
  Add or replace canvas layer passes in `games/multiplying-ball-race/rendering/layers/`. Each layer exports a dedicated draw function (`renderBackground`, `renderHeader`, `renderTracks`, etc.) that operates on `(ctx, engine, theme, director, w, h)`.
  Color palettes and visual styles are decoupled in `games/multiplying-ball-race/rendering/themes.js`.
- **Extending Physics:**
  Simulation algorithms reside in `games/<game>/engine/`. To customize ball interactions, spatial grid neighbor searches, or restitution parameters, extend `CollisionSolver` in `collisions.js` and `PhysicsWorld` in `physics.js`.
- **Extending Production Pipeline:**
  Pipeline lifecycle stages reside in `orchestrator/stages/`. To add a new proof-of-work or analysis stage (e.g., OCR verification, speech-to-text validation), implement a dedicated stage module and mount it within `ProductionProofPipeline` in `orchestrator/pipeline.js`.
