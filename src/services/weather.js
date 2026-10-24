// Weather for the trip dates from Open-Meteo (free, no key).
// Trips starting within the forecast window get the real forecast; trips
// further out get "typical" weather averaged from the same dates in the last
// three years.

import { getJson } from "./geo";
import { addDays } from "../samplePlan";

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const FORECAST_DAYS = 16;
const YEARS_BACK = 3;

export function todayIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
}

function shiftYears(isoDate, years) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y + years, m - 1, Math.min(d, 28 + (m === 2 ? 0 : 3)))).toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

async function forecast(place, start, count) {
  const daily = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max";
  const url = `${FORECAST}?latitude=${place.lat}&longitude=${place.lon}&daily=${daily}&timezone=auto&start_date=${start}&end_date=${addDays(start, count - 1)}`;
  const { daily: d } = await getJson(url);
  return d.time.map((date, i) => ({
    date,
    code: d.weather_code[i],
    tMax: d.temperature_2m_max[i],
    tMin: d.temperature_2m_min[i],
    precip: d.precipitation_sum[i] ?? 0,
    rainChance: d.precipitation_probability_max[i],
    wind: d.wind_speed_10m_max[i],
    uv: d.uv_index_max[i],
    stormChance: null,
  }));
}

async function typical(place, start, count) {
  const daily = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max";
  const years = await Promise.all(
    Array.from({ length: YEARS_BACK }, (_, k) => {
      const from = shiftYears(start, -(k + 1));
      const url = `${ARCHIVE}?latitude=${place.lat}&longitude=${place.lon}&daily=${daily}&timezone=auto&start_date=${from}&end_date=${addDays(from, count - 1)}`;
      return getJson(url).then((r) => r.daily).catch(() => null);
    })
  );
  const valid = years.filter(Boolean);
  if (!valid.length) throw new Error("Historical weather isn't available for this place.");

  const mean = (values) => {
    const nums = values.filter((v) => v != null);
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  };
  return Array.from({ length: count }, (_, i) => {
    const pick = (key) => valid.map((y) => y[key][i]);
    const codes = pick("weather_code").filter((c) => c != null);
    const precips = pick("precipitation_sum").filter((p) => p != null);
    return {
      date: addDays(start, i),
      code: null,
      tMax: mean(pick("temperature_2m_max")),
      tMin: mean(pick("temperature_2m_min")),
      precip: mean(precips) ?? 0,
      rainChance: precips.length ? Math.round((100 * precips.filter((p) => p >= 1).length) / precips.length) : null,
      wind: mean(pick("wind_speed_10m_max")),
      uv: null,
      stormChance: codes.length ? Math.round((100 * codes.filter((c) => c >= 95).length) / codes.length) : 0,
      snow: codes.some((c) => (c >= 71 && c <= 77) || c === 85 || c === 86),
    };
  });
}

export async function getTripWeather(place, startDate, tripDays) {
  const today = todayIso();
  const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate ?? "");
  const start = hasDate ? startDate : today;
  const offset = daysBetween(today, start);

  if (offset >= 0 && offset < FORECAST_DAYS) {
    const count = Math.min(tripDays, FORECAST_DAYS - offset);
    return {
      mode: "forecast",
      label: hasDate ? "Forecast for your dates" : "Forecast if you left today",
      partial: count < tripDays,
      days: await forecast(place, start, count),
    };
  }
  return {
    mode: "typical",
    label: `Typical weather for these dates (last ${YEARS_BACK} years)`,
    partial: false,
    days: await typical(place, start, Math.min(tripDays, 21)),
  };
}
