// Gathers the live, location-based part of a trip: coordinates, road routes,
// fuel and EV stops, viewpoints, budget stays and weather. Each part fails on
// its own, so one slow service never blocks the rest of the trip.

import { distanceKm, findPlaces, geocode, getRoutes } from "./services/geo";
import { getTripWeather } from "./services/weather";
import { assessTrip } from "./climate";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function message(error) {
  return error?.message || "This service isn't responding right now.";
}

// For each place: how far along the route it is, and how far off it.
function placeAlongRoute(place, route) {
  let best = { index: 0, off: Infinity };
  route.coords.forEach((point, index) => {
    const off = distanceKm(point, [place.lat, place.lon]);
    if (off < best.off) best = { index, off };
  });
  return { alongKm: (route.distanceKm * best.index) / Math.max(route.coords.length - 1, 1), offKm: best.off };
}

export function measurePlaces(places, route, destination) {
  return places
    .map((place) => {
      const fromDestKm = distanceKm([destination.lat, destination.lon], [place.lat, place.lon]);
      return { ...place, fromDestKm, ...(route ? placeAlongRoute(place, route) : {}) };
    })
    .sort((a, b) => (route ? a.alongKm - b.alongKm : a.fromDestKm - b.fromDestKm));
}

// The longest stretch of the route with no fuel station (or charger), and where it starts.
export function longestGap(stops, totalKm) {
  const kms = [0, ...stops.map((p) => p.alongKm).sort((a, b) => a - b), totalKm];
  let gap = 0;
  let at = 0;
  for (let i = 1; i < kms.length; i++) {
    if (kms[i] - kms[i - 1] > gap) {
      gap = kms[i] - kms[i - 1];
      at = kms[i - 1];
    }
  }
  return { gap, at };
}

// Whether the car can cover the route between the known fuel stops or chargers.
// level: 0 = fine, 1 = plan top-ups, 2 = range risk (same scale as the weather).
export function rangeCheck(places, route, rangeKm, ev) {
  const what = ev ? "charger" : "fuel station";
  const fill = ev ? "charge" : "tank";
  if (route.distanceKm < rangeKm * 0.7) {
    return { level: 0, title: "Range is fine", text: `The whole drive (${Math.round(route.distanceKm)} km) fits in one ${fill}. Top up before you leave.` };
  }
  const stops = places.filter((p) => p.kind === (ev ? "ev" : "fuel") && p.offKm <= 3);
  const { gap, at } = longestGap(stops, route.distanceKm);
  const km = Math.round(gap);
  if (gap > rangeKm * 0.8) {
    return {
      level: 2,
      title: "Range risk",
      text: `There's a ${km} km stretch with no ${what} we know of (from about km ${Math.round(at)}), close to or over your ${rangeKm} km range. Start it with a full ${fill} or pick another route.`,
    };
  }
  if (gap > rangeKm * 0.55) {
    return { level: 1, title: "Plan your top-ups", text: `The longest stretch without a ${what} is ${km} km (from about km ${Math.round(at)}). Fill up before it.` };
  }
  return { level: 0, title: "Range is fine", text: `The longest stretch without a ${what} is ${km} km, well within your ${rangeKm} km range.` };
}

// Stops along a route other than the first, which the trip context already covers.
export function loadRoutePlaces(context, routeIndex) {
  return findPlaces({ destination: context.destination, route: context.routes[routeIndex] });
}

export async function loadTripContext(input, onProgress = () => {}) {
  const context = { destination: null, origin: null, routes: [], places: [], weather: null, errors: {} };

  onProgress("Finding your destination on the map");
  try {
    // A place picked from the suggestions already has coordinates.
    context.destination = input.destinationPlace ?? (await geocode(input.destination));
  } catch (error) {
    context.errors.destination = message(error);
    return context;
  }

  if (input.originPlace) {
    context.origin = input.originPlace;
  } else if (input.origin) {
    // Nominatim allows one request per second.
    if (!input.destinationPlace) await wait(1100);
    try {
      context.origin = await geocode(input.origin);
    } catch (error) {
      context.errors.routes = message(error);
    }
  }

  if (context.origin) {
    onProgress("Working out the easiest roads");
    try {
      context.routes = await getRoutes(context.origin, context.destination);
    } catch (error) {
      context.errors.routes = message(error);
    }
  }

  onProgress("Checking weather, fuel, chargers and viewpoints");
  const [places, weather] = await Promise.allSettled([
    findPlaces({ destination: context.destination, route: context.routes[0] }),
    getTripWeather(context.destination, input.startDate, input.days),
  ]);

  if (places.status === "fulfilled") context.places = places.value;
  else context.errors.places = message(places.reason);

  if (weather.status === "fulfilled") context.weather = assessTrip(weather.value);
  else context.errors.weather = message(weather.reason);

  return context;
}
