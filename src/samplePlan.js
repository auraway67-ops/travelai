// Offline template plan, used when no planner server is configured.
// It has the same shape as the AI plan (server/tripSchema.mjs) but contains
// no destination knowledge; the UI labels it as a sample.

const DAILY_PER_PERSON = { Budget: 90, Comfort: 200, Luxury: 450 };

const BUDGET_SPLIT = [
  ["Stays", 0.4, "Based on your budget level"],
  ["Food & drink", 0.25, "Three meals plus a coffee or snack"],
  ["Activities", 0.2, "Tickets, tours and entry fees"],
  ["Getting around", 0.1, "Local transit, taxis and day trips"],
  ["Extras", 0.05, "Souvenirs and the unexpected"],
];

const INTEREST_IDEAS = {
  Food: ["Food market crawl", "Cooking class or tasting menu"],
  Culture: ["Main museum or gallery", "Historic quarter walking tour"],
  Nature: ["Park or garden morning", "Half-day hike or scenic viewpoint"],
  Nightlife: ["Evening at a local bar street", "Live music venue"],
  Shopping: ["Local design shops", "Weekend market"],
  Beaches: ["Beach morning", "Sunset by the water"],
  Adventure: ["Guided outdoor activity", "Bike or kayak rental"],
  Relaxing: ["Spa or slow café afternoon", "Unplanned wandering time"],
  Family: ["Kid-friendly attraction", "Playground or aquarium stop"],
};

export function addDays(isoDate, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate ?? "");
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

export function buildSamplePlan(input) {
  const perDay = DAILY_PER_PERSON[input.budget] ?? DAILY_PER_PERSON.Comfort;
  const total = perDay * input.travelers * input.days;
  const nights = Math.max(input.days - 1, 1);
  const ideas = (input.interests.length ? input.interests : ["Culture", "Food"]).flatMap(
    (interest) => INTEREST_IDEAS[interest] ?? []
  );
  const perActivity = Math.round((total * 0.2) / Math.max(input.days * 1.5, 1));
  const perMeal = Math.round((total * 0.25) / Math.max(input.days * 2, 1));

  const days = Array.from({ length: input.days }, (_, index) => {
    const first = index === 0;
    const last = index === input.days - 1 && input.days > 1;
    const idea = (offset) => ideas[(index * 2 + offset) % ideas.length];
    let items;
    if (first) {
      items = [
        { time: "12:00", title: `Arrive in ${input.destination}`, type: "transport", description: "Travel in and head to your stay.", location: "Arrival point", cost: 0 },
        { time: "15:00", title: "Check in and settle", type: "stay", description: "Drop bags and get your bearings.", location: "Your stay", cost: 0 },
        { time: "17:30", title: "Neighbourhood stroll", type: "free", description: "An easy first walk around your area.", location: "Near your stay", cost: 0 },
        { time: "19:30", title: "Welcome dinner", type: "food", description: "Somewhere close by and low-effort.", location: "Near your stay", cost: perMeal },
      ];
    } else if (last) {
      items = [
        { time: "09:00", title: "Slow breakfast", type: "food", description: "One last local favourite.", location: "Near your stay", cost: Math.round(perMeal / 2) },
        { time: "11:00", title: "Check out", type: "stay", description: "Leave bags if you have time to spare.", location: "Your stay", cost: 0 },
        { time: "13:00", title: "Head home", type: "transport", description: "Allow buffer time for the journey.", location: "Departure point", cost: 0 },
      ];
    } else {
      items = [
        { time: "09:30", title: idea(0), type: "activity", description: "Morning plan based on your interests.", location: input.destination, cost: perActivity },
        { time: "13:00", title: "Lunch", type: "food", description: "Somewhere near the morning stop.", location: input.destination, cost: perMeal },
        { time: "15:00", title: idea(1), type: input.pace === "Relaxed" ? "free" : "activity", description: "Afternoon plan, at your pace.", location: input.destination, cost: input.pace === "Relaxed" ? 0 : perActivity },
        { time: "19:30", title: "Dinner", type: "food", description: "Try a dish the area is known for.", location: input.destination, cost: perMeal },
      ];
    }
    return {
      day: index + 1,
      date: addDays(input.startDate, index),
      theme: first ? "Arrival" : last ? "Departure" : `Exploring ${input.destination}`,
      items,
    };
  });

  return {
    title: `${input.days} days in ${input.destination}`,
    summary: `A ${input.pace.toLowerCase()} ${input.budget.toLowerCase()} trip for ${input.travelers}. This is a template plan: connect the AURA WAY planner for real places, prices and local tips.`,
    destination: input.destination,
    currency: "USD",
    totalEstimate: total,
    bestFor: input.interests,
    transport: {
      gettingThere: input.origin ? `From ${input.origin}: compare flights, trains and driving for your dates.` : "Compare flights, trains and driving for your dates.",
      gettingAround: "Check local transit passes before you go.",
    },
    travelOptions: input.origin
      ? [
          { mode: "bus", route: `${input.origin} → ${input.destination}`, duration: "Check timetables", cost: 0, note: "Usually the cheapest option. Compare long-distance coach operators." },
          { mode: "train", route: `${input.origin} → ${input.destination}`, duration: "Check timetables", cost: 0, note: "Book early for the lowest fares." },
          { mode: input.travelMode === "ev" ? "ev" : "car", route: `${input.origin} → ${input.destination}`, duration: "Depends on route", cost: 0, note: "Fuel or charging cost depends on distance and your vehicle." },
        ]
      : [],
    stays: [
      { name: "Hostel or guesthouse", type: "guesthouse", area: "Near the centre", nightlyPrice: Math.round((total * 0.25) / nights), why: "Usually the best value for money." },
      { name: "Central stay", type: "budget hotel", area: "City centre", nightlyPrice: Math.round((total * 0.4) / nights), why: "Walkable to most of the plan." },
    ],
    viewpoints: [],
    climate: {
      season: "Connect the AI planner for what the weather is typically like on your dates.",
      safetyNotes: [],
    },
    roadTrip: { fuelPricePerLitre: 1.6, chargePricePerKwh: 0.45, drivingNotes: "" },
    days,
    budget: BUDGET_SPLIT.map(([category, share, note]) => ({ category, amount: Math.round(total * share), note })),
    packing: ["Passport or ID", "Phone charger and adapter", "Comfortable walking shoes", "Reusable water bottle", "Any medication you need"],
    tips: ["Save offline maps before you arrive.", "Keep a copy of bookings on your phone."],
    checklist: [
      { task: "Book transport there and back", when: "As soon as dates are set" },
      { task: `Book ${nights} night(s) of accommodation`, when: "4–8 weeks before" },
      { task: "Check passport, visa and insurance", when: "6 weeks before" },
      { task: "Reserve popular tickets and restaurants", when: "2–3 weeks before" },
    ],
  };
}
