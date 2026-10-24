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

export async function loadTripContext(input, onProgress = () => {}) {
  const context = { destination: null, origin: null, routes: [], places: [], weather: null, errors: {} };

  onProgress("Finding your destination on the map");
  try {
    context.destination = await geocode(input.destination);
  } catch (error) {
    context.errors.destination = message(error);
    return context;
  }

  if (input.origin) {
    // Nominatim allows one request per second.
    await wait(1100);
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
