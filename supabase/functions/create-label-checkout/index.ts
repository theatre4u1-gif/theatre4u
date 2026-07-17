// create-label-checkout — creates a Stripe Checkout Session for a label pack order
// Called from App.jsx LabelsPage when user confirms order
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS });

  const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const SB = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    if (!STRIPE_KEY) throw new Error("STRIPE_SECRET_KEY not configured");

    const { org_id, pack_id, address, include_logo, logo_url } = await req.json();
    if (!org_id || !pack_id) throw new Error("org_id and pack_id required");

    // Look up the pack
    const { data: pack, error: packErr } = await SB.from("label_packs")
      .select("*").eq("id", pack_id).single();
    if (packErr || !pack) throw new Error("Pack not found");

    // Look up the org
    const { data: org } = await SB.from("orgs")
      .select("name,email,stripe_customer_id").eq("id", org_id).single();

    // Create a pending label_order record first so we have an ID
    const { data: order, error: orderErr } = await SB.from("label_orders").insert({
      org_id,
      org_name:      org?.name ?? "",
      contact_email: org?.email ?? "",
      item_count:    pack.label_count,
      label_type:    pack.material,
      amount_cents:  pack.price_cents,
      status:        "pending_payment",
      include_logo:  include_logo && !!logo_url,
      logo_url:      include_logo && logo_url ? logo_url : null,
      delivery_addr: address ? JSON.stringify(address) : null,
    }).select().single();

    if (orderErr || !order) throw new Error("Could not create order record");

    // Build line items — if stripe_price_id exists use it, otherwise use price_data
    const lineItems = pack.stripe_price_id
      ? [{ price: pack.stripe_price_id, quantity: 1 }]
      : [{
          price_data: {
            currency: "usd",
            unit_amount: pack.price_cents,
            product_data: {
              name: `Theatre4u Labels — ${pack.name}`,
              description: pack.description,
              metadata: { label_count: pack.label_count, material: pack.material },
            },
          },
          quantity: 1,
        }];

    // Build Stripe Checkout Session
    const sessionBody = new URLSearchParams({
      mode: "payment",
      "line_items[0][quantity]": "1",
      success_url: `https://theatre4u.org/app.html?labels_success=1&order_id=${order.id}`,
      cancel_url:  `https://theatre4u.org/app.html?labels_cancelled=1`,
      customer_email: org?.email ?? "",
      "metadata[order_id]": order.id,
      "metadata[org_id]": org_id,
      "metadata[pack_name]": pack.name,
      "metadata[label_count]": String(pack.label_count),
      "metadata[type]": "label_order",
    });

    // Line items
    if (pack.stripe_price_id) {
      sessionBody.append("line_items[0][price]", pack.stripe_price_id);
    } else {
      sessionBody.append("line_items[0][price_data][currency]", "usd");
      sessionBody.append("line_items[0][price_data][unit_amount]", String(pack.price_cents));
      sessionBody.append("line_items[0][price_data][product_data][name]", `Theatre4u Labels — ${pack.name}`);
      sessionBody.append("line_items[0][price_data][product_data][description]", pack.description ?? "");
    }

    // Use existing Stripe customer if available
    if (org?.stripe_customer_id) {
      sessionBody.append("customer", org.stripe_customer_id);
      sessionBody.delete("customer_email"); // can't use both
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: sessionBody,
    });

    const session = await stripeRes.json();
    if (!stripeRes.ok) throw new Error(`Stripe error: ${session.error?.message ?? JSON.stringify(session)}`);

    // Store session ID on the order
    await SB.from("label_orders").update({ stripe_session_id: session.id })
      .eq("id", order.id);

    console.log(`Created checkout session ${session.id} for order ${order.id} (${pack.name})`);

    return new Response(JSON.stringify({
      ok: true,
      checkout_url: session.url,
      session_id:   session.id,
      order_id:     order.id,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("create-label-checkout error:", String(e));
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
