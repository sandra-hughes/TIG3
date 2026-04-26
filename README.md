# TIG3 — Tiny Interactive Games vol.3

A hand-crafted collection of tiny browser games. Zero build step, pure HTML + Canvas + JavaScript.

🎮 **Live demo:** https://tig3.hijirisubaru.dpdns.org/


### Local profiles and saves

TIG3 uses a browser-local profile login. No backend or password is required. Profile IDs are random and user-scoped, while player names remain display labels. Each player name gets separate `localStorage` data for:

- game records and history
- high scores / best times
- current in-progress saves
- level progress where the game has levels

If a page is refreshed or closed during a game, the current run is saved. Next time, the player confirms restore first, then a 3-second countdown runs before play resumes. Breakout and Snake throttle routine saves to about once per second, force-save on lifecycle events, and auto-pause when the pointer leaves the game area.

## Games

| Game | Genre | Status |
|------|-------|--------|
| [Neon Breakout](games/breakout/) | Arcade | 🟢 Playable · 5 levels · progress saved locally |
| [Sudoku](games/sudoku/) | Logic | 🟢 Playable · 4 difficulties · notes / hints / undo · progress saved |
| [Neon Snake](games/snake/) | Arcade | 🟢 Playable · keyboard / WASD / touch swipe · best score saved |

More games coming — each lives in its own `games/<name>/` directory.

## Controls

### Neon Breakout

| Action | Key / Mouse |
|--------|-------------|
| Move paddle | mouse, or `←` / `→` |
| Launch ball | `Space` or click |
| Pause / resume | `P` |
| Pick level (in menu) | `←` / `→` then `Space` |
| Reset saved progress | `R` (asks for confirmation) |

Cleared levels are saved in `localStorage` under `tig3.breakout.maxLevel`, so
you can resume from your highest cleared level on the next visit. The level
picker on the start screen lets you replay any earlier level.

### Neon Snake

| Action | Key / Touch |
|--------|-------------|
| Move | `←` `→` `↑` `↓`, or `WASD`, or swipe |
| Start / pause / resume | `Space` or button |
| Restart | `R` |

Score is saved in `localStorage` under `tig3.snake.best`. The snake speeds up
every 80 points, with level and speed shown in the HUD.

### Sudoku

| Action | Key |
|--------|-----|
| Move selection | `←` `→` `↑` `↓` |
| Fill digit | `1`–`9` |
| Clear cell | `⌫` / `Delete` / `0` |
| Toggle notes mode | `N` |
| Hint (reveal one cell) | `H` |
| Undo last move | `U` |
| New game | `R` |
| Pause / resume | `Esc` |

Four difficulties (Easy / Medium / Hard / Expert) with target clue counts of
41 / 32 / 28 / 24. Puzzles are generated client-side with 180°-symmetric
digging and uniqueness checking. Hints reveal one correct cell from the cached
solution but cost a hint counter and are not undoable. Conflicting cells light
up in red in real time; the error counter goes up by one for each conflicting
input (erasing does not reduce it). All progress, best times per difficulty,
and win/start stats are persisted in `localStorage` under the
`tig3.sudoku.*` keys.

## Architecture

```
TIG3/
├── index.html       # Game selector (landing page)
├── style.css        # Shared neon theme
├── games/
│   ├── breakout/
│   │   ├── index.html
│   │   ├── main.js
│   │   └── style.css
│   ├── sudoku/
│   │   ├── index.html
│   │   ├── sudoku.js    # pure logic (generate/solve/uniqueness)
│   │   ├── main.js      # DOM glue (input/timer/persistence)
│   │   └── style.css
│   └── snake/
│       ├── index.html
│       ├── main.js
│       └── style.css
└── README.md
```

## Running locally

```bash
python3 -m http.server 8090
# then open http://127.0.0.1:8090/
```

No bundler, no dependencies, no npm. Edit any file and refresh the browser.

## License

MIT © sandra-hughes
