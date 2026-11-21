import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { EV_KWH_PER_100KM, PETROL_L_PER_100KM } from "./RouteSection";
import { COLORS, formatMoney } from "./theme";

const round2 = (n) => String(Math.round((Number(n) || 0) * 100) / 100);

// Starting values come from the AI plan. Every one can be changed.
function startingValues(plan, input, ev) {
  const days = plan.days.length;
  const cheapestStay = Math.min(...plan.stays.map((s) => s.nightlyPrice).filter((n) => n > 0));
  const foodLine = plan.budget.find((line) => /food|meal|dining|eat/i.test(line.category));
  return {
    consumption: String(ev ? EV_KWH_PER_100KM : PETROL_L_PER_100KM),
    price: round2(ev ? plan.roadTrip?.chargePricePerKwh : plan.roadTrip?.fuelPricePerLitre),
    stay: Number.isFinite(cheapestStay) ? String(Math.round(cheapestStay)) : "0",
    food: foodLine ? String(Math.round(foodLine.amount / Math.max(days * input.travelers, 1))) : "0",
    extras: "0",
  };
}

function NumberField({ label, value, onChange }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9.]/g, ""))}
        keyboardType="decimal-pad"
        style={styles.input}
        maxLength={9}
      />
    </View>
  );
}

// What the trip costs if you drive the chosen route: fuel or charging, stays,
// food and extras.
export default function RoadBudget({ route, plan, input }) {
  const ev = input.travelMode === "ev";
  const [values, setValues] = useState(() => startingValues(plan, input, ev));
  const [returnTrip, setReturnTrip] = useState(true);
  const set = (key) => (value) => setValues((current) => ({ ...current, [key]: value }));
  const num = (key) => Math.max(0, Number(values[key]) || 0);

  const km = route.distanceKm * (returnTrip ? 2 : 1);
  const nights = Math.max(plan.days.length - 1, 0);
  const days = plan.days.length;
  const units = (km / 100) * num("consumption");
  const energy = units * num("price");
  const stays = nights * num("stay");
  const food = days * input.travelers * num("food");
  const extras = num("extras");
  const total = energy + stays + food + extras;
  const money = (n) => formatMoney(n, plan.currency);

  const lines = [
    { label: ev ? "Charging" : "Fuel", note: `${Math.round(km)} km · about ${Math.round(units)} ${ev ? "kWh" : "L"}`, amount: energy },
    { label: "Stays", note: `${nights} night${nights === 1 ? "" : "s"}`, amount: stays },
    { label: "Food", note: `${days} day${days === 1 ? "" : "s"} × ${input.travelers} traveller${input.travelers === 1 ? "" : "s"}`, amount: food },
    { label: "Tolls, parking, tickets", note: null, amount: extras },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.label}>IF YOU DRIVE THIS ROUTE</Text>
      <Text style={styles.muted}>Change any number to match your car and prices. Amounts are in {plan.currency}.</Text>
      <View style={styles.grid}>
        <NumberField label={ev ? "kWh per 100 km" : "Litres per 100 km"} value={values.consumption} onChange={set("consumption")} />
        <NumberField label={ev ? "Price per kWh" : "Price per litre"} value={values.price} onChange={set("price")} />
        <NumberField label="Stay per night" value={values.stay} onChange={set("stay")} />
        <NumberField label="Food per person / day" value={values.food} onChange={set("food")} />
        <NumberField label="Tolls, parking, tickets" value={values.extras} onChange={set("extras")} />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: returnTrip }}
          onPress={() => setReturnTrip((on) => !on)}
          style={({ pressed }) => [styles.field, styles.check, pressed && styles.pressed]}
        >
          <View style={[styles.checkbox, returnTrip && styles.checkboxOn]}>{returnTrip && <Text style={styles.checkMark}>✓</Text>}</View>
          <Text style={styles.checkText}>Include the drive home</Text>
        </Pressable>
      </View>

      {lines.map((line) => (
        <View key={line.label} style={styles.line}>
          <View style={styles.flex}>
            <Text style={styles.lineLabel}>{line.label}</Text>
            {line.note ? <Text style={styles.lineNote}>{line.note}</Text> : null}
          </View>
          <Text style={styles.lineAmount}>{money(line.amount)}</Text>
        </View>
      ))}
      <View style={styles.total}>
        <View style={styles.flex}>
          <Text style={styles.totalLabel}>Estimated total</Text>
          <Text style={styles.totalNote}>{money(total / input.travelers)} per person</Text>
        </View>
        <Text style={styles.totalAmount}>{money(total)}</Text>
      </View>

      <Text style={[styles.label, styles.spaced]}>WAYS TO SPEND LESS</Text>
      <Text style={styles.tip}>
        • {ev
          ? "Charge at your stay overnight. It's usually far cheaper than fast chargers."
          : "Fill up away from motorway service areas, which often charge more."}
      </Text>
      {input.travelers > 1 ? (
        <Text style={styles.tip}>
          • Sharing the car saves {money(energy - energy / input.travelers)} on {ev ? "charging" : "fuel"} compared with each person driving alone.
        </Text>
      ) : null}
      <Text style={styles.tip}>• Book stays a few weeks ahead. Prices often rise close to the date.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: 10, padding: 15, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, backgroundColor: COLORS.white },
  label: { marginBottom: 7, color: "#869087", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  spaced: { marginTop: 16 },
  muted: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10, marginBottom: 6 },
  field: { width: "47%", flexGrow: 1 },
  fieldLabel: { marginBottom: 5, color: "#7f887f", fontSize: 11, fontWeight: "600" },
  input: { height: 42, paddingHorizontal: 11, borderWidth: 1, borderColor: COLORS.line, borderRadius: 6, backgroundColor: "#fafbf8", color: COLORS.ink, fontSize: 14 },
  check: { flexDirection: "row", alignItems: "center", gap: 9, alignSelf: "flex-end", height: 42 },
  checkbox: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#cfd5c8", borderRadius: 5 },
  checkboxOn: { borderColor: "#8ca336", backgroundColor: "#8ca336" },
  checkMark: { color: "#fff", fontSize: 13, fontWeight: "800" },
  checkText: { color: COLORS.ink, fontSize: 13 },
  line: { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#f0f2ec" },
  lineLabel: { color: COLORS.ink, fontSize: 13, fontWeight: "600" },
  lineNote: { marginTop: 2, color: COLORS.muted, fontSize: 11 },
  lineAmount: { color: COLORS.ink, fontSize: 13, fontWeight: "700" },
  total: { flexDirection: "row", alignItems: "center", marginTop: 6, padding: 12, borderRadius: 7, backgroundColor: COLORS.ink },
  totalLabel: { color: "#fff", fontSize: 14, fontWeight: "700" },
  totalNote: { marginTop: 2, color: "#a9b3aa", fontSize: 11 },
  totalAmount: { color: COLORS.lime, fontSize: 20, fontWeight: "800" },
  tip: { marginTop: 4, color: "#4b544f", fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.75 },
});
