import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

Deno.serve(async (_req: Request) => {
  if (!RESEND_KEY) {
    return new Response(JSON.stringify({ error: "No RESEND_API_KEY found in environment" }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({
      from: "Theatre4u <hello@theatre4u.org>",
      to: ["rzick@hbuhsd.edu"],
      subject: "Theatre4u Email Test",
      html: "<p>This is a test email from Theatre4u. If you received this, email is working!</p>"
    })
  });

  const status = res.status;
  const body = await res.text();

  return new Response(JSON.stringify({
    resend_status: status,
    resend_response: body,
    key_present: !!RESEND_KEY,
    key_prefix: RESEND_KEY.slice(0, 8)
  }), { headers: { "Content-Type": "application/json" } });
});
