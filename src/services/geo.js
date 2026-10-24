// Live map data from free, keyless OpenStreetMap services:
// Nominatim (place search), OSRM (road routing) and Overpass (points of interest).
// The public instances are fair-use only; move to self-hosted or paid
// instances before shipping to real users.

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
// Two public OSRM servers with the same API; the second is tried if the first is unreachable.
const OSRM = ["https://router.project-osrm.org/route/v1/driving", "https://routing.openstreetmap.de/routed-car/route/v1/driving"];
const OVERPASS = "https://overpass-api.de/api/interpreter";

// The OpenStreetMap services reject anonymous clients (403/406) unless the app
// identifies itself. Browsers ignore this header and send a Referer instead.
const IDENTITY = { "User-Agent": "AuraWay/1.0 (trip planner app)" };

export async function getJson(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, headers: { ...IDENTITY, ...options.headers }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The map service took too long to answer.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function geocode(query) {
  const url = `${NOMINATIM}?format=jsonv2&limit=1&accept-language=en&q=${encodeURIComponent(query)}`;
  const [hit] = await getJson(url);
  if (!hit) throw new Error(`Couldn't find "${query}" on the map.`);
  return {
    name: hit.display_name.split(",").slice(0, 2).join(",").trim(),
    fullName: hit.display_name,
    lat: Number(hit.lat),
    lon: Number(hit.lon),
  };
}

// Keeps the first and last point and an even spread in between.
export function samplePoints(points, max) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

export function distanceKm([lat1, lon1], [lat2, lon2]) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

const TURN_TYPES = new Set(["turn", "end of road", "fork", "merge", "on ramp", "off ramp", "roundabout", "rotary", "exit roundabout", "exit rotary"]);

function summarizeRoute(route) {
  let turns = 0;
  let motorwayMeters = 0;
  let toll = false;
  let ferry = false;
  const roads = new Map();

  for (const leg of route.legs) {
    for (const step of leg.steps) {
      const { type, modifier } = step.maneuver;
      if (TURN_TYPES.has(type) && modifier !== "straight") turns += 1;
      const classes = (step.intersections ?? []).flatMap((i) => i.classes ?? []);
      if (classes.includes("motorway")) motorwayMeters += step.distance;
      if (classes.includes("toll")) toll = true;
      if (classes.includes("ferry") || step.mode === "ferry") ferry = true;
      const road = step.ref || step.name;
      if (road) roads.set(road, (roads.get(road) ?? 0) + step.distance);
    }
  }

  const coords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  return {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    turns,
    motorwayShare: route.distance ? motorwayMeters / route.distance : 0,
    toll,
    ferry,
    via: [...roads.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([name]) => name.split(";")[0]),
    coords: samplePoints(coords, 500),
    labels: [],
  };
}

function minBy(items, score) {
  return items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0]);
}

export async function getRoutes(from, to) {
  const path = `/${from.lon},${from.lat};${to.lon},${to.lat}?alternatives=3&overview=full&geometries=geojson&steps=true`;
  let data;
  for (const base of OSRM) {
    try {
      data = await getJson(base + path, {}, 20000);
      break;
    } catch (error) {
      if (base === OSRM[OSRM.length - 1]) throw new Error("The routing service isn't reachable right now.");
    }
  }
  if (data.code !== "Ok" || !data.routes?.length) throw new Error("No driving route was found between these places.");

  const routes = data.routes.map(summarizeRoute);
  minBy(routes, (r) => r.durationMin).labels.push("Fastest");
  // Fewest turns means the least navigating; break ties on time.
  minBy(routes, (r) => r.turns * 1000 + r.durationMin).labels.push("Easiest");
  minBy(routes, (r) => r.distanceKm).labels.push("Shortest");
  if (routes.some((r) => r.toll) && routes.some((r) => !r.toll)) {
    minBy(routes.filter((r) => !r.toll), (r) => r.durationMin).labels.push("No tolls");
  }
  return routes;
}

const SOCKETS = {
  "socket:type2": "Type 2",
  "socket:type2_combo": "CCS",
  "socket:ccs": "CCS",
  "socket:chademo": "CHAdeMO",
  "socket:tesla_supercharger": "Tesla",
  "socket:type1": "Type 1",
  "socket:type1_combo": "CCS1",
  "socket:gb_t": "GB/T",
};

const FUELS = { "fuel:diesel": "Diesel", "fuel:lpg": "LPG", "fuel:cng": "CNG", "fuel:adblue": "AdBlue" };

const STAY_TYPES = { hostel: "Hostel", guest_house: "Guest house", motel: "Motel", hotel: "Hotel", camp_site: "Campsite" };

function describe(kind, t) {
  const parts = [];
  if (kind === "fuel") {
    if (t.brand && t.brand !== t.name) parts.push(t.brand);
    const fuels = Object.entries(FUELS).filter(([key]) => t[key] === "yes").map(([, label]) => label);
    if (fuels.length) parts.push(fuels.join(", "));
  } else if (kind === "ev") {
    const sockets = [...new Set(Object.entries(SOCKETS).filter(([key]) => t[key]).map(([, label]) => label))];
    if (sockets.length) parts.push(sockets.join(" · "));
    if (t.capacity) parts.push(`${t.capacity} bays`);
    if (t.fee === "no") parts.push("Free");
    if (t.operator && t.operator !== t.name) parts.push(t.operator);
  } else if (kind === "viewpoint") {
    if (t.ele) parts.push(`${Math.round(Number(t.ele))} m up`);
    if (t.description) parts.push(t.description);
  } else {
    parts.push(STAY_TYPES[t.tourism] ?? "Stay");
    if (t.stars) parts.push(`${t.stars}★`);
  }
  if (t.opening_hours) parts.push(t.opening_hours === "24/7" ? "Open 24/7" : t.opening_hours);
  return parts.join(" · ");
}

const DEFAULT_NAMES = { fuel: "Fuel station", ev: "EV charger", viewpoint: "Viewpoint", stay: "Place to stay" };

function toPlace(element) {
  const t = element.tags ?? {};
  const kind =
    t.amenity === "fuel" ? "fuel" : t.amenity === "charging_station" ? "ev" : t.tourism === "viewpoint" ? "viewpoint" : "stay";
  return {
    id: `${element.type}/${element.id}`,
    kind,
    lat: element.lat ?? element.center?.lat,
    lon: element.lon ?? element.center?.lon,
    name: t.name || t.brand || t.operator || DEFAULT_NAMES[kind],
    named: Boolean(t.name),
    details: describe(kind, t),
    website: t.website || t["contact:website"] || null,
  };
}

// Fuel pumps, EV chargers, viewpoints and budget-friendly stays along the
// route corridor (when there is a route) and around the destination.
export async function findPlaces({ destination, route }) {
  const dest = `${destination.lat},${destination.lon}`;
  const line = route ? samplePoints(route.coords, 70).map(([lat, lon]) => `${lat.toFixed(4)},${lon.toFixed(4)}`).join(",") : null;
  const near = (tag, corridorM, areaM) =>
    line
      ? `(nwr${tag}(around:${corridorM},${line});nwr${tag}(around:${areaM},${dest}););`
      : `nwr${tag}(around:${areaM},${dest});`;

  const query = `[out:json][timeout:45];
${near('["amenity"="fuel"]', 1500, 6000)}out center 150;
${near('["amenity"="charging_station"]', 2500, 8000)}out center 150;
${near('["tourism"="viewpoint"]', 5000, 25000)}out center 120;
(nwr["tourism"~"^(hostel|guest_house|motel)$"](around:10000,${dest});nwr["tourism"="hotel"]["stars"~"^[12]"](around:10000,${dest}););out center 100;`;

  const data = await getJson(OVERPASS, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  }, 50000);

  const seen = new Set();
  const places = [];
  for (const element of data.elements ?? []) {
    const place = toPlace(element);
    if (place.lat == null || seen.has(place.id)) continue;
    seen.add(place.id);
    places.push(place);
  }
  return places;
}
