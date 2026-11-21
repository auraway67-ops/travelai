import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { LEVEL_COLORS } from "./climate";
import { NoTripYet, RoutePicker } from "./MapScreen";
import { PLACE_KINDS, mapsUrl } from "./mapHtml";
import { formatDuration } from "./RouteSection";
import { stayTier } from "./services/geo";
import { measurePlaces, rangeCheck } from "./tripContext";
import { COLORS } from "./theme";

const STOP_KINDS = ["viewpoint", "ev", "fuel"];
const DEFAULT_RANGE_KM = { petrol: 550, ev: 380 };
const TIER_STYLES = {
  Budget: { color: "#4f6420", backgroundColor: "#eef4d2" },
  "Mid-range": { color: "#5b645e", backgroundColor: "#eef0ea" },
  Upscale: { color: "#9a6a1c", backgroundColor: "#f7eed9" },
};
// Stays further than this from the destination count as overnight stops on the way.
const OVERNIGHT_FROM_DEST_KM = 50;

function PlaceRow({ place, detail, right }) {
  const meta = PLACE_KINDS[place.kind];
  return (
    <Pressable
      onPress={() => Linking.openURL(mapsUrl(place.lat, place.lon, place.named ? place.name : null))}
      style={({ pressed }) => [styles.place, pressed && styles.pressed]}
    >
      <View style={[styles.placeDot, { backgroundColor: meta.color }]}>
        <Text style={styles.placeSymbol}>{meta.symbol}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.placeName}>{place.name}</Text>
        <Text style={styles.placeDetail}>{[place.details, detail].filter(Boolean).join(" · ")}</Text>
      </View>
      {right}
    </Pressable>
  );
}

function StayRow({ stay, destinationName, detail }) {
  const tier = stayTier(stay.budgetRank ?? 3);
  const pricesUrl = `https://www.google.com/search?q=${encodeURIComponent(`${stay.name} ${destinationName} price`)}`;
  return (
    <PlaceRow
      place={stay}
      detail={detail}
      right={
        <View style={styles.stayRight}>
          <Text style={[styles.tier, TIER_STYLES[tier]]}>{tier}</Text>
          <Pressable hitSlop={8} onPress={() => Linking.openURL(pricesUrl)}>
            <Text style={styles.link}>Prices ↗</Text>
          </Pressable>
        </View>
      }
    />
  );
}

export default function StopsScreen({ trip, routeIndex, onSelectRoute, routePlaces, onPlan }) {
  const ev = trip?.input.travelMode === "ev";
  const [shown, setShown] = useState(null);
  const context = trip?.context;

  if (!context?.destination) {
    return (
      <NoTripYet
        title="Stops on your way"
        text="Plan a trip with a starting point to find fuel, EV chargers, viewpoints and budget stays along the road."
        onPlan={onPlan}
      />
    );
  }

  const route = context.routes[routeIndex];
  const places = measurePlaces(routePlaces.places, route, context.destination);
  const active = shown ?? ["viewpoint", ev ? "ev" : "fuel"];
  const toggle = (kind) => setShown(active.includes(kind) ? active.filter((k) => k !== kind) : [...active, kind]);

  const along = route ? places.filter((p) => STOP_KINDS.includes(p.kind) && p.offKm <= 3) : [];
  const count = (kind) => along.filter((p) => p.kind === kind).length;
  const listed = along.filter((p) => active.includes(p.kind)).slice(0, 150);

  const stays = places
    .filter((p) => p.kind === "stay")
    .sort((a, b) => (a.budgetRank ?? 3) - (b.budgetRank ?? 3) || a.fromDestKm - b.fromDestKm);
  const destStays = stays.filter((s) => s.fromDestKm <= OVERNIGHT_FROM_DEST_KM).slice(0, 40);
  const overnight = route ? stays.filter((s) => s.fromDestKm > OVERNIGHT_FROM_DEST_KM).slice(0, 15) : [];

  const rangeKm = trip.input.rangeKm ?? DEFAULT_RANGE_KM[ev ? "ev" : "petrol"];
  const range = route ? rangeCheck(places, route, rangeKm, ev) : null;
  const breaks = route ? Math.floor(route.durationMin / 120) : 0;

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>ON THE ROAD</Text>
      <Text style={styles.title}>Stops & stays</Text>
      {route ? (
        <Text style={styles.subtitle}>
          {context.origin.name} → {context.destination.name} · {formatDuration(route.durationMin)} · {Math.round(route.distanceKm)} km
        </Text>
      ) : null}

      <RoutePicker routes={context.routes} selected={routeIndex} onSelect={onSelectRoute} />

      {routePlaces.loading && (
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.green} />
          <Text style={styles.loadingText}>Finding viewpoints, chargers, fuel and stays…</Text>
        </View>
      )}
      {routePlaces.error ? (
        <Text style={styles.message}>The stops service is busy, so this list may be incomplete. ({routePlaces.error})</Text>
      ) : null}

      {route ? (
        <>
          {!routePlaces.loading && range && (
            <View style={[styles.verdict, { backgroundColor: LEVEL_COLORS[range.level].tint }]}>
              <Text style={[styles.verdictTitle, { color: LEVEL_COLORS[range.level].color }]}>{range.title}</Text>
              <Text style={styles.body}>{range.text}</Text>
            </View>
          )}
          {breaks > 0 && (
            <Text style={styles.note}>
              Plan about {breaks} rest break{breaks > 1 ? "s" : ""}. One every 2 hours keeps drivers alert.
            </Text>
          )}

          <View style={styles.card}>
            <Text style={styles.label}>ALONG THE ROUTE</Text>
            <View style={styles.filters}>
              {STOP_KINDS.map((kind) => {
                const meta = PLACE_KINDS[kind];
                const on = active.includes(kind);
                return (
                  <Pressable
                    key={kind}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: on }}
                    onPress={() => toggle(kind)}
                    style={[styles.filter, on && { borderColor: meta.color }]}
                  >
                    <View style={[styles.swatch, { backgroundColor: on ? meta.color : "#d4d8cf" }]} />
                    <Text style={[styles.filterText, !on && styles.filterTextOff]}>{meta.label} {count(kind)}</Text>
                  </Pressable>
                );
              })}
            </View>
            {listed.map((place) => (
              <PlaceRow
                key={place.id}
                place={place}
                detail={place.offKm > 0.4 ? `${place.offKm.toFixed(1)} km off route` : null}
                right={<Text style={styles.km}>km {Math.round(place.alongKm)}</Text>}
              />
            ))}
            {!routePlaces.loading && listed.length === 0 && (
              <Text style={styles.muted}>Nothing in these categories along this route on OpenStreetMap.</Text>
            )}
          </View>
        </>
      ) : (
        <Text style={styles.message}>
          {trip.input.origin
            ? context.errors.routes ?? "No driving route was found."
            : "Add a starting point when you plan to see fuel, chargers and viewpoints along the way."}
        </Text>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>STAYS NEAR {context.destination.name.toUpperCase()} · CHEAPEST TYPES FIRST</Text>
        {destStays.map((stay) => (
          <StayRow key={stay.id} stay={stay} destinationName={context.destination.name} detail={`${stay.fromDestKm.toFixed(1)} km away`} />
        ))}
        {!routePlaces.loading && destStays.length === 0 && (
          <Text style={styles.muted}>No stays mapped near your destination on OpenStreetMap.</Text>
        )}
      </View>

      {overnight.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>OVERNIGHT STOP HALFWAY · LONG DRIVE</Text>
          {overnight.map((stay) => (
            <StayRow key={stay.id} stay={stay} destinationName={context.destination.name} detail={`km ${Math.round(stay.alongKm)}`} />
          ))}
        </View>
      )}

      <Text style={styles.credit}>
        Data from OpenStreetMap. Budget level is based on the type of stay and star rating. Check opening hours and live prices before you rely on them.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { paddingTop: 22 },
  eyebrow: { color: "#869087", fontSize: 10, fontWeight: "600", letterSpacing: 1.1 },
  title: { marginTop: 6, color: COLORS.ink, fontSize: 28, fontWeight: "700", letterSpacing: -1.2 },
  subtitle: { marginTop: 4, color: COLORS.muted, fontSize: 13 },
  loading: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 14 },
  loadingText: { color: COLORS.muted, fontSize: 13 },
  message: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: "#f3f0dc", color: "#6d6431", fontSize: 13, lineHeight: 18 },
  verdict: { marginTop: 12, padding: 14, borderRadius: 8 },
  verdictTitle: { fontSize: 15, fontWeight: "800" },
  body: { marginTop: 4, color: "#4b544f", fontSize: 13, lineHeight: 19 },
  note: { marginTop: 9, color: "#5d6858", fontSize: 12, lineHeight: 17 },
  card: { marginTop: 10, padding: 15, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, backgroundColor: COLORS.white },
  label: { marginBottom: 7, color: "#869087", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  muted: { paddingVertical: 6, color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 6 },
  filter: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, backgroundColor: COLORS.white },
  swatch: { width: 9, height: 9, borderRadius: 5 },
  filterText: { color: COLORS.ink, fontSize: 12, fontWeight: "600" },
  filterTextOff: { color: "#a0a79f" },
  place: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#f0f2ec" },
  placeDot: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  placeSymbol: { color: "#fff", fontSize: 12 },
  placeName: { color: COLORS.ink, fontSize: 13, fontWeight: "700" },
  placeDetail: { marginTop: 2, color: COLORS.muted, fontSize: 11 },
  km: { color: "#5d6858", fontSize: 12, fontWeight: "700" },
  stayRight: { alignItems: "flex-end", gap: 5 },
  tier: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9, overflow: "hidden", fontSize: 10, fontWeight: "700" },
  link: { color: "#758d2e", fontSize: 12, fontWeight: "700" },
  credit: { marginTop: 10, color: "#9ba39a", fontSize: 10, lineHeight: 15, textAlign: "center" },
  pressed: { opacity: 0.75 },
});
