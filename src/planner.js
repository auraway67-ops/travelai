import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildSamplePlan } from "./samplePlan";

// URL of the planner service in server/. On a physical phone this must be
// your computer's LAN address (e.g. http://192.168.1.20:8787), not localhost.
const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
const SAVED_KEY = "auraway.savedTrips.v1";

export const plannerConnected = Boolean(API_URL);

export async function requestPlan(input) {
  if (!API_URL) {
    return { plan: buildSamplePlan(input), source: "sample" };
  }

  let response;
  try {
    response = await fetch(`${API_URL}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error(`Couldn't reach the planner at ${API_URL}. Is the server running?`);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.trip) {
    throw new Error(body?.error ?? `The planner returned an error (${response.status}).`);
  }
  return { plan: body.trip, source: "ai" };
}

export async function loadSavedTrips() {
  try {
    const raw = await AsyncStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function storeSavedTrips(trips) {
  try {
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(trips));
  } catch {
    // Saving is best-effort; the trips stay in memory for this session.
  }
}
