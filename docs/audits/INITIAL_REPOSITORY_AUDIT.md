# Burstpoint — Initial Repository Audit
**Audit Date**: November 4, 2026  
**Auditor**: Principal Software Architect & QA Lead  
**Target Repository**: `https://github.com/csharikrishna/gamification_automation`  
**Current HEAD**: Commit `f420532` (`main` branch)

---

## 1. Executive Summary

This independent audit examines the entire Burstpoint codebase following commit `f420532`. Burstpoint is transitioning from a set of disjoint simulation and rendering prototypes into an enterprise-grade, autonomous game simulation and short-form video production platform.

While recent commits (`a888fd1`, `f56074f`, `b1fc257`, `f420532`) resolved major P0 defects (such as the scheduler simulation fallback, initial ball caps, and confetti aesthetics), the codebase still suffers from architectural entanglement:
1. **Monolithic Game Logic**: The flagship game (*Multiplying Ball Race*) is hardcoded directly in `src/engine.js` and `src/renderer.js` rather than isolated in its own game module.
2. **Fragmented Publishing Queues**: Multiple queue files (`output/publishing_queue.json`, `output/production_publishing_queue.json`, `daily_queue/calendar_schedule.json`) exist with divergent schemas.
3. **Loopback Server Path Traversal Vulnerability**: An unpatched directory traversal vulnerability remains in `render.js`.
4. **Scattered CLI Entrypoints**: Legacy scripts (`pipeline.js`, `auto_daily.js`, `generate_scenarios.js`) duplicate functionality found in `src/production_orchestrator.js`.
5. **Visual Clutter vs Minimal Competitive Direction**: The presentation still features heavy neon wireframes and complex gradients rather than the requested crisp, high-contrast, minimal competitive physics aesthetic.

---

## 2. Inventory of Repository Components

| Category | File Path(s) | Role & Status |
| :--- | :--- | :--- |
| **Flagship Simulation** | `src/engine.js` (961 lines) | Core 2D physics simulation for *Multiplying Ball Race*. High functional quality, but monolithic. |
| **Flagship Renderer** | `src/renderer.js` (920 lines) | HTML5 Canvas 2D renderer for *Multiplying Ball Race*. Needs restructuring into modular arena, ball, tile, and HUD components. |
| **Secondary Games** | `src/games/*.js` | Prototype implementations of *Mega Plinko*, *Sumo Arena*, *Brick Breaker*, and *Marble Run*. Varied adherence to common adapter contract. |
| **Universal Adapter** | `src/game_adapter.js`, `src/game_manager.js` | Adapter base class and manager. `GameManager` contains inline ad-hoc wrapper for `multi_race` instead of a standalone adapter class. |
| **Audio Engine** | `src/audio_generator.js`, `src/sound.js` | Procedural WAV generator and browser WebAudio helper. Lacks multi-mode selection (ASMR vs Commentary) and loudness normalization. |
| **Video Production** | `render.js` | Puppeteer headless Chrome to FFmpeg video pipeline. Functional, but contains path traversal defect in HTTP server. |
| **AI Director** | `src/ai_director.js` | Archetypes, scenario generation, and candidate window scoring. Heavily coupled to `multi_race`. |
| **Publishing Pipeline** | `src/production_orchestrator.js`, `src/publishing_scheduler.js`, `src/publishers/` | 9-stage production orchestrator, 8-day cadence scheduler, and YouTube Data API v3 publisher. Multiple competing queue stores exist. |
| **Legacy Entrypoints** | `pipeline.js`, `auto_daily.js`, `generate_scenarios.js`, `ball_growth_race_demo.html` | Obsolete procedural scripts with hardcoded options and unvalidated schemas. |
| **Test Suites** | `test/*.test.js`, `test/qualification_harness.js` | 5 test suites (33 tests total), passing 100%. Needs segregation into contracts, regression, and security categories. |

---

## 3. Detailed Audit Findings & Classifications

### [P0-01] Architectural Duplication & Competing Queue Repositories
- **Severity**: **P0 (Production Blocking)**
- **Affected Files**: `src/publishing_scheduler.js`, `src/production_orchestrator.js`, `auto_daily.js`, `output/publishing_queue.json`, `output/production_publishing_queue.json`, `daily_queue/calendar_schedule.json`.
- **Underlying Cause**: Independent scripts each instantiated their own queue file path and entry format. `PublishingScheduler` read from `output/publishing_queue.json`, while `ProductionOrchestrator` wrote to `output/production_publishing_queue.json`.
- **Impact**: State drift, dual queues, phantom scheduled items, and impossible multi-game publishing synchronization.
- **Proposed Remediation**: Create a single authoritative queue repository in `core/publishing/queue-repository.js` with atomic writes, safe entry claiming, and unified schema validation.

### [P0-02] Monolithic Game Logic in Shared Core Root
- **Severity**: **P0 (Architectural Defect)**
- **Affected Files**: `src/engine.js`, `src/renderer.js`, `src/ai_director.js`.
- **Underlying Cause**: Multiplying Ball Race was the first prototype developed, so its specific physics, tiles, pegs, and rendering routines were placed directly in `src/`. Secondary games were placed in `src/games/`.
- **Impact**: Violates the modular architecture requirement. Game-specific code is mixed with shared infrastructure. The orchestrator cannot treat all 4 games uniformly.
- **Proposed Remediation**: Modularize Multiplying Ball Race into `games/multiplying-ball-race/` with sub-modules (`engine/`, `rendering/`, `audio/`, `configs/`, `tests/`, `game-adapter.js`).

---

### [P1-01] Path Traversal Vulnerability in `render.js` Internal HTTP Server
- **Severity**: **P1 (Security / Correctness)**
- **Affected Files**: `render.js` (lines 158-161).
- **Underlying Cause**: In `render.js`, the local HTTP server created for Puppeteer resolves requested URLs using `let filePath = path.resolve(__dirname, relPath)` without verifying that the resolved path stays within `__dirname`.
- **Impact**: Any client with access to the loopback port during video rendering could traverse directories and read arbitrary host files via encoded `..%2f`.
- **Proposed Remediation**: Enforce `const relPath = path.relative(root, filePath); if (relPath.startsWith('..') || path.isAbsolute(relPath)) { res.writeHead(403); res.end('Forbidden'); return; }`.

### [P1-02] Ad-hoc Multiplying Ball Race Adapter in `GameManager`
- **Severity**: **P1 (Architecture / Contract)**
- **Affected Files**: `src/game_manager.js` (lines 41-97), `src/game_adapter.js`.
- **Underlying Cause**: `GameManager.createGame()` implements an ad-hoc inline object for `multi_race` rather than instantiating a clean, dedicated class that inherits from `GameAdapter`.
- **Impact**: Inconsistent lifecycle methods and inability to unit-test the `multi_race` adapter contract independently.
- **Proposed Remediation**: Implement `games/multiplying-ball-race/game-adapter.js` inheriting from `core/contracts/game-adapter.js`.

### [P1-03] Visual Hierarchy & Excessive Aesthetic Bloom
- **Severity**: **P1 (Creative / User Direction)**
- **Affected Files**: `src/renderer.js`.
- **Underlying Cause**: The current renderer employs glowing neon wireframes, gradients, and celebratory cards that compete with the core marble action.
- **Impact**: Fails to deliver the requested "minimal competitive physics" aesthetic (clean red vs blue outlines, almost-black background, simple horizontal barriers, large readable values, and mobile-first clarity).
- **Proposed Remediation**: Overhaul the rendering pipeline in `games/multiplying-ball-race/rendering/` to adopt a crisp, high-contrast, minimalist competitive broadcast aesthetic.

### [P1-04] Incomplete Lifecycle State Model
- **Severity**: **P1 (Production Integrity)**
- **Affected Files**: `src/production_orchestrator.js`.
- **Underlying Cause**: The current lifecycle uses 9 states but lacks intermediate asynchronous publishing states (`UPLOAD_PENDING`, `UPLOAD_IN_PROGRESS`, `UPLOAD_PREFLIGHT_PASSED`, `PROCESSING`, `FAILED`, `RETRY_PENDING`, `REJECTED`).
- **Impact**: Cannot model upload retries, transient network faults, or platform processing verification.
- **Proposed Remediation**: Implement the full 17-state lifecycle in `core/contracts/lifecycle-schema.js`.

---

### [P2-01] Legacy Dead Code and Obsolete Root Scripts
- **Severity**: **P2 (Maintainability / Hygiene)**
- **Affected Files**: `pipeline.js`, `auto_daily.js`, `generate_scenarios.js`, `ball_growth_race_demo.html`, `gamification_physics_engine.zip`, `share_server.py`.
- **Underlying Cause**: Early exploratory prototypes and scratch scripts were committed to the root and left behind as the production pipeline evolved.
- **Impact**: Clutters the repository, confuses developers about the authoritative entry point, and stores binary zip archives in git history.
- **Proposed Remediation**: Archive obsolete scripts or migrate useful routines to `core/` and remove stale zip files.

### [P2-02] Lack of Configurable Audio Modes & Local TTS Feasibility Analysis
- **Severity**: **P2 (Product Quality)**
- **Affected Files**: `src/audio_generator.js`.
- **Underlying Cause**: Audio generator is purely procedural and lacks structured modes (Mode A: ASMR/Pure Physics, Mode B: Minimal Commentary, Mode C: Full Commentary).
- **Impact**: Cannot easily toggle between commentary and ASMR sound design or integrate voice synthesis.
- **Proposed Remediation**: Implement audio modes in `core/audio/` and conduct a feasibility evaluation of local TTS engines (Kokoro / Piper vs pre-generated sound libraries).

### [P2-03] Unorganized Flat Test Suite
- **Severity**: **P2 (QA Structure)**
- **Affected Files**: `test/*.js`.
- **Underlying Cause**: All test files live in a single flat directory with mixed responsibilities (contract validation, qualification, regression).
- **Impact**: Makes selective CI runs and security-focused audits difficult.
- **Proposed Remediation**: Reorganize into `tests/contracts/`, `tests/regression/`, `tests/security/`, and `tests/integration/`.

---

### [P3-01] Documentation Disconnect
- **Severity**: **P3 (Documentation)**
- **Affected Files**: `README.md`.
- **Underlying Cause**: `README.md` documents old CLI scripts (`node pipeline.js 3`, `node auto_daily.js`) that do not reflect the canonical orchestrator or modular architecture.
- **Impact**: Onboarding confusion.
- **Proposed Remediation**: Overhaul `README.md` with modern architecture diagrams, authoritative CLI commands, and release qualification instructions.

---

## 4. Reorganization & Migration Plan

To safely migrate the codebase to the target architecture without breaking deterministic replays, test suites, or git history:

1. **Step 1: Core Contracts & Utilities**:
   - Establish `core/contracts/` (`game-adapter.js`, `scenario-schema.js`, `lifecycle-schema.js`).
   - Establish `core/simulation/` (`prng.js`, `math-evaluator.js`).
2. **Step 2: Modularize Multiplying Ball Race**:
   - Create `games/multiplying-ball-race/` with clean submodules for engine, rendering, audio, and configuration.
   - Implement `games/multiplying-ball-race/game-adapter.js`.
3. **Step 3: Modularize Secondary Games**:
   - Move `src/games/mega_plinko.js`, `sumo_arena.js`, `brick_breaker.js`, `marble_run.js` into `games/mega-plinko/`, `games/sumo-battle-royale/`, `games/neon-brick-breaker/`.
4. **Step 4: Centralize Shared Production & Publishing Infrastructure**:
   - Create `core/production/` (`render-manager.js`, `media-validator.js`).
   - Create `core/publishing/` (`queue-repository.js`, `scheduler.js`, `youtube-publisher.js`).
   - Create `orchestrator/` with central CLI registry and pipeline runner.
5. **Step 5: Backward Compatibility Wrappers**:
   - Maintain root `render.js`, `src/engine.js`, `src/renderer.js` as thin forwarders during transition so existing tools do not break.
6. **Step 6: Update Tests & Verify 100% Pass**:
   - Migrate and execute all test suites. Ensure 33/33 tests pass at every step.
