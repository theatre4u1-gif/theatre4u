// Supabase client + edge-function helper (shared backbone) — extracted from App.jsx.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON } from "./config.js";

// Backend is brand-switched in config.js: BinTrove → its own project, schools → the
// shared Theatre4u/ArtsTracker project. So consumer data and school data never mix.
const _SB_REAL = createClient(SUPABASE_URL, SUPABASE_ANON);

// SB_ACTIVE is the mutable backend — swapped to demoStore in demo mode.
// All SB.xxx() calls throughout the app use this transparently via the Proxy.
let SB_ACTIVE = _SB_REAL;
export const SB = new Proxy({}, {
  get(_, prop) {
    const target = SB_ACTIVE;
    const val = target[prop];
    return typeof val === "function" ? val.bind(target) : val;
  }
});

// Swap the backend to a demo store (demo mode). Idempotent.
export function activateDemoStore(store) {
  if (store && SB_ACTIVE !== store) SB_ACTIVE = store;
}

// Edge function caller helper
export const callEdgeFn = async (name, body, token) => {
  const res = await fetch(`https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return res.json();
};
