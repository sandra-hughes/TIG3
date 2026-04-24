# TIG3 — Tiny Interactive Games vol.3

A hand-crafted collection of tiny browser games. Zero build step, pure HTML + Canvas + JavaScript.

🎮 **Live demo:** https://tig3.hijirisubaru.dpdns.org/

## Games

| Game | Genre | Status |
|------|-------|--------|
| [Neon Breakout](games/breakout/) | Arcade | 🟢 Playable · 5 levels · progress saved locally |

More games coming — each lives in its own `games/<name>/` directory.

## Controls (Neon Breakout)

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

## Architecture

```
TIG3/
├── index.html       # Game selector (landing page)
├── style.css        # Shared neon theme
├── games/
│   └── breakout/    # One folder per game
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
