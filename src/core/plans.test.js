import { describe, it, expect } from "vitest";
import { PLANS_DEF, STRIPE_LINKS, stripeLink } from "./plans.js";

describe("plan gates", () => {
  it("Free is capped at 25 items", () => {
    expect(PLANS_DEF.free.maxItems).toBe(25);
  });
  it("paid plans are unlimited", () => {
    for (const p of ["pro", "district", "at_pro", "at_district_s", "at_district_m", "at_district_l"]) {
      expect(PLANS_DEF[p].maxItems).toBe(Infinity);
    }
  });
  it("only ArtsTracker plans unlock all departments", () => {
    expect(PLANS_DEF.pro.allVerticals).toBe(false);
    expect(PLANS_DEF.district.allVerticals).toBe(false);
    expect(PLANS_DEF.at_pro.allVerticals).toBe(true);
    expect(PLANS_DEF.at_district_l.allVerticals).toBe(true);
  });
});

describe("current prices — guard against accidental changes (see Pricing-and-Billing-AUTHORITATIVE)", () => {
  it("Theatre4u Pro is $15 / $150", () => {
    expect(PLANS_DEF.pro.monthlyPrice).toBe(15);
    expect(PLANS_DEF.pro.annualPrice).toBe(150);
  });
  it("Theatre4u District S is $49 / $500", () => {
    expect(PLANS_DEF.district.monthlyPrice).toBe(49);
    expect(PLANS_DEF.district.annualPrice).toBe(500);
  });
  it("ArtsTracker monthly ladder is 59 / 199 / 399 / 699", () => {
    expect(PLANS_DEF.at_pro.monthlyPrice).toBe(59);
    expect(PLANS_DEF.at_district_s.monthlyPrice).toBe(199);
    expect(PLANS_DEF.at_district_m.monthlyPrice).toBe(399);
    expect(PLANS_DEF.at_district_l.monthlyPrice).toBe(699);
  });
});

describe("stripeLink helper", () => {
  it("adds client_reference_id and prefilled_email to a checkout link", () => {
    const url = stripeLink("https://buy.stripe.com/test", "org_123", "a@b.com");
    expect(url).toContain("client_reference_id=org_123");
    expect(url).toContain("prefilled_email=a%40b.com");
  });
  it("passes through a disabled link", () => {
    expect(stripeLink("#")).toBe("#");
  });
  it("has a live payment link for every plan and interval", () => {
    for (const key of ["pro", "district", "district_m", "district_l", "at_pro", "at_district_s", "at_district_m", "at_district_l"]) {
      expect(STRIPE_LINKS[key].monthly).toMatch(/^https:\/\/buy\.stripe\.com\//);
      expect(STRIPE_LINKS[key].annual).toMatch(/^https:\/\/buy\.stripe\.com\//);
    }
  });
});
