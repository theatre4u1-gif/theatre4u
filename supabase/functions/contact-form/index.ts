const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const TO = "hello@theatre4u.org";
const FROM = "Theatre4u Contact <hello@theatre4u.org>";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  try {
    const { name, email, org, subject, message } = await req.json();

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return json({ error: "Name, email, and message are required." }, 400);
    }

    const subjectLabels: Record<string, string> = {
      general: "General Question",
      support: "Technical Support",
      billing: "Billing",
      district: "District Inquiry",
      partnership: "Partnership",
    };
    const subjectLabel = subjectLabels[subject] ?? subject ?? "Contact Form";

    const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fff">
  <div style="background:#1a1008;border-radius:10px;padding:20px 24px;margin-bottom:24px;display:flex;align-items:center;gap:12px">
    <span style="font-size:28px">🎭</span>
    <div>
      <div style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#e8b84b">Theatre4u™</div>
      <div style="font-size:12px;color:rgba(255,255,255,.5)">New Contact Form Submission</div>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <tr><td style="padding:8px 12px;background:#fdf8f1;border:1px solid #e8dcc8;font-weight:700;font-size:13px;color:#5a4a38;width:140px">Name</td><td style="padding:8px 12px;border:1px solid #e8dcc8;font-size:14px">${name}</td></tr>
    <tr><td style="padding:8px 12px;background:#fdf8f1;border:1px solid #e8dcc8;font-weight:700;font-size:13px;color:#5a4a38">Email</td><td style="padding:8px 12px;border:1px solid #e8dcc8;font-size:14px"><a href="mailto:${email}" style="color:#c4922a">${email}</a></td></tr>
    ${org ? `<tr><td style="padding:8px 12px;background:#fdf8f1;border:1px solid #e8dcc8;font-weight:700;font-size:13px;color:#5a4a38">Program</td><td style="padding:8px 12px;border:1px solid #e8dcc8;font-size:14px">${org}</td></tr>` : ""}
    <tr><td style="padding:8px 12px;background:#fdf8f1;border:1px solid #e8dcc8;font-weight:700;font-size:13px;color:#5a4a38">Subject</td><td style="padding:8px 12px;border:1px solid #e8dcc8;font-size:14px">${subjectLabel}</td></tr>
  </table>
  <div style="background:#fdf8f1;border:1px solid #e8dcc8;border-radius:8px;padding:16px 20px;margin-bottom:20px">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b8a890;margin-bottom:8px">Message</div>
    <div style="font-size:15px;line-height:1.7;color:#1a1008;white-space:pre-wrap">${message}</div>
  </div>
  <div style="text-align:center;padding:16px;border-top:1px solid #e8dcc8">
    <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subjectLabel)}" style="display:inline-block;background:#c4922a;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Reply to ${name} →</a>
  </div>
  <p style="text-align:center;font-size:12px;color:#b8a890;margin-top:16px">Theatre4u™ · Artstracker LLC · hello@theatre4u.org</p>
</div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: `[Theatre4u Contact] ${subjectLabel} — ${name}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return json({ error: "Failed to send message. Please try again or email us directly at hello@theatre4u.org" }, 500);
    }

    return json({ success: true });
  } catch (e) {
    console.error("contact-form error:", e);
    return json({ error: "Something went wrong. Please email us directly at hello@theatre4u.org" }, 500);
  }
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
