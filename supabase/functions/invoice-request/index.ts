const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLANS: Record<string, { label: string; monthly: string; annual: string; schools: string }> = {
  pro:        { label: "Theatre4u Pro",        monthly: "$15.00",  annual: "$150.00",    schools: "1 program" },
  district:   { label: "Theatre4u District S", monthly: "$49.00",  annual: "$500.00",    schools: "up to 6 schools" },
  district_m: { label: "Theatre4u District M", monthly: "$99.00",  annual: "$999.00",    schools: "up to 15 schools" },
  district_l: { label: "Theatre4u District L", monthly: "$179.00", annual: "$1,799.00",  schools: "up to 30 schools" },
  at_pro:        { label: "ArtsTracker Pro",        monthly: "$59.00",  annual: "$590.00",    schools: "all departments · 1 school" },
  at_district_s: { label: "ArtsTracker District S", monthly: "$199.00", annual: "$1,990.00",  schools: "all departments · up to 6 schools" },
  at_district_m: { label: "ArtsTracker District M", monthly: "$399.00", annual: "$3,990.00",  schools: "all departments · up to 15 schools" },
  at_district_l: { label: "ArtsTracker District L", monthly: "$699.00", annual: "$6,990.00",  schools: "all departments · up to 30 schools" },
  enterprise: { label: "Theatre4u Enterprise", monthly: "Custom",  annual: "Custom",     schools: "unlimited" },
};

function invoiceNumber(): string {
  const now = new Date();
  return `INV-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*900)+100}`;
}
function dueDate(): string {
  const d = new Date(); d.setDate(d.getDate() + 30);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function today(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function buildCustomerEmail(data: any, invNum: string, due: string): string {
  const brand = (data.brand || "Theatre4u").trim();
  const brandUrl = (data.brandUrl || "https://theatre4u.org").trim();
  const brandHost = brandUrl.replace(/^https?:\/\//, "");
  const plan = PLANS[data.plan] || PLANS.pro;
  const isAnnual = data.period === 'annual';
  const price = isAnnual ? plan.annual : plan.monthly;
  const period = isAnnual ? 'Annual' : 'Monthly';
  const isEnterprise = data.plan === 'enterprise';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#ffffff">
  <div style="background:#1a1200;padding:28px 36px;text-align:center">
    <div style="font-family:Georgia,serif;font-size:32px;font-weight:700;color:#d4a843">${brand}</div>
    <div style="font-size:13px;color:rgba(212,168,67,.6);margin-top:4px">A product of Artstracker LLC</div>
  </div>
  <div style="background:#d4a843;padding:14px 36px;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:22px;font-weight:800;color:#1a1200;letter-spacing:2px">INVOICE</span>
    <span style="font-size:14px;font-weight:700;color:#1a1200">${invNum}</span>
  </div>
  <div style="padding:32px 36px">
    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 24px">Dear <strong>${data.contact || data.name}</strong>,</p>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px">
      Thank you for your interest in ${brand}! ${isEnterprise
        ? 'We will be in touch within one business day to discuss an Enterprise plan tailored to your district. This is a preliminary request confirmation &#x2014; no payment is due yet.'
        : 'Please find your invoice details below. Payment instructions are included at the bottom of this email.'}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-collapse:collapse">
      <tr>
        <td style="padding:8px 12px;background:#f5f0e8;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;width:33%">Invoice Date</td>
        <td style="padding:8px 12px;background:#f5f0e8;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;width:33%">Due Date (Net-30)</td>
        <td style="padding:8px 12px;background:#f5f0e8;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;width:33%">PO Number</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;border:1px solid #e0d8c8;font-size:14px;color:#222">${today()}</td>
        <td style="padding:10px 12px;border:1px solid #e0d8c8;font-size:14px;color:#222">${isEnterprise ? 'TBD' : due}</td>
        <td style="padding:10px 12px;border:1px solid #e0d8c8;font-size:14px;color:#222">${data.po || 'N/A'}</td>
      </tr>
      <tr><td colspan="3" style="height:12px"></td></tr>
      <tr>
        <td colspan="2" style="padding:8px 12px;background:#f5f0e8;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px">Organization</td>
        <td style="padding:8px 12px;background:#f5f0e8;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px">Coverage</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:10px 12px;border:1px solid #e0d8c8;font-size:14px;color:#222">${data.name}</td>
        <td style="padding:10px 12px;border:1px solid #e0d8c8;font-size:14px;color:#222">${plan.schools}</td>
      </tr>
      ${data.address ? `<tr><td colspan="3" style="padding:8px 12px;background:#f5f0e8;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px">Accounts Payable Address</td></tr><tr><td colspan="3" style="padding:10px 12px;border:1px solid #e0d8c8;font-size:14px;color:#222">${data.address}</td></tr>` : ''}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;border-collapse:collapse">
      <tr style="background:#1a1200">
        <th style="padding:10px 12px;font-size:12px;color:#fff;text-align:left;font-weight:700">Description</th>
        <th style="padding:10px 12px;font-size:12px;color:#fff;text-align:center;font-weight:700;width:100px">Period</th>
        <th style="padding:10px 12px;font-size:12px;color:#fff;text-align:right;font-weight:700;width:100px">Amount</th>
      </tr>
      <tr>
        <td style="padding:14px 12px;border:1px solid #e0d8c8;font-size:14px;color:#222">
          <strong>${plan.label}</strong><br>
          <span style="font-size:12px;color:#888">Inventory management, QR codes, Exchange, Funding Tracker, Team sharing &amp; more. ${plan.schools}.</span>
          ${data.notes ? `<br><span style="font-size:12px;color:#666;margin-top:4px;display:block"><em>Notes: ${data.notes}</em></span>` : ''}
        </td>
        <td style="padding:14px 12px;border:1px solid #e0d8c8;font-size:13px;color:#222;text-align:center">${period}</td>
        <td style="padding:14px 12px;border:1px solid #e0d8c8;font-size:14px;color:#222;text-align:right;font-weight:700">${isEnterprise ? 'Custom' : price}</td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
      <tr>
        <td></td>
        <td style="padding:12px 14px;background:#1a1200;font-size:13px;font-weight:700;color:#fff;text-align:right;width:120px">TOTAL DUE</td>
        <td style="padding:12px 14px;background:#d4a843;font-size:16px;font-weight:800;color:#1a1200;text-align:right;width:100px">${isEnterprise ? 'Custom' : price}</td>
      </tr>
    </table>
    ${isEnterprise ? '' : `
    <div style="background:#f5f0e8;border-radius:8px;padding:20px;margin-bottom:24px">
      <div style="font-size:14px;font-weight:700;color:#1a1200;margin-bottom:14px">Payment Instructions</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:50%;padding-right:16px;vertical-align:top">
            <div style="font-size:13px;font-weight:700;color:#8b6914;margin-bottom:6px">&#x2709; Pay by Check</div>
            <div style="font-size:13px;color:#444;line-height:1.7">
              Make check payable to:<br>
              <strong>Artstracker LLC</strong><br>
              10441 Stanford Ave., #1155<br>
              Garden Grove, CA 92842<br><br>
              <em style="font-size:11px;color:#888">Include invoice number ${invNum} in memo line.</em>
            </div>
          </td>
          <td style="width:50%;padding-left:16px;vertical-align:top">
            <div style="font-size:13px;font-weight:700;color:#8b6914;margin-bottom:6px">&#x1F3E6; Pay by Purchase Order</div>
            <div style="font-size:13px;color:#444;line-height:1.7">
              Email your PO to:<br>
              <strong>hello@theatre4u.org</strong><br><br>
              We accept POs from accredited educational institutions. Net-30 terms available. We will activate your account immediately upon receipt of a signed PO.
            </div>
          </td>
        </tr>
      </table>
    </div>`}
    <p style="font-size:13px;color:#888;line-height:1.7;margin:0">Questions? Reply to this email or contact us at <a href="mailto:hello@theatre4u.org" style="color:#8b6914">hello@theatre4u.org</a>. All messages are read personally by the founder.</p>
  </div>
  <div style="background:#f5f0e8;padding:18px 36px;border-top:2px solid #d4a843;text-align:center">
    <div style="font-size:12px;color:#999;line-height:1.8">${brand} &mdash; Artstracker LLC &mdash; 10441 Stanford Ave., #1155, Garden Grove, CA 92842<br><a href="${brandUrl}" style="color:#8b6914">${brandHost}</a> &mdash; hello@theatre4u.org</div>
  </div>
</div></body></html>`;
}

function buildAdminEmail(data: any, invNum: string): string {
  const brand = (data.brand || "Theatre4u").trim();
  const plan = PLANS[data.plan] || PLANS.pro;
  const isAnnual = data.period === 'annual';
  const price = isAnnual ? plan.annual : plan.monthly;
  return `<div style="font-family:Arial,sans-serif;max-width:500px;padding:20px">
  <h2 style="color:#8b6914">New ${brand} Invoice Request &#x1F3AD;</h2>
  <table cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse">
    <tr><td style="font-weight:700;width:160px">Invoice #</td><td>${invNum}</td></tr>
    <tr><td style="font-weight:700">Brand</td><td>${brand}</td></tr>
    <tr><td style="font-weight:700">Organization</td><td>${data.name}</td></tr>
    <tr><td style="font-weight:700">Contact</td><td>${data.contact}</td></tr>
    <tr><td style="font-weight:700">Email</td><td>${data.email}</td></tr>
    <tr><td style="font-weight:700">Plan</td><td>${plan.label} &mdash; ${isAnnual ? 'Annual' : 'Monthly'} &mdash; ${price}</td></tr>
    <tr><td style="font-weight:700">PO Number</td><td>${data.po || 'Not provided'}</td></tr>
    <tr><td style="font-weight:700">Address</td><td>${data.address || 'Not provided'}</td></tr>
    <tr><td style="font-weight:700">Notes</td><td>${data.notes || 'None'}</td></tr>
  </table>
  <p style="margin-top:16px;color:#555">Invoice was automatically sent to <strong>${data.email}</strong>.</p>
  <p style="color:#555">Next step: When payment or signed PO is received, activate their account in the Admin dashboard.</p>
</div>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS });
  try {
    const data = await req.json();
    if (!data.name || !data.email) {
      return new Response(JSON.stringify({ error: "name and email required" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_KEY) throw new Error("RESEND_API_KEY not configured");
    const brand = (data.brand || "Theatre4u").trim();
    const invNum = invoiceNumber();
    const due = dueDate();
    const plan = PLANS[data.plan] || PLANS.pro;
    const customerRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${brand} <hello@theatre4u.org>`,
        to: [data.email],
        subject: `${brand} Invoice ${invNum} — ${data.plan === 'enterprise' ? 'Enterprise Inquiry' : plan.label}`,
        html: buildCustomerEmail(data, invNum, due),
      })
    });
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${brand} System <hello@theatre4u.org>`,
        to: ["hello@theatre4u.org"],
        subject: `🎭 New ${brand} Invoice Request: ${data.name} — ${invNum}`,
        html: buildAdminEmail(data, invNum),
      })
    });
    if (!customerRes.ok) {
      const err = await customerRes.text();
      return new Response(JSON.stringify({ error: "Email send failed", detail: err }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ success: true, invoice: invNum }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch(e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
