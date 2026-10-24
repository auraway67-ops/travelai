# AURA WAY

AURA WAY plans your whole trip. Tell it where you're going, when, who's coming, your budget, pace and interests, and it builds:

- **Getting there**: the cheapest and easiest ways to travel, with live road routes (fastest, easiest, shortest, no tolls) and the fuel or charging cost of the drive
- **Where to stay**: best-value stays, plus real hostels, guesthouses and budget hotels near your destination
- **Day-by-day itinerary**: timed activities, meals and transport, kept geographically sensible
- **Live map**: your route with fuel stations, EV chargers, viewpoints and stays along the way
- **Weather & safety**: the live forecast (or typical weather for dates further out), with a plain-language safety verdict and seasonal risks
- **Budget, packing list, local tips and a booking checklist**

Trips can be saved on the device.

## How it fits together

| Part | What it is |
| --- | --- |
| `App.js`, `src/` | The Expo (React Native) app: Plan, Trip, Map, Stops and Saved tabs |
| `server/` | The planner service. It asks Claude (`claude-opus-5-5`) for the trip plan and keeps the API key off the phone. It also serves the web pages. |
| `planner.html`, `planner.js`, `planner.css` | The web version of the planner |
| `index.html`, `styles.css`, `script.js` | The landing page |

Live map, route and weather data come from free, keyless open-data services: OpenStreetMap (Nominatim, Overpass), OSRM routing, and Open-Meteo. Their public servers are for light, fair use. Move to self-hosted or paid instances before launching to real users.

## Run it

You need Node.js 20 or newer and an [Anthropic API key](https://console.anthropic.com/).

### 1. Start the planner server

```sh
cd server
npm install
cp .env.example .env      # then put your ANTHROPIC_API_KEY in server/.env
npm start
```

The server listens on `http://localhost:8787`. The web planner is at `http://localhost:8787/planner`.

### 2. Start the app

In the project root, tell the app where the planner server is by adding this line to `.env` (see `.env.example`):

```sh
EXPO_PUBLIC_API_URL=http://localhost:8787
```

On a physical phone, use your computer's local network address instead of `localhost`, for example `http://192.168.1.20:8787`. The phone and computer must be on the same Wi-Fi.

```sh
npm install
npm start
```

Scan the QR code with Expo Go, or press `a` or `i` to open an Android or iOS simulator.

Without `EXPO_PUBLIC_API_URL`, the app runs in **sample mode**. It builds a clearly labelled template plan instead of calling Claude, so you can try the app before setting up a key. Live maps, routes and weather still work in sample mode.

## Good to know

- Prices, opening hours and availability in AI plans are estimates. The plan tells travellers what to confirm before booking.
- A plan usually takes under a minute to generate. Each one is a single Claude API call, which costs a few cents.
- The Map and Stops tabs are the original concept screens and still use illustrative sample data.
