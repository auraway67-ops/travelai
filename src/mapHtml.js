// Self-contained Leaflet page for the interactive trip map. Rendered in a
// WebView on iOS/Android and an iframe on web.

export const PLACE_KINDS = {
  ev: { label: "EV chargers", color: "#2f7fb5", symbol: "⚡" },
  fuel: { label: "Fuel pumps", color: "#c7782f", symbol: "⛽" },
  viewpoint: { label: "Viewpoints", color: "#7a5aa8", symbol: "👁" },
  stay: { label: "Budget stays", color: "#2a8a7a", symbol: "⌂" },
};

export function mapsUrl(lat, lon, name) {
  const query = name ? `${name} ${lat},${lon}` : `${lat},${lon}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function buildMapHtml({ context, selectedRoute, hiddenKinds = [] }) {
  const data = {
    origin: context.origin,
    destination: context.destination,
    routes: context.routes.map((r) => r.coords),
    selected: selectedRoute,
    kinds: PLACE_KINDS,
    hidden: hiddenKinds,
    places: context.places.map((p) => ({
      kind: p.kind,
      lat: p.lat,
      lon: p.lon,
      name: p.name,
      details: p.details,
      url: mapsUrl(p.lat, p.lon, p.named ? p.name : null),
    })),
  };
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html, body, #map { height: 100%; margin: 0; background: #e8eddf; font-family: -apple-system, system-ui, sans-serif; }
  .leaflet-control-layers { border: none !important; border-radius: 8px !important; box-shadow: 0 2px 10px rgba(0,0,0,.15) !important; font-size: 13px; }
  .leaflet-control-layers-expanded { padding: 8px 10px; }
  .leaflet-popup-content { margin: 10px 12px; font-size: 13px; line-height: 1.4; }
  .leaflet-popup-content b { font-size: 14px; }
  .leaflet-popup-content a { display: inline-block; margin-top: 6px; color: #5d7424; font-weight: 600; }
  .end { width: 18px; height: 18px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.4); box-sizing: border-box; }
  .swatch { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; }
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var D = ${json};
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var map = L.map("map", { zoomControl: true });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  var bounds = [];
  D.routes.forEach(function (coords, i) {
    if (i !== D.selected) L.polyline(coords, { color: "#8e998e", weight: 4, opacity: 0.6, dashArray: "6 6" }).addTo(map);
  });
  var route = D.routes[D.selected];
  if (route) {
    L.polyline(route, { color: "#17211e", weight: 8, opacity: 0.18 }).addTo(map);
    L.polyline(route, { color: "#8ca336", weight: 5 }).addTo(map);
    bounds = route.slice();
  }

  function endMarker(place, color, label) {
    if (!place) return;
    var icon = L.divIcon({ className: "", html: '<div class="end" style="background:' + color + '"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
    L.marker([place.lat, place.lon], { icon: icon, zIndexOffset: 1000 }).bindPopup("<b>" + label + "</b><br>" + esc(place.name)).addTo(map);
    bounds.push([place.lat, place.lon]);
  }
  endMarker(D.origin, "#17211e", "Start");
  endMarker(D.destination, "#a8c943", "Destination");

  var overlays = {};
  Object.keys(D.kinds).forEach(function (kind) {
    var meta = D.kinds[kind];
    var group = L.layerGroup();
    var count = 0;
    D.places.forEach(function (p) {
      if (p.kind !== kind) return;
      count++;
      L.circleMarker([p.lat, p.lon], { radius: 7, color: "#fff", weight: 2, fillColor: meta.color, fillOpacity: 1 })
        .bindPopup("<b>" + esc(p.name) + "</b>" + (p.details ? "<br>" + esc(p.details) : "") + '<br><a href="' + esc(p.url) + '" target="_blank" rel="noopener">Open in Maps ↗</a>')
        .addTo(group);
    });
    var name = '<span class="swatch" style="background:' + meta.color + '"></span>' + meta.label + " (" + count + ")";
    overlays[name] = group;
    if (D.hidden.indexOf(kind) === -1) group.addTo(map);
  });
  L.control.layers(null, overlays, { collapsed: false, position: "topright" }).addTo(map);

  if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
  else if (D.destination) map.setView([D.destination.lat, D.destination.lon], 12);
</script>
</body></html>`;
}
