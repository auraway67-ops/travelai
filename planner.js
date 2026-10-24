// AURA WAY trip planner (web).
// Uses free, keyless open-data services:
//   Photon (place search) · OSRM (driving routes) · Overpass / OpenStreetMap
//   (viewpoints, stays, EV chargers, fuel) · Open-Meteo (weather).
// The day-by-day itinerary comes from the AURA WAY planner server in server/.

const SERVICES = {
  search: "https://photon.komoot.io/api/",
  reverse: "https://photon.komoot.io/reverse",
  route: "https://router.project-osrm.org/route/v1/driving/",
  overpass: ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"],
  forecast: "https://api.open-meteo.com/v1/forecast",
  archive: "https://archive-api.open-meteo.com/v1/archive",
};

// Planner server: same origin when this page is served by server/, otherwise the default local port.
const PLANNER_API = location.protocol.startsWith("http") && location.port === "8787" ? "" : "http://localhost:8787";

const CATEGORIES = {
  view: { label: "Viewpoints", letter: "V", color: "#7a5bb5" },
  hotel: { label: "Stays", letter: "H", color: "#2f7f8a" },
  ev: { label: "EV chargers", letter: "⚡", color: "#2f6fd0" },
  fuel: { label: "Fuel", letter: "F", color: "#c46a2b" },
};

// Typical prices used to pre-fill the budget. Users can edit every one.
const PRICE_PRESETS = {
  AED: { fuel: 2.7, kwh: 0.8, hotel: 250, food: 90 },
  USD: { fuel: 0.95, kwh: 0.4, hotel: 95, food: 40 },
  EUR: { fuel: 1.75, kwh: 0.5, hotel: 85, food: 35 },
  GBP: { fuel: 1.4, kwh: 0.7, hotel: 80, food: 30 },
  INR: { fuel: 103, kwh: 18, hotel: 2200, food: 800 },
  SAR: { fuel: 2.33, kwh: 0.75, hotel: 230, food: 80 },
};

const state = {
  places: { from: null, to: null },
  routes: [],
  selected: 0,
  pois: { view: [], hotel: [], ev: [], fuel: [] },
  poiCache: new Map(),
  stopFilter: new Set(["view", "ev", "fuel"]),
  weather: null,
  weatherVerdict: "",
  runId: 0,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const panel = (name) => $(`[data-panel="${name}"]`);

// ---------- Map ----------

let map, routeLayer, endsLayer;
const poiLayers = {};

function initMap() {
  map = L.map("map", { zoomControl: true }).setView([25.2, 55.3], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  endsLayer = L.layerGroup().addTo(map);
  const overlays = {};
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    poiLayers[key] = L.layerGroup().addTo(map);
    overlays[`<span style="color:${cat.color};font-weight:700">●</span> ${cat.label}`] = poiLayers[key];
  }
  L.control.layers(null, overlays, { collapsed: window.innerWidth < 860 }).addTo(map);
}

function poiIcon(kind) {
  const cat = CATEGORIES[kind];
  return L.divIcon({
    className: "",
    html: `<span class="poi-marker" style="background:${cat.color}">${cat.letter}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function drawRoutes() {
  routeLayer.clearLayers();
  endsLayer.clearLayers();
  state.routes.forEach((route, i) => {
    if (i === state.selected) return;
    L.polyline(route.latlngs, { color: "#7d8a80", weight: 5, opacity: 0.55 })
      .on("click", () => selectRoute(i))
      .bindTooltip(`${route.labels.join(" · ") || "Alternative"} — click to choose`, { sticky: true })
      .addTo(routeLayer);
  });
  const sel = state.routes[state.selected];
  if (sel) {
    L.polyline(sel.latlngs, { color: "#17211e", weight: 9, opacity: 0.9 }).addTo(routeLayer);
    L.polyline(sel.latlngs, { color: "#d9f06a", weight: 4 }).addTo(routeLayer);
  }
  const { from, to } = state.places;
  const end = (place, dest) =>
    L.marker([place.lat, place.lon], {
      icon: L.divIcon({ className: "", html: `<span class="end-marker${dest ? " is-dest" : ""}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] }),
      zIndexOffset: 1000,
    }).bindPopup(`<strong>${esc(place.name)}</strong><br>${dest ? "Destination" : "Start"}`);
  if (from) end(from, false).addTo(endsLayer);
  if (to) end(to, true).addTo(endsLayer);
}

function drawPois() {
  for (const [kind, layer] of Object.entries(poiLayers)) {
    layer.clearLayers();
    for (const p of state.pois[kind]) {
      p.marker = L.marker([p.lat, p.lon], { icon: poiIcon(kind) }).bindPopup(poiPopup(p)).addTo(layer);
    }
  }
}

function poiPopup(p) {
  const bits = [`<strong>${esc(p.name)}</strong>`, esc(p.detail)];
  if (p.km != null) bits.push(`About ${Math.round(p.km)} km into the drive`);
  bits.push(`<a href="${gmapsLink(p)}" target="_blank" rel="noopener">Directions ↗</a>`);
  return bits.filter(Boolean).join("<br>");
}

const gmapsLink = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;

function focusPoi(p) {
  map.setView([p.lat, p.lon], Math.max(map.getZoom(), 14));
  p.marker?.openPopup();
  if (window.innerWidth < 860) $("#map").scrollIntoView({ behavior: "smooth" });
}

// ---------- Place search ----------

function placeFromFeature(f) {
  const p = f.properties;
  const name = p.name || p.street || p.city || "Selected place";
  const area = [p.city !== name ? p.city : null, p.state, p.country].filter(Boolean).join(", ");
  return { name, area, label: area ? `${name}, ${area}` : name, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], countryCode: p.countrycode };
}

async function searchPlaces(query, limit = 5) {
  const url = `${SERVICES.search}?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Place search is unavailable right now.");
  const data = await res.json();
  return data.features.map(placeFromFeature);
}

function setupAutocomplete(key) {
  const input = $(`#${key}`);
  const list = $(`.suggestions[data-for="${key}"]`);
  let timer, results = [], active = -1;

  const close = () => { list.innerHTML = ""; results = []; active = -1; };
  const choose = (place) => {
    state.places[key] = place;
    input.value = place.label;
    close();
  };
  const render = () => {
    list.innerHTML = results
      .map((r, i) => `<li data-i="${i}" class="${i === active ? "is-active" : ""}">${esc(r.name)}<small>${esc(r.area)}</small></li>`)
      .join("");
  };

  input.addEventListener("input", () => {
    state.places[key] = null;
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 3) return close();
    timer = setTimeout(async () => {
      try {
        results = await searchPlaces(q);
        active = -1;
        if (input.value.trim() === q) render();
      } catch {
        close();
      }
    }, 300);
  });
  input.addEventListener("keydown", (e) => {
    if (!results.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
      render();
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") close();
  });
  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li");
    if (li) { e.preventDefault(); choose(results[Number(li.dataset.i)]); }
  });
  input.addEventListener("blur", () => setTimeout(close, 150));
}

async function resolvePlace(key) {
  if (state.places[key]) return state.places[key];
  const q = $(`#${key}`).value.trim();
  const [first] = await searchPlaces(q, 1);
  if (!first) throw new Error(`Couldn't find "${q}". Try a nearby town or a fuller address.`);
  state.places[key] = first;
  $(`#${key}`).value = first.label;
  return first;
}

function useMyLocation() {
  if (!navigator.geolocation) return showFormMsg("Your browser can't share its location.", true);
  showFormMsg("Finding you…");
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      let place = { name: "My location", area: "", label: "My location", lat: coords.latitude, lon: coords.longitude };
      try {
        const res = await fetch(`${SERVICES.reverse}?lat=${coords.latitude}&lon=${coords.longitude}`);
        const f = (await res.json()).features?.[0];
        if (f) place = { ...placeFromFeature(f), lat: coords.latitude, lon: coords.longitude };
      } catch { /* keep the plain coordinates */ }
      state.places.from = place;
      $("#from").value = place.label;
      showFormMsg("");
    },
    () => showFormMsg("Location access was blocked. Type your starting point instead.", true),
    { timeout: 10000 },
  );
}

// ---------- Geometry ----------

function haversineKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Evenly spaced points along the route, each with its distance from the start.
function sampleRoute(latlngs, count) {
  const cum = [0];
  for (let i = 1; i < latlngs.length; i++) cum.push(cum[i - 1] + haversineKm(latlngs[i - 1], latlngs[i]));
  const total = cum[cum.length - 1];
  const out = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const target = (total * k) / (count - 1);
    while (j < cum.length - 1 && cum[j] < target) j++;
    out.push({ lat: latlngs[j][0], lon: latlngs[j][1], km: cum[j] });
  }
  return out;
}

function nearestAlong(samples, lat, lon) {
  let best = null, bestD = Infinity;
  for (const s of samples) {
    const d = haversineKm([lat, lon], [s.lat, s.lon]);
    if (d < bestD) { bestD = d; best = s; }
  }
  return { km: best.km, offKm: bestD };
}

// ---------- Routes ----------

const TURN_TYPES = new Set(["turn", "fork", "end of road", "roundabout", "rotary", "roundabout turn", "exit roundabout", "exit rotary", "on ramp", "off ramp", "merge"]);

async function fetchRoutes(from, to) {
  const url = `${SERVICES.route}${from.lon},${from.lat};${to.lon},${to.lat}?alternatives=3&steps=true&geometries=geojson&overview=full`;
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("The routing service couldn't be reached. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.code !== "Ok" || !data.routes?.length) {
    throw new Error(data?.code === "NoRoute" ? "There's no drivable route between these places." : "Couldn't find a route. Try places closer to a road.");
  }
  const routes = data.routes.map((r) => {
    const steps = r.legs.flatMap((l) => l.steps);
    const turns = steps.filter((s) => TURN_TYPES.has(s.maneuver.type)).length;
    const roads = [...new Set(steps.filter((s) => s.distance > 15000 && (s.ref || s.name)).map((s) => s.ref || s.name))].slice(0, 4);
    return {
      km: r.distance / 1000,
      minutes: r.duration / 60,
      turns,
      roads,
      avgSpeed: r.distance / 1000 / (r.duration / 3600),
      latlngs: r.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
      labels: [],
    };
  });
  const tag = (pick, label) => pick.labels.push(label);
  tag(routes.reduce((a, b) => (b.minutes < a.minutes ? b : a)), "Fastest");
  if (routes.length > 1) {
    tag(routes.reduce((a, b) => (b.km < a.km ? b : a)), "Shortest");
    tag(routes.reduce((a, b) => (b.turns / b.km < a.turns / a.km ? b : a)), "Easiest drive");
  } else {
    routes[0].labels.push("Easiest drive");
  }
  return routes;
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

function renderRoutes() {
  const el = panel("routes");
  $('[data-count="routes"]').textContent = state.routes.length || "";
  el.innerHTML =
    state.routes
      .map((r, i) => {
        const breaks = Math.floor(r.minutes / 120);
        return `<button type="button" class="card route-card${i === state.selected ? " is-selected" : ""}" data-route="${i}">
          <div class="route-head"><strong>${formatDuration(r.minutes)}</strong><span>${Math.round(r.km)} km</span></div>
          <div class="route-meta">
            ${r.labels.map((l) => `<span class="tag tag-lime">${l}</span>`).join("")}
            <span class="tag">${r.turns} turns</span>
            <span class="tag">avg ${Math.round(r.avgSpeed)} km/h</span>
          </div>
          ${r.roads.length ? `<p>Mostly via ${esc(r.roads.join(", "))}</p>` : ""}
          ${breaks ? `<p>Plan about ${breaks} rest break${breaks > 1 ? "s" : ""} — one every 2 hours keeps drivers alert.</p>` : ""}
        </button>`;
      })
      .join("") +
    `<p class="kicker">"Easiest" has the fewest turns per km. Times don't include live traffic.</p>`;
}

function selectRoute(i) {
  if (i === state.selected) return;
  state.selected = i;
  drawRoutes();
  renderRoutes();
  renderBudget();
  loadPois(state.runId);
}

// ---------- Stops & stays (OpenStreetMap via Overpass) ----------

async function overpass(query) {
  let lastError;
  for (const endpoint of SERVICES.overpass) {
    try {
      const res = await fetch(endpoint, { method: "POST", body: new URLSearchParams({ data: query }) });
      if (res.ok) return (await res.json()).elements;
      lastError = new Error(`Overpass ${res.status}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

function poiFromElement(el, kind) {
  const t = el.tags || {};
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
  if (lat == null) return null;
  let name = t.name || t.brand || t.operator;
  let detail = "";
  let budgetRank = 0;
  if (kind === "fuel") {
    name ||= "Fuel station";
    const fuels = ["diesel", "octane_95", "octane_98", "lpg"].filter((f) => t[`fuel:${f}`] === "yes").map((f) => f.replace("octane_", "").toUpperCase());
    detail = [t.opening_hours === "24/7" ? "Open 24/7" : null, fuels.length ? fuels.join(" · ") : null, t.shop ? "Shop" : null].filter(Boolean).join(" · ");
  } else if (kind === "ev") {
    name ||= "EV charger";
    const sockets = Object.keys(t).filter((k) => /^socket:[^:]+$/.test(k)).map((k) => k.slice(7).replace(/_/g, " "));
    detail = [t.capacity ? `${t.capacity} spots` : null, sockets.length ? sockets.slice(0, 3).join(", ") : null, t.fee === "no" ? "Free" : null, t.opening_hours === "24/7" ? "24/7" : null].filter(Boolean).join(" · ");
  } else if (kind === "view") {
    name ||= "Scenic viewpoint";
    detail = t.description || (t.ele ? `${t.ele} m elevation` : "Scenic spot");
  } else {
    const type = t.tourism;
    const stars = Number(t.stars) || null;
    name ||= type.replace("_", " ");
    // Lower rank = more budget-friendly. OSM has no prices, so we use the type of stay and star rating.
    budgetRank = { hostel: 0, guest_house: 1, motel: 1, hotel: stars ? stars : 3 }[type] ?? 3;
    detail = [type.replace("_", " "), stars ? `${"★".repeat(Math.min(stars, 5))}` : null, t.internet_access === "wlan" ? "Wi-Fi" : null].filter(Boolean).join(" · ");
  }
  return { id: `${el.type}${el.id}`, kind, name, detail, lat, lon, budgetRank, website: t.website || t["contact:website"] || null };
}

async function loadPois(runId) {
  const route = state.routes[state.selected];
  const key = `${runId}:${state.selected}`;
  const stopsEl = panel("stops"), staysEl = panel("stays");
  if (state.poiCache.has(key)) {
    state.pois = state.poiCache.get(key);
    drawPois(); renderStops(); renderStays();
    return;
  }
  stopsEl.innerHTML = `<div class="status">Finding viewpoints, chargers and fuel along your route…</div>`;
  staysEl.innerHTML = `<div class="status">Looking for budget-friendly stays…</div>`;
  state.pois = { view: [], hotel: [], ev: [], fuel: [] };
  drawPois();

  const samples = sampleRoute(route.latlngs, 300);
  const line = sampleRoute(route.latlngs, Math.min(120, Math.max(20, Math.round(route.km / 4))))
    .map((s) => `${s.lat.toFixed(5)},${s.lon.toFixed(5)}`).join(",");
  const to = state.places.to;
  const mid = samples[Math.floor(samples.length / 2)];
  const stayTypes = '["tourism"~"^(hotel|motel|hostel|guest_house)$"]';

  const stopsQuery = `[out:json][timeout:60];(nwr(around:2000,${line})["amenity"="fuel"];nwr(around:2000,${line})["amenity"="charging_station"];nwr(around:5000,${line})["tourism"="viewpoint"];);out center tags 600;`;
  const staysQuery = `[out:json][timeout:40];(nwr(around:6000,${to.lat},${to.lon})${stayTypes};${route.km > 450 ? `nwr(around:8000,${mid.lat},${mid.lon})${stayTypes};` : ""});out center tags 250;`;

  const kindOf = (t) => (t.amenity === "fuel" ? "fuel" : t.amenity === "charging_station" ? "ev" : t.tourism === "viewpoint" ? "view" : "hotel");
  const collect = (elements) => {
    const seen = new Set();
    for (const el of elements) {
      const p = poiFromElement(el, kindOf(el.tags || {}));
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      Object.assign(p, nearestAlong(samples, p.lat, p.lon));
      state.pois[p.kind].push(p);
    }
  };

  // Overpass allows few parallel requests per user, so these run one after the other.
  let stopsError = null, staysError = null;
  try { collect(await overpass(stopsQuery)); } catch (e) { stopsError = e; }
  if (runId !== state.runId) return;
  try { collect(await overpass(staysQuery)); } catch (e) { staysError = e; }
  if (runId !== state.runId) return;

  for (const k of ["view", "ev", "fuel"]) state.pois[k].sort((a, b) => a.km - b.km);
  const destKm = route.km;
  state.pois.hotel.forEach((h) => (h.overnight = destKm - h.km > 50));
  state.pois.hotel.sort((a, b) => a.overnight - b.overnight || a.budgetRank - b.budgetRank || haversineKm([a.lat, a.lon], [to.lat, to.lon]) - haversineKm([b.lat, b.lon], [to.lat, to.lon]));
  state.pois.stopsError = stopsError;
  state.pois.staysError = staysError;
  state.poiCache.set(key, state.pois);
  drawPois(); renderStops(); renderStays();
}

function longestGap(list, totalKm) {
  const kms = [0, ...list.map((p) => p.km), totalKm];
  let gap = 0, at = 0;
  for (let i = 1; i < kms.length; i++) if (kms[i] - kms[i - 1] > gap) { gap = kms[i] - kms[i - 1]; at = kms[i - 1]; }
  return { gap, at };
}

function rangeNote() {
  const route = state.routes[state.selected];
  const ev = $("#vehicle").value === "ev";
  const kind = ev ? "ev" : "fuel";
  const range = Number($("#range").value) || 0;
  const { gap, at } = longestGap(state.pois[kind], route.km);
  const what = ev ? "charger" : "fuel station";
  if (route.km < range * 0.7) {
    return `<div class="verdict verdict-ok"><strong>Range is fine</strong><span>The whole drive (${Math.round(route.km)} km) fits in one ${ev ? "charge" : "tank"}. Top up before you leave.</span></div>`;
  }
  const level = gap > range * 0.8 ? "bad" : gap > range * 0.55 ? "warn" : "ok";
  const msg = {
    ok: `Longest stretch without a ${what} is ${Math.round(gap)} km, well within your ${range} km range.`,
    warn: `Longest stretch without a ${what} is ${Math.round(gap)} km (from about km ${Math.round(at)}). Fill up before that stretch.`,
    bad: `There's a ${Math.round(gap)} km stretch with no ${what} we know of (from about km ${Math.round(at)}), close to or over your ${range} km range. Plan a full ${ev ? "charge" : "tank"} before it or pick another route.`,
  }[level];
  return `<div class="verdict verdict-${level}"><strong>${{ ok: "Range is fine", warn: "Plan your top-ups", bad: "Range risk" }[level]}</strong><span>${msg}</span></div>`;
}

function poiItem(p) {
  const off = p.offKm > 0.4 ? ` · ${p.offKm.toFixed(1)} km off route` : "";
  return `<li class="poi" data-poi="${esc(p.id)}">
    <span class="dot dot-${p.kind}"></span>
    <span><strong>${esc(p.name)}</strong><small>${esc(p.detail)}${off}</small></span>
    <span class="km">km ${Math.round(p.km)}</span>
  </li>`;
}

function renderStops() {
  const el = panel("stops");
  const { view, ev, fuel } = state.pois;
  $('[data-count="stops"]').textContent = view.length + ev.length + fuel.length || "";
  const chips = ["view", "ev", "fuel"]
    .map((k) => `<button type="button" class="chip" data-filter="${k}" aria-pressed="${state.stopFilter.has(k)}"><i class="dot dot-${k}"></i>${CATEGORIES[k].label} ${state.pois[k].length}</button>`)
    .join("");
  const shown = ["view", "ev", "fuel"].filter((k) => state.stopFilter.has(k)).flatMap((k) => state.pois[k]).sort((a, b) => a.km - b.km);
  el.innerHTML = `
    ${state.pois.stopsError ? `<div class="error">The stops service is busy, so this list may be incomplete. Try choosing the route again in a minute.</div>` : ""}
    ${rangeNote()}
    <div class="filters">${chips}</div>
    ${shown.length ? `<ul class="poi-list">${shown.slice(0, 250).map(poiItem).join("")}</ul>` : `<div class="empty">Nothing in these categories along this route on OpenStreetMap.</div>`}
    <p class="kicker">Data from OpenStreetMap. Check opening hours before you rely on a stop.</p>`;
}

function renderStays() {
  const el = panel("stays");
  const hotels = state.pois.hotel;
  $('[data-count="stays"]').textContent = hotels.length || "";
  const dest = hotels.filter((h) => !h.overnight), overnight = hotels.filter((h) => h.overnight);
  const tier = (r) => (r <= 1 ? `<span class="tag tag-ok">Budget</span>` : r <= 3 ? `<span class="tag">Mid-range</span>` : `<span class="tag tag-warn">Upscale</span>`);
  const item = (h) => `<li class="poi" data-poi="${esc(h.id)}">
      <span class="dot dot-hotel"></span>
      <span><strong>${esc(h.name)}</strong><small>${esc(h.detail)}</small></span>
      <span style="display:grid;gap:4px;justify-items:end">${tier(h.budgetRank)}<a href="https://www.google.com/search?q=${encodeURIComponent(`${h.name} ${state.places.to?.name ?? ""} price`)}" target="_blank" rel="noopener">Prices ↗</a></span>
    </li>`;
  el.innerHTML = `
    ${state.pois.staysError ? `<div class="error">The stays service is busy, so this list may be incomplete.</div>` : ""}
    <p class="kicker">Near ${esc(state.places.to?.name)} · cheapest types first</p>
    ${dest.length ? `<ul class="poi-list">${dest.slice(0, 60).map(item).join("")}</ul>` : `<div class="empty">No stays mapped near your destination on OpenStreetMap.</div>`}
    ${overnight.length ? `<p class="kicker">Overnight stop halfway (long drive)</p><ul class="poi-list">${overnight.slice(0, 20).map(item).join("")}</ul>` : ""}
    <p class="kicker">Budget level is based on the type of stay and star rating. Check live prices before you book.</p>`;
}

// ---------- Weather & travel safety (Open-Meteo) ----------

const WMO = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Freezing fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Showers", 81: "Showers", 82: "Violent showers",
  85: "Snow showers", 86: "Heavy snow showers", 95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
};

function dayRisk(d) {
  const reasons = [];
  let level = 0;
  const flag = (l, why) => { level = Math.max(level, l); reasons.push(why); };
  if (d.code >= 95) flag(2, "thunderstorms");
  if ([56, 57, 66, 67, 48].includes(d.code)) flag(2, "icy roads likely");
  if ((d.code >= 71 && d.code <= 77) || d.code === 85 || d.code === 86) flag(2, "snow");
  if (d.code === 82) flag(2, "violent showers");
  if (d.code === 45) flag(1, "fog, low visibility");
  if (d.rain >= 25) flag(2, `${Math.round(d.rain)} mm of rain`);
  else if (d.rain >= 8) flag(1, `${Math.round(d.rain)} mm of rain`);
  if (d.wind >= 60) flag(2, `gusty winds up to ${Math.round(d.wind)} km/h`);
  else if (d.wind >= 40) flag(1, `strong winds (${Math.round(d.wind)} km/h)`);
  if (d.max >= 45) flag(2, `extreme heat (${Math.round(d.max)}°C)`);
  else if (d.max >= 40) flag(1, `very hot (${Math.round(d.max)}°C)`);
  if (d.min <= -8) flag(2, `severe cold (${Math.round(d.min)}°C)`);
  else if (d.min <= 0) flag(1, "frost possible");
  return { level, reasons };
}

const isoDate = (d) => d.toISOString().slice(0, 10);

async function loadWeather(runId) {
  const el = panel("weather");
  el.innerHTML = `<div class="status">Checking the weather for your dates…</div>`;
  const route = state.routes[state.selected];
  const s = sampleRoute(route.latlngs, 3);
  const spots = [
    { name: state.places.from.name, lat: s[0].lat, lon: s[0].lon },
    ...(route.km > 150 ? [{ name: "Halfway", lat: s[1].lat, lon: s[1].lon }] : []),
    { name: state.places.to.name, lat: s[2].lat, lon: s[2].lon },
  ];
  const start = new Date(`${$("#date").value}T00:00:00Z`);
  const nights = Math.min(Number($("#nights").value) || 0, 15);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + nights);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const forecastLimit = new Date(today); forecastLimit.setUTCDate(forecastLimit.getUTCDate() + 15);

  // Forecasts go about 16 days ahead. Further out, show the same dates last year as a guide.
  const typical = start > forecastLimit;
  let qStart = start, qEnd = end > forecastLimit && !typical ? forecastLimit : end;
  if (typical) {
    qStart = new Date(start); qStart.setUTCFullYear(qStart.getUTCFullYear() - 1);
    qEnd = new Date(end); qEnd.setUTCFullYear(qEnd.getUTCFullYear() - 1);
  }
  const params = new URLSearchParams({
    latitude: spots.map((p) => p.lat.toFixed(4)).join(","),
    longitude: spots.map((p) => p.lon.toFixed(4)).join(","),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max",
    timezone: "auto",
    start_date: isoDate(qStart),
    end_date: isoDate(qEnd),
  });
  try {
    const res = await fetch(`${typical ? SERVICES.archive : SERVICES.forecast}?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.reason || "Weather unavailable");
    if (runId !== state.runId) return;
    const list = Array.isArray(data) ? data : [data];
    state.weather = spots.map((spot, i) => {
      const d = list[i].daily;
      // Travel days for the drive are the first and last day; the destination matters for the whole stay.
      return {
        ...spot,
        days: d.time.map((t, j) => {
          const day = { date: t, code: d.weather_code[j], max: d.temperature_2m_max[j], min: d.temperature_2m_min[j], rain: d.precipitation_sum[j] ?? 0, wind: d.wind_gusts_10m_max[j] ?? 0 };
          return { ...day, ...dayRisk(day) };
        }),
      };
    });
    renderWeather(typical);
  } catch (e) {
    if (runId !== state.runId) return;
    el.innerHTML = `<div class="error">Couldn't load the weather (${esc(e.message)}). Try again shortly.</div>`;
  }
}

function renderWeather(typical) {
  const el = panel("weather");
  const all = state.weather.flatMap((p) => p.days.map((d) => ({ ...d, place: p.name })));
  const worst = Math.max(...all.map((d) => d.level));
  const issues = all.filter((d) => d.level === worst && worst > 0).slice(0, 3)
    .map((d) => `${d.place} on ${fmtDay(d.date, typical)}: ${d.reasons.join(", ")}`);
  const verdict = [
    { cls: "ok", title: "Good conditions for travel", text: "No severe weather expected along your route for these dates." },
    { cls: "warn", title: "Travel with care", text: issues.join(". ") + ". Drive slower, leave more gap and carry water." },
    { cls: "bad", title: "Unsafe weather possible", text: issues.join(". ") + ". Consider moving your dates or waiting it out before driving." },
  ][worst];
  state.weatherVerdict = `${verdict.title}. ${verdict.text}`;
  el.innerHTML = `
    <div class="verdict verdict-${verdict.cls}"><strong>${verdict.title}</strong><span>${esc(verdict.text)}</span></div>
    ${typical ? `<p class="kicker">Your trip is more than 2 weeks away, so this shows the same dates last year as a guide. Check again closer to the day.</p>` : ""}
    ${state.weather.map((p) => `
      <div class="card wx-place"><h3>${esc(p.name)}</h3><div class="wx-days">
        ${p.days.map((d) => `<div class="wx-day">
          <span class="when">${fmtDay(d.date, typical)}</span>
          <span>${esc(WMO[d.code] ?? "—")}${d.level ? ` <span class="tag tag-${d.level === 2 ? "bad" : "warn"}">${esc(d.reasons[0])}</span>` : ""}</span>
          <span class="temps">${Math.round(d.max)}° / ${Math.round(d.min)}°</span>
        </div>`).join("")}
      </div></div>`).join("")}
    <p class="kicker">Weather from Open-Meteo.</p>`;
}

function fmtDay(iso, typical) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (typical) d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

// ---------- Budget ----------

function money(amount) {
  const currency = $("#currency").value;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(Math.round(amount));
  } catch {
    return `${Math.round(amount).toLocaleString()} ${currency}`;
  }
}

function applyPricePresets() {
  const p = PRICE_PRESETS[$("#currency").value];
  const ev = $("#vehicle").value === "ev";
  $("#energy-price").value = ev ? p.kwh : p.fuel;
  $("#hotel-price").value = p.hotel;
  $("#food-price").value = p.food;
}

function syncVehicleFields() {
  const ev = $("#vehicle").value === "ev";
  const diesel = $("#vehicle").value === "diesel";
  $("#consumption-label").textContent = ev ? "Energy use (kWh / 100 km)" : "Fuel use (L / 100 km)";
  $("#energy-price-label").textContent = ev ? "Charging price (per kWh)" : "Fuel price (per litre)";
  $("#consumption").value = ev ? 18 : diesel ? 6.5 : 8;
  $("#range").value = ev ? 380 : diesel ? 800 : 550;
  applyPricePresets();
  state.stopFilter = new Set(["view", ev ? "ev" : "fuel"]);
}

function renderBudget() {
  const out = $("#budget-out");
  const route = state.routes[state.selected];
  if (!route) {
    out.innerHTML = `<div class="empty">Plan a route to see what the trip will cost.</div>`;
    return;
  }
  const num = (id) => Math.max(0, Number($(`#${id}`).value) || 0);
  const ev = $("#vehicle").value === "ev";
  const km = route.km * ($("#return-trip").checked ? 2 : 1);
  const travelers = Math.max(1, num("travelers"));
  const nights = num("nights");
  const days = nights + 1;
  const energy = (km / 100) * num("consumption") * num("energy-price");
  const stay = nights * num("rooms") * num("hotel-price");
  const food = days * travelers * num("food-price");
  const extras = num("extras");
  const total = energy + stay + food + extras;
  const fuelUnits = (km / 100) * num("consumption");
  out.innerHTML = `
    <div class="card"><ul class="budget-lines">
      <li><span>${ev ? "Charging" : "Fuel"}<small>${Math.round(km)} km · ~${Math.round(fuelUnits)} ${ev ? "kWh" : "L"}</small></span><strong>${money(energy)}</strong></li>
      <li><span>Stays<small>${nights} night${nights === 1 ? "" : "s"} × ${num("rooms")} room${num("rooms") === 1 ? "" : "s"}</small></span><strong>${money(stay)}</strong></li>
      <li><span>Food<small>${days} day${days === 1 ? "" : "s"} × ${travelers} traveller${travelers === 1 ? "" : "s"}</small></span><strong>${money(food)}</strong></li>
      <li><span>Tolls, parking, tickets</span><strong>${money(extras)}</strong></li>
    </ul></div>
    <div class="budget-total"><span>Estimated total<small>${money(total / travelers)} per person</small></span><strong>${money(total)}</strong></div>
    <div class="card"><h3>Ways to spend less</h3><ul class="bullets">
      ${ev ? "<li>Charge at your hotel overnight; home or hotel charging is usually far cheaper than fast chargers.</li>" : "<li>Fill up away from motorway service areas, which often charge more.</li>"}
      <li>Guest houses and hostels in the Stays tab are the cheapest places to sleep.</li>
      ${travelers > 1 ? `<li>Sharing the car already saves ${money(energy - energy / travelers)} on ${ev ? "charging" : "fuel"} compared with each person driving alone.</li>` : ""}
      <li>Book stays a few weeks ahead; prices often rise close to the date.</li>
    </ul></div>`;
}

// ---------- Itinerary (AURA WAY planner server) ----------

async function buildItinerary() {
  const out = $("#plan-out");
  const btn = $("#itinerary-btn");
  const { from, to } = state.places;
  if (!to) {
    out.innerHTML = `<div class="error">Plan a route first so the itinerary knows where you're going.</div>`;
    return;
  }
  const route = state.routes[state.selected];
  const ev = $("#vehicle").value === "ev";
  const views = state.pois.view.slice(0, 8).map((v) => v.name).filter((n) => n !== "Scenic viewpoint");
  const notes = [
    `Travelling by ${ev ? "electric car" : "car"}: ${Math.round(route.km)} km, about ${formatDuration(route.minutes)} each way.`,
    views.length ? `Viewpoints on the way: ${views.join(", ")}.` : null,
    state.weatherVerdict ? `Weather check for these dates: ${state.weatherVerdict}` : null,
    $("#notes").value.trim() || null,
  ].filter(Boolean).join(" ");

  const input = {
    destination: to.label,
    origin: from?.label,
    startDate: $("#date").value,
    days: Math.min(21, Math.max(1, (Number($("#nights").value) || 0) + 1)),
    travelers: Math.min(20, Math.max(1, Number($("#travelers").value) || 1)),
    budget: $("#budget-level").value,
    pace: $("#pace").value,
    interests: $$("#interests .chip[aria-pressed='true']").map((c) => c.dataset.interest),
    notes: notes.slice(0, 500),
  };

  btn.disabled = true;
  out.innerHTML = `<div class="status">Planning every day of your trip… this can take a minute.</div>`;
  try {
    let res;
    try {
      res = await fetch(`${PLANNER_API}/api/plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    } catch {
      throw new Error("The itinerary planner isn't running. Start it with \"npm start\" in the server folder, then open http://localhost:8787.");
    }
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.trip) throw new Error(body?.error ?? `The planner returned an error (${res.status}).`);
    renderItinerary(body.trip);
  } catch (e) {
    out.innerHTML = `<div class="error">${esc(e.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
}

function renderItinerary(trip) {
  const cur = trip.currency;
  const fmt = (n) => {
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n); }
    catch { return `${Math.round(n)} ${cur}`; }
  };
  $("#plan-out").innerHTML = `
    <div class="card"><h3>${esc(trip.title)}</h3><p>${esc(trip.summary)}</p>
      <div class="route-meta" style="margin-top:10px"><span class="tag tag-lime">About ${fmt(trip.totalEstimate)} total</span>${trip.bestFor.map((b) => `<span class="tag">${esc(b)}</span>`).join("")}</div></div>
    ${trip.days.map((d) => `
      <div class="card plan-day"><h3>Day ${d.day}: ${esc(d.theme)}<small>${esc(d.date)}</small></h3>
        ${d.items.map((it) => `<div class="plan-item"><time>${esc(it.time)}</time><div><strong>${esc(it.title)}</strong>${it.cost ? ` · ${fmt(it.cost)}` : ""}<p>${esc(it.description)}</p>${it.location ? `<small style="color:var(--muted)">${esc(it.location)}</small>` : ""}</div></div>`).join("")}
      </div>`).join("")}
    <div class="card"><h3>Where to stay</h3><ul class="bullets">${trip.stays.map((s) => `<li><strong>${esc(s.name)}</strong> (${esc(s.area)}) · ~${fmt(s.nightlyPrice)}/night — ${esc(s.why)}</li>`).join("")}</ul></div>
    <div class="card"><h3>Budget</h3><ul class="budget-lines">${trip.budget.map((b) => `<li><span>${esc(b.category)}<small>${esc(b.note)}</small></span><strong>${fmt(b.amount)}</strong></li>`).join("")}</ul></div>
    <div class="card"><h3>Packing list</h3><ul class="bullets">${trip.packing.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
    <div class="card"><h3>Tips</h3><ul class="bullets">${trip.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
    <div class="card"><h3>Before you go</h3><ul class="bullets">${trip.checklist.map((c) => `<li>${esc(c.task)} <small>(${esc(c.when)})</small></li>`).join("")}</ul></div>`;
}

// ---------- Flow ----------

function showFormMsg(text, isError) {
  $("#form-msg").innerHTML = text ? `<div class="${isError ? "error" : "status"}">${esc(text)}</div>` : "";
}

function showTab(name) {
  $$(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
  $$(".tab-panel").forEach((p) => (p.hidden = p.dataset.panel !== name));
}

async function planTrip(e) {
  e.preventDefault();
  const runId = ++state.runId;
  const btn = $("#plan-btn");
  btn.disabled = true;
  showFormMsg("Finding your routes…");
  try {
    const [from, to] = await Promise.all([resolvePlace("from"), resolvePlace("to")]);
    const routes = await fetchRoutes(from, to);
    if (runId !== state.runId) return;
    state.routes = routes;
    state.selected = routes.findIndex((r) => r.labels.includes("Easiest drive"));
    state.poiCache.clear();
    state.weatherVerdict = "";
    showFormMsg("");
    drawRoutes();
    map.fitBounds(L.latLngBounds(routes.flatMap((r) => r.latlngs)), { padding: [30, 30] });
    renderRoutes();
    renderBudget();
    showTab("routes");
    loadWeather(runId);
    loadPois(runId);
  } catch (err) {
    showFormMsg(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

function init() {
  initMap();
  setupAutocomplete("from");
  setupAutocomplete("to");

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  $("#date").value = isoDate(tomorrow);
  $("#date").min = isoDate(new Date());
  applyPricePresets();
  renderBudget();

  $("#trip-form").addEventListener("submit", planTrip);
  $("#locate").addEventListener("click", useMyLocation);
  $("#swap").addEventListener("click", () => {
    [state.places.from, state.places.to] = [state.places.to, state.places.from];
    [$("#from").value, $("#to").value] = [$("#to").value, $("#from").value];
  });
  $$(".tab").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));

  $(".panel").addEventListener("click", (e) => {
    const routeBtn = e.target.closest("[data-route]");
    if (routeBtn) return selectRoute(Number(routeBtn.dataset.route));
    const filter = e.target.closest("[data-filter]");
    if (filter) {
      const k = filter.dataset.filter;
      state.stopFilter.has(k) ? state.stopFilter.delete(k) : state.stopFilter.add(k);
      return renderStops();
    }
    const chip = e.target.closest("#interests .chip");
    if (chip) return chip.setAttribute("aria-pressed", String(chip.getAttribute("aria-pressed") !== "true"));
    const poi = e.target.closest("[data-poi]");
    if (poi && !e.target.closest("a")) {
      const p = Object.values(state.pois).flat().find((x) => x?.id === poi.dataset.poi);
      if (p) focusPoi(p);
    }
  });

  $("#vehicle").addEventListener("change", () => {
    syncVehicleFields();
    renderBudget();
    if (state.routes.length) renderStops();
  });
  $("#range").addEventListener("change", () => state.routes.length && renderStops());
  $("#currency").addEventListener("change", () => { applyPricePresets(); renderBudget(); });
  $$("[data-panel='budget'] input, #nights, #travelers").forEach((el) => el.addEventListener("input", renderBudget));
  $("#itinerary-btn").addEventListener("click", buildItinerary);
}

document.addEventListener("DOMContentLoaded", init);
