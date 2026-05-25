# Development

## Architecture

No build step. The entire UI is a single `index.html` — vanilla JS, no dependencies, no bundler. Serve it with any static file server:

```
npx serve .
# or
python3 -m http.server
```

`data/launches.json` is committed to the repo and served as a static asset fetched at runtime via `fetch('./data/launches.json')`.

## File map

| Path | Purpose |
|------|---------|
| `index.html` | Entire UI — styles, markup, and JS in one file |
| `data/launches.json` | Committed launch data (801+ records) |
| `scripts/fetchLaunches.js` | Node script to pull/update launch data |

## Data pipeline

Source: [Launch Library 2 API](https://ll.thespacedevs.com/docs) v2.3.0, filtered by `search=SpaceX`.

```
npm run fetch-launches              # incremental — pulls only since latest date in file
npm run fetch-launches -- --full-refetch   # wipe and re-fetch everything
```

The script is rate-limit-aware: unauthenticated requests are capped at **15/hour**, so it adds a 2-second delay between paginated requests. After updating, commit `data/launches.json`.

### Launch record shape

```json
{
  "name": "Falcon 9 Block 5 | Starlink Group 6-40",
  "date": "2024-03-04T06:05:00Z",
  "status": "Success",
  "mission": "Starlink Group 6-40"
}
```

`status` values from the API: `"Success"` | `"Failure"` | `"Partial Failure"` | `"Go"` | `"TBD"` | `null`

## Calendar logic

`build_launch_map()` transforms the flat array into a `MM-DD → launch[]` map (e.g. `"03-04"`). This is the core data structure — all calendar rendering reads from `launches_by_day`.

`CALENDAR_YEAR` (`new Date().getFullYear()`) is used **only** for computing day-of-week offsets so month grids align correctly. The heatmap is all-time aggregated across every year in the data.

### Heatmap levels

| Class | Launches/day |
|-------|-------------|
| `l0` | 0 |
| `l1` | 1–2 |
| `l2` | 3–4 |
| `l3` | 5+ |

## Keyboard navigation

All non-blank day cells get `data-month` (0–11) and `data-day` (1–31) attributes. The document-level `keydown` handler drives navigation:

| Key | Action |
|-----|--------|
| `h` / `l` | Previous / next day (wraps across months) |
| `k` / `j` | Previous / next week (wraps across months) |
| `PageUp` / `PageDown` | Previous / next month (clamps day to month length) |
| `Enter` / `Space` | Open popover for launch-day cells |
| `Esc` | Close popover |

Navigation is suppressed while the popover is open.
