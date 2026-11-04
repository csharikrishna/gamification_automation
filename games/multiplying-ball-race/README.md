# Multiplying Ball Race (Flagship Game)

## Overview
Multiplying Ball Race is Burstpoint's premier flagship 2D physics simulation and YouTube Shorts production title. Two symmetric lanes compete down a vertical multi-tier obstacle track featuring pachinko deflection pegs, destructible barrier tiles with mathematical operations ($\times, +, -, \div$), and a final victory reservoir.

## Architecture
- `engine/`: Deterministic 2D physics engine, fixed substep integration, spatial hash grid, and explicit 3-metric population tracking (`actualBallCount`, `totalGeneratedBalls`, `mathematicalPopulation`).
- `rendering/`: Minimalist, high-contrast arcade broadcast canvas renderer.
- `audio/`: Synchronized event logging and procedural sound synthesis.
- `game-adapter.js`: Official implementation of the Universal `GameAdapter` contract.
- `configs/`: Production and benchmark scenario configurations.

## Visual Direction
- Almost-black background (`#07090e`).
- High-contrast symmetric arenas (Purple/Left vs Green/Right).
- Horizontal breakable barriers with crystal damage facets.
- 1:1 physical marble rendering with specular highlights.
- Broadcast lower-third HUD comparing physical marbles (`192` vs `86`) with `REPLAY ↻` cue.
