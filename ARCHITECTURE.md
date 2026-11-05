# Burstpoint Architecture & Modularization Specification

See the canonical architecture specification in [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md).

## Quick Directory Summary

- `core/`: Canonical contracts, PRNG, AST evaluator, audio mixer, publishing scheduler, and queue repository.
- `games/`: Modular game packages (`multiplying-ball-race`, `mega-plinko`, `sumo-battle-royale`, `neon-brick-breaker`, `marble-run`).
- `orchestrator/`: Production lifecycle pipeline and stage workers (`stages/scenario-generator`, `stages/candidate-scorer`, etc.).
- `src/`: Backward-compatibility re-export shims.
- `test/`: Verification and qualification suites.
