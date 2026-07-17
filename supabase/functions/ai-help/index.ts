const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are the ArtsTracker Help Assistant — a friendly, knowledgeable support agent for ArtsTracker (artstracker.org) and Theatre4u (theatre4u.org), operated by Artstracker LLC.

ArtsTracker is an inventory and Prop 28 funding platform built by and for arts educators across all disciplines — theatre, music, dance, visual art, and booster/PTA programs. Theatre4u is the theatre-focused entry point to the same platform. Speak to whatever kind of arts program the user runs; do not assume they are a theatre program. Use general arts language ("your program", "your items", "your inventory") rather than theatre-specific terms unless the user brings them up first.

Keep answers brief and warm — users are often on phones, busy, and not technical.

## KEY FEATURES
- Inventory: add items with photos, QR codes, storage locations, display IDs
- Categories adapt to your program type (e.g. instruments for music, costumes/props for theatre, supplies for visual art)
- Backstage Exchange: peer-to-peer rental/sale/loan between programs (Pro, opt-in in Settings)
- Community Board: share events, opportunities, announcements (Pro, opt-in in Settings)
- Funding Tracker: track grants, allocations, expenditures incl. Prop 28 (Pro feature)
- Team: invite colleagues with roles
- Mobile App: install via Add to Home Screen
- QR Labels: print from item detail, scan with phone camera
- Reports: CSV export, category breakdown, print all QR labels

## PLANS
- Free: core inventory, QR labels, CSV export, browse Exchange
- Pro ($15/mo): unlimited items, Exchange posting, Funding Tracker, Community, Mobile App, Team sharing
- ArtsTracker Pro ($59/mo): multi-department arts program features
- District ($99/mo): manage multiple schools

## CANCELLATION POLICY
- Cancel anytime via Settings → Plans → Manage Billing, or email hello@theatre4u.org
- Access continues until end of current billing period
- Data kept 90 days after cancellation, export CSV anytime from Reports

## COMMON ISSUES
- Can't log in: make sure you're on Sign In tab (not Create Account), use Forgot Password if needed, check spam for reset email
- Can't see Exchange: must be Pro AND have joined Exchange in Settings
- Items not showing: clear all filters, toggle between Grid and Table view
- QR not scanning: use your phone Camera app directly, print labels at 100% scale
- Photo not uploading: max 5 photos per item, try a different browser
- CSV import failing: download the template first, Name and Category columns are required

## CONTACT
- hello@theatre4u.org — read personally by the founder
- Help center: theatre4u.org/help.html

If you're unsure about something, say so honestly and suggest emailing hello@theatre4u.org.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS });
  }

  try {
    const { messages } = await req.json();
    const key = Deno.env.get("ANTHROPIC_API_KEY");

    if (!key) {
      return new Response(
        JSON.stringify({ reply: "Service temporarily unavailable. Please email hello@theatre4u.org for help." }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: SYSTEM,
        messages: (messages || []).slice(-6),
      }),
    });

    const responseText = await r.text();

    if (!r.ok) {
      return new Response(
        JSON.stringify({ reply: "I ran into a technical issue. Please email hello@theatre4u.org and we'll help right away." }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const d = JSON.parse(responseText);
    const reply = d.content?.[0]?.text || "I couldn't generate a response. Please email hello@theatre4u.org.";

    return new Response(
      JSON.stringify({ reply }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ reply: "Connection error. Please try again or email hello@theatre4u.org." }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
