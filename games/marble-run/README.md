# Rube Goldberg Marble Run Game Module

## Overview
Autonomous multi-tier marble race physics simulation implementing the Burstpoint `GameAdapter` contract.
Features dynamic vertical camera tracking, rotating paddle wheels, damped seesaw levers, and pachinko deflection pegs.

## Architecture & Integration
- **Game Type:** `marble_run`
- **Adapter:** `games/marble-run/game-adapter.js`
- **Entry Points:**
  - Node.js: `GameRegistry.createGame({ gameType: 'marble_run', ... })`
  - Browser: `<script src="games/marble-run/game-adapter.js"></script>` -> `window.MarbleRunGame`
