# SpaceX Launch Gap Calendar

A simple aggregated view of all SpaceX launches on a calendar. Shows days that haven't had a launch as well as which launches happened on a given day.

Launch data is sourced from the [Launch Library 2 API](https://ll.thespacedevs.com/docs) (v2.3.0) and covers all SpaceX vehicles — Falcon 1, Falcon 9, Falcon Heavy, and Starship.

## Setup

```
npm install
```

## Commands

### `npm run fetch-launches`

Fetches SpaceX launch data from the Launch Library 2 API and saves it to `data/launches.json`.

On subsequent runs it performs an **incremental fetch** — only pulling launches newer than the most recent date already in `data/launches.json`. This keeps API requests minimal and respects the unauthenticated rate limit of 15 requests/hour.

**Options**

| Flag | Description |
|------|-------------|
| `--full-refetch` | Ignore existing data and re-fetch all launches from scratch |

```
npm run fetch-launches -- --full-refetch
```

## Development

See [docs/development.md](docs/development.md) for architecture details, data pipeline notes, and keyboard nav reference.
