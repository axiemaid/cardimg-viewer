# CARDIMG Viewer

A clean, public-facing gallery for browsing [CARDIMG](https://github.com/axiemaid/cardimg-upload) and [CARDSET](https://github.com/axiemaid/cardimg-indexer) protocol data on the BSV blockchain. Static frontend served by a minimal Express server — talks directly to the [cardimg-api](https://github.com/axiemaid/cardimg-api) for all data.

## Features

### Uploads Tab
- **Responsive grid** — auto-filling columns (220px min card width), works on desktop and mobile
- **Newest first** — sorted by block height descending, unconfirmed (mempool) uploads pinned to top with amber badge
- **Lazy loading** — images only fetch when scrolled into view (IntersectionObserver), with shimmer placeholder animation
- **Click any upload** → navigates to `/cardimg/:txid` detail page

### Upload Detail Page (`/cardimg/:txid`)
- Full-resolution image
- TxID (full, copyable)
- SHA-256 hash
- Block height (or "Unconfirmed" for mempool)
- Image size
- Link to WhatsOnChain
- Direct raw image link
- **Card associations** — "Appears in N card(s)" with role label and click-through to card detail page

### Cards Tab

The Cards page has two sections:

#### 1. Card Directory (top)

A directory of all 42 Grand Line Hyper Battle card codes (C01–C34, S01–S08). Each code displays with its cardset count in brackets, e.g. `S03 (3)` for 3 indexed cardsets.

- **5 per row** on desktop, 4 on medium screens, 3 on mobile
- Codes with 0 cardsets are greyed out
- **Click a code** to filter the cardsets feed below to that code
- **Click again** (or "Clear filter") to remove the filter
- An **Uncategorized** bucket appears when cardsets have no code mapping

#### 2. Newest Cardsets (below)

Same cardset feed as before — responsive grid of member thumbnails, sorted newest first (mempool at top).

- When a card code filter is active, only matching cardsets show
- Each set card displays the card code badge (when mapped)
- Click any cardset → navigates to `/card/:txid` detail page

### Card Detail Page (`/card/:txid`)
- All member uploads with position labels (front / back / supplementary)
- Click any member image to navigate to that upload's detail page
- CARDSET TxID with WhatsOnChain link
- Shows card code + character name when mapped
- Unconfirmed cards pinned to top with amber badge

### General
- **Manual refresh** — spinning refresh button polls for new uploads/cards
- **Mobile-friendly** — responsive layout adjusts grid columns, stacks modals vertically
- **Dark theme** — clean, museum-display aesthetic. The image is the content; metadata is secondary

## Conceptual Model

- **Upload** — a single CARDIMG transaction: one image inscribed on-chain. Raw protocol data.
- **Card** — a CARDSET transaction linking multiple uploads (front + back minimum). A card is what a human thinks of as "a card" — front and back grouped together.
- Multiple CARDSETs may reference the same physical card (rescans, different angles). Clustering these by visual fingerprint is a future feature.

## Architecture

```
┌─────────────────────┐       HTTP        ┌──────────────────────────────┐
│   Viewer (static)   │ ──────────────►   │   CARDIMG API (port 3014)    │
│   port 3015         │                   │                              │
│                     │   CARDIMG:        │   /list     /img/:hash       │
│  Uploads tab        │   /list           │   /stats    /tx/:txid        │
│  Cards tab          │   /img/:hash      │   /card/:hash                │
│  Upload modal       │   /stats          │                              │
│  Card modal         │                   │   CARDSET:                   │
│                     │   CARDSET:        │   /sets/list                 │
│                     │   /sets/list      │   /sets/:txid               │
│                     │   /sets/:txid     │   /card/:hash/sets           │
│                     │   /card/:hash/sets│                              │
└─────────────────────┘                   └──────────────────────────────┘
                                                    │
                                                    ▼
                                          ┌──────────────────────┐
                                          │   Indexer Data        │
                                          │   ledger.json         │
                                          │   mempool.json        │
                                          │   cardset-ledger.json │
                                          │   cardset-mempool.json│
                                          │   images/             │
                                          └──────────────────────┘
```

The viewer is a static frontend (HTML/CSS/JS) served by a minimal Express server. It talks directly to the cardimg-api for all data — no own state, no database, no indexing. The API URL is injectable at runtime via the `--api` flag, which gets written to `/config.js` and loaded by the frontend.

## Managing Card Codes

Card codes are an **application-layer** concept — the CARDIMG/CARDSET protocols carry no card code data. Mapping is done locally, not on-chain.

### How to assign a card code to a cardset

Edit `public/card-codes.json`:

```json
{
  "mappings": {
    "42484af615d840eb4252d88b955268553403c264d19b9c9e44dff8f7da3ae7b5": "C01",
    "6c0bdcf5fdb0d521e83c16d3c137b35de17a211bcd749e8133de02450e601984": "S03"
  }
}
```

- **Key** = CARDSET transaction ID (the `cardsetTxid` shown in the viewer)
- **Value** = card code (e.g. `C01`, `S03`)

The viewer reads this file on page load. Changes take effect on refresh — no restart needed.

### Reference data

`public/card-reference.json` contains the 42 card codes with names from the Grand Line Wiki (C01 Luffy, C02 Luffy, etc.). This is the source of truth for what codes exist. Generated from the Hyper Battle card data at `~/.openclaw/hyperbattle/first-stage/cards.json`.

### Design principles

- **Image is identity** — card codes are not stored on-chain. They're a viewer-operator mapping, not protocol truth.
- **Future: pHash matching** — the plan is to auto-match scanned cards to reference images via 1024-bit perceptual hashing, eliminating manual mapping. Until then, manual mapping is honest and simple.
- **Permissionless** — anyone can map, anyone can ignore the mapping. The protocol stays dumb.

## Managing Exclusions

Exclusions hide specific transactions from the viewer and API. This is also an **application-layer** concept — excluded txids are still on-chain, just not shown.

### Exclusion file

The exclusion file lives in the **API's data directory** (not the viewer):

```
~/.openclaw/cardimg/exclusions.json
```

```json
{
  "cardimg": [
    "3a512c182e03f4d5cf1468e679740f7ca5c6bdcfb9953fcda95704997aacb3f6",
    "5d25b4e57fb2c0521d08039cb3c8343499e2bcfb6082aa8dce9cea5beb15baa0"
  ],
  "cardset": []
}
```

- **`cardimg`** — array of CARDIMG txids to hide from `/list`, `/img/:hash`, `/thumb/:hash`, `/tx/:txid`
- **`cardset`** — array of CARDSET txids to hide from `/sets/list`, `/sets/:txid`

### How to exclude a transaction

Edit `~/.openclaw/cardimg/exclusions.json` and add the txid to the appropriate array. The API reads this file on every request — changes take effect immediately, no restart needed.

You can also manage exclusions via the API:

```bash
# Add an exclusion
curl -X POST http://localhost:3014/exclusions \
  -H "Content-Type: application/json" \
  -d '{"type": "cardimg", "txid": "3a512c..."}'

# Remove an exclusion
curl -X DELETE http://localhost:3014/exclusions \
  -H "Content-Type: application/json" \
  -d '{"type": "cardimg", "txid": "3a512c..."}'

# List all exclusions
curl http://localhost:3014/exclusions
```

## Run

```bash
# Start the API first (if not running)
cd ~/.openclaw/cardimg-api && node scripts/serve.cjs --port 3014 --data-dir ~/.openclaw/cardimg

# Start the viewer
cd ~/.openclaw/cardimg-viewer && node server.cjs --port 3015

# Or with a custom API URL
node server.cjs --port 3015 --api http://localhost:3014
```

## PM2

```bash
pm2 start scripts/serve.cjs --name cardimg-api -- --port 3014 --data-dir ~/.openclaw/cardimg
pm2 start server.cjs --name cardimg-viewer -- --port 3015
pm2 save
```

## Files

```
cardimg-viewer/
├── server.cjs              # Express server — serves static files + injects API URL into /config.js
├── package.json
├── README.md
├── vercel.json
└── public/
    ├── index.html          # Gallery page + cards view + upload/card modals
    ├── style.css           # Dark theme, responsive grid, tabs, modals, animations
    ├── app.js              # Fetch logic, lazy-load, tabs, card code directory, routing
    ├── config.js           # Generated at runtime — sets API URL
    ├── card-reference.json # 42 card codes with names (C01-C34, S01-S08)
    └── card-codes.json     # Cardset txid → card code mappings (operator-managed)
```

## API Endpoints Used

### CARDIMG

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/list` | GET | JSON array of all indexed cards (txid, hash, blockHeight, size) |
| `/stats` | GET | Index stats (card count, set count, total bytes, last block) |
| `/card/:hash` | GET | Card metadata + CARDSET associations (reverse lookup) |
| `/img/:hash` | GET | Raw image bytes with proper Content-Type header |
| `/tx/:txid` | GET | Raw image bytes by txid (chain fallback for uncached) |
| `/thumb/:hash` | GET | Thumbnail (400px JPEG) |
| `/thumb/tx/:txid` | GET | Thumbnail by txid |

### CARDSET

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sets/list` | GET | JSON array of all CARDSETs (cardsetTxid, txids, memberCount, blockHeight) |
| `/sets/:txid` | GET | Single CARDSET with resolved member cards (hash, role, imageUrl) |
| `/card/:hash/sets` | GET | Reverse lookup — which CARDSETs contain this card |

### Exclusions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/exclusions` | GET | List all exclusions (cardimg + cardset arrays) |
| `/exclusions` | POST | Add exclusion — body: `{"type": "cardimg"\|"cardset", "txid": "..."}` |
| `/exclusions` | DELETE | Remove exclusion — body: `{"type": "cardimg"\|"cardset", "txid": "..."}` |

All endpoints are served by the [cardimg-api](https://github.com/axiemaid/cardimg-api), which reads from the indexer's data directory and falls back to WhatsOnChain for uncached images.

## Design Decisions

- **Client-side routing** — `/` (uploads), `/cards` (cards), `/cardimg/:txid` (upload detail), `/card/:txid` (card detail). Uses pushState/popstate, no page reloads.
- **No upload** — upload is handled by cardimg-scan + cardimg-upload. The viewer is read-only.
- **No CARDSET creation** — that's the cardset-viewer tool's job. Viewer is browse-only.
- **No clustering** — multiple CARDSETs for the same physical card show as separate cards. Clustering by shared txid or pHash is a future feature.
- **No WebSocket/SSE** — manual refresh only. Keeps it simple and stateless.
- **No accounts** — public registry, anyone can browse.
- **No server-side state** — the viewer is a static frontend. All state lives in the indexer/API.
- **API URL injectable** — via `--api` flag, written to `/config.js` at runtime. Deploy anywhere, point at any API instance.
- **Card codes are application-layer** — not stored on-chain. Manual mapping via `card-codes.json`. Future: pHash auto-matching.
- **Exclusions are application-layer** — hidden from API responses, not deleted from chain. Operator-managed via `exclusions.json` or API endpoints.
- **Member resolution** — card members resolve to images via `/tx/:txid` (chain fallback) when not in local index, so cards always show images even if the CARDIMG indexer hasn't caught up.
- **Terminology** — "Upload" = single CARDIMG image. "Card" = CARDSET grouping (front + back minimum). Labels do the teaching.

## Stack

- **Express** — minimal static file server + `/config.js` injection
- **Vanilla JS** — no frameworks, no build step, no dependencies beyond Express
- **CSS Grid + Flexbox** — responsive layout without any UI library
- **IntersectionObserver** — lazy loading without external libraries
