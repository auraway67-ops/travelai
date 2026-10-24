// JSON schema for a full trip plan. Used as Claude's structured output format,
// and mirrors the shape the app renders (see src/samplePlan.js).

const str = { type: "string" };
const num = { type: "number" };
const int = { type: "integer" };

function obj(properties) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

const item = obj({
  time: { type: "string", description: "Local time like 09:00" },
  title: str,
  type: { type: "string", enum: ["activity", "food", "transport", "stay", "free"] },
  description: str,
  location: str,
  cost: { type: "number", description: "Estimated cost for the whole group, in the trip currency. 0 if free." },
});

export const TRIP_SCHEMA = obj({
  title: str,
  summary: str,
  destination: str,
  currency: { type: "string", description: "ISO currency code used for every amount" },
  totalEstimate: num,
  bestFor: { type: "array", items: str },
  transport: obj({
    gettingThere: str,
    gettingAround: str,
  }),
  travelOptions: {
    type: "array",
    description: "Ways to get from the origin to the destination, cheapest first. Empty if no origin was given.",
    items: obj({
      mode: { type: "string", enum: ["bus", "train", "flight", "car", "ev", "ferry", "rideshare"] },
      route: str,
      duration: { type: "string", description: "Door-to-door estimate, like 4h 30m" },
      cost: { type: "number", description: "Estimated one-way cost for the whole group, in the trip currency" },
      note: str,
    }),
  },
  stays: {
    type: "array",
    description: "Places to stay, best value first",
    items: obj({
      name: str,
      type: { type: "string", enum: ["hostel", "guesthouse", "budget hotel", "mid-range hotel", "apartment", "campsite", "luxury hotel"] },
      area: str,
      nightlyPrice: { type: "number", description: "Per night for the whole group, in the trip currency" },
      why: str,
    }),
  },
  viewpoints: {
    type: "array",
    description: "Scenic viewpoints at the destination, plus worthwhile scenic stops on the way",
    items: obj({
      name: str,
      area: str,
      bestTime: { type: "string", description: "For example Sunset or Early morning" },
      why: str,
      onTheWay: { type: "boolean", description: "True if it is a stop on the journey rather than at the destination" },
    }),
  },
  climate: obj({
    season: { type: "string", description: "The season and weather to expect on these dates" },
    safetyNotes: {
      type: "array",
      items: str,
      description: "Weather and travel-safety risks for these dates, such as monsoon, extreme heat, storms or snow on mountain roads. Empty if none.",
    },
  }),
  roadTrip: obj({
    fuelPricePerLitre: { type: "number", description: "Typical petrol price per litre along the way, in the trip currency" },
    chargePricePerKwh: { type: "number", description: "Typical public EV fast-charging price per kWh, in the trip currency" },
    drivingNotes: { type: "string", description: "Road conditions, tolls, parking, driving rules worth knowing" },
  }),
  days: {
    type: "array",
    items: obj({
      day: int,
      date: str,
      theme: str,
      items: { type: "array", items: item },
    }),
  },
  budget: {
    type: "array",
    items: obj({ category: str, amount: num, note: str }),
  },
  packing: { type: "array", items: str },
  tips: { type: "array", items: str },
  checklist: {
    type: "array",
    items: obj({ task: str, when: str }),
  },
});
