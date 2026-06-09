// Small shared helpers — extracted from App.jsx.
export function authErrKey(msg) {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("email not confirmed") || m.includes("wrong password") || m.includes("incorrect password")) return "loginBadPassword";
  if (m.includes("user not found") || m.includes("no user") || m.includes("email not found") || m.includes("no account")) return "loginNoEmail";
  if (m.includes("expired") || m.includes("jwt") || m.includes("refresh_token")) return "sessionExpired";
  return null;
}

export function getRefCode() {
  try { return sessionStorage.getItem("t4u_ref") || null; } catch(e) { return null; }
}

export const isDemoMode = () => {
  try { return new URLSearchParams(window.location.search).get("demo") === "1"; } catch { return false; }
};
