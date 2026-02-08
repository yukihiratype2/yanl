# NAS Tools - Media Manager

A self-hosted media management tool for anime, TV shows, and movies.

## Architecture

- **Backend**: TypeScript + Bun + Hono + SQLite
- **Frontend**: TypeScript + Next.js + Tailwind CSS

## Setup

### Backend

```bash
cd backend
bun install
bun run dev
```

The backend will start on `http://localhost:3001` and print the API token to the console.

### Frontend

```bash
cd frontend
bun install
bun run dev
```

The frontend will start on `http://localhost:3000`.

On first visit, enter the API token from the backend console in the Settings page.

## Features

- **Media Search**: Search anime, TV shows, and movies via TMDB
- **Subscriptions**: Subscribe to media and track episodes
- **Torrent Search**: Search torrents from Mikan and DMHY RSS feeds
- **Download**: Send torrents to qBittorrent for download
- **Calendar**: View upcoming episodes on a calendar
- **File Management**: Automatically organize downloaded media into structured directories

## Configuration (Settings Page)

- **qBittorrent**: URL, username, password for your qBittorrent instance
- **TMDB Token**: API bearer token from themoviedb.org
- **AI**: OpenAI-compatible API config (for future intelligent parsing)
- **Media Directories**: Where to store anime, TV shows, and movies

## Workflow

1. Search for media using TMDB
2. Subscribe to a show/movie (creates folder structure)
3. Search for torrents via RSS feeds
4. Send selected torrents to qBittorrent
5. Downloaded files are organized into the configured media directories
