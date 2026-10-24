import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import RouteSection from "./RouteSection";
import WeatherSection from "./WeatherSection";
import { COLORS, ITEM_STYLES, formatMoney } from "./theme";

const SECTIONS = [
  { id: "days", label: "Itinerary" },
  { id: "route", label: "Route & map" },
  { id: "weather", label: "Weather" },
  { id: "budget", label: "Budget" },
  { id: "packing", label: "Packing" },
  { id: "prep", label: "Before you go" },
];

function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function DayCard({ day, currency }) {
  const dayTotal = day.items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
  return (
    <Card>
      <View style={styles.dayHeader}>
        <View style={styles.dayBadge}><Text style={styles.dayBadgeText}>{day.day}</Text></View>
        <View style={styles.flex}>
          <Text style={styles.dayTheme}>{day.theme}</Text>
          {day.date ? <Text style={styles.dayDate}>{formatDate(day.date)}</Text> : null}
        </View>
        {dayTotal > 0 ? <Text style={styles.dayCost}>{formatMoney(dayTotal, currency)}</Text> : null}
      </View>
      {day.items.map((item, index) => {
        const look = ITEM_STYLES[item.type] ?? ITEM_STYLES.activity;
        const last = index === day.items.length - 1;
        return (
          <View key={`${index}-${item.title}`} style={styles.item}>
            <Text style={styles.itemTime}>{item.time}</Text>
            <View style={styles.itemRail}>
              <View style={[styles.itemIcon, { backgroundColor: look.tint }]}>
                <Text style={[styles.itemIconText, { color: look.color }]}>{look.icon}</Text>
              </View>
              {!last && <View style={styles.itemLine} />}
            </View>
            <View style={[styles.itemBody, !last && styles.itemBodySpaced]}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {item.description ? <Text style={styles.itemDescription}>{item.description}</Text> : null}
              <Text style={styles.itemMeta}>
                {item.location}
                {item.cost > 0 ? `  ·  ${formatMoney(item.cost, currency)}` : ""}
              </Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const MODE_ICONS = { bus: "▭", train: "≡", flight: "✈", car: "◆", ev: "ϟ", ferry: "≈", rideshare: "⇄" };

function ItinerarySection({ plan, input }) {
  // Plans saved before these fields existed won't have them.
  const climate = plan.climate;
  const travelOptions = plan.travelOptions ?? [];
  const viewpoints = plan.viewpoints ?? [];
  const roadTrip = plan.roadTrip;
  const driving = input.travelMode === "petrol" || input.travelMode === "ev";

  return (
    <>
      {climate && (climate.season || climate.safetyNotes?.length > 0) && (
        <Card style={climate.safetyNotes?.length > 0 && styles.warnCard}>
          <Text style={styles.cardLabel}>WEATHER & SAFETY</Text>
          {climate.season ? <Text style={styles.body}>{climate.season}</Text> : null}
          {climate.safetyNotes?.map((note, index) => (
            <View key={`${index}-${note}`} style={styles.tip}>
              <Text style={styles.warnBullet}>!</Text>
              <Text style={[styles.body, styles.flex]}>{note}</Text>
            </View>
          ))}
        </Card>
      )}
      <Card>
        <Text style={styles.cardLabel}>GETTING THERE</Text>
        <Text style={styles.body}>{plan.transport.gettingThere}</Text>
        {travelOptions.map((option, index) => (
          <View key={`${index}-${option.mode}`} style={styles.travelOption}>
            <View style={styles.modeIcon}><Text style={styles.modeIconText}>{MODE_ICONS[option.mode] ?? "↗"}</Text></View>
            <View style={styles.flex}>
              <Text style={styles.stayName}>
                {option.mode === "ev" ? "Electric car" : option.mode.charAt(0).toUpperCase() + option.mode.slice(1)}
                <Text style={styles.travelDuration}>  ·  {option.duration}</Text>
              </Text>
              <Text style={styles.stayArea}>{option.route}</Text>
              {option.note ? <Text style={styles.body}>{option.note}</Text> : null}
            </View>
            {option.cost > 0 ? <Text style={styles.stayPrice}>{formatMoney(option.cost, plan.currency)}</Text> : null}
          </View>
        ))}
        <Text style={[styles.cardLabel, styles.spacedLabel]}>GETTING AROUND</Text>
        <Text style={styles.body}>{plan.transport.gettingAround}</Text>
        {roadTrip && (driving || roadTrip.drivingNotes) ? (
          <>
            <Text style={[styles.cardLabel, styles.spacedLabel]}>ON THE ROAD</Text>
            {driving ? (
              <Text style={styles.body}>
                {input.travelMode === "ev"
                  ? `Fast charging is typically about ${formatMoney(roadTrip.chargePricePerKwh, plan.currency, 2)} per kWh.`
                  : `Fuel is typically about ${formatMoney(roadTrip.fuelPricePerLitre, plan.currency, 2)} per litre.`}
              </Text>
            ) : null}
            {roadTrip.drivingNotes ? <Text style={[styles.body, driving && styles.spacedBody]}>{roadTrip.drivingNotes}</Text> : null}
          </>
        ) : null}
      </Card>
      {plan.stays.length > 0 && (
        <Card>
          <Text style={styles.cardLabel}>WHERE TO STAY</Text>
          {plan.stays.map((stay, index) => (
            <View key={`${index}-${stay.name}`} style={styles.stay}>
              <View style={styles.flex}>
                <Text style={styles.stayName}>{stay.name}</Text>
                <Text style={styles.stayArea}>{stay.type ? `${stay.type.charAt(0).toUpperCase()}${stay.type.slice(1)} · ` : ""}{stay.area}</Text>
                <Text style={styles.body}>{stay.why}</Text>
              </View>
              <Text style={styles.stayPrice}>
                {formatMoney(stay.nightlyPrice, plan.currency)}
                <Text style={styles.stayUnit}>{"\n"}per night</Text>
              </Text>
            </View>
          ))}
        </Card>
      )}
      {viewpoints.length > 0 && (
        <Card>
          <Text style={styles.cardLabel}>SCENIC VIEWPOINTS</Text>
          {viewpoints.map((spot, index) => (
            <View key={`${index}-${spot.name}`} style={styles.stay}>
              <View style={styles.flex}>
                <Text style={styles.stayName}>{spot.name}</Text>
                <Text style={styles.stayArea}>
                  {spot.onTheWay ? "On the way · " : ""}{spot.area}{spot.bestTime ? ` · Best at ${spot.bestTime.toLowerCase()}` : ""}
                </Text>
                <Text style={styles.body}>{spot.why}</Text>
              </View>
            </View>
          ))}
        </Card>
      )}
      {plan.days.map((day) => <DayCard key={day.day} day={day} currency={plan.currency} />)}
    </>
  );
}

function BudgetSection({ plan }) {
  const largest = Math.max(...plan.budget.map((line) => line.amount), 1);
  return (
    <Card>
      <Text style={styles.cardLabel}>ESTIMATED TOTAL</Text>
      <Text style={styles.budgetTotal}>{formatMoney(plan.totalEstimate, plan.currency)}</Text>
      <Text style={styles.muted}>For the whole group, before transport to your destination is booked.</Text>
      {plan.budget.map((line, index) => (
        <View key={`${index}-${line.category}`} style={styles.budgetLine}>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetCategory}>{line.category}</Text>
            <Text style={styles.budgetAmount}>{formatMoney(line.amount, plan.currency)}</Text>
          </View>
          <View style={styles.budgetTrack}>
            <View style={[styles.budgetFill, { width: `${(line.amount / largest) * 100}%` }]} />
          </View>
          {line.note ? <Text style={styles.budgetNote}>{line.note}</Text> : null}
        </View>
      ))}
    </Card>
  );
}

function PackingSection({ plan }) {
  const [packed, setPacked] = useState([]);
  return (
    <Card>
      <Text style={styles.cardLabel}>PACKED {packed.length} OF {plan.packing.length}</Text>
      {plan.packing.map((thing, index) => {
        const done = packed.includes(index);
        return (
          <Pressable
            key={`${index}-${thing}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            onPress={() => setPacked((current) => (done ? current.filter((x) => x !== index) : [...current, index]))}
            style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
          >
            <View style={[styles.checkbox, done && styles.checkboxDone]}>{done && <Text style={styles.checkMark}>✓</Text>}</View>
            <Text style={[styles.checkText, done && styles.checkTextDone]}>{thing}</Text>
          </Pressable>
        );
      })}
    </Card>
  );
}

function PrepSection({ plan }) {
  return (
    <>
      <Card>
        <Text style={styles.cardLabel}>BOOKING CHECKLIST</Text>
        {plan.checklist.map((entry, index) => (
          <View key={`${index}-${entry.task}`} style={styles.prepRow}>
            <Text style={styles.prepTask}>{entry.task}</Text>
            <Text style={styles.prepWhen}>{entry.when}</Text>
          </View>
        ))}
      </Card>
      <Card>
        <Text style={styles.cardLabel}>LOCAL TIPS</Text>
        {plan.tips.map((tip, index) => (
          <View key={`${index}-${tip}`} style={styles.tip}>
            <Text style={styles.tipBullet}>✳</Text>
            <Text style={[styles.body, styles.flex]}>{tip}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

export default function TripScreen({ trip, saved, onToggleSave, onNewPlan }) {
  const [section, setSection] = useState("days");

  if (!trip) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>✳</Text>
        <Text style={styles.title}>No trip yet</Text>
        <Text style={[styles.muted, styles.centered]}>Plan a trip and your full itinerary will appear here.</Text>
        <Pressable onPress={onNewPlan} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Text style={styles.primaryButtonText}>Plan a trip ↗</Text>
        </Pressable>
      </View>
    );
  }

  const { plan, input, source } = trip;
  const firstDate = plan.days[0]?.date;
  const lastDate = plan.days[plan.days.length - 1]?.date;

  return (
    <View style={styles.screen}>
      {source === "sample" && (
        <Text style={styles.sampleBanner}>Template plan · Not AI-generated. Connect the planner for real places and prices.</Text>
      )}
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>{plan.destination.toUpperCase()}</Text>
        <Text style={styles.heroTitle}>{plan.title}</Text>
        <Text style={styles.heroSummary}>{plan.summary}</Text>
        <View style={styles.heroStats}>
          <View>
            <Text style={styles.heroStatValue}>{plan.days.length}</Text>
            <Text style={styles.heroStatLabel}>{firstDate ? `${formatDate(firstDate)} – ${formatDate(lastDate)}` : "DAYS"}</Text>
          </View>
          <View>
            <Text style={styles.heroStatValue}>{input.travelers}</Text>
            <Text style={styles.heroStatLabel}>TRAVELLERS</Text>
          </View>
          <View>
            <Text style={styles.heroStatValue}>{formatMoney(plan.totalEstimate, plan.currency)}</Text>
            <Text style={styles.heroStatLabel}>EST. TOTAL</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={onToggleSave} style={({ pressed }) => [styles.actionButton, saved && styles.actionSaved, pressed && styles.pressed]}>
          <Text style={[styles.actionText, saved && styles.actionTextSaved]}>{saved ? "♥ Saved" : "♡ Save trip"}</Text>
        </Pressable>
        <Pressable onPress={onNewPlan} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
          <Text style={styles.actionText}>New plan</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabs}
        accessibilityRole="tablist"
      >
        {SECTIONS.map((tab) => (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: section === tab.id }}
            onPress={() => setSection(tab.id)}
            style={[styles.tab, section === tab.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, section === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {section === "days" && <ItinerarySection plan={plan} input={input} />}
      {section === "route" && <RouteSection key={trip.id} context={trip.context} plan={plan} input={input} />}
      {section === "weather" && <WeatherSection context={trip.context} plan={plan} />}
      {section === "budget" && <BudgetSection plan={plan} />}
      {section === "packing" && <PackingSection key={trip.id} plan={plan} />}
      {section === "prep" && <PrepSection plan={plan} />}

      <Text style={styles.disclaimer}>Prices, hours and availability are estimates. Confirm before you book.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 20 },
  flex: { flex: 1 },
  centered: { textAlign: "center" },
  sampleBanner: { marginBottom: 12, padding: 10, borderRadius: 6, backgroundColor: "#f3f0dc", color: "#6d6431", fontSize: 12, lineHeight: 17 },
  hero: { padding: 18, borderRadius: 10, backgroundColor: COLORS.ink },
  heroEyebrow: { color: COLORS.lime, fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  heroTitle: { marginTop: 6, color: "#fff", fontSize: 24, fontWeight: "700", letterSpacing: -0.8 },
  heroSummary: { marginTop: 8, color: "#c4cbc4", fontSize: 13, lineHeight: 19 },
  heroStats: { flexDirection: "row", flexWrap: "wrap", gap: 22, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#2e3a36" },
  heroStatValue: { color: "#fff", fontSize: 17, fontWeight: "800" },
  heroStatLabel: { marginTop: 2, color: "#94a096", fontSize: 10, letterSpacing: 0.6 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionButton: { flex: 1, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.line, borderRadius: 6, backgroundColor: COLORS.white },
  actionSaved: { borderColor: "#c9d88f", backgroundColor: "#eef4d2" },
  actionText: { color: COLORS.ink, fontSize: 13, fontWeight: "700" },
  actionTextSaved: { color: "#4f6420" },
  tabsScroll: { flexGrow: 0, marginTop: 16, marginBottom: 4 },
  tabs: { flexDirection: "row", padding: 3, borderRadius: 8, backgroundColor: "#e9ece2" },
  tab: { paddingHorizontal: 13, paddingVertical: 9, alignItems: "center", borderRadius: 6 },
  tabActive: { backgroundColor: COLORS.white },
  tabText: { color: "#7b847b", fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: COLORS.ink, fontWeight: "700" },
  card: { marginTop: 10, padding: 15, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, backgroundColor: COLORS.white },
  cardLabel: { marginBottom: 7, color: "#869087", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  spacedLabel: { marginTop: 14 },
  body: { color: "#4b544f", fontSize: 13, lineHeight: 19 },
  muted: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  stay: { flexDirection: "row", gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f0f2ec" },
  stayName: { color: COLORS.ink, fontSize: 14, fontWeight: "700" },
  stayArea: { marginTop: 2, marginBottom: 4, color: "#7a8a4a", fontSize: 12, fontWeight: "600" },
  stayPrice: { color: COLORS.ink, fontSize: 14, fontWeight: "800", textAlign: "right" },
  stayUnit: { color: COLORS.muted, fontSize: 10, fontWeight: "500" },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 14 },
  dayBadge: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: COLORS.lime },
  dayBadgeText: { color: COLORS.ink, fontSize: 14, fontWeight: "800" },
  dayTheme: { color: COLORS.ink, fontSize: 15, fontWeight: "700" },
  dayDate: { marginTop: 2, color: COLORS.muted, fontSize: 12 },
  dayCost: { color: "#5d6858", fontSize: 12, fontWeight: "700" },
  item: { flexDirection: "row" },
  itemTime: { width: 46, paddingTop: 6, color: "#7f887f", fontSize: 12, fontWeight: "600" },
  itemRail: { width: 30, alignItems: "center" },
  itemIcon: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  itemIconText: { fontSize: 13, fontWeight: "800" },
  itemLine: { flex: 1, width: 2, marginVertical: 3, backgroundColor: "#eef0ea" },
  itemBody: { flex: 1, paddingLeft: 9, paddingTop: 4 },
  itemBodySpaced: { paddingBottom: 16 },
  itemTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "700" },
  itemDescription: { marginTop: 3, color: "#5b645e", fontSize: 13, lineHeight: 18 },
  itemMeta: { marginTop: 4, color: "#909890", fontSize: 11 },
  budgetTotal: { color: COLORS.ink, fontSize: 30, fontWeight: "800", letterSpacing: -1 },
  budgetLine: { marginTop: 16 },
  budgetRow: { flexDirection: "row", justifyContent: "space-between" },
  budgetCategory: { color: COLORS.ink, fontSize: 13, fontWeight: "600" },
  budgetAmount: { color: COLORS.ink, fontSize: 13, fontWeight: "700" },
  budgetTrack: { height: 8, marginTop: 6, borderRadius: 4, backgroundColor: "#eef0ea", overflow: "hidden" },
  budgetFill: { height: 8, borderRadius: 4, backgroundColor: "#a8c943" },
  budgetNote: { marginTop: 4, color: "#8a9389", fontSize: 11 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 9 },
  checkbox: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#cfd5c8", borderRadius: 5 },
  checkboxDone: { borderColor: "#8ca336", backgroundColor: "#8ca336" },
  checkMark: { color: "#fff", fontSize: 13, fontWeight: "800" },
  checkText: { flex: 1, color: COLORS.ink, fontSize: 14 },
  checkTextDone: { color: "#9aa198", textDecorationLine: "line-through" },
  prepRow: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#f0f2ec" },
  prepTask: { color: COLORS.ink, fontSize: 14, fontWeight: "600" },
  prepWhen: { marginTop: 2, color: "#7a8a4a", fontSize: 12 },
  tip: { flexDirection: "row", gap: 9, paddingVertical: 6 },
  tipBullet: { color: "#8ca336", fontSize: 12, marginTop: 3 },
  warnCard: { borderColor: "#ecd3b8", backgroundColor: "#fdf7f0" },
  warnBullet: { width: 16, height: 16, marginTop: 2, borderRadius: 8, overflow: "hidden", backgroundColor: "#d9883f", color: "#fff", fontSize: 11, fontWeight: "800", textAlign: "center" },
  travelOption: { flexDirection: "row", gap: 11, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f0f2ec" },
  modeIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#e5edf0" },
  modeIconText: { color: "#5f7a86", fontSize: 14, fontWeight: "800" },
  travelDuration: { color: COLORS.muted, fontSize: 12, fontWeight: "500" },
  spacedBody: { marginTop: 6 },
  disclaimer: { marginTop: 14, color: "#9ba39a", fontSize: 11, textAlign: "center" },
  empty: { minHeight: 470, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  emptyIcon: { marginBottom: 14, color: "#8ca336", fontSize: 40 },
  title: { color: COLORS.ink, fontSize: 26, fontWeight: "700", letterSpacing: -1 },
  primaryButton: { marginTop: 20, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 6, backgroundColor: COLORS.ink },
  primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.75 },
});
