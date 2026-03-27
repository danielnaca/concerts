# 🎵 Neighborhood Concert Discovery — Product Brief

## Overview

A web app for discovering local concerts through audio. Instead of browsing a list of show names and dates, users explore music first — hearing thirty-second previews from bands playing nearby before deciding what to attend. The experience is tactile, browsable, and sound-first.

---

## Problem

Most concert discovery apps are transactional. You already have to know who you want to see. There's no good way to stumble onto a band you've never heard of but would actually love.

---

## Concept

A 3×3 grid of tiles, each representing a band playing in your city in the next two months. Move your cursor (or finger on mobile) around the grid and audio previews play as you hover. It's browsing by listening.

---

## Data Sources

**Bands in Town** — scraped for local show data (SF, next 60 days). Covers indie and grassroots acts that ticketing APIs miss. A one-time scrape for the prototype dumps to a static JSON file.

**Spotify API** — used to match each scraped artist and pull their thirty-second preview clip and artist image/color palette.

---

## Grid Logic

- Always a 3×3 grid = 9 tiles
- Tiles are distributed evenly across artists in the dataset
  - 1 artist → all 9 tiles show that artist
  - 2 artists → 5 tiles / 4 tiles
  - 3 artists → 3 tiles each
  - 9+ artists → 1 tile each, randomized on each load
- Each tile shows the artist's image or brand color as background
- A small music note icon sits centered on each tile
- Tapping/clicking a tile opens a detail view: show date, venue, ticket link

---

## Interaction Design

**Cursor follower** — a soft circle with a drop shadow tracks the user's mouse/finger across the grid. Gives the UI an organic, responsive feel without requiring WebGL.

**Audio on hover** — when the cursor enters a tile, the Spotify preview for that artist plays. Audio fades out on exit.

**No autoplay on load** — nothing plays until the user moves into the grid. Feels intentional, not intrusive.

---

## UI Aesthetic

- Dark background
- Artist imagery or a muted color fill per tile
- Minimal text — just the note icon on each tile
- Detail panel slides in on tap/click with show info
- Feels tactile and music-forward, not like a ticketing app

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (React) | Easy Vercel deploy, API routes for Spotify |
| Styling | Tailwind CSS | Fast, utility-first |
| Audio | HTML5 Audio / Web Audio API | Preview playback + fade |
| Cursor | Vanilla JS mouse tracking | Simple circle follower |
| Data | Static JSON | One-time Bands in Town scrape |
| Spotify | Spotify Web API | Artist match + preview URL |
| Hosting | Vercel | Auto-deploys from GitHub |

---

## Environment Variables

Never commit API keys. Use `.env.local` for local dev (gitignored) and Vercel Environment Variables for production.
```
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

Bands in Town scraping requires no API key at prototype stage.

---

## Data Pipeline (One-Time for Prototype)

1. Run a Python scraper against Bands in Town for SF, next 60 days
2. For each artist, call Spotify search API → get `preview_url` + `images[]`
3. Dump enriched data to `public/data/shows.json`
4. UI reads static JSON — no database needed

---

## File Structure
```
/
├── public/
│   └── data/
│       └── shows.json        # scraped + enriched show data
├── src/
│   ├── app/
│   │   └── page.tsx          # main grid view
│   ├── components/
│   │   ├── Grid.tsx          # 3x3 tile layout
│   │   ├── Tile.tsx          # individual tile + hover audio
│   │   ├── CursorFollower.tsx# animated cursor circle
│   │   └── DetailPanel.tsx   # show info on tap/click
│   └── lib/
│       └── spotify.ts        # Spotify API helpers
├── scripts/
│   └── scrape.py             # Bands in Town scraper
├── .env.local                # gitignored
└── .gitignore
```

---

## V2 Ideas (Post-Prototype)

- Three.js / WebGL particle effects responding to cursor or audio
- Web Audio API frequency visualization on tiles
- Spotify login to personalize grid based on listening history
- Supabase for weekly re-scraping and show data persistence
- Expand beyond SF to any city

---

## Out of Scope (V1)

- User accounts
- Personalized recommendations
- Ticketing integration
- Audio visualization
- Database