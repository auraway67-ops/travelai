// Turns daily weather into plain travel-safety guidance.
// Levels: 0 = fine, 1 = take care, 2 = think twice / have a backup plan.

const CODE_LABELS = [
  [[0], "Clear", "☀"],
  [[1, 2], "Partly cloudy", "⛅"],
  [[3], "Overcast", "☁"],
  [[45, 48], "Fog", "🌫"],
  [[51, 53, 55, 56, 57], "Drizzle", "🌦"],
  [[61, 63, 66, 80, 81], "Rain", "🌧"],
  [[65, 67, 82], "Heavy rain", "🌧"],
  [[71, 73, 75, 77, 85, 86], "Snow", "❄"],
  [[95, 96, 99], "Thunderstorms", "⛈"],
];

export function describeWeather(day) {
  if (day.code != null) {
    const match = CODE_LABELS.find(([codes]) => codes.includes(day.code));
    if (match) return { label: match[1], icon: match[2] };
  }
  if (day.stormChance >= 34) return { label: "Storms likely", icon: "⛈" };
  if (day.rainChance >= 60) return { label: "Often wet", icon: "🌧" };
  if (day.rainChance >= 30) return { label: "Showers possible", icon: "🌦" };
  return { label: "Mostly dry", icon: "⛅" };
}

export function assessDay(day) {
  const notes = [];
  let level = 0;
  const flag = (lvl, note) => {
    level = Math.max(level, lvl);
    notes.push(note);
  };

  if ([95, 96, 99].includes(day.code)) flag(2, "Thunderstorms forecast");
  else if (day.stormChance >= 34) flag(1, "Storms are common on these dates");

  if (day.precip >= 50) flag(2, "Very heavy rain, flooding possible");
  else if (day.precip >= 20) flag(1, "Heavy rain");

  if ((day.code >= 71 && day.code <= 77) || day.code === 85 || day.code === 86 || day.snow) flag(1, "Snow or ice on roads");
  if (day.code === 45 || day.code === 48) flag(1, "Fog, drive slowly");

  if (day.tMax >= 40) flag(2, "Extreme heat");
  else if (day.tMax >= 35) flag(1, "Very hot, avoid midday sun");
  if (day.tMin <= -10) flag(2, "Severe cold");
  else if (day.tMin <= 0) flag(1, "Freezing nights");

  if (day.wind >= 75) flag(2, "Storm-force winds");
  else if (day.wind >= 50) flag(1, "Strong winds");

  if (day.uv >= 8) flag(0, "Very high UV, use sun protection");
  return { level, notes };
}

export function assessTrip(weather) {
  const days = weather.days.map((day) => ({ ...day, ...assessDay(day), ...describeWeather(day) }));
  const worst = Math.max(0, ...days.map((d) => d.level));
  const careDays = days.filter((d) => d.level >= 1).length;
  const temps = days.flatMap((d) => [d.tMin, d.tMax]).filter((t) => t != null);

  const verdict =
    worst === 2
      ? { level: 2, title: "Think twice about these dates", text: "Some days look risky for travel. Keep plans flexible and check local alerts before you go." }
      : careDays > 0
        ? { level: 1, title: "Good, with some care", text: `${careDays} of ${days.length} days need a little extra care. Details below.` }
        : { level: 0, title: "Safe, comfortable weather", text: "Nothing in the weather should get in the way of this trip." };

  return {
    ...weather,
    days,
    verdict,
    range: temps.length ? [Math.round(Math.min(...temps)), Math.round(Math.max(...temps))] : null,
  };
}

export const LEVEL_COLORS = [
  { color: "#5f7d22", tint: "#eef4d8" },
  { color: "#9a6a1c", tint: "#f7eed9" },
  { color: "#a24a2a", tint: "#f8e5dc" },
];
