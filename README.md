# Home Portal

Unified login + app launcher for your home server.

## Quick Start

```bash
cd home-portal
npm install
npm start
```

Open **http://localhost:3000**

## Docker

```bash
docker compose up -d --build
```

## Features

- **Single login** — one account to access all your apps
- **App launcher** — card grid with live health status indicators
- **Add any app** — name, URL, emoji icon, color accent
- **Health checks** — green/red dots showing which apps are running
- **Right-click to edit** — modify or remove apps
- **Greeting** — time, date, and greeting based on time of day
- **Dark/light theme**
- **Pre-configured** — comes with Trading Journal, RSS Reader, Stock Scanner, Pi-hole

## Default Apps

| App | Port | Icon |
|-----|------|------|
| Trading Journal | 5000 | 📊 |
| RSS Reader | 3001 | 📰 |
| Stock Scanner | 3002 | 🔍 |
| Pi-hole | 80 | 🛡️ |

## Ports

| App | Port |
|-----|------|
| **Home Portal** | **3000** |
| Trading Journal | 5000 |
| RSS Reader | 3001 |
| Stock Scanner | 3002 |
