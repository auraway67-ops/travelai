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
import PlanScreen from "./src/PlanScreen";
import TripScreen from "./src/TripScreen";
import { loadSavedTrips, plannerConnected, requestPlan, storeSavedTrips } from "./src/planner";
import { loadTripContext } from "./src/tripContext";
import { COLORS, formatMoney } from "./src/theme";

const STOPS = [
  { name: "Greenway Fuel", distance: "0.8 mi", detail: "Open 24 hours", price: "$3.49", color: "#79923a" },
  { name: "Northside Market", distance: "1.4 mi", detail: "Fuel · Convenience", price: "$3.55", color: "#c58c4a" },
  { name: "River Road Station", distance: "2.1 mi", detail: "Fuel · Cafe", price: "$3.59", color: "#778d58" },
];

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

function MapPreview({ trafficVisible, fuelVisible, isThreeDimensional }) {
  return (
    <View style={styles.mapFrame}>
      <View style={[styles.mapSurface, !isThreeDimensional && styles.mapFlat]}>
        <View style={styles.parkOne}>
          <Text style={styles.parkLabel}>RIVERSIDE{"\n"}GARDENS</Text>
        </View>
        <View style={styles.parkTwo} />
        <View style={styles.waterway} />
        <View style={[styles.cityBlock, styles.blockOne]} />
        <View style={[styles.cityBlock, styles.blockTwo]} />
        <View style={[styles.cityBlock, styles.blockThree]} />
        <View style={[styles.cityBlock, styles.blockFour]} />
        <View style={[styles.cityBlock, styles.blockFive]} />
        <View style={[styles.road, styles.roadOne]} />
        <View style={[styles.road, styles.roadTwo]} />
        <View style={[styles.road, styles.roadThree]} />
        <View style={[styles.road, styles.roadFour]} />
        <View style={[styles.road, styles.mainRoad]} />
        <View style={[styles.route, styles.routeOne]} />
        <View style={[styles.route, styles.routeTwo]} />
        <View style={[styles.route, styles.routeThree]} />
        <Text style={[styles.streetName, styles.streetNorth]}>NORTH LOOP</Text>
        <Text style={[styles.streetName, styles.streetRiver]}>RIVER ROAD</Text>
        <View style={styles.startPin}><View style={styles.startPinDot} /></View>
        <View style={styles.destinationPin}><View style={styles.destinationPinDot} /></View>
        {fuelVisible && (
          <>
            <View style={[styles.fuelPin, styles.fuelPinOne]}><Text style={styles.fuelPinText}>↗</Text></View>
            <View style={[styles.fuelPin, styles.fuelPinTwo]}><Text style={styles.fuelPinText}>↗</Text></View>
          </>
        )}
        {trafficVisible && (
          <>
            <View style={[styles.trafficTag, styles.trafficOne]}><View style={styles.slowDot} /><Text style={styles.mapTagText}>SLOW AHEAD</Text></View>
            <View style={[styles.trafficTag, styles.trafficTwo]}><View style={styles.clearDot} /><Text style={styles.mapTagText}>MOVING WELL</Text></View>
          </>
        )}
      </View>
      <View style={styles.mapCaption}>
        <View style={styles.sampleDot} />
        <Text style={styles.sampleText}>CONCEPT MAP · SAMPLE ROUTE</Text>
      </View>
      <View style={styles.compass}><Text style={styles.compassArrow}>↑</Text><Text style={styles.compassN}>N</Text></View>
    </View>
  );
}

function LayerButton({ label, active, onPress }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.layerButton, active && styles.layerButtonActive, pressed && styles.pressed]}
    >
      <Text style={[styles.layerButtonText, active && styles.layerButtonTextActive]}>{label}</Text>
      <View style={[styles.switchTrack, active && styles.switchTrackActive]}>
        <View style={[styles.switchKnob, active && styles.switchKnobActive]} />
      </View>
    </Pressable>
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

function StopCard({ stop }) {
  return (
    <View style={styles.stopCard}>
      <View style={[styles.stopIcon, { backgroundColor: `${stop.color}18` }]}>
        <Text style={[styles.stopIconText, { color: stop.color }]}>↗</Text>
      </View>
      <View style={styles.stopInfo}>
        <Text style={styles.stopName}>{stop.name}</Text>
        <Text style={styles.stopDetail}>{stop.detail}</Text>
      </View>
      <View style={styles.stopMeta}>
        <Text style={styles.stopDistance}>{stop.distance}</Text>
        <Text style={styles.stopPrice}>{stop.price}<Text style={styles.stopUnit}> / gal</Text></Text>
      </View>
    </View>
  );
}

function StopsScreen() {
  return (
    <View style={styles.secondaryScreen}>
      <Text style={styles.sectionEyebrow}>A LITTLE FUEL FOR THE WAY</Text>
      <Text style={styles.screenTitle}>Stops nearby</Text>
      <Text style={styles.screenDescription}>A few places to pause, all close to your sample route.</Text>
      <View style={styles.nearbyBanner}>
        <Text style={styles.nearbyIcon}>⌖</Text>
        <View>
          <Text style={styles.nearbyTitle}>Around your route</Text>
          <Text style={styles.nearbySub}>Sample locations · Not live data</Text>
        </View>
      </View>
      {STOPS.map((stop) => <StopCard key={stop.name} stop={stop} />)}
      <Text style={styles.disclaimer}>Prices and locations are illustrative. Live station data isn’t connected yet.</Text>
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
  const [trafficVisible, setTrafficVisible] = useState(true);
  const [fuelVisible, setFuelVisible] = useState(true);
  const [isThreeDimensional, setIsThreeDimensional] = useState(true);
  const [trip, setTrip] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [planProgress, setPlanProgress] = useState("");
  const [savedTrips, setSavedTrips] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    loadSavedTrips().then(setSavedTrips);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [activeTab, trip?.id]);

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
      setTrip({ id: `${Date.now()}`, createdAt: new Date().toISOString(), input, plan, source, context });
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
          <TripScreen trip={trip} saved={isSaved} onToggleSave={toggleSave} onNewPlan={() => setActiveTab("plan")} />
        )}
        {activeTab === "map" && (
          <>
            <View style={styles.welcome}>
              <View>
                <Text style={styles.sectionEyebrow}>YOUR NEXT ADVENTURE STARTS HERE</Text>
                <Text style={styles.greeting}>Where to today?</Text>
              </View>
              <View style={styles.weatherBadge}>
                <Text style={styles.weatherIcon}>☼</Text>
                <Text style={styles.weatherText}>72°</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveTab("plan")}
              style={({ pressed }) => [styles.searchBox, pressed && styles.pressed]}
            >
              <Text style={styles.searchIcon}>⌕</Text>
              <Text style={styles.searchPlaceholder}>Where would you like to go?</Text>
              <View style={styles.searchMic}><Text style={styles.searchMicText}>···</Text></View>
            </Pressable>
            <View style={styles.mapHeading}>
              <View>
                <Text style={styles.mapHeadingTitle}>Your route, at a glance</Text>
                <Text style={styles.mapHeadingSubtitle}>A sample journey through the city</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="3D map view"
                accessibilityState={{ checked: isThreeDimensional }}
                onPress={() => setIsThreeDimensional((current) => !current)}
                style={({ pressed }) => [styles.viewToggle, pressed && styles.pressed]}
              >
                <Text style={[styles.viewToggleText, isThreeDimensional && styles.viewToggleTextActive]}>
                  {isThreeDimensional ? "3D" : "2D"}
                </Text>
              </Pressable>
            </View>
            <MapPreview
              trafficVisible={trafficVisible}
              fuelVisible={fuelVisible}
              isThreeDimensional={isThreeDimensional}
            />
            <View style={styles.layerPanel}>
              <View style={styles.layerPanelHeading}>
                <Text style={styles.layerTitle}>Make it yours</Text>
                <Text style={styles.layerSubtitle}>Choose what you see</Text>
              </View>
              <View style={styles.layerButtons}>
                <LayerButton label="Traffic" active={trafficVisible} onPress={() => setTrafficVisible((value) => !value)} />
                <LayerButton label="Fuel stops" active={fuelVisible} onPress={() => setFuelVisible((value) => !value)} />
              </View>
            </View>
            <View style={styles.routeCard}>
              <View style={styles.routeCardTop}>
                <View style={styles.destinationIcon}><View style={styles.destinationIconDot} /></View>
                <View style={styles.destinationCopy}>
                  <Text style={styles.routeLabel}>DESTINATION</Text>
                  <Text style={styles.destinationName}>Downtown</Text>
                </View>
                <Text style={styles.routeMenu}>···</Text>
              </View>
              <View style={styles.routeDivider} />
              <View style={styles.routeStats}>
                <View><Text style={styles.statValue}>18 <Text style={styles.statUnit}>min</Text></Text><Text style={styles.statLabel}>ESTIMATED</Text></View>
                <View style={styles.statDivider} />
                <View><Text style={styles.statValue}>8.4 <Text style={styles.statUnit}>mi</Text></Text><Text style={styles.statLabel}>TO GO</Text></View>
                <View style={styles.trafficSummary}><View style={styles.clearDot} /><Text style={styles.trafficSummaryText}>Moving well</Text></View>
              </View>
            </View>
            <Text style={styles.mapDisclaimer}>Concept preview · Route, traffic, and nearby places are sample data.</Text>
          </>
        )}
        {activeTab === "stops" && <StopsScreen />}
        {activeTab === "saved" && (
          <SavedScreen
            trips={savedTrips}
            onOpen={(saved) => {
              setTrip(saved);
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
  welcome: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 17 },
  sectionEyebrow: { color: "#869087", fontSize: 8, fontWeight: "600", letterSpacing: 1.1 },
  greeting: { marginTop: 5, color: COLORS.ink, fontSize: 25, fontWeight: "700", letterSpacing: -1.1 },
  weatherBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, backgroundColor: "#ecefe2" },
  weatherIcon: { color: "#a88b3f", fontSize: 15 },
  weatherText: { color: "#5d6858", fontSize: 10, fontWeight: "700" },
  searchBox: { height: 47, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 5 },
  searchIcon: { width: 25, color: "#829137", fontSize: 23, lineHeight: 25 },
  searchPlaceholder: { flex: 1, color: "#9ba29a", fontSize: 10 },
  searchMic: { width: 27, height: 27, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#f1f3ea" },
  searchMicText: { marginTop: -7, color: "#778742", fontSize: 17, fontWeight: "700", letterSpacing: -2 },
  mapHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 23, marginBottom: 11 },
  mapHeadingTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "700", letterSpacing: -0.25 },
  mapHeadingSubtitle: { marginTop: 3, color: COLORS.muted, fontSize: 9 },
  viewToggle: { minWidth: 39, height: 29, alignItems: "center", justifyContent: "center", borderRadius: 4, backgroundColor: "#e9eddf" },
  viewToggleText: { color: "#788273", fontSize: 9, fontWeight: "800" },
  viewToggleTextActive: { color: "#5d7424" },
  mapFrame: { height: 238, overflow: "hidden", borderWidth: 1, borderColor: "#dfe4d8", borderRadius: 7, backgroundColor: COLORS.map },
  mapSurface: { position: "absolute", top: -12, right: -12, bottom: -12, left: -12, overflow: "hidden", backgroundColor: COLORS.map, transform: [{ perspective: 700 }, { rotateX: "13deg" }, { scale: 1.06 }] },
  mapFlat: { transform: [{ perspective: 700 }, { rotateX: "0deg" }, { scale: 1.02 }] },
  parkOne: { position: "absolute", top: "9%", left: "5%", width: "31%", height: "29%", borderRadius: 45, backgroundColor: "#d5e2c4", transform: [{ rotate: "-13deg" }] },
  parkLabel: { position: "absolute", top: "38%", left: "25%", color: "#87977c", fontSize: 6, lineHeight: 9, letterSpacing: 0.7 },
  parkTwo: { position: "absolute", right: "5%", bottom: "4%", width: "27%", height: "30%", borderRadius: 45, backgroundColor: "#d5e2c4", transform: [{ rotate: "15deg" }] },
  waterway: { position: "absolute", top: "-28%", right: "-4%", width: "18%", height: "155%", borderLeftWidth: 14, borderLeftColor: "rgba(255,255,255,0.45)", backgroundColor: "#d1dfd5", transform: [{ rotate: "25deg" }] },
  cityBlock: { position: "absolute", borderRadius: 3, backgroundColor: "#dce4d4", borderWidth: 1, borderColor: "rgba(126,144,112,0.15)" },
  blockOne: { top: "8%", left: "42%", width: "15%", height: "12%", transform: [{ rotate: "-10deg" }] },
  blockTwo: { top: "49%", right: "10%", width: "20%", height: "13%", transform: [{ rotate: "9deg" }] },
  blockThree: { bottom: "9%", left: "20%", width: "17%", height: "13%", transform: [{ rotate: "-6deg" }] },
  blockFour: { top: "68%", left: "52%", width: "16%", height: "12%", transform: [{ rotate: "7deg" }] },
  blockFive: { top: "10%", right: "17%", width: "12%", height: "9%", transform: [{ rotate: "6deg" }] },
  road: { position: "absolute", height: 8, borderRadius: 8, backgroundColor: "#fff" },
  roadOne: { top: "21%", left: "-5%", width: "84%", transform: [{ rotate: "8deg" }] },
  roadTwo: { top: "42%", left: "-4%", width: "72%", transform: [{ rotate: "-11deg" }] },
  roadThree: { top: "72%", left: "-7%", width: "90%", transform: [{ rotate: "-7deg" }] },
  roadFour: { top: "-5%", left: "29%", width: 8, height: "120%", transform: [{ rotate: "17deg" }] },
  mainRoad: { top: "49%", left: "-9%", width: "120%", height: 15, backgroundColor: "#fff", transform: [{ rotate: "-8deg" }] },
  route: { position: "absolute", height: 3, borderRadius: 2, backgroundColor: COLORS.green },
  routeOne: { top: "57%", left: "10%", width: "32%", transform: [{ rotate: "-8deg" }] },
  routeTwo: { top: "51%", left: "39%", width: "25%", transform: [{ rotate: "-17deg" }] },
  routeThree: { top: "43%", left: "61%", width: "27%", transform: [{ rotate: "-8deg" }] },
  streetName: { position: "absolute", color: "#9ca697", fontSize: 5, letterSpacing: 1 },
  streetNorth: { top: "28%", left: "57%", transform: [{ rotate: "-8deg" }] },
  streetRiver: { bottom: "15%", left: "46%", transform: [{ rotate: "-8deg" }] },
  startPin: { position: "absolute", top: "51%", left: "15%", width: 16, height: 16, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "rgba(23,33,30,0.15)" },
  startPinDot: { width: 9, height: 9, borderWidth: 2, borderColor: "#fff", borderRadius: 5, backgroundColor: COLORS.ink },
  destinationPin: { position: "absolute", top: "32%", right: "17%", width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "rgba(217,240,106,0.42)" },
  destinationPinDot: { width: 12, height: 12, borderWidth: 3, borderColor: "#fff", borderRadius: 7, backgroundColor: "#a8c943" },
  fuelPin: { position: "absolute", width: 20, height: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e7eadf", borderRadius: 6, backgroundColor: "#fff", transform: [{ rotate: "-45deg" }] },
  fuelPinOne: { top: "45%", left: "47%" },
  fuelPinTwo: { bottom: "17%", right: "28%" },
  fuelPinText: { color: "#708a25", fontSize: 11, fontWeight: "800", transform: [{ rotate: "45deg" }] },
  trafficTag: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 5, borderWidth: 1, borderColor: "#e8eadf", borderRadius: 3, backgroundColor: "rgba(255,255,255,0.96)" },
  trafficOne: { top: "37%", left: "31%" },
  trafficTwo: { top: "61%", left: "59%" },
  slowDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#e5a05b" },
  clearDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#99b942" },
  mapTagText: { color: "#697369", fontSize: 5, fontWeight: "600", letterSpacing: 0.3 },
  mapCaption: { position: "absolute", bottom: 9, left: 9, zIndex: 2, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.9)" },
  sampleDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#a3bf42" },
  sampleText: { color: "#758076", fontSize: 6, letterSpacing: 0.4 },
  compass: { position: "absolute", top: 8, right: 10, zIndex: 2, alignItems: "center" },
  compassArrow: { color: "#647065", fontSize: 14, lineHeight: 15 },
  compassN: { color: "#647065", fontSize: 6, fontWeight: "700" },
  layerPanel: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 61, marginTop: 11, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.line, borderRadius: 5, backgroundColor: "#fff" },
  layerPanelHeading: { gap: 3 },
  layerTitle: { color: COLORS.ink, fontSize: 9, fontWeight: "700" },
  layerSubtitle: { color: "#929a92", fontSize: 7 },
  layerButtons: { flexDirection: "row", gap: 7 },
  layerButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 7, paddingVertical: 7, borderWidth: 1, borderColor: "#e6e8df", borderRadius: 4, backgroundColor: "#fafbf8" },
  layerButtonActive: { borderColor: "#e0e7c9", backgroundColor: "#f7f9ef" },
  layerButtonText: { color: "#8b948b", fontSize: 7, fontWeight: "600" },
  layerButtonTextActive: { color: "#586d26" },
  switchTrack: { width: 22, height: 12, justifyContent: "center", paddingHorizontal: 2, borderRadius: 7, backgroundColor: "#dce0d8" },
  switchTrackActive: { backgroundColor: "#bccd7b" },
  switchKnob: { width: 8, height: 8, borderRadius: 5, backgroundColor: "#fff" },
  switchKnobActive: { alignSelf: "flex-end", backgroundColor: "#fff" },
  routeCard: { marginTop: 11, paddingHorizontal: 13, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.line, borderRadius: 5, backgroundColor: "#fff" },
  routeCardTop: { flexDirection: "row", alignItems: "center" },
  destinationIcon: { width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#eff3df" },
  destinationIconDot: { width: 8, height: 8, borderWidth: 2, borderColor: "#fff", borderRadius: 4, backgroundColor: "#99b942" },
  destinationCopy: { marginLeft: 9, gap: 3 },
  routeLabel: { color: "#9aa198", fontSize: 6, letterSpacing: 0.8 },
  destinationName: { color: COLORS.ink, fontSize: 10, fontWeight: "700" },
  routeMenu: { marginLeft: "auto", color: "#8b958c", fontSize: 18, letterSpacing: -2 },
  routeDivider: { height: 1, marginVertical: 10, backgroundColor: "#eef0e9" },
  routeStats: { flexDirection: "row", alignItems: "center", gap: 16 },
  statValue: { color: COLORS.ink, fontSize: 13, fontWeight: "800", letterSpacing: -0.4 },
  statUnit: { color: "#68736c", fontSize: 8, fontWeight: "500" },
  statLabel: { marginTop: 3, color: "#9aa198", fontSize: 6, letterSpacing: 0.8 },
  statDivider: { width: 1, height: 25, backgroundColor: "#e9ece3" },
  trafficSummary: { flexDirection: "row", alignItems: "center", gap: 5, marginLeft: "auto" },
  trafficSummaryText: { color: "#75816e", fontSize: 7 },
  mapDisclaimer: { marginTop: 9, color: "#9ba39a", fontSize: 7, textAlign: "center" },
  bottomNav: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-around", borderTopWidth: 1, borderTopColor: COLORS.line, backgroundColor: "#fff", paddingBottom: 4 },
  navItem: { width: "20%", height: 58, alignItems: "center", justifyContent: "center", gap: 3 },
  navIcon: { color: "#9aa198", fontSize: 18, lineHeight: 20 },
  navIconActive: { color: "#758d2e" },
  navLabel: { color: "#929b92", fontSize: 8 },
  navLabelActive: { color: COLORS.ink, fontWeight: "700" },
  secondaryScreen: { paddingTop: 28 },
  screenTitle: { marginTop: 7, color: COLORS.ink, fontSize: 28, fontWeight: "700", letterSpacing: -1.3 },
  screenDescription: { maxWidth: 270, marginTop: 8, color: COLORS.muted, fontSize: 10, lineHeight: 17 },
  nearbyBanner: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 23, marginBottom: 12, padding: 13, borderRadius: 5, backgroundColor: "#e9eddf" },
  nearbyIcon: { color: "#748a2d", fontSize: 20 },
  nearbyTitle: { color: COLORS.ink, fontSize: 9, fontWeight: "700" },
  nearbySub: { marginTop: 3, color: "#778173", fontSize: 7 },
  stopCard: { flexDirection: "row", alignItems: "center", minHeight: 66, marginBottom: 8, paddingHorizontal: 11, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.line, borderRadius: 5, backgroundColor: "#fff" },
  stopIcon: { width: 31, height: 31, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  stopIconText: { fontSize: 16, fontWeight: "800" },
  stopInfo: { flex: 1, marginLeft: 10, gap: 4 },
  stopName: { color: COLORS.ink, fontSize: 9, fontWeight: "700" },
  stopDetail: { color: "#929a92", fontSize: 7 },
  stopMeta: { alignItems: "flex-end", gap: 4 },
  stopDistance: { color: "#869087", fontSize: 7 },
  stopPrice: { color: COLORS.ink, fontSize: 9, fontWeight: "700" },
  stopUnit: { color: "#949c94", fontSize: 6, fontWeight: "400" },
  disclaimer: { marginTop: 7, color: "#9ba39a", fontSize: 7, lineHeight: 12 },
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
