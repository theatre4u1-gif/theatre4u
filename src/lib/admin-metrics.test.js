import { describe, it, expect } from "vitest";
import { doorOf, activeBucket, lastActiveTs, DAY } from "./admin-metrics.js";

describe("doorOf — which brand door a program belongs to", () => {
  it("theatre program on the theatre4u domain => theatre4u", () => {
    expect(doorOf({ vertical: "theatre", signup_domain: "theatre4u.org" })).toBe("theatre4u");
  });
  it("theatre program that signed up on artstracker => artstracker", () => {
    expect(doorOf({ vertical: "theatre", signup_domain: "artstracker.org" })).toBe("artstracker");
  });
  it("non-theatre verticals are ALWAYS ArtsTracker, regardless of signup domain", () => {
    for (const v of ["music", "dance", "art", "booster"]) {
      expect(doorOf({ vertical: v, signup_domain: "theatre4u.org" })).toBe("artstracker");
    }
  });
  it("missing/empty org defaults to theatre4u", () => {
    expect(doorOf({})).toBe("theatre4u");
    expect(doorOf(null)).toBe("theatre4u");
  });
});

describe("activeBucket — engagement tiers", () => {
  const now = 1000 * DAY; // fixed reference point
  it("null timestamp => never", () => expect(activeBucket(null, now)).toBe("never"));
  it("within 7 days => a7", () => expect(activeBucket(now - 3 * DAY, now)).toBe("a7"));
  it("8..30 days => a30", () => expect(activeBucket(now - 20 * DAY, now)).toBe("a30"));
  it("31..90 days => dormant", () => expect(activeBucket(now - 60 * DAY, now)).toBe("dormant"));
  it("over 90 days => inactive", () => expect(activeBucket(now - 200 * DAY, now)).toBe("inactive"));
});

describe("lastActiveTs — most recent real signal", () => {
  it("returns the max of last_seen / last_item_added / last_exchange_activity", () => {
    const org = { last_seen: "2026-01-01T00:00:00Z" };
    const usage = { last_item_added: "2026-02-01T00:00:00Z", last_exchange_activity: null };
    expect(lastActiveTs(org, usage)).toBe(new Date("2026-02-01T00:00:00Z").getTime());
  });
  it("returns null when there are no signals", () => {
    expect(lastActiveTs({}, {})).toBeNull();
  });
});
