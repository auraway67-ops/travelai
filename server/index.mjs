// AURA WAY trip planner service.
// Keeps the Anthropic API key on the server and turns the app's trip request
// into a complete, structured trip plan.

import { readFile } from "node:fs/promises";
import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { TRIP_SCHEMA } from "./tripSchema.mjs";

const PORT = Number(process.env.PORT ?? 8787);
const MODEL = "claude-opus-5-5";
const client = new Anthropic();

const SYSTEM_PROMPT = `You are AURA WAY's trip planner. You plan an entire trip end to end: the most affordable ways to get there, easy-going routes, scenic viewpoints, budget-friendly places to stay, a realistic day-by-day itinerary, what the weather and travel safety will be like, a budget, a packing list, practical tips, and a booking checklist.

Guidelines:
- Fit the plan to the travellers' pace, budget level and interests. A relaxed pace means 2-3 anchored things a day with real downtime; a packed pace can hold 5-6.
- Keep each day geographically sensible so travellers are not crossing the city back and forth. Include meals and the transport between far-apart stops.
- Day 1 should allow for arrival and the last day for departure.
- Every amount is an estimate in one currency (the destination's local currency unless the request says otherwise), for the whole group. The budget categories must add up to totalEstimate.
- You do not have live prices, opening hours, or availability. Name real, well-known places, but phrase anything time-sensitive so the traveller knows to confirm it, and put "confirm hours/prices" style items in the checklist.
- Dates: if a start date is given, fill each day's date as YYYY-MM-DD; otherwise use "".
- Packing list and tips should be specific to the destination, season and planned activities, not generic.
- Affordability comes first. List travelOptions cheapest first and include buses, trains and shared rides where they exist, not just flights. List stays best value first; for a Budget trip favour hostels, guesthouses and budget hotels in safe, well-connected areas.
- Prefer easy, low-stress routes: note when a scenic or simpler road is worth a little extra time, and mention tolls, mountain passes or difficult city driving in roadTrip.drivingNotes.
- If the traveller is driving an EV, plan the itinerary around charging stops on longer drives.
- viewpoints should mix famous lookouts with quieter ones; mark scenic stops on the journey with onTheWay.
- climate.safetyNotes must flag real seasonal risks for these dates and this place (monsoon, cyclone or hurricane season, heatwaves, wildfire smoke, snow on passes). The app adds a live forecast separately, so describe the typical season rather than inventing a forecast.`;

const TRAVEL_MODES = {
  petrol: "driving a petrol/diesel car",
  ev: "driving an electric car (needs charging stops)",
  transit: "public transport (bus and train)",
  any: "whatever is cheapest and easiest",
};

function describeRequest(input) {
  const lines = [
    `Destination: ${input.destination}`,
    input.origin ? `Travelling from: ${input.origin}` : null,
    input.travelMode ? `Preferred way to travel: ${TRAVEL_MODES[input.travelMode] ?? input.travelMode}` : null,
    input.startDate ? `Start date: ${input.startDate}` : "Start date: flexible",
    `Length: ${input.days} day(s)`,
    `Travellers: ${input.travelers}`,
    `Budget level: ${input.budget}`,
    `Pace: ${input.pace}`,
    input.interests?.length ? `Interests: ${input.interests.join(", ")}` : null,
    input.notes ? `Extra notes from the traveller: ${input.notes}` : null,
  ];
  return `Plan this trip.\n\n${lines.filter(Boolean).join("\n")}`;
}

function validate(input) {
  if (!input || typeof input !== "object") return "Request body must be a JSON object.";
  if (typeof input.destination !== "string" || !input.destination.trim()) return "destination is required.";
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 21) return "days must be a whole number from 1 to 21.";
  if (!Number.isInteger(input.travelers) || input.travelers < 1 || input.travelers > 20) return "travelers must be from 1 to 20.";
  for (const key of ["origin", "startDate", "budget", "pace", "notes", "travelMode"]) {
    if (input[key] != null && typeof input[key] !== "string") return `${key} must be a string.`;
    if (typeof input[key] === "string" && input[key].length > 500) return `${key} is too long.`;
  }
  if (input.interests != null && (!Array.isArray(input.interests) || input.interests.some((i) => typeof i !== "string"))) {
    return "interests must be a list of strings.";
  }
  return null;
}

async function planTrip(input) {
  // Streamed so long plans don't hit HTTP timeouts; we only need the final message.
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: TRIP_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: describeRequest(input) }],
  });
  const response = await stream.finalMessage();

  if (response.stop_reason === "refusal") {
    const error = new Error("The planner couldn't plan this trip. Try rewording the request.");
    error.status = 422;
    throw error;
  }
  if (response.stop_reason === "max_tokens") {
    const error = new Error("This trip was too long to plan in one go. Try fewer days.");
    error.status = 422;
    throw error;
  }

  const text = response.content.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("The planner returned an empty response.");
  return JSON.parse(text);
}

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 20_000) throw Object.assign(new Error("Request body is too large."), { status: 413 });
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { status: 400 });
  }
}

// The web pages in the project root. Only these files are served.
const WEB_ROOT = new URL("../", import.meta.url);
const WEB_FILES = {
  "/": ["index.html", "text/html"],
  "/index.html": ["index.html", "text/html"],
  "/styles.css": ["styles.css", "text/css"],
  "/script.js": ["script.js", "text/javascript"],
  "/planner": ["planner.html", "text/html"],
  "/planner.html": ["planner.html", "text/html"],
  "/planner.css": ["planner.css", "text/css"],
  "/planner.js": ["planner.js", "text/javascript"],
};

async function serveFile(res, [name, type]) {
  try {
    const body = await readFile(new URL(name, WEB_ROOT));
    res.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
    res.end(body);
  } catch {
    send(res, 404, { error: "Not found." });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true });
  const file = req.method === "GET" && WEB_FILES[req.url.split("?")[0]];
  if (file) return serveFile(res, file);
  if (req.method !== "POST" || req.url !== "/api/plan") return send(res, 404, { error: "Not found." });

  try {
    const input = await readJson(req);
    const problem = validate(input);
    if (problem) return send(res, 400, { error: problem });

    const started = Date.now();
    const trip = await planTrip(input);
    console.log(`Planned ${input.days}-day trip to ${input.destination} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    send(res, 200, { trip });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic authentication failed. Set ANTHROPIC_API_KEY in server/.env.");
      return send(res, 500, { error: "The planner isn't configured with a valid API key." });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return send(res, 429, { error: "The planner is busy. Try again in a minute." });
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}:`, error.message);
      return send(res, 502, { error: "The planner service had a problem. Try again." });
    }
    console.error(error);
    send(res, error.status ?? 500, { error: error.status ? error.message : "Something went wrong while planning." });
  }
});

server.listen(PORT, () => {
  console.log(`AURA WAY planner listening on http://localhost:${PORT}`);
  console.log(`Web planner: http://localhost:${PORT}/planner`);
});
