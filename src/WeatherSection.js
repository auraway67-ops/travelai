import { StyleSheet, Text, View } from "react-native";
import { LEVEL_COLORS } from "./climate";
import { COLORS } from "./theme";

function formatDay(iso) {
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const round = (value) => (value == null ? "–" : Math.round(value));

export default function WeatherSection({ context, plan }) {
  const weather = context?.weather;
  const safetyNotes = plan.climate?.safetyNotes ?? [];

  return (
    <>
      {weather ? (
        <View style={[styles.verdict, { backgroundColor: LEVEL_COLORS[weather.verdict.level].tint }]}>
          <Text style={[styles.verdictTitle, { color: LEVEL_COLORS[weather.verdict.level].color }]}>{weather.verdict.title}</Text>
          <Text style={styles.body}>{weather.verdict.text}</Text>
          {weather.range ? (
            <Text style={styles.range}>
              {weather.range[0]}° to {weather.range[1]}°C · {weather.label}
              {weather.partial ? " · Only the first days are in the forecast window" : ""}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.message}>{context?.errors?.weather ?? "Live weather wasn't loaded for this trip."}</Text>
      )}

      {safetyNotes.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>SEASONAL RISKS</Text>
          {safetyNotes.map((note, index) => (
            <Text key={`${index}-${note}`} style={styles.note}>• {note}</Text>
          ))}
        </View>
      )}

      {weather?.days.map((day) => {
        const level = LEVEL_COLORS[day.level];
        return (
          <View key={day.date} style={styles.day}>
            <Text style={styles.icon}>{day.icon}</Text>
            <View style={styles.flex}>
              <Text style={styles.dayTitle}>{formatDay(day.date)} · {day.label}</Text>
              <Text style={styles.dayMeta}>
                {round(day.tMin)}° / {round(day.tMax)}°C
                {day.rainChance != null ? ` · ${day.rainChance}% rain` : ""}
                {day.wind != null ? ` · wind ${round(day.wind)} km/h` : ""}
              </Text>
              {day.notes.length > 0 && <Text style={[styles.dayNotes, { color: level.color }]}>{day.notes.join(" · ")}</Text>}
            </View>
            <View style={[styles.levelDot, { backgroundColor: level.color }]} />
          </View>
        );
      })}

      <Text style={styles.credit}>Weather by Open-Meteo. Check local alerts before you travel.</Text>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  verdict: { marginTop: 10, padding: 15, borderRadius: 8 },
  verdictTitle: { fontSize: 16, fontWeight: "800" },
  body: { marginTop: 4, color: "#4b544f", fontSize: 13, lineHeight: 19 },
  range: { marginTop: 8, color: "#5d6858", fontSize: 12, fontWeight: "600" },
  message: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: "#f3f0dc", color: "#6d6431", fontSize: 13, lineHeight: 18 },
  card: { marginTop: 10, padding: 15, borderWidth: 1, borderColor: "#ecd3b8", borderRadius: 8, backgroundColor: "#fdf7f0" },
  label: { marginBottom: 7, color: "#869087", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  note: { marginTop: 3, color: "#4b544f", fontSize: 13, lineHeight: 19 },
  day: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, padding: 12, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, backgroundColor: COLORS.white },
  icon: { width: 30, fontSize: 22, textAlign: "center" },
  dayTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "700" },
  dayMeta: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  dayNotes: { marginTop: 3, fontSize: 12, fontWeight: "600" },
  levelDot: { width: 9, height: 9, borderRadius: 5 },
  credit: { marginTop: 10, color: "#9ba39a", fontSize: 10, textAlign: "center" },
});
