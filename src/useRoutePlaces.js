import { useEffect, useRef, useState } from "react";
import { loadRoutePlaces } from "./tripContext";

// Shared so the map isn't rebuilt for every render that has no places yet.
const NONE = { places: [], loading: false, error: null };
const LOADING = { places: [], loading: true, error: null };

// Stops and stays for the chosen route. The trip context already holds them
// for the first route; other routes are fetched when picked, and kept.
export default function useRoutePlaces(trip, routeIndex) {
  const cache = useRef(new Map());
  const [, setVersion] = useState(0);
  const context = trip?.context;
  const key = `${trip?.id}:${routeIndex}`;
  const needsFetch = Boolean(context?.destination && routeIndex > 0 && context.routes[routeIndex]);

  useEffect(() => {
    if (!needsFetch || cache.current.has(key)) return;
    cache.current.set(key, LOADING);
    setVersion((v) => v + 1);
    loadRoutePlaces(context, routeIndex)
      .then((places) => cache.current.set(key, { places, loading: false, error: null }))
      .catch((error) =>
        cache.current.set(key, { places: [], loading: false, error: error?.message || "The stops service isn't responding right now." })
      )
      .finally(() => setVersion((v) => v + 1));
  }, [key, needsFetch, context, routeIndex]);

  if (!context) return NONE;
  if (!needsFetch) return { places: context.places, loading: false, error: context.errors?.places ?? null };
  return cache.current.get(key) ?? LOADING;
}
