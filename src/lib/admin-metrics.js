// Shared admin metric definitions so every dashboard measures the same thing the same way.
// "Last active" = the most recent real signal we have for a program: last sign-in (last_seen),
// last item added, or last exchange activity. This keeps multi-member / district programs (whose
// owner may never log in) from looking dormant, and is accurate immediately (no backfill needed).
export const DAY = 86400000;

export function lastActiveTs(org, usage) {
  const u = usage || {};
  const ts = [org && org.last_seen, u.last_item_added, u.last_exchange_activity]
    .filter(Boolean)
    .map((t) => new Date(t).getTime())
    .filter((n) => !isNaN(n));
  return ts.length ? Math.max(...ts) : null;
}

// Which door a program belongs to — same rule as the email/branding logic:
// non-theatre verticals (music/dance/art/booster) are ArtsTracker; theatre follows signup_domain.
export function doorOf(org) {
  const v = (org && org.vertical) || "theatre";
  if (v !== "theatre") return "artstracker";
  return ((org && org.signup_domain) || "").includes("artstracker") ? "artstracker" : "theatre4u";
}
export const DOOR_LABEL = { theatre4u: "Theatre4u", artstracker: "ArtsTracker" };

// Bucket a "last active" timestamp into engagement tiers used across the admin.
export function activeBucket(ts, now = Date.now()) {
  if (!ts) return "never";
  const days = (now - ts) / DAY;
  return days <= 7 ? "a7" : days <= 30 ? "a30" : days <= 90 ? "dormant" : "inactive";
}
