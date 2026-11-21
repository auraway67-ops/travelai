import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import MapScreen from "./src/MapScreen";
import PlanScreen from "./src/PlanScreen";
import StopsScreen from "./src/StopsScreen";
import TripScreen from "./src/TripScreen";
import useRoutePlaces from "./src/useRoutePlaces";
import { loadSavedTrips, plannerConnected, requestPlan, storeSavedTrips } from "./src/planner";
import { loadTripContext } from "./src/tripContext";
import { COLORS, formatMoney } from "./src/theme";

function Brand() {
  return (
    <View style={styles.brand}>
      <View style={styles.brandMark} accessibilityElementsHidden>
        <View style={[styles.brandMarkBar, styles.markBarOne]} />
        <View style={[styles.brandMarkBar, styles.markBarTwo]} />
        <View style={[styles.brandMarkBar, styles.markBarThree]} />
      </View>
      <Text style={styles.brandText}>
        AURA <Text style={styles.brandLight}>WAY</Text>
      </Text>
    </View>
  );
}

function BottomNavigation({ activeTab, onChange }) {
  const tabs = [
    { id: "plan", label: "Plan", icon: "✳" },
    { id: "trip", label: "Trip", icon: "☰" },
    { id: "map", label: "Map", icon: "⌖" },
    { id: "stops", label: "Stops", icon: "↗" },
    { id: "saved", label: "Saved", icon: "♡" },
  ];

  return (
    <View style={styles.bottomNav}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}
          >
            <Text style={[styles.navIcon, active && styles.navIconActive]}>{tab.icon}</Text>
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SavedScreen({ trips, onOpen, onRemove, onExplore }) {
  if (trips.length === 0) {
    return (
      <View style={[styles.secondaryScreen, styles.savedScreen]}>
        <View style={styles.savedIllustration}>
          <Text style={styles.savedIllustrationIcon}>♡</Text>
          <View style={styles.savedOrbit} />
        </View>
        <Text style={styles.sectionEyebrow}>KEEP THE GOOD TRIPS CLOSE</Text>
        <Text style={[styles.screenTitle, styles.savedTitle]}>Your saved trips</Text>
        <Text style={[styles.screenDescription, styles.savedDescription]}>Trips you save will live here, ready for the road.</Text>
        <Pressable onPress={onExplore} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Text style={styles.primaryButtonText}>Plan a trip <Text style={styles.buttonArrow}>↗</Text></Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.secondaryScreen}>
      <Text style={styles.sectionEyebrow}>KEEP THE GOOD TRIPS CLOSE</Text>
      <Text style={styles.screenTitle}>Your saved trips</Text>
      {trips.map((trip) => (
        <Pressable
          key={trip.id}
          onPress={() => onOpen(trip)}
          style={({ pressed }) => [styles.savedCard, pressed && styles.pressed]}
        >
          <View style={styles.savedCardIcon}><Text style={styles.savedCardIconText}>✳</Text></View>
          <View style={styles.stopInfo}>
            <Text style={styles.savedCardTitle}>{trip.plan.title}</Text>
            <Text style={styles.savedCardMeta}>
              {trip.plan.days.length} days · {trip.input.travelers} travellers · {formatMoney(trip.plan.totalEstimate, trip.plan.currency)}
              {trip.source === "sample" ? " · Template" : ""}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={`Remove ${trip.plan.title}`}
            hitSlop={10}
            onPress={() => onRemove(trip.id)}
            style={({ pressed }) => [styles.savedRemove, pressed && styles.pressed]}
          >
            <Text style={styles.savedRemoveText}>✕</Text>
          </Pressable>
        </Pressable>
      ))}
    </View>
  );
}

function AuraWayApp() {
  const [activeTab, setActiveTab] = useState("plan");
  const [trip, setTrip] = useState(null);
  // The chosen route is shared by the Trip, Map and Stops tabs.
  const [routeIndex, setRouteIndex] = useState(0);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [planProgress, setPlanProgress] = useState("");
  const [savedTrips, setSavedTrips] = useState([]);
  const scrollRef = useRef(null);
  const routePlaces = useRoutePlaces(trip, routeIndex);

  useEffect(() => {
    loadSavedTrips().then(setSavedTrips);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [activeTab, trip?.id]);

  function openTrip(next) {
    setTrip(next);
    // Start on the easiest route, as the web planner does.
    const easiest = next.context?.routes?.findIndex((r) => r.labels.includes("Easiest")) ?? -1;
    setRouteIndex(Math.max(easiest, 0));
  }

  function updateSaved(next) {
    setSavedTrips(next);
    storeSavedTrips(next);
  }

  async function handlePlan(input) {
    setPlanning(true);
    setPlanError(null);
    setPlanProgress("Planning your trip");
    try {
      // Live map, route and weather load alongside the AI plan; if they fail
      // the plan still shows and those sections explain what went wrong.
      const contextPromise = loadTripContext(input, setPlanProgress).catch(() => null);
      const { plan, source } = await requestPlan(input);
      setPlanProgress("Finishing the map and weather");
      const context = await contextPromise;
      openTrip({ id: `${Date.now()}`, createdAt: new Date().toISOString(), input, plan, source, context });
      setActiveTab("trip");
    } catch (error) {
      setPlanError(error.message);
    } finally {
      setPlanning(false);
    }
  }

  const isSaved = Boolean(trip && savedTrips.some((saved) => saved.id === trip.id));

  function toggleSave() {
    if (!trip) return;
    updateSaved(isSaved ? savedTrips.filter((saved) => saved.id !== trip.id) : [trip, ...savedTrips]);
  }

  return (
    <SafeAreaView style={styles.app} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Brand />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}
        >
          <Text style={styles.notificationIcon}>⌁</Text>
          <View style={styles.notificationDot} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.scroll} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Kept mounted so the form keeps its answers while browsing other tabs. */}
        <View style={activeTab !== "plan" && styles.hidden}>
          <PlanScreen onPlan={handlePlan} loading={planning} progress={planProgress} error={planError} connected={plannerConnected} />
        </View>
        {activeTab === "trip" && (
          <TripScreen
            trip={trip}
            saved={isSaved}
            onToggleSave={toggleSave}
            onNewPlan={() => setActiveTab("plan")}
            routeIndex={routeIndex}
            onSelectRoute={setRouteIndex}
            routePlaces={routePlaces}
          />
        )}
        {activeTab === "map" && (
          <MapScreen
            trip={trip}
            routeIndex={routeIndex}
            onSelectRoute={setRouteIndex}
            routePlaces={routePlaces}
            onPlan={() => setActiveTab("plan")}
          />
        )}
        {activeTab === "stops" && (
          <StopsScreen
            trip={trip}
            routeIndex={routeIndex}
            onSelectRoute={setRouteIndex}
            routePlaces={routePlaces}
            onPlan={() => setActiveTab("plan")}
          />
        )}
        {activeTab === "saved" && (
          <SavedScreen
            trips={savedTrips}
            onOpen={(saved) => {
              openTrip(saved);
              setActiveTab("trip");
            }}
            onRemove={(id) => updateSaved(savedTrips.filter((saved) => saved.id !== id))}
            onExplore={() => setActiveTab("plan")}
          />
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <BottomNavigation activeTab={activeTab} onChange={setActiveTab} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuraWayApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: COLORS.paper, paddingTop: 0 },
  header: {
    height: 60,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: { height: 22, width: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, transform: [{ rotate: "-38deg" }] },
  brandMarkBar: { width: 4, borderRadius: 3, backgroundColor: COLORS.ink },
  markBarOne: { height: 10, opacity: 0.55 },
  markBarTwo: { height: 17 },
  markBarThree: { height: 12, opacity: 0.75 },
  brandText: { color: COLORS.ink, fontSize: 13, fontWeight: "800", letterSpacing: 1.8 },
  brandLight: { fontWeight: "500" },
  notificationButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#eceee6" },
  notificationIcon: { color: COLORS.ink, fontSize: 21, transform: [{ rotate: "90deg" }] },
  notificationDot: { position: "absolute", top: 7, right: 7, width: 6, height: 6, borderRadius: 3, backgroundColor: "#a7be50", borderWidth: 1, borderColor: "#eceee6" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 27 },
  sectionEyebrow: { color: "#869087", fontSize: 8, fontWeight: "600", letterSpacing: 1.1 },
  bottomNav: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: COLORS.line, backgroundColor: "#fff", paddingBottom: 4 },
  navItem: { width: "20%", height: 58, alignItems: "center", justifyContent: "center", gap: 3 },
  navIcon: { color: "#9aa198", fontSize: 18, lineHeight: 20 },
  navIconActive: { color: "#758d2e" },
  navLabel: { color: "#929b92", fontSize: 8 },
  navLabelActive: { color: COLORS.ink, fontWeight: "700" },
  secondaryScreen: { paddingTop: 28 },
  screenTitle: { marginTop: 7, color: COLORS.ink, fontSize: 28, fontWeight: "700", letterSpacing: -1.3 },
  screenDescription: { maxWidth: 270, marginTop: 8, color: COLORS.muted, fontSize: 10, lineHeight: 17 },
  stopInfo: { flex: 1, marginLeft: 10, gap: 4 },
  savedScreen: { flex: 1, minHeight: 470, alignItems: "center", justifyContent: "center", paddingBottom: 45 },
  savedIllustration: { position: "relative", width: 110, height: 110, alignItems: "center", justifyContent: "center", marginBottom: 24, borderRadius: 55, backgroundColor: "#edf1e0" },
  savedIllustrationIcon: { color: "#839736", fontSize: 38 },
  savedOrbit: { position: "absolute", top: 9, right: 5, width: 20, height: 20, borderWidth: 4, borderColor: COLORS.paper, borderRadius: 10, backgroundColor: COLORS.lime },
  savedTitle: { textAlign: "center" },
  savedDescription: { textAlign: "center" },
  primaryButton: { marginTop: 21, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 4, backgroundColor: COLORS.ink },
  primaryButtonText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  buttonArrow: { fontSize: 13 },
  savedCard: { flexDirection: "row", alignItems: "center", marginTop: 12, padding: 13, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, backgroundColor: "#fff" },
  savedCardIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "#eef3dc" },
  savedCardIconText: { color: "#758d2e", fontSize: 16, fontWeight: "800" },
  savedCardTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "700" },
  savedCardMeta: { color: COLORS.muted, fontSize: 12 },
  savedRemove: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#f1f2ee" },
  savedRemoveText: { color: "#8a928a", fontSize: 12, fontWeight: "700" },
  hidden: { display: "none" },
  pressed: { opacity: 0.75 },
});
