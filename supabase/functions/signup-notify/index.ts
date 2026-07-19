// signup-notify v9
// Sends admin alert + welcome email for directors
// Sends "You're in" team email for team members — no org created, no sequence
// v9: the team "You're in" email is now brand/door aware (Theatre4u vs ArtsTracker).
import{createClient}from'https://esm.sh/@supabase/supabase-js@2';

const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const NOTIFY_EMAIL='theatre4u1@gmail.com';
const SKIP_EMAILS=['hello@theatre4u.org','rzick@hbuhsd.edu','theatre4u1@gmail.com','rzickjr@gmail.com'];

// Brand by vertical/door: non-theatre programs = ArtsTracker; theatre follows signup_domain.
// Defaults to Theatre4u when nothing is passed, so older callers keep working.
type Brand={name:string;site:string;host:string;from:string;reply:string;emoji:string;exchange:string;teamWord:string};
const BRANDS:Record<string,Brand>={
  theatre4u:  {name:'Theatre4u',  site:'https://theatre4u.org',  host:'theatre4u.org',  from:'Theatre4u <hello@theatre4u.org>',  reply:'hello@theatre4u.org',  emoji:'&#x1F3AD;',exchange:'Backstage Exchange',teamWord:'backstage team'},
  artstracker:{name:'ArtsTracker',site:'https://artstracker.org',host:'artstracker.org',from:'ArtsTracker <hello@theatre4u.org>',reply:'hello@artstracker.org',emoji:'&#x1F3A8;',exchange:'The Exchange',      teamWord:'team'},
};
const brandFor=(d?:string,v?:string):Brand=>
  ((v||'theatre')!=='theatre') ? BRANDS.artstracker
  : ((d||'').includes('artstracker') ? BRANDS.artstracker : BRANDS.theatre4u);

function adminHtml(org:any,stats:any,isTeamMember=false):string{
  const t=new Date(org.created_at||new Date()).toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
  const badge=isTeamMember?'<span style="background:#42a5f522;color:#42a5f5;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700">TEAM MEMBER</span>':'<span style="background:#d4a84322;color:#d4a843;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700">NEW DIRECTOR</span>';
  return`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif"><div style="max-width:540px;margin:0 auto;background:#fff"><div style="background:#1a1200;padding:18px 24px"><span style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#d4a843">&#x1F3AD; Theatre4u New Signup</span></div><div style="padding:22px 24px"><h2 style="font-family:Georgia,serif;font-size:19px;color:#1a1200;margin:0 0 8px">New signup ${badge}</h2><table cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px"><tr style="background:#f5f0e8"><td style="color:#666;width:90px;padding:7px 10px">Name</td><td style="font-weight:700;padding:7px 10px">${org.name||'&mdash;'}</td></tr><tr><td style="color:#666;padding:7px 10px">Email</td><td style="padding:7px 10px"><a href="mailto:${org.email}" style="color:#8b6914">${org.email}</a></td></tr><tr style="background:#f5f0e8"><td style="color:#666;padding:7px 10px">Signed up</td><td style="padding:7px 10px">${t} PT</td></tr></table><div style="background:#f5f0e8;border-radius:8px;padding:12px 14px;font-size:13px;color:#555;margin-bottom:16px">&#x1F3AB; ${stats.total_orgs} programs &nbsp;&middot;&nbsp; &#x1F4E6; ${stats.total_items} items</div></div><div style="padding:10px 24px;border-top:1px solid #e8e0d0;text-align:center;font-size:11px;color:#aaa">Theatre4u&trade; &mdash; Artstracker LLC</div></div></body></html>`;
}

function teamWelcomeHtml(orgName:string,role:string,B:Brand):string{
  const roleLabel=role==='stage_manager'?'Stage Manager':role==='co_director'?'Co-Director':role==='crew'?'Crew':role==='house'?'House':'Team Member';
  const roleDesc=role==='co_director'?'Full access, the same as the director. You can add, edit, and manage everything in the program.':role==='stage_manager'?`You can add and edit inventory items, access the Funding Tracker, ${B.exchange}, and Community Board.`:role==='crew'?'You can add and edit items and upload photos to the inventory.':'You can view and search the program\'s inventory.';
  return`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif"><div style="max-width:520px;margin:0 auto;background:#fff"><div style="background:#1a1200;padding:20px 28px;text-align:center"><span style="font-size:36px">${B.emoji}</span><div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#d4a843;margin-top:6px">${B.name}</div></div><div style="padding:28px"><h2 style="font-family:Georgia,serif;color:#1a1200;font-size:22px;margin:0 0 10px">You’re in!</h2><p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 18px">You’ve been added to <strong>${orgName}</strong>’s ${B.teamWord} as <strong>${roleLabel}</strong>.</p><div style="background:#f5f0e8;border-radius:8px;padding:14px;font-size:13px;color:#666;margin-bottom:22px;line-height:1.6"><strong>Your access:</strong> ${roleDesc}</div><div style="text-align:center;margin-bottom:24px"><a href="${B.site}" style="display:inline-block;background:#d4a843;color:#1a0f00;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Open ${B.name} →</a></div><p style="color:#888;font-size:13px;line-height:1.6">Sign in with the email and password you used to join. You’ll see ${orgName}’s inventory when you log in.</p></div><div style="padding:12px 24px;border-top:1px solid #e8e0d0;text-align:center;font-size:11px;color:#aaa">${B.name} · Artstracker LLC · <a href="mailto:${B.reply}" style="color:#aaa">${B.reply}</a></div></div></body></html>`;
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response(null,{status:200,headers:CORS});
  const KEY=Deno.env.get('RESEND_API_KEY');
  const SVC=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const BASE=Deno.env.get('SUPABASE_URL')!;
  const SB=createClient(BASE,SVC);

  try{
    const body=await req.json().catch(()=>({}));
    const{org_id,org_email,is_team_member,team_org_name,team_role,team_signup_domain,team_vertical}=body;
    if(!KEY) return new Response(JSON.stringify({error:'RESEND_API_KEY not set'}),{status:500,headers:{...CORS,'Content-Type':'application/json'}});

    // ── TEAM MEMBER PATH ────────────────────────────────────────────────
    // Team members don't create an org — just send them the "you're in" email
    if(is_team_member){
      const toEmail=org_email;
      if(!toEmail||SKIP_EMAILS.includes(toEmail.toLowerCase())){
        return new Response(JSON.stringify({ok:true,skipped:'internal'}),{headers:{...CORS,'Content-Type':'application/json'}});
      }
      const B=brandFor(team_signup_domain,team_vertical);
      const orgName=team_org_name||(B===BRANDS.artstracker?'your program':'your theatre program');
      const role=team_role||'crew';

      // Send you're-in email to team member (door-aware brand)
      const teamRes=await fetch('https://api.resend.com/emails',{
        method:'POST',
        headers:{'Authorization':`Bearer ${KEY}`,'Content-Type':'application/json'},
        body:JSON.stringify({
          from:B.from,
          reply_to:B.reply,
          to:[toEmail],
          subject:`You're in: ${orgName} on ${B.name}`,
          html:teamWelcomeHtml(orgName,role,B),
        }),
      });
      console.log('Team welcome email:',teamRes.status,'to',toEmail);

      // Admin alert (smaller, tagged as team member)
      await fetch('https://api.resend.com/emails',{
        method:'POST',
        headers:{'Authorization':`Bearer ${KEY}`,'Content-Type':'application/json'},
        body:JSON.stringify({
          from:'Theatre4u Alerts <hello@theatre4u.org>',
          to:[NOTIFY_EMAIL],
          subject:`Team member joined: ${toEmail} → ${orgName}`,
          html:adminHtml({name:orgName,email:toEmail,created_at:new Date().toISOString()},{total_orgs:0,total_items:0},true),
        }),
      });

      return new Response(JSON.stringify({ok:true,team_member:true}),{headers:{...CORS,'Content-Type':'application/json'}});
    }

    // ── DIRECTOR PATH ─────────────────────────────────────────────────────
    let org:any=null;
    if(org_id){const{data}=await SB.from('orgs').select('*').eq('id',org_id).maybeSingle();org=data;}
    if(!org&&org_email){const{data}=await SB.from('orgs').select('*').eq('email',org_email).maybeSingle();org=data;}
    if(!org) return new Response(JSON.stringify({error:'org not found'}),{status:404,headers:{...CORS,'Content-Type':'application/json'}});

    // Deduplicate
    const{data:existing}=await SB.from('signup_notifications').select('id,notified').eq('org_id',org.id).maybeSingle();
    if(existing?.notified) return new Response(JSON.stringify({ok:true,skipped:'already notified'}),{headers:{...CORS,'Content-Type':'application/json'}});

    const[{count:totalOrgs},{count:paidOrgs},{count:totalItems}]=await Promise.all([
      SB.from('orgs').select('*',{count:'exact',head:true}),
      SB.from('orgs').select('*',{count:'exact',head:true}).in('plan',['pro','district','district_m','district_l']),
      SB.from('items').select('*',{count:'exact',head:true}),
    ]);
    const stats={total_orgs:totalOrgs||0,paid_orgs:paidOrgs||0,total_items:totalItems||0};

    // Admin notification
    const adminRes=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{'Authorization':`Bearer ${KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({from:'Theatre4u Alerts <hello@theatre4u.org>',reply_to:org.email,to:[NOTIFY_EMAIL],
        subject:`New signup: ${org.name||org.email}`,html:adminHtml(org,stats,false)}),
    });
    console.log('Admin email:',adminRes.status);

    // Welcome sequence #1 for directors only
    if(!SKIP_EMAILS.includes(org.email?.toLowerCase())){
      const seqRes=await fetch(`${BASE}/functions/v1/send-sequence-email`,{
        method:'POST',
        headers:{'Authorization':`Bearer ${SVC}`,'Content-Type':'application/json'},
        body:JSON.stringify({org_id:org.id,email_num:1}),
      });
      console.log('Welcome email #1:',await seqRes.json());
    }

    await SB.from('signup_notifications').upsert(
      {org_id:org.id,org_name:org.name,org_email:org.email,plan:org.plan,notified:adminRes.ok,notified_at:new Date().toISOString()},
      {onConflict:'org_id'}
    );

    return new Response(JSON.stringify({ok:true}),{headers:{...CORS,'Content-Type':'application/json'}});
  }catch(e){
    console.error(String(e));
    return new Response(JSON.stringify({error:String(e)}),{status:500,headers:{...CORS,'Content-Type':'application/json'}});
  }
});
