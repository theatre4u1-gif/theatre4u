// ── Default landing-page content, shared by the public site (public.jsx) and the admin
// Content editor (content-editor.jsx). Keeping these in one place avoids the two files drifting.
// The admin can override any of this via site_content; these are the fallbacks.

export const DEFAULT_FEATURES = {
  theatre4u: [
    { icon: "📦", title: "Inventory That Actually Works", desc: "Catalog every costume, prop, light, and sound item your program owns. Add photos, tag by production, print QR labels for storage bins. Always know exactly what you have and where it lives." },
    { icon: "🎭", title: "Productions Tracker", desc: "Create a folder for each show. Assign items from your inventory, track what's checked out, and see at a glance what every production needs from wishlist to opening night." },
    { icon: "📱", title: "Mobile-Ready Backstage", desc: "Add items by taking a photo. Scan QR labels with your phone's camera — the iPhone Camera app reads Theatre4u labels instantly. Available on iPhone and Android — no app store required." },
    { icon: "💰", title: "Funding Tracker", desc: "Track grants, district allocations, booster funds, earned income, and donations. Log expenditures against each source, generate reports, and export to CSV — for your records." },
    { icon: "🏪", title: "Backstage Exchange", desc: "When you're ready, opt in to share selected items with other programs. You choose exactly which items to post — your full inventory stays completely private. Browse what others near you have available, rent, purchase, or arrange a loan." },
    { icon: "🎪", title: "Community Board", desc: "Post audition notices, share upcoming show dates, upload production photos, and find items you need. A regional bulletin board for the performing arts community." },
  ],
  artstracker: [
    { icon: "📦", title: "Inventory That Actually Works", desc: "Catalog every costume, instrument, prop, light, art supply, uniform, or piece of equipment your program owns. Add photos, tag by show or unit, print QR labels for storage. Always know exactly what you have and where it lives." },
    { icon: "🎭", title: "Productions & Events", desc: "Create a folder for each show, concert, exhibition, or event. Pull items straight from your inventory, track what's checked out, and see what each one still needs." },
    { icon: "📱", title: "Mobile-Ready", desc: "Add items by taking a photo. Scan QR labels with your phone's camera — instantly. Works on iPhone and Android — no app store required." },
    { icon: "💰", title: "Funding Tracker", desc: "Track grants, district allocations, booster funds, and donations. Log expenditures against each source, generate reports, and export to CSV. California programs can track Prop 28 spending here too." },
    { icon: "🔄", title: "The Exchange", desc: "Opt in to share selected items with other programs — across theatre, music, dance, and art. You choose exactly what to post; your full inventory stays private. Browse what others near you have, then rent, buy, or borrow." },
    { icon: "🎪", title: "Community Board", desc: "Post calls and auditions, share upcoming dates, upload event photos, and find what you need. A regional bulletin board for the whole arts community." },
  ],
};

// Safely parse an admin-saved features array; returns null if empty/invalid so callers fall back.
export function parseFeatures(raw) {
  try {
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) return arr;
  } catch (e) { /* fall back */ }
  return null;
}
