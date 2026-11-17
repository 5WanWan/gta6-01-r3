# SOLMAR BAY — Streets of the Sun

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/5WanWan/gta6-01-r3/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/5WanWan/gta6-01-r3/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
make.fun **gta6-01 "Make GTA 6"** bounty. No libraries, no network, no
build step — just static files and a canvas.

## The story

Solmar Bay is a sun-soaked coastal city where the tide brings in money
and trouble in equal measure. **Dario Voss** just walked out of the
Marina lock-up owing fixer **Mara Kline** $5,000. She has work — three
jobs. Finish them, and the debt is gone and the city is his.

1. **First Wheels** — steal a car on Palm Row and bring it to the Voss Garage.
2. **The Drop** — pick up a package at Solmar Market and deliver it to the
   Harbor Docks while the police close in (timed).
3. **Harbor Heat** — take the case from the Kestrel crew at the docks, then
   reach the Sunset Bar on the beach (timed shootout).

## What is in the game

- **A whole city to explore** — six districts (Marina, Downtown, Old Town,
  Palm Row, Harbor, Beachfront), a beach and water, parks, crosswalks and
  hundreds of buildings, all on foot and by car.
- **Driving** — seven car types (sedan, taxi, sports, pickup, van, muscle,
  police cruiser) with arcade handling, drift and crash damage. Steal
  parked cars or pull drivers out of traffic.
- **Traffic & pedestrians** — traffic cars cruise the road grid, turn at
  intersections and brake for cars ahead; pedestrians stroll the
  sidewalks and panic and run when shots are fired.
- **Wanted level & police** — 0–5 stars. Stealing, shooting and punching
  raise the heat; Solmar PD cruisers spawn, pursue and ram you. Lay low
  and the heat cools off star by star.
- **Combat** — fists (Space) and a pistol (mouse aim, click to shoot)
  with enemy health bars, muzzle flashes, tracers and hit particles.
- **Missions & story** — three story missions with dialogue, objectives,
  a timer, mission-passed / mission-failed states and cash rewards.
- **HUD & minimap** — health, cash, weapon/ammo, speed, wanted stars,
  mission objective, timer, event feed, radio chatter and a labeled
  live minimap with the mission target and police dots.
- **Save system** — save at the Voss Garage (F key), auto-save after
  every mission, continue from the start screen (L key).
- **Sound & music** — fully synthesized WebAudio: engine hum, sirens,
  gunshots, pickups and a lazy bass groove. No audio files. M mutes.
- **Polish** — start screen, pause, "WASTED" hospital respawn, cash
  pickups, day-bright palette, particles and a deterministic screenshot
  mode (`?shot=chase|mission|drive|street`) that stages real gameplay
  scenes from a fixed seed.

## How to run

```sh
# Serve the game/ folder with any static server, then open:
#   http://localhost:8000/index.html
python3 -m http.server 8000
```

Or open `game/index.html` directly in desktop Chrome. The game needs
no network connection and loads no external files.

## Controls

| Key / Mouse | Action |
|---|---|
| W A S D / Arrows | Move on foot, drive the car |
| Shift | Run |
| E | Enter / exit a car, steal a car |
| Mouse | Aim (pistol) |
| Click | Shoot |
| Space | Punch |
| F | Save at the Voss Garage |
| L | Continue from a save (start screen) |
| P / Esc | Pause |
| M | Mute |
| Enter | Advance dialogue / start / respawn |

## Project layout

```
game/
  index.html        page + canvas
  src/
    main.js         game loop, input, state machine
    city.js         city generation, districts, roads, buildings
    render.js       drawing: city, cars, people, markers, effects
    hud.js          HUD, minimap, dialogue, menus
    vehicles.js     car types, traffic AI, police pursuit, driving
    people.js       player on foot, pedestrians, enemies
    missions.js     story, mission definitions and progress
    combat.js       shooting, punching, bullets, wanted level
    audio.js        synthesized WebAudio sound and music
    save.js         localStorage save / load
    shots.js        deterministic staged scenes (?shot=...)
    rng.js          seeded random numbers
```

## License

MIT — see `LICENSE`.

<sub>Entered on [make.fun](https://make.fun/?ref=sdnvmg7s&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
