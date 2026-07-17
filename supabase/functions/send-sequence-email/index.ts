// send-sequence-email v7 — brand by VERTICAL too (2026-07-14)
// Change from v5/v6: brand now also considers org.vertical. Non-theatre verticals
// (music/dance/art/booster) are ALWAYS ArtsTracker-branded — Theatre4u is theatre-only —
// regardless of signup_domain. Theatre programs still follow signup_domain.
//   - BRAND: sender display name, header, links, footer follow the org's signup_domain
//     (sending address stays hello@theatre4u.org — the Resend-verified domain — with
//      brand reply-to; switch FROM to artstracker.org after that domain is verified in Resend)
//   - VERTICAL: item examples, exchange name, event words, spaces follow org.vertical
//   - EMAIL 7: "free first year" promise REMOVED (rescinded 7/4) — founding rate $9.99 only
//   - Beta framing pinned to the real dates: free through September 1, 2026
import{createClient}from'https://esm.sh/@supabase/supabase-js@2';

const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};

type Brand={name:string;plain:string;site:string;host:string;from:string;reply:string;emoji:string};
const BRANDS:Record<string,Brand>={
  theatre4u:{name:'Theatre4u&#x2122;',plain:'Theatre4u',site:'https://theatre4u.org',host:'theatre4u.org',
    from:'Bob Zick at Theatre4u <hello@theatre4u.org>',reply:'hello@theatre4u.org',emoji:'&#x1F3AD;'},
  artstracker:{name:'ArtsTracker',plain:'ArtsTracker',site:'https://artstracker.org',host:'artstracker.org',
    from:'Bob Zick at ArtsTracker <hello@theatre4u.org>',reply:'hello@artstracker.org',emoji:'&#x1F3A8;'},
};
// Non-theatre verticals are ArtsTracker-only; theatre programs follow the domain they signed up on.
const brandFor=(signup_domain?:string,vertical?:string):Brand=>
  ((vertical||'theatre')!=='theatre')?BRANDS.artstracker
  :((signup_domain||'').includes('artstracker')?BRANDS.artstracker:BRANDS.theatre4u);

type Vert={items:string;itemsShort:string;one:string;exchange:string;event:string;space:string;team:string;deep:string};
const VERTS:Record<string,Vert>={
  theatre:{items:'costumes, props, lighting, and sets',itemsShort:'costumes, props, lighting, sets, and storage bins',
    one:'a costume, a prop, a lighting fixture',exchange:'Backstage Exchange',event:'show',space:'scene shop',
    team:'stage manager, crew, and house volunteers',deep:'the costume in the wrong closet, the prop that walks off after closing night'},
  music:{items:'instruments, accessories, uniforms, and sheet music',itemsShort:'instruments, accessories, uniforms, and gear',
    one:'an instrument, a stand, a uniform',exchange:'The Exchange',event:'concert',space:'instrument room',
    team:'section leaders, aides, and volunteers',deep:'the trumpet that never came back, the uniform in the wrong size bin'},
  dance:{items:'costumes, props, and equipment',itemsShort:'costumes, props, and gear',
    one:'a costume, a prop, a portable barre',exchange:'The Exchange',event:'performance',space:'costume room',
    team:'aides and volunteers',deep:'the costume that vanished after the spring showcase'},
  art:{items:'supplies, tools, and equipment',itemsShort:'supplies, tools, and equipment',
    one:'a tool, a kiln shelf, a class set of brushes',exchange:'The Exchange',event:'exhibition',space:'supply closet',
    team:'aides and volunteers',deep:'the good scissors that disappeared, the glaze nobody can find'},
  booster:{items:'equipment, supplies, and event gear',itemsShort:'equipment, supplies, and event gear',
    one:'a folding table, a canopy, a cash box',exchange:'The Exchange',event:'event',space:'storage room',
    team:'volunteers',deep:'the canopy that went home with a volunteer last fall'},
};
const vertFor=(v?:string):Vert=>VERTS[v||'theatre']||VERTS.theatre;

const hdr=(B:Brand)=>`<div style="background:#1a0f00;padding:18px 24px"><span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#d4a843">${B.emoji} ${B.name}</span></div>`;
const ftr=(B:Brand)=>`<div style="padding:12px 28px;border-top:1px solid #e8e0d0;text-align:center;font-size:11px;color:#aaa">${B.name} &mdash; Artstracker LLC &middot; <a href="${B.site}" style="color:#aaa">${B.host}</a></div>`;
const sig=(B:Brand)=>`<p style="font-size:15px;color:#333;margin:28px 0 4px">Warmly,</p><p style="font-size:15px;font-weight:700;color:#1a0f00;margin:0 0 4px">Bob</p><p style="font-size:13px;color:#888;margin:0">Bob Zick &middot; Founder, ${B.name}<br/>${B.reply} &middot; ${B.host}</p>`;
const wrap=(B:Brand,body:string)=>`<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff">${hdr(B)}<div style="padding:28px 28px 20px">${body}${sig(B)}</div>${ftr(B)}</div>`;
const gold=(lines:string[])=>`<div style="background:#fff8e6;border:1px solid #d4a843;border-radius:8px;padding:16px 18px;margin:20px 0">${lines.map(l=>`<p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 6px">${l}</p>`).join('')}</div>`;
const parchment=(html:string)=>`<div style="background:#f5f0e8;border-radius:8px;padding:16px 18px;margin:0 0 20px">${html}</div>`;
const stripe=(icon:string,text:string)=>`<div style="margin:0 0 14px;padding:12px 16px;background:#f9f6f0;border-left:3px solid #d4a843;border-radius:0 8px 8px 0"><strong style="color:#1a0f00;font-size:14px">${icon}</strong><br/><span style="font-size:14px;color:#444;line-height:1.6">${text}</span></div>`;
const p=(t:string,opts='')=>`<p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 16px;${opts}">${t}</p>`;
const sm=(t:string)=>`<p style="font-size:13px;color:#888;line-height:1.6;margin:0 0 12px">${t}</p>`;
const cta=(B:Brand,label:string)=>`<div style="text-align:center;margin:24px 0"><a href="${B.site}" style="display:inline-block;background:#d4a843;color:#1a0f00;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">${label}</a></div>`;
const signinBox=(B:Brand)=>parchment(`<p style="font-size:15px;font-weight:700;color:#1a0f00;text-align:center;margin:0 0 6px">Sign in at</p><p style="text-align:center;margin:0"><a href="${B.site}" style="font-size:17px;font-weight:700;color:#d4a843;text-decoration:none">${B.host}</a></p>`);
const ol=(items:string[])=>`<ol style="margin:10px 0 0;padding-left:18px;color:#444;font-size:14px;line-height:1.9">${items.map(i=>`<li style="margin-bottom:4px">${i}</li>`).join('')}</ol>`;
const ul=(items:string[])=>`<ul style="font-size:14px;color:#444;line-height:1.9;padding-left:18px;margin:0 0 16px">${items.map(i=>`<li style="margin-bottom:4px">${i}</li>`).join('')}</ul>`;

// The founding-member offer — the ONLY beta reward (free-year promise rescinded 7/4/26)
const FOUNDING=(B:Brand)=>gold([
  '&#x2713; Free Pro access now, through September 1, 2026 (our beta period)',
  '&#x2713; Add <strong>25+ items</strong> and share <strong>one piece of feedback</strong> before September 1 &rarr; lock in the <strong>founding member rate: $9.99/month for as long as you subscribe</strong> (standard rate will be $15)',
  '&#x2713; Everything you build carries over &mdash; nothing is lost at launch',
]);

type EmailDef={subject:(B:Brand,V:Vert)=>string,html:(B:Brand,V:Vert,name:string,org:string)=>string};
const EMAILS:Record<number,EmailDef>={
0:{subject:(B)=>`${B.plain} is live — you're invited to join`,
  html:(B,V,name)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`Thank you for your interest in ${B.plain} — it means a lot. I wanted to personally reach out and invite you to come see what we've built.`)}
    ${p(`${B.plain} is live and growing. Programs from California, Ohio, Missouri, North Carolina, New Hampshire, New York, Georgia, Virginia, and Pennsylvania are already building their inventories, sharing resources with each other, and tracking their funding.`)}
    ${p("Here's a look at what's inside:")}
    ${gold([
      `&#x1F4E6; Inventory — all your ${V.items} in one searchable database, each item with its own QR code`,
      `&#x1F504; ${V.exchange} — browse and share items with programs across the country`,
      '&#x1F4B0; Funding Tracker — track grants and donations with built-in expenditure logging',
      `&#x1F465; Team access — invite your ${V.team} so everyone can find things`,
    ])}
    ${p('Programs signing up during our beta get <strong>free Pro access through September 1</strong> — no credit card. Just sign in and start building.','font-size:14px;color:#555;')}
    ${signinBox(B)}
    ${sm("Questions before signing up? Just reply — I'm here.")}
  `)},
1:{subject:(B)=>`Welcome to ${B.plain} — you're in!`,
  html:(B,V,name,org)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`You just created your ${B.plain} account, and I'm really glad you're here. ${org} is joining a growing community of programs across the country who are building something genuinely useful together.`)}
    ${p("As a beta member, you have <strong>free Pro access through September 1</strong> — no credit card, no limits. Here's what's waiting for you:")}
    ${gold([
      `&#x1F4E6; Inventory — add ${V.itemsShort}. Every item gets a QR code.`,
      `&#x1F504; ${V.exchange} — browse and share items with programs in CA, OH, MO, NC, NH, NY, and more.`,
      '&#x1F4B0; Funding Tracker — track grants and donations with built-in expenditure logging.',
      `&#x1F465; Team — invite your ${V.team}.`,
    ])}
    ${signinBox(B)}
    ${p("I'll send you a few short tips over the next few weeks — just useful things to try when you're ready for them.",'font-size:14px;color:#555;')}
    ${sm('Questions? Just reply — I read every one.')}
  `)},
2:{subject:()=>'Ready for your first item? It takes about 90 seconds.',
  html:(B,V,name,org)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`The fastest way to feel what ${B.plain} can do for ${org} is to add one item to your inventory. Just one — ${V.one}, anything sitting in your ${V.space} right now.`)}
    ${parchment(`<strong style="color:#1a0f00;font-size:14px">Here's how:</strong>${ol([
      `Sign in at <a href="${B.site}" style="color:#8b6914;font-weight:700">${B.host}</a>`,
      'Click <strong>Inventory</strong> in the left sidebar',
      'Click <strong>+ Add</strong>',
      'Fill in the name, category, condition, and quantity — then Save',
    ])}`)}
    ${p('A few things that might surprise you:','font-size:14px;color:#555;font-weight:700;')}
    ${ul([
      'Every item gets a <strong>QR code automatically</strong> — scan it with any phone to pull it up instantly',
      'You can add a <strong>storage location</strong> so your team can find things without asking',
      `Items can be listed for rent, loan, or sale and shared with other programs through ${V.exchange}`,
    ])}
    ${p(`Start with whatever has been hardest to keep track of — ${V.deep}.`,'font-size:14px;color:#555;')}
  `)},
3:{subject:(B)=>`Here's everything ${B.plain} can do for your program`,
  html:(B,V,name,org)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`You've had a few days to explore — here's a full picture of what ${B.plain} can do for ${org}, including some things you might not have found yet.`)}
    ${stripe('&#x1F4E6; Inventory Management',`Your full physical inventory in one searchable database. Every item gets a QR code. Filter by category, condition, location, or availability.`)}
    ${stripe('&#x1F465; Your Team',`Invite your ${V.team}. Each role has the right level of access. New members can join instantly with a QR code.`)}
    ${stripe('&#x1F3AD; Events',`Track your ${V.event}s by season. Associate items with each one and build a historical record of what you used.`)}
    ${stripe(`&#x1F504; ${V.exchange}`,'Browse what other programs across the country are renting, lending, or selling — and list your own. Programs in CA, OH, MO, NC, NH, NY, VA, GA, and PA are already active.')}
    ${stripe('&#x1F4CA; Reports','Generate inventory reports by category, condition, location, or value. Export to CSV. Useful for grants, audits, and budget conversations.')}
    ${stripe('&#x1F4B0; Funding Tracker','Track grants, donations, and district funding. Log expenditures as you go and see your balance at any time — the documentation builds itself.')}
    ${FOUNDING(B)}
  `)},
4:{subject:(B,V)=>`Your ${V.space} has neighbors — meet ${V.exchange}`,
  html:(B,V,name,org)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`Every program has things it doesn't use year-round. ${V.exchange} is where programs like ${org} can list those things and find what others are sharing in return.`)}
    ${parchment(`<strong style="color:#1a0f00;font-size:14px">To list an item for sharing:</strong>${ol([
      `Sign in at <a href="${B.site}" style="color:#8b6914;font-weight:700">${B.host}</a>`,
      'Go to <strong>Inventory</strong> and open any item',
      `Click <strong>Edit</strong>, then find the <strong>${V.exchange}</strong> section`,
      'Choose For Rent, For Loan, or For Sale and set your terms',
      'Save — the item is now visible to programs across the country',
    ])}`)}
    ${parchment(`<strong style="color:#1a0f00;font-size:14px">To browse what others are sharing:</strong><p style="font-size:14px;color:#444;margin:8px 0 0;line-height:1.7">Click <strong>${V.exchange}</strong> in the left sidebar. Programs near you show up first with a Request button. Programs farther away have a Message button — great for anything that can ship.</p>`)}
    ${cta(B,`Explore ${V.exchange} →`)}
    ${sm(`Know a neighboring program that could benefit? Invite them to join ${B.plain} — the more programs involved, the better the sharing gets for everyone.`)}
  `)},
5:{subject:()=>'The funding tracker that does your paperwork for you',
  html:(B,V,name,org)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`One of the most practical things ${B.plain} can do for ${org} is track your funding — grants, donations, district allocations, booster funds — and build the documentation your administration needs, automatically.`)}
    ${ul([
      'Create a funding source for each grant or allocation by name and amount',
      'Log expenditures as you spend — the running balance updates automatically',
      'Pull a full report by source and date range at any time',
      'Hand your administration exactly what they need at year-end, already organized',
    ])}
    ${p('California programs: the Funding Tracker works great for Prop 28 compliance documentation specifically. Other states: it works just as well for any grant or funding program your district uses.','font-size:13px;color:#888;line-height:1.6;')}
    ${parchment(`<strong style="color:#1a0f00;font-size:14px">To get started:</strong>${ol([
      `Sign in at <a href="${B.site}" style="color:#8b6914;font-weight:700">${B.host}</a>`,
      'Click <strong>Funding Tracker</strong> in the left sidebar',
      'Click <strong>+ Add Funding Source</strong> and enter the name and amount received',
      'Log expenditures as you spend — the balance stays current automatically',
    ])}`)}
    ${sm("Have a specific reporting format your district or grant requires? Reply and describe it — I'll see if we can add it.")}
  `)},
6:{subject:()=>'A report that might change your next budget conversation',
  html:(B,V,name,org)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`Once ${org} has items in inventory, ${B.plain} can turn that data into reports that are genuinely useful — not just for you, but for the conversations you need to have with your administration.`)}
    ${stripe('For budget conversations','Generate a report showing your total inventory value. Walking into a meeting with a document that shows your program manages $40,000+ in physical assets changes how that conversation goes.')}
    ${stripe('For grant applications','Many grants ask you to document existing resources. Export your inventory as a CSV and attach it — clean, organized, done in about 30 seconds.')}
    ${stripe('For insurance and audits','Every item, its condition, location, and estimated value, all in one place with a full history. Exactly what district risk management wants to see.')}
    ${stripe('For end-of-year reviews',`Show what you acquired, what you used, and what's ready for next season. Filter by ${V.event}, category, or condition.`)}
    ${parchment(`<strong style="color:#1a0f00;font-size:14px">How to run a report:</strong>${ol([
      `Sign in at <a href="${B.site}" style="color:#8b6914;font-weight:700">${B.host}</a>`,
      'Click <strong>Reports</strong> in the left sidebar',
      'Choose your filters — category, condition, date range, or location',
      'View the summary on screen or click <strong>Export CSV</strong> to download',
    ])}`)}
    ${sm("Need a specific format for a district requirement or grant application? Just reply — I'll add it.")}
  `)},
7:{subject:()=>"What's coming September 1 — and what it means for you",
  html:(B,V,name,org)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`You've been part of ${B.plain} during our beta, and I want to be upfront about where things are headed.`)}
    ${p('<strong style="color:#1a0f00">What happens September 1</strong>','font-size:15px;margin-bottom:6px;')}
    ${p(`The beta ends and paid plans begin. ${B.plain} is part of ArtsTracker — a platform for arts programs covering Theatre, Music, Dance, Visual Art, and Organizations. Same platform, same data: ${org}'s account carries over exactly as it is.`,'font-size:14px;color:#555;')}
    ${p('<strong style="color:#1a0f00">What that means for you</strong>','font-size:15px;margin-bottom:6px;')}
    ${FOUNDING(B)}
    ${p("The one thing I'm asking in return: honest feedback. What's working, what's confusing, what's missing? Use the feedback button inside the app or just reply to this email. It goes directly to me.",'font-size:14px;color:#555;')}
    ${sm(`Know a colleague who runs a program? They can learn more and sign up at ${B.host}.`)}
  `)},
};

async function sendEmail(to:string,num:number,name:string,org:string,key:string,B:Brand,V:Vert):Promise<string|null>{
  const e=EMAILS[num];
  if(!e)return null;
  const first=name?.split(' ')[0]||'there';
  const res=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({from:B.from,reply_to:B.reply,to:[to],subject:e.subject(B,V),html:e.html(B,V,first,org)})
  });
  const d=await res.json();
  if(!res.ok)throw new Error(`Resend ${res.status}: ${JSON.stringify(d)}`);
  return d.id as string;
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:200,headers:CORS});
  const KEY=Deno.env.get('RESEND_API_KEY');
  const SB=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  if(!KEY)return new Response(JSON.stringify({error:'RESEND_API_KEY not set'}),{status:500,headers:{...CORS,'Content-Type':'application/json'}});
  try{
    const{org_id,email_num,lead_email,lead_name,lead_org}=await req.json();

    if(email_num===0){
      if(!lead_email)return new Response(JSON.stringify({error:'lead_email required for email 0'}),{status:400,headers:{...CORS,'Content-Type':'application/json'}});
      const B=BRANDS.theatre4u, V=VERTS.theatre; // beta leads are theatre-era
      const rid=await sendEmail(lead_email,0,lead_name||'there',lead_org||'your program',KEY,B,V);
      return new Response(JSON.stringify({ok:true,email_num:0,to:lead_email,resend_id:rid}),{headers:{...CORS,'Content-Type':'application/json'}});
    }

    if(!org_id||!email_num)return new Response(JSON.stringify({error:'org_id and email_num required'}),{status:400,headers:{...CORS,'Content-Type':'application/json'}});
    const{data:ex}=await SB.from('email_sequence').select('id').eq('org_id',org_id).eq('email_num',email_num).maybeSingle();
    if(ex)return new Response(JSON.stringify({ok:true,skipped:'already sent'}),{headers:{...CORS,'Content-Type':'application/json'}});
    const{data:org}=await SB.from('orgs').select('id,name,email,director_name,plan,vertical,signup_domain').eq('id',org_id).single();
    if(!org)return new Response(JSON.stringify({error:'org not found'}),{status:404,headers:{...CORS,'Content-Type':'application/json'}});
    const B=brandFor(org.signup_domain,org.vertical), V=vertFor(org.vertical);
    const name=org.director_name||org.name||'there';
    const rid=await sendEmail(org.email,email_num,name,org.name,KEY,B,V);
    await SB.from('email_sequence').insert({org_id,email_num,resend_id:rid,status:'sent'});
    console.log(`Email ${email_num} → ${org.email} (${org.name}) [${B.plain}/${org.vertical||'theatre'}]`);
    return new Response(JSON.stringify({ok:true,email_num,to:org.email,resend_id:rid}),{headers:{...CORS,'Content-Type':'application/json'}});
  }catch(e){
    console.error(String(e));
    return new Response(JSON.stringify({error:String(e)}),{status:500,headers:{...CORS,'Content-Type':'application/json'}});
  }
});
