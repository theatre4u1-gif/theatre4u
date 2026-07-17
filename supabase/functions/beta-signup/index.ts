// beta-signup v2 — saves lead to DB, sends emails to correct addresses
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
import{createClient}from"https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL="theatre4u1@gmail.com";

const TYPE_LABELS:Record<string,string>={k12_public:"K-12 Public School",k12_private:"K-12 Private School",community:"Community Theatre",college:"College / University",district:"School District",other:"Other"};
const SOURCE_LABELS:Record<string,string>={colleague:"A colleague / theatre teacher",facebook:"Facebook / social media",cteaa:"CTEAA / theatre org",search:"Google / web search",bob:"Directly from Bob",other:"Other"};

function welcomeHtml(d:any):string{
  return`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f0e8;font-family:'Helvetica Neue',Arial,sans-serif"><div style="max-width:600px;margin:0 auto;background:#fff"><div style="background:#1a1200;padding:24px 32px;text-align:center"><div style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:#d4a843">Theatre4u&#x2122;</div><div style="font-size:12px;color:rgba(212,168,67,.6);margin-top:4px">A product of Artstracker LLC</div></div><div style="background:linear-gradient(135deg,#d4a843,#a37f2c);padding:10px 32px;text-align:center"><span style="font-size:15px;font-weight:800;color:#1a1200;letter-spacing:1px">&#x1F3AD; Welcome to the Opening Night Crew</span></div><div style="padding:28px 32px"><p style="font-size:15px;color:#333;margin:0 0 16px">Hi <strong>${d.name}</strong>,</p><p style="font-size:14px;color:#555;line-height:1.8;margin:0 0 16px">You're in! <strong>${d.org}</strong> is now part of the Theatre4u Opening Night Crew. You're among the first theatre programs to help shape this platform.</p><div style="background:#f5f0e8;border-radius:10px;padding:18px;margin:0 0 18px;text-align:center"><div style="font-size:13px;font-weight:700;color:#1a1200;margin-bottom:12px">Your next step:</div><a href="https://theatre4u.org" style="display:inline-block;background:linear-gradient(135deg,#d4a843,#a37f2c);color:#1a1200;font-size:14px;font-weight:800;padding:11px 24px;border-radius:8px;text-decoration:none">Create Your Account at theatre4u.org &#x2192;</a><p style="font-size:12px;color:#888;margin:10px 0 0">Sign up with this email address: ${d.email}</p></div><div style="border-left:3px solid #d4a843;padding:10px 16px;margin:0 0 18px;background:#fffdf5"><p style="font-size:13px;color:#555;line-height:1.7;margin:0"><strong style="color:#1a1200">As an Opening Night Crew member:</strong><br>&#x2714; Full platform access &#x2014; free during Opening Night<br>&#x2714; Founding member pricing locked in at launch<br>&#x2714; Stage Points for feedback you submit<br>&#x2714; Leading Player status in the community<br>&#x2714; Direct line to me &#x2014; I read every message</p></div><p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 16px">Once you're set up, use the <strong>&#x1F4AC; Feedback</strong> button in the app to tell me what's working and what isn't. Your feedback directly shapes what we build.</p><p style="font-size:14px;color:#333;margin:0">Welcome to Opening Night.<br><br>&#x2014; <strong>Bob Zick</strong>, Founder<br><a href="mailto:hello@theatre4u.org" style="color:#8b6914">hello@theatre4u.org</a></p></div><div style="background:#f5f0e8;padding:14px 32px;border-top:2px solid #d4a843;text-align:center;font-size:11px;color:#aaa">Theatre4u&#x2122; &#x2014; Artstracker LLC &#x2014; theatre4u.org</div></div></body></html>`;
}

function adminHtml(d:any):string{
  return`<div style="font-family:Arial,sans-serif;max-width:520px;padding:20px"><h2 style="color:#8b6914">&#x1F3AD; New Opening Night Signup</h2><table cellpadding="7" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px"><tr style="background:#f5f0e8"><td style="font-weight:700;width:120px">Program</td><td><strong>${d.org}</strong></td></tr><tr><td style="font-weight:700">Name</td><td>${d.name}</td></tr><tr style="background:#f5f0e8"><td style="font-weight:700">Email</td><td><a href="mailto:${d.email}" style="color:#8b6914">${d.email}</a></td></tr><tr><td style="font-weight:700">Type</td><td>${TYPE_LABELS[d.type]||d.type||'Not specified'}</td></tr><tr style="background:#f5f0e8"><td style="font-weight:700">Location</td><td>${d.location||'Not specified'}</td></tr><tr><td style="font-weight:700">Source</td><td>${SOURCE_LABELS[d.source]||d.source||'Not specified'}</td></tr></table><div style="margin-top:16px;padding:12px;background:#f5f0e8;border-radius:8px;font-size:13px;color:#555">Lead saved to database. When they create their Theatre4u account, mark them as a Leading Player in Admin &#x2192; Organizations.</div><a href="mailto:${d.email}?subject=Welcome to Theatre4u Opening Night!" style="display:inline-block;margin-top:14px;background:#d4a843;color:#1a1200;padding:9px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:700">Email them directly &#x2192;</a></div>`;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:200,headers:CORS});
  try{
    const d=await req.json();
    if(!d.name||!d.email||!d.org)return new Response(JSON.stringify({error:"name, email, org required"}),{status:400,headers:{...CORS,"Content-Type":"application/json"}});

    const KEY=Deno.env.get("RESEND_API_KEY");
    const SB=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Save lead to database (upsert by email)
    const{error:dbErr}=await SB.from("beta_leads").upsert({
      org:d.org, name:d.name, email:d.email,
      type:d.type||null, location:d.location||null, source:d.source||null,
    },{onConflict:"email"});
    if(dbErr) console.error("DB insert error:",dbErr);
    else console.log("Lead saved:",d.email);

    if(!KEY){
      console.error("RESEND_API_KEY not set");
      return new Response(JSON.stringify({success:true,email_sent:false}),{headers:{...CORS,"Content-Type":"application/json"}});
    }

    // Welcome email to prospect
    const r1=await fetch("https://api.resend.com/emails",{method:"POST",
      headers:{"Authorization":`Bearer ${KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({from:"Bob Zick @ Theatre4u <hello@theatre4u.org>",reply_to:"hello@theatre4u.org",to:[d.email],subject:"Welcome to the Opening Night Crew — Theatre4u™",html:welcomeHtml(d),text:`Hi ${d.name}, you're in! Create your account at theatre4u.org using this email address. Welcome to Opening Night. — Bob Zick`})});
    console.log("Welcome email:",r1.status);

    // Admin notification to gmail
    const r2=await fetch("https://api.resend.com/emails",{method:"POST",
      headers:{"Authorization":`Bearer ${KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({from:"Theatre4u Alerts <hello@theatre4u.org>",to:[ADMIN_EMAIL],subject:`New Opening Night Signup: ${d.org}`,html:adminHtml(d),text:`New beta signup: ${d.org} / ${d.name} / ${d.email} / ${d.location||''}`})});
    console.log("Admin email:",r2.status);

    return new Response(JSON.stringify({success:true,lead_saved:!dbErr,welcome_sent:r1.ok,admin_sent:r2.ok}),{headers:{...CORS,"Content-Type":"application/json"}});
  }catch(e){
    console.error(String(e));
    return new Response(JSON.stringify({error:String(e)}),{status:500,headers:{...CORS,"Content-Type":"application/json"}});
  }
});
