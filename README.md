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
- **Cards tab toggle** in header with live count badge
- **Cards grid** — each card (CARDSET) shows member thumbnails side by side (front + back)
- **Click any card** → navigates to `/card/:txid` detail page

### Card Detail Page (`/card/:txid`)
- All member uploads with position labels (front / back / supplementary)
- Click any member image to navigate to that upload's detail page
- CARDSET TxID with WhatsOnChain link
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
├── server.cjs          # Express server — serves static files + injects API URL into /config.js
├── package.json
├── README.md
└── public/
    ├── index.html      # Gallery page + cards view + upload/card modals
    ├── style.css       # Dark theme, responsive grid, tabs, modals, animations
    └── app.js          # Fetch logic, lazy-load, tabs, upload modal, card modal, reverse lookup
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

### CARDSET

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sets/list` | GET | JSON array of all CARDSETs (cardsetTxid, txids, memberCount, blockHeight) |
| `/sets/:txid` | GET | Single CARDSET with resolved member cards (hash, role, imageUrl) |
| `/card/:hash/sets` | GET | Reverse lookup — which CARDSETs contain this card |

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
- **Member resolution** — card members resolve to images via `/tx/:txid` (chain fallback) when not in local index, so cards always show images even if the CARDIMG indexer hasn't caught up.
- **Terminology** — "Upload" = single CARDIMG image. "Card" = CARDSET grouping (front + back minimum). Labels do the teaching.

## Stack

- **Express** — minimal static file server + `/config.js` injection
- **Vanilla JS** — no frameworks, no build step, no dependencies beyond Express
- **CSS Grid + Flexbox** — responsive layout without any UI library
- **IntersectionObserver** — lazy loading without external libraries
