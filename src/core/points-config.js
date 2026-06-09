// Points-system constants (rewards economy) — extracted from App.jsx.
// Shared by App.jsx and core/points.jsx (CreditsPage). Pure data, no React.

// ── Point earn rates by category (mirrors point_earn_rates DB table) ──────────
export const POINT_EARN_RATES = {
  lighting: 50, sound: 50, sets: 40, costumes: 25, props: 20,
  furniture: 20, effects: 20, fabrics: 15, makeup: 15,
  scripts: 10, tools: 10, other: 15,
};

// Points: 1 point = $0.01 · 1,500 points = free Pro month · max balance 5,000
export const POINTS_PER_DOLLAR   = 1;       // rental earn rate
export const POINTS_FREE_MONTH   = 1500;    // points needed for a free month
export const POINTS_MAX_BALANCE  = 5000;    // cap per org
export const POINTS_EXPIRE_DAYS  = 365;     // points expire after 12 months
export const PLATFORM_FEE_PCT    = 0.08;    // 8% platform fee on Exchange transactions
export const POINTS_MIN_REDEEM   = 500;     // minimum points to redeem in one go

// Onboarding milestone points (one-time, idempotent via DB function)
export const MILESTONE_POINTS = {
  welcome_bonus:    { pts: 25,  label: "Welcome Bonus" },
  profile_complete: { pts: 25,  label: "Profile Completed" },
  items_10:         { pts: 25,  label: "10 Items Added" },
  items_25_photos:  { pts: 50,  label: "25 Items with Photos" },
  first_listing:    { pts: 15,  label: "First Exchange Listing" },
  first_request:    { pts: 10,  label: "First Exchange Request" },
  team_invite:      { pts: 15,  label: "Team Member Invited" },
  referral_earn:    { pts: 50,  label: "Referral Bonus" },
};
