import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import TripMap from "./TripMap";
import { PLACE_KINDS } from "./mapHtml";
import { formatDuration } from "./RouteSection";
import { COLORS } from "./theme";

// Shown on the Map and Stops tabs when there's nothing to map yet.
export function NoTripYet({ title, text, onPlan }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>⌖</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      <Pressable onPress={onPlan} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Text style={styles.primaryButtonText}>Plan a trip ↗</Text>
      </Pressable>
    </View>
  );
}

// One chip per route, so the choice is the same on every tab.
export function RoutePicker({ routes, selected, onSelect }) {
  if (routes.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routes}>
      {routes.map((route, index) => {
        const on = index === selected;
        return (
          <Pressable
            key={index}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onSelect(index)}
            style={({ pressed }) => [styles.routeChip, on && styles.routeChipOn, pressed && styles.pressed]}
          >
            <Text style={[styles.routeChipTitle, on && styles.routeChipTitleOn]}>
              {formatDuration(route.durationMin)} · {Math.round(route.distanceKm)} km
            </Text>
            <Text style={styles.routeChipLabel}>{route.labels.join(" · ") || "Alternative"}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function MapScreen({ trip, routeIndex, onSelectRoute, routePlaces, onPlan }) {
  const [hidden, setHidden] = useState([]);
  const context = trip?.context;

  if (!context?.destination) {
    return (
      <NoTripYet
        title="Your trip map"
        text={
          trip
            ? context?.errors?.destination ?? "This trip has no map data. Plan it again to load the map."
            : "Plan a trip to see your route, fuel stops, EV chargers, viewpoints and stays on a live map."
        }
        onPlan={onPlan}
      />
    );
  }

  const route = context.routes[routeIndex];
  const counts = routePlaces.places.reduce((acc, p) => ({ ...acc, [p.kind]: (acc[p.kind] ?? 0) + 1 }), {});
  const toggle = (kind) => setHidden((current) => (current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind]));

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>LIVE TRIP MAP</Text>
      <Text style={styles.title} numberOfLines={2}>
        {context.origin ? `${context.origin.name} → ${context.destination.name}` : context.destination.name}
      </Text>
      {route ? (
        <Text style={styles.subtitle}>
          {formatDuration(route.durationMin)} · {Math.round(route.distanceKm)} km{route.toll ? " · Tolls" : ""}{route.ferry ? " · Ferry" : ""}
        </Text>
      ) : (
        <Text style={styles.subtitle}>
          {trip.input.origin ? context.errors.routes ?? "No driving route was found." : "Add a starting point to see driving routes."}
        </Text>
      )}

      <RoutePicker routes={context.routes} selected={routeIndex} onSelect={onSelectRoute} />

      <View style={styles.mapWrap}>
        <TripMap context={context} places={routePlaces.places} selectedRoute={routeIndex} hiddenKinds={hidden} height={440} />
        {routePlaces.loading && (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="small" color={COLORS.green} />
            <Text style={styles.mapLoadingText}>Finding stops on this route…</Text>
          </View>
        )}
      </View>

      <View style={styles.kinds}>
        {Object.entries(PLACE_KINDS).map(([kind, meta]) => {
          const on = !hidden.includes(kind);
          return (
            <Pressable
              key={kind}
              accessibilityRole="switch"
              accessibilityState={{ checked: on }}
              onPress={() => toggle(kind)}
              style={[styles.kind, on && { borderColor: meta.color }]}
            >
              <View style={[styles.swatch, { backgroundColor: on ? meta.color : "#d4d8cf" }]} />
              <Text style={[styles.kindText, !on && styles.kindTextOff]}>
                {meta.label} {counts[kind] ?? 0}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {routePlaces.error ? <Text style={styles.message}>Nearby places: {routePlaces.error}</Text> : null}
      <Text style={styles.credit}>Tap a pin for details and directions. Map data © OpenStreetMap contributors.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 22 },
  eyebrow: { color: "#869087", fontSize: 10, fontWeight: "600", letterSpacing: 1.1 },
  title: { marginTop: 6, color: COLORS.ink, fontSize: 24, fontWeight: "700", letterSpacing: -0.9 },
  subtitle: { marginTop: 4, color: COLORS.muted, fontSize: 13 },
  routes: { gap: 8, paddingTop: 14 },
  routeChip: { paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, backgroundColor: COLORS.white },
  routeChipOn: { borderColor: "#a8c943", backgroundColor: "#f6f9ea" },
  routeChipTitle: { color: "#5b645e", fontSize: 13, fontWeight: "700" },
  routeChipTitleOn: { color: COLORS.ink },
  routeChipLabel: { marginTop: 2, color: "#7a8a4a", fontSize: 11, fontWeight: "600" },
  mapWrap: { marginTop: 12 },
  mapLoading: { position: "absolute", left: 10, bottom: 10, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.95)" },
  mapLoadingText: { color: COLORS.ink, fontSize: 12 },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  kind: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, backgroundColor: COLORS.white },
  swatch: { width: 9, height: 9, borderRadius: 5 },
  kindText: { color: COLORS.ink, fontSize: 12, fontWeight: "600" },
  kindTextOff: { color: "#a0a79f" },
  message: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: "#f3f0dc", color: "#6d6431", fontSize: 13, lineHeight: 18 },
  credit: { marginTop: 10, color: "#9ba39a", fontSize: 10, textAlign: "center" },
  empty: { minHeight: 470, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  emptyIcon: { marginBottom: 14, color: "#8ca336", fontSize: 40 },
  emptyTitle: { color: COLORS.ink, fontSize: 26, fontWeight: "700", letterSpacing: -1 },
  emptyText: { maxWidth: 300, marginTop: 8, color: COLORS.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  primaryButton: { marginTop: 20, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 6, backgroundColor: COLORS.ink },
  primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.75 },
});
