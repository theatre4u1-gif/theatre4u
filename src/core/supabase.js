// Supabase client + edge-function helper (shared backbone) — extracted from App.jsx.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const _SB_REAL = createClient(
  "https://ldmmphwivnnboyhlxipl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbW1waHdpdm5uYm95aGx4aXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxODA2MDUsImV4cCI6MjA3OTc1NjYwNX0.U2acfM5Ew7leACj4TWEy7EKwHi92270B1lt78dEjEfA"
);

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
