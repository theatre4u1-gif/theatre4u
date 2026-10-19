// send-sequence-email v8 — + monthly "something new" re-engagement series (2026-10-13)
//   Onboarding 0-6 unchanged. New `monthly:true` mode reads per-org usage and sends the
//   most-relevant unseen tip (ARTS_TIPS / HOME_TIPS), recycling oldest-first. Logs to
//   email_monthly_log. Driven by email-sequence-scheduler's monthly pass.
// send-sequence-email v7 — brand by VERTICAL too (2026-07-14)
// Change from v5/v6: brand now also considers org.vertical. Non-theatre verticals
// (music/dance/art/booster) are ALWAYS ArtsTracker-branded — Theatre4u is theatre-only —
// regardless of signup_domain. Theatre programs still follow signup_domain.
//   - BRAND: sender display name, header, links, footer follow the org's signup_domain
//     (sending address stays hello@theatre4u.org — the Resend-verified domain — with
//      brand reply-to; switch FROM to artstracker.org after that domain is verified in Resend)
//   - VERTICAL: item examples, exchange name, event words, spaces follow org.vertical
//   - 2026-09-25: founding-member offer retired (no replacement deal); all beta / "free through
//     September 1" framing removed; Email 7 (beta-end announcement) dropped from the sequence.
//     Emails now describe the standing model: first 25 items free forever, Pro when ready.
import{createClient}from'https://esm.sh/@supabase/supabase-js@2';

const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};

type Brand={name:string;plain:string;site:string;host:string;from:string;reply:string;emoji:string;pro:string;mark:string;mw:number;mh:number;tag:string;ink:string};
const BRANDS:Record<string,Brand>={
  theatre4u:{name:'Theatre4u&#x2122;',plain:'Theatre4u',site:'https://theatre4u.org',host:'theatre4u.org',
    from:'Bob Zick at Theatre4u <hello@theatre4u.org>',reply:'hello@theatre4u.org',emoji:'&#x1F3AD;',pro:'$15',
    mark:'https://theatre4u.org/logo-mark-theatre4u.png',mw:57,mh:44,tag:'Built for the people who make theatre happen.',ink:'#4C1035'},
  artstracker:{name:'ArtsTracker',plain:'ArtsTracker',site:'https://artstracker.org',host:'artstracker.org',
    from:'Bob Zick at ArtsTracker <hello@theatre4u.org>',reply:'hello@artstracker.org',emoji:'&#x1F3A8;',pro:'$59',
    mark:'https://theatre4u.org/logo-mark-artstracker.png',mw:62,mh:44,tag:'Arts programs, organized.',ink:'#4C1035'},
  // BinTrove (home). FROM stays the Resend-verified theatre4u.org domain with BinTrove reply-to
  // until bintrove.com is verified in Resend; then switch from to hello@bintrove.com.
  bintrove:{name:'BinTrove',plain:'BinTrove',site:'https://bintrove.com',host:'bintrove.com',
    from:'Bob Zick at BinTrove <hello@theatre4u.org>',reply:'hello@bintrove.com',emoji:'&#x1F4E6;',pro:'$24',
    mark:'https://bintrove.com/logo-mark-bintrove.png',mw:44,mh:44,tag:'Home storage, organized.',ink:'#0A5450'},
};
// Home orgs → BinTrove. Non-theatre arts verticals → ArtsTracker. Theatre follows signup domain.
const brandFor=(signup_domain?:string,vertical?:string,org_type?:string):Brand=>
  ((vertical||'theatre')==='home'||org_type==='home')?BRANDS.bintrove
  :((vertical||'theatre')!=='theatre')?BRANDS.artstracker
  :((signup_domain||'').includes('artstracker')?BRANDS.artstracker:BRANDS.theatre4u);

type Vert={items:string;itemsShort:string;one:string;exchange:string;event:string;space:string;team:string;deep:string;
  org?:string;oversight?:string;money?:string;budgetWord?:string;prop28?:string;risk?:string;community?:string};
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
// Audience overrides by org_type (school | college | community | other). Only the lines that
// assume "school" get branched; everything else stays shared. Default (unknown) = neutral.
type Aud={org:string;oversight:string;money:string;budgetWord:string;prop28:string;risk:string;teamTheatre:string;spaceTheatre:string};
const AUDS:Record<string,Aud>={
  school:{org:'your program',oversight:'your administration',
    money:'grants, donations, district funding, and booster funds',budgetWord:'budget conversations',
    prop28:'California programs: the Funding Tracker works great for Prop 28 compliance documentation specifically. Other states: it works just as well for any grant or funding program your district uses.',
    risk:'what district risk management wants to see',teamTheatre:'stage manager, crew, and house volunteers',spaceTheatre:'scene shop'},
  college:{org:'your department',oversight:'your department chair',
    money:'department budget, grants, and donations',budgetWord:'budget conversations',
    prop28:'Grants and department funding: the Funding Tracker keeps your documentation ready for whatever your institution requires.',
    risk:'what your institution and risk management want to see',teamTheatre:'crew, assistants, and student workers',spaceTheatre:'shop'},
  community:{org:'your company',oversight:'your board',
    money:'grants, donations, ticket revenue, and membership dues',budgetWord:'board reports',
    prop28:'Community theatres: the Funding Tracker is just as useful for grant reporting and your annual board report.',
    risk:'what your insurer and board want to see',teamTheatre:'cast, crew, and volunteers',spaceTheatre:'storage, green room, or set shop'},
  other:{org:'your program',oversight:'your leadership',
    money:'grants and donations',budgetWord:'budget conversations',
    prop28:'The Funding Tracker keeps your grant and donation documentation ready whenever you need it.',
    risk:'what your insurer and leadership want to see',teamTheatre:'your team and volunteers',spaceTheatre:'storage space'},
};
const audFor=(t?:string):Aud=>AUDS[t||'other']||AUDS.other;
// Merge the vertical's base vocabulary with audience-aware fields. For theatre, team + space also
// shift by audience (school vs community); other verticals keep their base team/space.
const vertFor=(v?:string,org_type?:string):Vert=>{
  const base=VERTS[v||'theatre']||VERTS.theatre;
  const A=audFor(org_type);
  const isTheatre=(v||'theatre')==='theatre';
  return {...base,
    org:A.org,oversight:A.oversight,money:A.money,budgetWord:A.budgetWord,prop28:A.prop28,risk:A.risk,
    team:isTheatre?A.teamTheatre:base.team,
    space:isTheatre?A.spaceTheatre:base.space,
  };
};

const hdr=(B:Brand)=>`<div style="background:#FBF7F0;padding:20px 24px 16px;text-align:center;border-bottom:3px solid #d4a843"><img src="${B.mark}" alt="" width="${B.mw}" height="${B.mh}" style="border:0;vertical-align:middle"/><span style="font-family:Georgia,serif;font-size:25px;font-weight:700;color:${B.ink};vertical-align:middle;margin-left:10px">${B.name}</span><div style="font-size:11px;color:#6D625E;margin-top:6px;letter-spacing:.02em">${B.tag}</div></div>`;
const ftr=(B:Brand)=>`<div style="padding:12px 28px;border-top:1px solid #e8e0d0;text-align:center;font-size:11px;color:#aaa">${B.name} &mdash; Artstracker LLC &middot; <a href="${B.site}" style="color:#aaa">${B.host}</a></div>`;
// Full CAN-SPAM footer (postal address + unsubscribe). Injected at send time in place of ftr(B).
const ADDR='Artstracker LLC &middot; 10441 Stanford Ave., #1155, Garden Grove, CA 92842';
const ftrFull=(B:Brand,unsubUrl:string)=>`<div style="padding:14px 28px;border-top:1px solid #e8e0d0;text-align:center;font-size:11px;color:#aaa;line-height:1.7">${B.name} &mdash; ${ADDR}<br/><a href="${B.site}" style="color:#aaa">${B.host}</a> &middot; ${unsubUrl?`<a href="${unsubUrl}" style="color:#aaa;text-decoration:underline">Unsubscribe</a>`:`<a href="mailto:hello@theatre4u.org?subject=unsubscribe" style="color:#aaa;text-decoration:underline">Unsubscribe</a>`}<br/><span style="color:#bbb">You are receiving this because you signed up for ${B.name}.</span></div>`;
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

// Current pricing — free to start, Pro when ready (founding-member offer retired 2026-09; no deal)
const PRICING=(B:Brand,V:Vert)=>gold([
  '&#x2713; Free to start &mdash; your first <strong>25 items are free forever</strong>, no credit card',
  `&#x2713; Upgrade to <strong>Pro (${B.pro}/month, or save with annual billing)</strong> anytime for unlimited items, full reports, and ${V.exchange} sharing`,
  '&#x2713; Everything you build stays yours &mdash; nothing is lost',
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
    ${p('You can start free — your first <strong>25 items are free forever</strong>, no credit card. Just sign in and start building.','font-size:14px;color:#555;')}
    ${signinBox(B)}
    ${sm("Questions before signing up? Just reply — I'm here.")}
  `)},
1:{subject:(B)=>`Welcome to ${B.plain} — you're in!`,
  html:(B,V,name,org)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`You just created your ${B.plain} account, and I'm really glad you're here. ${org} is joining a growing community of programs and theatre companies across the country who are building something genuinely useful together.`)}
    ${p("You're on the free plan — your first <strong>25 items are free forever</strong>, no credit card. Here's what's waiting for you:")}
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
3:{subject:(B,V)=>`Here's everything ${B.plain} can do for ${V.org}`,
  html:(B,V,name,org)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`You've had a few days to explore — here's a full picture of what ${B.plain} can do for ${org}, including some things you might not have found yet.`)}
    ${stripe('&#x1F4E6; Inventory Management',`Your full physical inventory in one searchable database. Every item gets a QR code. Filter by category, condition, location, or availability.`)}
    ${stripe('&#x1F465; Your Team',`Invite your ${V.team}. Each role has the right level of access. New members can join instantly with a QR code.`)}
    ${stripe('&#x1F3AD; Events',`Track your ${V.event}s by season. Associate items with each one and build a historical record of what you used.`)}
    ${stripe(`&#x1F504; ${V.exchange}`,'Browse what other programs across the country are renting, lending, or selling — and list your own. Programs in CA, OH, MO, NC, NH, NY, VA, GA, and PA are already active.')}
    ${stripe('&#x1F4CA; Reports',`Generate inventory reports by category, condition, location, or value. Export to CSV. Useful for grants, audits, and ${V.budgetWord}.`)}
    ${stripe('&#x1F4B0; Funding Tracker',`Track ${V.money}. Log expenditures as you go and see your balance at any time — the documentation builds itself.`)}
    ${PRICING(B,V)}
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
    ${p(`One of the most practical things ${B.plain} can do for ${org} is track your funding — ${V.money} — and build the documentation ${V.oversight} needs, automatically.`)}
    ${ul([
      'Create a funding source for each grant or allocation by name and amount',
      'Log expenditures as you spend — the running balance updates automatically',
      'Pull a full report by source and date range at any time',
      'Hand your administration exactly what they need at year-end, already organized',
    ])}
    ${p(V.prop28,'font-size:13px;color:#888;line-height:1.6;')}
    ${parchment(`<strong style="color:#1a0f00;font-size:14px">To get started:</strong>${ol([
      `Sign in at <a href="${B.site}" style="color:#8b6914;font-weight:700">${B.host}</a>`,
      'Click <strong>Funding Tracker</strong> in the left sidebar',
      'Click <strong>+ Add Funding Source</strong> and enter the name and amount received',
      'Log expenditures as you spend — the balance stays current automatically',
    ])}`)}
    ${sm(`Have a specific reporting format ${V.oversight} or a grant requires? Reply and describe it — I'll see if we can add it.`)}
  `)},
6:{subject:()=>'A report that might change your next budget conversation',
  html:(B,V,name,org)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`Once ${org} has items in inventory, ${B.plain} can turn that data into reports that are genuinely useful — not just for you, but for the conversations you need to have with ${V.oversight}.`)}
    ${stripe('For budget conversations','Generate a report showing your total inventory value. Walking into a meeting with a document that shows your program manages $40,000+ in physical assets changes how that conversation goes.')}
    ${stripe('For grant applications','Many grants ask you to document existing resources. Export your inventory as a CSV and attach it — clean, organized, done in about 30 seconds.')}
    ${stripe('For insurance and audits',`Every item, its condition, location, and estimated value, all in one place with a full history. Exactly ${V.risk}.`)}
    ${stripe('For end-of-year reviews',`Show what you acquired, what you used, and what's ready for next season. Filter by ${V.event}, category, or condition.`)}
    ${parchment(`<strong style="color:#1a0f00;font-size:14px">How to run a report:</strong>${ol([
      `Sign in at <a href="${B.site}" style="color:#8b6914;font-weight:700">${B.host}</a>`,
      'Click <strong>Reports</strong> in the left sidebar',
      'Choose your filters — category, condition, date range, or location',
      'View the summary on screen or click <strong>Export CSV</strong> to download',
    ])}`)}
    ${sm("Need a specific format for a district requirement or grant application? Just reply — I'll add it.")}
  `)},
};

// ── BinTrove (home) welcome series — home-aimed copy; no Exchange/Funding/team/arts language.
// Free = first 30 items and 3 bins; paid plans from $24/year.
const HOME_PRICING=()=>gold([
  '&#x2713; Free to start &mdash; your first <strong>30 items and 3 bins are free</strong>, no credit card',
  '&#x2713; When you outgrow it, plans start at <strong>$24/year</strong> for more bins and items',
  '&#x2713; Everything you add stays yours &mdash; nothing is lost',
]);
const HOME_EMAILS:Record<number,EmailDef>={
0:{subject:()=>`BinTrove is live — know what's in every bin`,
  html:(B,_V,name)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`Thanks for checking out BinTrove. The idea is simple: every bin, box, and tote in your home gets a photo and a QR label, so you can find anything in seconds instead of digging through the garage.`)}
    ${gold([
      '&#x1F4E6; <strong>Catalog</strong> every bin and item in one searchable place &mdash; each with its own QR code',
      '&#x1F3F7;&#xFE0F; <strong>QR labels</strong> &mdash; stick one on a bin, scan it with your phone, see what&#39;s inside without opening it',
      '&#x1F4CD; <strong>Locations</strong> &mdash; know which closet, shelf, or storage unit everything lives in',
      '&#x1F50E; <strong>Search</strong> &mdash; &ldquo;where are the Christmas lights?&rdquo; &rarr; found',
    ])}
    ${p('Start free — your first <strong>30 items and 3 bins are free</strong>, no credit card.','font-size:14px;color:#555;')}
    ${signinBox(B)}
    ${sm("Questions before you start? Just reply — I'm here.")}
  `)},
1:{subject:()=>`Welcome to BinTrove — you're in!`,
  html:(B,_V,name)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`You just created your BinTrove account — glad you're here. Whether it's the garage, the holiday closet, a storage unit, or a whole move, BinTrove's job is to make sure you always know what you have and where it is.`)}
    ${p("You're on the free plan — <strong>30 items and 3 bins, free forever</strong>, no card. Here's what's waiting:")}
    ${gold([
      '&#x1F4E6; Add items — snap a photo and it becomes an item. Each one gets a QR code.',
      '&#x1F3F7;&#xFE0F; Print QR labels for your bins — scan to see what&#39;s inside.',
      '&#x1F4CD; Set up bins and locations so everything has a home.',
      '&#x1F50E; Search everything you own in seconds.',
    ])}
    ${signinBox(B)}
    ${p("I'll send a few short tips over the next couple weeks — just useful things to try when you're ready.",'font-size:14px;color:#555;')}
    ${sm('Questions? Just reply — I read every one.')}
  `)},
2:{subject:()=>'Your first bin, in about 90 seconds',
  html:(B,_V,name)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`The fastest way to feel what BinTrove does is to catalog one bin. Pick the one you dig through most — holiday decorations, tools, the kids' outgrown clothes.`)}
    ${parchment(`<strong style="color:#1a0f00;font-size:14px">Here's how:</strong>${ol([
      `Sign in at <a href="${B.site}" style="color:#8b6914;font-weight:700">${B.host}</a>`,
      'Tap <strong>My Bins &rarr; + Add</strong>',
      'Snap photos of a few things in the bin (each becomes an item) and name the bin&#39;s location',
      'Print the bin&#39;s <strong>QR label</strong> from the Labels tab and stick it on',
    ])}`)}
    ${p('Now scan that label with your phone — there&#39;s everything inside, without lifting the lid.','font-size:14px;color:#555;')}
    ${sm('Start with whatever has been hardest to find.')}
  `)},
3:{subject:()=>'Everything BinTrove can do',
  html:(B,_V,name)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`A few days in — here's the full picture.`)}
    ${stripe('&#x1F4E6; Catalog','Every item in one searchable place, each with a QR code. Filter by category, condition, or location.')}
    ${stripe('&#x1F3F7;&#xFE0F; QR labels','Print from any home printer on plain paper or Avery sticker sheets, or use a Brother label maker. Scan any bin to see its contents.')}
    ${stripe('&#x1F4CD; Bins &amp; locations','Closet, garage, attic, storage unit — know where everything lives.')}
    ${stripe('&#x1F50E; Search','Find anything you own instantly.')}
    ${stripe('&#x1F4CA; Reports','A full list of everything you own, with a CSV export — great for insurance or a home inventory.')}
    ${HOME_PRICING()}
  `)},
4:{subject:()=>'Moving? Label every box, unpack by room',
  html:(B,_V,name)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`If a move is anywhere on your horizon, this is where BinTrove earns its keep.`)}
    ${ul([
      '<strong>Packing:</strong> snap each box, give it a QR label — an instant manifest, no Sharpie scrawl.',
      '<strong>The move:</strong> set each box&#39;s location to its destination room (&ldquo;Kitchen,&rdquo; &ldquo;Primary bed&rdquo;).',
      '<strong>Unpacking:</strong> scan a box to see what&#39;s inside before you cut the tape; unpack by priority.',
    ])}
    ${cta(B,'Start your move list →')}
    ${sm('Even a few labeled boxes will save you a frustrating afternoon on the other end.')}
  `)},
5:{subject:()=>'Never buy a second box of ornaments again',
  html:(B,_V,name)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`The stuff that comes out once a year is exactly the stuff we forget we own. A few labeled holiday bins means:`)}
    ${ul([
      'You find the lights, the ornaments, and the wrap in minutes, not an afternoon.',
      'You stop re-buying things you already have in a bin somewhere.',
      "When the season's over, everything goes back labeled.",
    ])}
    ${parchment('<strong style="color:#1a0f00;font-size:14px">Tip:</strong> make a bin location called &ldquo;Holiday — Garage Shelf A,&rdquo; tag each bin, done.')}
    ${cta(B,'Set up your holiday bins →')}
  `)},
6:{subject:()=>"A home inventory you'll be glad you have",
  html:(B,_V,name,org)=>wrap(B,`
    ${p(`Hi ${name},`)}
    ${p(`Once your bins are in BinTrove, you've quietly built something valuable: a complete, photographed record of what you own.`)}
    ${stripe('For insurance','If anything is ever lost, stolen, or damaged, you have photos, locations, and a list — exportable to CSV in seconds.')}
    ${stripe('For peace of mind',"No more &ldquo;do we already have one of these?&rdquo;")}
    ${stripe('For downsizing or an estate','Everything documented in one place.')}
    ${HOME_PRICING()}
    ${p('Thanks for giving BinTrove a try — reply anytime.','font-size:14px;color:#555;')}
  `)},
};

// ───────────────────────────────────────────────────────────────────────────
// MONTHLY "something new" re-engagement series (runs AFTER onboarding 0-6).
// Usage-responsive: reads what the org has actually done and surfaces a feature
// or angle they haven't used yet. Recycles indefinitely (oldest-first) once all
// tips in the brand's pool have been sent. Tracked in email_monthly_log.
// ───────────────────────────────────────────────────────────────────────────
type Usage={items:number;listed:number;valued:number;bins:number;productions:number;funding:number;members:number;tagged:number;ageDays:number};
async function getUsage(SB:any,org_id:string,created_at?:string):Promise<Usage>{
  const c=async(tbl:string,extra?:(q:any)=>any)=>{
    let q=SB.from(tbl).select('id',{count:'exact',head:true}).eq('org_id',org_id);
    if(extra)q=extra(q);
    const{count}=await q; return count||0;
  };
  const[items,bins,productions,funding,members]=await Promise.all([
    c('items'),c('storage_locations'),c('productions'),c('funding_sources'),c('org_members'),
  ]);
  const listed=await c('items',(q)=>q.not('mkt','is',null).neq('mkt','Not Listed'));
  const valued=await c('items',(q)=>q.or('purchase_cost.gt.0,sale.gt.0'));
  const tagged=await c('items',(q)=>q.not('tags','is',null));
  const ageDays=created_at?Math.floor((Date.now()-new Date(created_at).getTime())/86400000):999;
  return{items,listed,valued,bins,productions,funding,members,tagged,ageDays};
}

type Tip={id:string;score:(u:Usage,month:number)=>number;subject:(B:Brand,V:Vert)=>string;html:(B:Brand,V:Vert,name:string,org:string)=>string};

// Arts pool (Theatre4u + ArtsTracker) — vocab/audience via V. Higher score = more relevant now.
const ARTS_TIPS:Tip[]=[
  {id:'a_catalog',score:(u)=>u.items<5?60:(u.items<10?25:5),
    subject:(B)=>`Keep building — ${B.plain} gets more useful with every item`,
    html:(B,V,name,org)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`${org} is off to a start — the real payoff comes once more of your ${V.items} are in. The fuller your inventory, the faster everyone finds what they need.`)}
      ${ul([
        'Add items in a batch — snap a photo and fill in the details later',
        'Every item gets its own QR code automatically',
        `Start with whatever has been hardest to keep track of — ${V.deep}`,
      ])}
      ${cta(B,'Add your next items →')}`)},
  {id:'a_reports',score:(u)=>u.items>=10?62:(u.items>=3?30:0),
    subject:(B,V)=>`A report that changes the ${V.budgetWord}`,
    html:(B,V,name,org)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`${org} has enough in inventory now that the <strong>Reports</strong> tab becomes genuinely useful — turn your items into a document ${V.oversight} will actually respond to.`)}
      ${stripe('&#x1F4B0; Total value',`Show the full replacement value of what your program manages. Walking into ${V.budgetWord} with that number changes the conversation.`)}
      ${stripe('&#x1F4CA; By category or condition','Spot what you have too much of, what needs replacing, and what is ready for next season.')}
      ${stripe('&#x1F4C4; Export CSV','Attach a clean inventory list to a grant application in about 30 seconds.')}
      ${cta(B,'Open Reports →')}`)},
  {id:'a_exchange',score:(u)=>u.items>=5&&u.listed===0?70:(u.items>=5?18:0),
    subject:(B,V)=>`You haven't listed anything on ${V.exchange} yet`,
    html:(B,V,name,org)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`${org} has items worth sharing — but nothing is listed on <strong>${V.exchange}</strong> yet. Listing the things you don't use year-round is how programs find each other (and how you find what you need without buying new).`)}
      ${parchment(`<strong style="color:#1a0f00;font-size:14px">Takes a minute:</strong>${ol([
        `Open any item in <strong>Inventory</strong>`,
        `Click <strong>Edit</strong> → <strong>${V.exchange}</strong>`,
        'Choose For Rent, For Loan, or For Sale, set your terms, Save',
      ])}`)}
      ${cta(B,`List an item on ${V.exchange} →`)}
      ${sm('Programs in CA, OH, MO, NC, NH, NY, VA, GA, and PA are already active.')}`)},
  {id:'a_funding',score:(u)=>u.funding===0?56:12,
    subject:()=>'The funding tracker does your paperwork for you',
    html:(B,V,name,org)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`If you track ${V.money} anywhere right now — a spreadsheet, a folder, your memory — the <strong>Funding Tracker</strong> will save ${org} real time at year-end.`)}
      ${ul([
        'Create a source for each grant or allocation',
        'Log expenditures as you spend — the balance updates itself',
        `Pull a full report whenever ${V.oversight} asks`,
      ])}
      ${p(V.prop28,'font-size:13px;color:#888;line-height:1.6;')}
      ${cta(B,'Set up a funding source →')}`)},
  {id:'a_team',score:(u)=>u.members<=1?52:10,
    subject:(B,V)=>`${V.org} is easier with your ${V.team} in it`,
    html:(B,V,name,org)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`Right now you're the only one in ${org}'s account. The moment you invite your ${V.team}, people stop asking you where things are — they just look it up.`)}
      ${ul([
        'Each role gets the right level of access',
        'New members join instantly with a QR code',
        'Everyone sees the same up-to-date inventory',
      ])}
      ${cta(B,'Invite your team →')}`)},
  {id:'a_labels',score:(u)=>u.items>=5?42:15,
    subject:()=>'Print QR labels for everything you own',
    html:(B,V,name,org)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`Every item in ${org}'s inventory already has a QR code — printing labels for them is where the whole system starts to feel like magic.`)}
      ${ul([
        'Print from any printer, or order durable pre-printed label packs',
        'Scan a bin or shelf tag with any phone to see exactly what&#39;s there',
        `No more opening six boxes to find one ${V.one.split(',')[0].replace('a ','')}`,
      ])}
      ${cta(B,'Print labels →')}`)},
  {id:'a_productions',score:(u)=>u.productions===0&&u.items>=5?46:10,
    subject:(B,V)=>`Tie your inventory to each ${V.event}`,
    html:(B,V,name,org)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`${B.plain} can track your ${V.event}s by season and connect items to each one — so ${org} builds a real history of what you used, and when.`)}
      ${ul([
        `Create each ${V.event} and associate the items it used`,
        'See at a glance what came back and what didn&#39;t',
        'Pull up last season to plan this one',
      ])}
      ${cta(B,`Add a ${V.event} →`)}`)},
  {id:'a_value',score:(u)=>u.items>=10&&u.valued<Math.max(3,Math.floor(u.items*0.3))?50:14,
    subject:()=>'Add values now, thank yourself at audit time',
    html:(B,V,name,org)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`Most of ${org}'s items don't have an estimated value yet. Adding them as you go quietly builds exactly ${V.risk}.`)}
      ${ul([
        'Open an item → add its estimated or purchase value',
        'Reports then total it for insurance, grants, and audits',
        'A documented asset list is what protects the program if something is lost',
      ])}
      ${cta(B,'Add values to your items →')}`)},
  {id:'a_bins',score:(u)=>u.bins===0&&u.items>=5?48:8,
    subject:(B,V)=>`Give everything in your ${V.space} a home`,
    html:(B,V,name,org)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`${org} has items but no storage locations set up yet. Adding them means your ${V.team} can find anything without asking you first.`)}
      ${ul([
        `Create locations for your ${V.space} — shelves, racks, closets, bins`,
        'Assign items to where they actually live',
        'Search by location to pull everything in one spot',
      ])}
      ${cta(B,'Set up storage locations →')}`)},
];

// Home pool (BinTrove) — ignores V; literal home copy.
const HOME_TIPS:Tip[]=[
  {id:'h_catalog',score:(u)=>u.items<10?58:5,
    subject:()=>'The fastest way to get value from BinTrove',
    html:(B,_V,name)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`You've started — now the payoff comes from getting a few more bins in. The <strong>Add from photos</strong> tool turns a batch of pictures into items fast.`)}
      ${ul([
        'Snap a shelf or an open bin — each thing becomes an item',
        'Name it and set its location later, in bulk',
        'Pick the bin you dig through most and start there',
      ])}
      ${cta(B,'Add more to your bins →')}`)},
  {id:'h_bins',score:(u)=>u.bins<3&&u.items>=3?55:10,
    subject:()=>'Give every bin a location',
    html:(B,_V,name)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`A <strong>location</strong> is where things live (Garage, Attic, Hall Closet); a <strong>bin</strong> is a container in it. Once each bin has a home, "where is that?" stops being a question.`)}
      ${parchment('<strong style="color:#1a0f00;font-size:14px">Tip:</strong> name a location like &ldquo;Garage — Shelf A&rdquo; and you&#39;ll always know which shelf to walk to.')}
      ${cta(B,'Set up your bins →')}`)},
  {id:'h_labels',score:(u)=>u.items>=3?45:20,
    subject:()=>'Print a QR label for every bin',
    html:(B,_V,name)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`This is where BinTrove earns its keep: stick a QR label on a bin, scan it with your phone, and see what&#39;s inside without opening it.`)}
      ${ul([
        'Print from any home printer onto plain paper or Avery sticker sheets',
        'For labels that last for years, use a Brother label maker',
        'Scan to view — no app required just to look inside',
      ])}
      ${cta(B,'Print bin labels →')}`)},
  {id:'h_reports',score:(u)=>u.items>=10?60:(u.items>=3?26:0),
    subject:()=>"The home inventory you'll be glad you have",
    html:(B,_V,name)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`You've quietly built something valuable: a photographed record of what you own. The <strong>Reports</strong> tab turns it into a home inventory in seconds.`)}
      ${stripe('For insurance','Photos, locations, values, and a list — export to CSV and hand it to your insurer.')}
      ${stripe('For peace of mind','No more &ldquo;do we already have one of these?&rdquo;')}
      ${stripe('For a move or an estate','Everything documented in one place.')}
      ${cta(B,'Open Reports →')}`)},
  {id:'h_value',score:(u)=>u.items>=10&&u.valued<Math.max(3,Math.floor(u.items*0.3))?50:15,
    subject:()=>'Add values — build your insurance list as you go',
    html:(B,_V,name)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`Most of your items don't have a value yet. Add one in the item's <strong>Purchase &amp; Value</strong> section and Reports will total it for you.`)}
      ${ul([
        'Open an item → Purchase &amp; Value → enter what it&#39;s worth',
        'Reports shows your total value by category',
        'Export a CSV that&#39;s ready for an insurance claim',
      ])}
      ${cta(B,'Add values to your items →')}`)},
  {id:'h_tags',score:(u)=>u.items>=10&&u.tagged===0?50:15,
    subject:()=>'One tap to "show me the Christmas stuff"',
    html:(B,_V,name)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`Tag your items — Holiday, Camping, Baby, Keepsakes — and finding a whole category becomes one tap, no matter which bin things are in.`)}
      ${ul([
        'Add a tag or category to items as you go',
        'Filter to see everything with that tag at once',
        'Great for the stuff that only comes out once a year',
      ])}
      ${cta(B,'Tag your items →')}`)},
  {id:'h_moving',score:(u,month)=>30+([4,5,6,7].includes(month)?18:0),
    subject:()=>'Moving? Label every box, unpack by room',
    html:(B,_V,name)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`If a move is anywhere on your horizon, BinTrove turns packing chaos into a plan.`)}
      ${ul([
        '<strong>Packing:</strong> snap each box, give it a QR label — an instant manifest.',
        '<strong>The move:</strong> set each box&#39;s location to its destination room.',
        '<strong>Unpacking:</strong> scan a box to see what&#39;s inside before you cut the tape.',
      ])}
      ${cta(B,'Start a move list →')}`)},
  {id:'h_holiday',score:(u,month)=>26+([8,9,10,11].includes(month)?40:0),
    subject:()=>'Never buy a second box of ornaments again',
    html:(B,_V,name)=>wrap(B,`
      ${p(`Hi ${name},`)}
      ${p(`The stuff that comes out once a year is exactly what we forget we own. A few labeled seasonal bins means you find the lights and the wrap in minutes — and stop re-buying what you already have.`)}
      ${parchment('<strong style="color:#1a0f00;font-size:14px">Tip:</strong> make a location called &ldquo;Holiday — Garage Shelf A,&rdquo; label each bin, done.')}
      ${cta(B,'Set up your holiday bins →')}`)},
];

// Pick the best tip the org hasn't seen; recycle oldest-first once all are sent.
function pickTip(pool:Tip[],sentIds:Set<string>,lastId:string|null,u:Usage,month:number):Tip{
  const scored=pool.map(t=>({t,s:t.score(u,month)})).filter(x=>x.s>0);
  const base=scored.length?scored:pool.map(t=>({t,s:1}));
  let cand=base.filter(x=>!sentIds.has(x.t.id));
  if(!cand.length)cand=base.filter(x=>x.t.id!==lastId);   // recycle, skip back-to-back repeat
  if(!cand.length)cand=base;
  cand.sort((a,b)=>b.s-a.s);
  return cand[0].t;
}

// BinTrove uses the shared email helpers (gold accents). Swap gold → teal at render time so
// BinTrove mail matches the brand without forking every helper. No-op for the arts brands.
const tealize=(h:string)=>h
  .split('#d4a843').join('#1C9E8F')   // primary gold accent (borders, CTA button, gold box border)
  .split('#8b6914').join('#0A5450')   // darker gold link text
  .split('#fff8e6').join('#E6F4F1');  // gold callout background
const brandHtml=(B:Brand,html:string)=>B.plain==='BinTrove'?tealize(html):html;

async function sendTipHtml(to:string,subject:string,html:string,key:string,B:Brand,unsubUrl:string):Promise<string|null>{
  html=brandHtml(B,html);
  const headers:Record<string,string>={'List-Unsubscribe':unsubUrl?`<${unsubUrl}>, <mailto:hello@theatre4u.org?subject=unsubscribe>`:`<mailto:hello@theatre4u.org?subject=unsubscribe>`};
  if(unsubUrl)headers['List-Unsubscribe-Post']='List-Unsubscribe=One-Click';
  const res=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({from:B.from,reply_to:B.reply,to:[to],subject,html,headers})
  });
  const d=await res.json();
  if(!res.ok)throw new Error(`Resend ${res.status}: ${JSON.stringify(d)}`);
  return d.id as string;
}

async function sendEmail(to:string,num:number,name:string,org:string,key:string,B:Brand,V:Vert,unsubUrl=''):Promise<string|null>{
  const e=(B.plain==='BinTrove'?HOME_EMAILS:EMAILS)[num];
  if(!e)return null;
  const first=name?.split(' ')[0]||'there';
  const html=brandHtml(B,e.html(B,V,first,org).replace(ftr(B),ftrFull(B,unsubUrl)));
  const headers:Record<string,string>={'List-Unsubscribe':unsubUrl?`<${unsubUrl}>, <mailto:hello@theatre4u.org?subject=unsubscribe>`:`<mailto:hello@theatre4u.org?subject=unsubscribe>`};
  if(unsubUrl)headers['List-Unsubscribe-Post']='List-Unsubscribe=One-Click';
  const res=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({from:B.from,reply_to:B.reply,to:[to],subject:e.subject(B,V),html,headers})
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
    const{org_id,email_num,lead_email,lead_name,lead_org,monthly}=await req.json();

    // ── Monthly "something new" re-engagement (usage-responsive; recycles).
    if(monthly){
      if(!org_id)return new Response(JSON.stringify({error:'org_id required for monthly'}),{status:400,headers:{...CORS,'Content-Type':'application/json'}});
      const{data:org}=await SB.from('orgs').select('id,name,email,director_name,plan,vertical,org_type,home_plan,signup_domain,email_opt_out,unsubscribe_token,account_status,deleted_at,created_at').eq('id',org_id).single();
      if(!org)return new Response(JSON.stringify({error:'org not found'}),{status:404,headers:{...CORS,'Content-Type':'application/json'}});
      if(org.email_opt_out||org.deleted_at||['closed','deleted'].includes(org.account_status))return new Response(JSON.stringify({ok:true,skipped:'opted out or closed'}),{headers:{...CORS,'Content-Type':'application/json'}});
      const B=brandFor(org.signup_domain,org.vertical,org.org_type), V=vertFor(org.vertical,org.org_type);
      const u=await getUsage(SB,org_id,org.created_at);
      // Never-activated guard: 0 items and >90 days old → stop pinging (log a cadence marker so
      // the scheduler won't re-call for the cadence window; resumes automatically if they add items).
      if(u.items===0&&u.ageDays>90){
        await SB.from('email_monthly_log').insert({org_id,tip_id:'none',brand:B.plain,status:'skipped_inactive'});
        return new Response(JSON.stringify({ok:true,skipped:'inactive (0 items, >90d)'}),{headers:{...CORS,'Content-Type':'application/json'}});
      }
      const{data:log}=await SB.from('email_monthly_log').select('tip_id,sent_at').eq('org_id',org_id).eq('status','sent').order('sent_at',{ascending:false});
      const sentIds=new Set((log||[]).map((r:any)=>r.tip_id));
      const lastId=(log&&log[0])?log[0].tip_id:null;
      const pool=(B.plain==='BinTrove')?HOME_TIPS:ARTS_TIPS;
      const tip=pickTip(pool,sentIds,lastId,u,new Date().getMonth());
      const first=(org.director_name||org.name||'there').split(' ')[0];
      const unsubUrl=`${Deno.env.get('SUPABASE_URL')}/functions/v1/unsubscribe/${org.unsubscribe_token}`;
      const html=tip.html(B,V,first,org.name||'your program').replace(ftr(B),ftrFull(B,unsubUrl));
      const rid=await sendTipHtml(org.email,tip.subject(B,V),html,KEY,B,unsubUrl);
      await SB.from('email_monthly_log').insert({org_id,tip_id:tip.id,brand:B.plain,resend_id:rid,status:'sent'});
      console.log(`Monthly tip ${tip.id} → ${org.email} (${org.name}) [${B.plain}/${org.vertical||'theatre'}]`);
      return new Response(JSON.stringify({ok:true,monthly:true,tip_id:tip.id,to:org.email,resend_id:rid}),{headers:{...CORS,'Content-Type':'application/json'}});
    }

    if(email_num===0){
      if(!lead_email)return new Response(JSON.stringify({error:'lead_email required for email 0'}),{status:400,headers:{...CORS,'Content-Type':'application/json'}});
      const B=BRANDS.theatre4u, V=VERTS.theatre; // beta leads are theatre-era
      const rid=await sendEmail(lead_email,0,lead_name||'there',lead_org||'your program',KEY,B,V);
      return new Response(JSON.stringify({ok:true,email_num:0,to:lead_email,resend_id:rid}),{headers:{...CORS,'Content-Type':'application/json'}});
    }

    if(!org_id||!email_num)return new Response(JSON.stringify({error:'org_id and email_num required'}),{status:400,headers:{...CORS,'Content-Type':'application/json'}});
    const{data:ex}=await SB.from('email_sequence').select('id').eq('org_id',org_id).eq('email_num',email_num).maybeSingle();
    if(ex)return new Response(JSON.stringify({ok:true,skipped:'already sent'}),{headers:{...CORS,'Content-Type':'application/json'}});
    const{data:org}=await SB.from('orgs').select('id,name,email,director_name,plan,vertical,org_type,signup_domain,email_opt_out,unsubscribe_token,account_status,deleted_at').eq('id',org_id).single();
    if(!org)return new Response(JSON.stringify({error:'org not found'}),{status:404,headers:{...CORS,'Content-Type':'application/json'}});
    if(org.email_opt_out||org.deleted_at||['closed','deleted'].includes(org.account_status))return new Response(JSON.stringify({ok:true,skipped:'opted out or closed'}),{headers:{...CORS,'Content-Type':'application/json'}});
    const B=brandFor(org.signup_domain,org.vertical,org.org_type), V=vertFor(org.vertical,org.org_type);
    const name=org.director_name||org.name||'there';
    const unsubUrl=`${Deno.env.get('SUPABASE_URL')}/functions/v1/unsubscribe/${org.unsubscribe_token}`;
    const rid=await sendEmail(org.email,email_num,name,org.name,KEY,B,V,unsubUrl);
    await SB.from('email_sequence').insert({org_id,email_num,resend_id:rid,status:'sent'});
    console.log(`Email ${email_num} → ${org.email} (${org.name}) [${B.plain}/${org.vertical||'theatre'}]`);
    return new Response(JSON.stringify({ok:true,email_num,to:org.email,resend_id:rid}),{headers:{...CORS,'Content-Type':'application/json'}});
  }catch(e){
    console.error(String(e));
    return new Response(JSON.stringify({error:String(e)}),{status:500,headers:{...CORS,'Content-Type':'application/json'}});
  }
});
