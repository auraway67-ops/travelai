import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import TripMap from "./TripMap";
import { PLACE_KINDS, mapsUrl } from "./mapHtml";
import { measurePlaces } from "./tripContext";
import { COLORS, formatMoney } from "./theme";

// Typical consumption, used only to estimate the cost of the drive.
const PETROL_L_PER_100KM = 7;
const EV_KWH_PER_100KM = 18;

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function RouteSection({ context, plan, input }) {
  const [selected, setSelected] = useState(0);
  const [hidden, setHidden] = useState([]);

  if (!context) {
    return <Text style={styles.message}>Live map data wasn't loaded for this trip.</Text>;
  }
  if (!context.destination) {
    return <Text style={styles.message}>{context.errors.destination ?? "Couldn't find this destination on the map."}</Text>;
  }

  const route = context.routes[selected];
  const ev = input.travelMode === "ev";
  const roadTrip = plan.roadTrip;
  const legCost = route && roadTrip
    ? ev
      ? (route.distanceKm / 100) * EV_KWH_PER_100KM * roadTrip.chargePricePerKwh
      : (route.distanceKm / 100) * PETROL_L_PER_100KM * roadTrip.fuelPricePerLitre
    : null;

  const places = measurePlaces(context.places, route, context.destination);
  const onRoute = places.filter((p) => route && p.offKm <= 3 && (p.kind === (ev ? "ev" : "fuel") || p.kind === "viewpoint"));
  const nearDestination = places
    .filter((p) => p.kind === "stay" || (p.kind === "viewpoint" && p.fromDestKm <= 25))
    .sort((a, b) => a.fromDestKm - b.fromDestKm)
    .slice(0, 12);

  function toggleKind(kind) {
    setHidden((current) => (current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind]));
  }

  return (
    <>
      <View style={styles.mapWrap}>
        <TripMap context={context} selectedRoute={selected} hiddenKinds={hidden} height={360} />
      </View>
      <View style={styles.kinds}>
        {Object.entries(PLACE_KINDS).map(([kind, meta]) => {
          const on = !hidden.includes(kind);
          return (
            <Pressable key={kind} onPress={() => toggleKind(kind)} style={[styles.kind, on && { borderColor: meta.color }]}>
              <View style={[styles.swatch, { backgroundColor: on ? meta.color : "#d4d8cf" }]} />
              <Text style={[styles.kindText, !on && styles.kindTextOff]}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {context.routes.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.label}>ROUTES FROM {context.origin.name.toUpperCase()}</Text>
          {context.routes.map((r, index) => (
            <Pressable
              key={index}
              onPress={() => setSelected(index)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected === index }}
              style={[styles.route, selected === index && styles.routeSelected]}
            >
              <View style={styles.flex}>
                <Text style={styles.routeTitle}>
                  {formatDuration(r.durationMin)} · {Math.round(r.distanceKm)} km
                </Text>
                <Text style={styles.routeVia}>
                  {r.via.length ? `via ${r.via.join(", ")}` : "Direct route"}
                  {r.toll ? " · Tolls" : ""}
                  {r.ferry ? " · Ferry" : ""}
                </Text>
              </View>
              <View style={styles.badges}>
                {r.labels.map((label) => (
                  <Text key={label} style={styles.badge}>{label}</Text>
                ))}
              </View>
            </Pressable>
          ))}
          {legCost != null ? (
            <Text style={styles.cost}>
              {ev ? "Charging" : "Fuel"} for this route: about{" "}
              <Text style={styles.costValue}>{formatMoney(legCost, plan.currency)}</Text> one way
              {"\n"}
              <Text style={styles.costNote}>
                Assumes {ev ? `${EV_KWH_PER_100KM} kWh` : `${PETROL_L_PER_100KM} L`} per 100 km at{" "}
                {formatMoney(ev ? roadTrip.chargePricePerKwh : roadTrip.fuelPricePerLitre, plan.currency, 2)} per {ev ? "kWh" : "litre"}.
              </Text>
            </Text>
          ) : null}
        </View>
      ) : input.origin ? (
        <Text style={styles.message}>{context.errors.routes ?? "No driving route was found."}</Text>
      ) : null}

      {onRoute.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>STOPS ALONG THE WAY</Text>
          {onRoute.slice(0, 15).map((place) => (
            <PlaceRow key={place.id} place={place} detail={`${Math.round(place.alongKm)} km in`} />
          ))}
        </View>
      )}

      {nearDestination.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>STAYS & VIEWS NEAR {context.destination.name.toUpperCase()}</Text>
          {nearDestination.map((place) => (
            <PlaceRow key={place.id} place={place} detail={`${place.fromDestKm.toFixed(1)} km away`} />
          ))}
        </View>
      )}

      {context.errors.places ? <Text style={styles.message}>Nearby places: {context.errors.places}</Text> : null}
      <Text style={styles.credit}>Map data © OpenStreetMap contributors. Routes by OSRM.</Text>
    </>
  );
}

function PlaceRow({ place, detail }) {
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
        <Text style={styles.placeDetail}>{[detail, place.details].filter(Boolean).join(" · ")}</Text>
      </View>
      <Text style={styles.open}>↗</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mapWrap: { marginTop: 10 },
  message: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: "#f3f0dc", color: "#6d6431", fontSize: 13, lineHeight: 18 },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  kind: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, backgroundColor: COLORS.white },
  swatch: { width: 9, height: 9, borderRadius: 5 },
  kindText: { color: COLORS.ink, fontSize: 12, fontWeight: "600" },
  kindTextOff: { color: "#a0a79f" },
  card: { marginTop: 10, padding: 15, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, backgroundColor: COLORS.white },
  label: { marginBottom: 7, color: "#869087", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  route: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6, padding: 11, borderWidth: 1, borderColor: COLORS.line, borderRadius: 7 },
  routeSelected: { borderColor: "#a8c943", backgroundColor: "#f6f9ea" },
  routeTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "700" },
  routeVia: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  badges: { alignItems: "flex-end", gap: 3 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9, overflow: "hidden", backgroundColor: "#eef4d2", color: "#4f6420", fontSize: 10, fontWeight: "700" },
  cost: { marginTop: 12, color: COLORS.ink, fontSize: 13, lineHeight: 19 },
  costValue: { fontWeight: "800" },
  costNote: { color: "#8a9389", fontSize: 11 },
  place: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#f0f2ec" },
  placeDot: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  placeSymbol: { color: "#fff", fontSize: 12 },
  placeName: { color: COLORS.ink, fontSize: 13, fontWeight: "700" },
  placeDetail: { marginTop: 2, color: COLORS.muted, fontSize: 11 },
  open: { color: "#758d2e", fontSize: 15, fontWeight: "700" },
  credit: { marginTop: 10, color: "#9ba39a", fontSize: 10, textAlign: "center" },
  pressed: { opacity: 0.75 },
});
