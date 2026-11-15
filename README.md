# makefun-fps-02

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/anjay898/makefun-fps-02/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/anjay898/makefun-fps-02/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

**Breachline** — an original round-based tactical FPS in three.js, Counter-Strike-style but entirely its own: the Ember Cell attacks the Wardens across Foundry Yard, a dusk-lit industrial map with three lanes and one bombsite, the Crucible. Single-player 5v5 against bot teammates and opponents: 12-second buy phase with a full economy (six fictional weapons, flash and frag charges), 100-second rounds, a plantable/defusable charge, first to 7 rounds. Gunplay rewards stopping and aiming — headshot multipliers, recoil bloom, movement spread, crouch — and the bots run a waypoint graph with roles (carrier, entry, support, anchors, rotators), raycast vision, hearing, and post-plant plays. Static files only: no build step, no network, runs from any static server.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in desktop Chrome
# (or build the submission output: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts)
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=xwewnr0f&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>
