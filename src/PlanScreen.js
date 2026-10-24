import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { COLORS } from "./theme";

const BUDGETS = ["Budget", "Comfort", "Luxury"];
const PACES = ["Relaxed", "Balanced", "Packed"];
const TRAVEL_MODES = [
  { id: "any", label: "Cheapest & easiest" },
  { id: "transit", label: "Bus & train" },
  { id: "petrol", label: "Petrol car" },
  { id: "ev", label: "Electric car" },
];
const INTERESTS = ["Food", "Culture", "Nature", "Nightlife", "Shopping", "Beaches", "Adventure", "Relaxing", "Family"];

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function Field({ label, children, hint }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function Chip({ label, selected, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Stepper({ value, onChange, min, max, unit }) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityLabel={`Fewer ${unit}`}
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
        style={({ pressed }) => [styles.stepButton, value <= min && styles.stepDisabled, pressed && styles.pressed]}
      >
        <Text style={styles.stepButtonText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>
        {value} <Text style={styles.stepUnit}>{unit}</Text>
      </Text>
      <Pressable
        accessibilityLabel={`More ${unit}`}
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        style={({ pressed }) => [styles.stepButton, value >= max && styles.stepDisabled, pressed && styles.pressed]}
      >
        <Text style={styles.stepButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

export default function PlanScreen({ onPlan, loading, progress, error, connected }) {
  const [destination, setDestination] = useState("");
  const [origin, setOrigin] = useState("");
  const [travelMode, setTravelMode] = useState("any");
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState(4);
  const [travelers, setTravelers] = useState(2);
  const [budget, setBudget] = useState("Comfort");
  const [pace, setPace] = useState("Balanced");
  const [interests, setInterests] = useState(["Food", "Culture"]);
  const [notes, setNotes] = useState("");

  const dateProblem = startDate.trim() && !isValidDate(startDate.trim()) ? "Use the format YYYY-MM-DD." : null;
  const canSubmit = destination.trim().length > 1 && !dateProblem && !loading;

  function toggleInterest(interest) {
    setInterests((current) =>
      current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]
    );
  }

  function submit() {
    if (!canSubmit) return;
    onPlan({
      destination: destination.trim(),
      origin: origin.trim(),
      travelMode,
      startDate: startDate.trim(),
      days,
      travelers,
      budget,
      pace,
      interests,
      notes: notes.trim(),
    });
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>YOUR WHOLE TRIP, PLANNED</Text>
      <Text style={styles.title}>Where to next?</Text>
      <Text style={styles.description}>
        Tell us the basics. AURA WAY plans the journey, stays, every day of the itinerary, the budget and what to pack.
      </Text>

      {!connected && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Sample mode</Text>
          <Text style={styles.noticeText}>
            The AI planner isn't connected, so you'll get a template plan. Set EXPO_PUBLIC_API_URL to use the real planner.
          </Text>
        </View>
      )}

      <Field label="DESTINATION">
        <TextInput
          value={destination}
          onChangeText={setDestination}
          placeholder="Lisbon, Kyoto, the Scottish Highlands…"
          placeholderTextColor="#a3a9a1"
          style={styles.input}
          returnKeyType="next"
        />
      </Field>

      <Field label="TRAVELLING FROM" hint="Optional. Helps plan how you get there.">
        <TextInput value={origin} onChangeText={setOrigin} placeholder="Your home city" placeholderTextColor="#a3a9a1" style={styles.input} />
      </Field>

      <Field label="HOW YOU'D LIKE TO TRAVEL">
        <View style={styles.chips}>
          {TRAVEL_MODES.map((mode) => (
            <Chip key={mode.id} label={mode.label} selected={travelMode === mode.id} onPress={() => setTravelMode(mode.id)} />
          ))}
        </View>
      </Field>

      <Field label="START DATE" hint={dateProblem ?? "Optional. Leave blank if your dates are flexible."}>
        <TextInput
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#a3a9a1"
          style={[styles.input, dateProblem && styles.inputError]}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
      </Field>

      <View style={styles.row}>
        <Field label="LENGTH">
          <Stepper value={days} onChange={setDays} min={1} max={14} unit={days === 1 ? "day" : "days"} />
        </Field>
        <Field label="TRAVELLERS">
          <Stepper value={travelers} onChange={setTravelers} min={1} max={12} unit={travelers === 1 ? "person" : "people"} />
        </Field>
      </View>

      <Field label="BUDGET">
        <View style={styles.chips}>
          {BUDGETS.map((option) => (
            <Chip key={option} label={option} selected={budget === option} onPress={() => setBudget(option)} />
          ))}
        </View>
      </Field>

      <Field label="PACE">
        <View style={styles.chips}>
          {PACES.map((option) => (
            <Chip key={option} label={option} selected={pace === option} onPress={() => setPace(option)} />
          ))}
        </View>
      </Field>

      <Field label="INTERESTS">
        <View style={styles.chips}>
          {INTERESTS.map((option) => (
            <Chip key={option} label={option} selected={interests.includes(option)} onPress={() => toggleInterest(option)} />
          ))}
        </View>
      </Field>

      <Field label="ANYTHING ELSE?">
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Vegetarian, travelling with a toddler, want one fancy dinner…"
          placeholderTextColor="#a3a9a1"
          style={[styles.input, styles.notes]}
          multiline
          maxLength={500}
        />
      </Field>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={!canSubmit}
        onPress={submit}
        style={({ pressed }) => [styles.submit, !canSubmit && styles.submitDisabled, pressed && styles.pressed]}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Plan my trip ↗</Text>}
      </Pressable>
      {loading ? (
        <Text style={styles.hintCenter}>
          {progress || "Planning your trip"}…{connected ? "\nThe full plan usually takes under a minute." : ""}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 26 },
  eyebrow: { color: "#869087", fontSize: 10, fontWeight: "600", letterSpacing: 1.1 },
  title: { marginTop: 6, color: COLORS.ink, fontSize: 28, fontWeight: "700", letterSpacing: -1.2 },
  description: { marginTop: 8, marginBottom: 6, color: COLORS.muted, fontSize: 13, lineHeight: 19 },
  notice: { marginTop: 12, padding: 12, borderRadius: 6, backgroundColor: "#f3f0dc", borderWidth: 1, borderColor: "#e6e0bd" },
  noticeTitle: { color: "#6d6431", fontSize: 12, fontWeight: "700" },
  noticeText: { marginTop: 3, color: "#7d7651", fontSize: 12, lineHeight: 17 },
  field: { flex: 1, marginTop: 18 },
  label: { marginBottom: 7, color: "#7f887f", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  hint: { marginTop: 5, color: "#9aa198", fontSize: 11 },
  hintCenter: { marginTop: 9, color: "#8a9389", fontSize: 12, textAlign: "center" },
  input: { minHeight: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: COLORS.line, borderRadius: 6, backgroundColor: COLORS.white, color: COLORS.ink, fontSize: 14 },
  inputError: { borderColor: "#d9a27a" },
  notes: { minHeight: 80, paddingTop: 12, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 12 },
  stepper: { height: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 5, borderWidth: 1, borderColor: COLORS.line, borderRadius: 6, backgroundColor: COLORS.white },
  stepButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "#eef1e6" },
  stepDisabled: { opacity: 0.35 },
  stepButtonText: { color: COLORS.ink, fontSize: 18, fontWeight: "600" },
  stepValue: { color: COLORS.ink, fontSize: 15, fontWeight: "700" },
  stepUnit: { color: COLORS.muted, fontSize: 12, fontWeight: "500" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.line, borderRadius: 18, backgroundColor: COLORS.white },
  chipSelected: { borderColor: "#c9d88f", backgroundColor: "#eef4d2" },
  chipText: { color: "#6f786f", fontSize: 13 },
  chipTextSelected: { color: "#4f6420", fontWeight: "700" },
  error: { marginTop: 16, padding: 11, borderRadius: 6, backgroundColor: "#f8e9e2", color: "#8a4a2c", fontSize: 13, lineHeight: 18 },
  submit: { height: 52, marginTop: 22, alignItems: "center", justifyContent: "center", borderRadius: 6, backgroundColor: COLORS.ink },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  pressed: { opacity: 0.75 },
});
