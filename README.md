# TIG3 — Tiny Interactive Games vol.3

A hand-crafted collection of tiny browser games. Zero build step, pure HTML + Canvas + JavaScript.

🎮 **Live demo:** https://tig3.hijirisubaru.dpdns.org/

## Games

| Game | Genre | Status |
|------|-------|--------|
| [Neon Breakout](games/breakout/) | Arcade | 🟢 Playable · 5 levels · progress saved locally |
| [Sudoku](games/sudoku/) | Logic | 🟢 Playable · 4 difficulties · notes / hints / undo · progress saved |

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
│   └── sudoku/
│       ├── index.html
│       ├── sudoku.js    # pure logic (generate/solve/uniqueness)
│       ├── main.js      # DOM glue (input/timer/persistence)
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
