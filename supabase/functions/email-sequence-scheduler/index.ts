// email-sequence-scheduler v3
// Fixed: email 0 tracking uses simple WHERE clause
import{createClient}from'https://esm.sh/@supabase/supabase-js@2';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
const SKIP=['hello@theatre4u.org','rzick@hbuhsd.edu','theatre4u1@gmail.com','rzickjr@gmail.com','rachel@daretodreamtheatre.orh'];
const SCHEDULE:Record<number,number>={2:2,3:5,4:10,5:16,6:22,7:30};

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:200,headers:CORS});
  const SB=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const SEQ=`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-sequence-email`;
  const SVC=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const results:{target:string,email_num:number,status:string}[]=[];
  const now=new Date();

  const post=async(body:object)=>{
    const r=await fetch(SEQ,{method:'POST',headers:{'Authorization':`Bearer ${SVC}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json();
    await new Promise(res=>setTimeout(res,300));
    return d;
  };

  try{
    // ── Email 0: send to unconverted beta leads who haven't been emailed
    const{data:leads}=await SB.from('beta_leads')
      .select('id,name,email,org')
      .eq('converted',false)
      .neq('email_0_sent',true);

    for(const lead of (leads||[])){
      if(SKIP.includes(lead.email?.toLowerCase()))continue;
      try{
        const d=await post({email_num:0,lead_email:lead.email,lead_name:lead.name,lead_org:lead.org});
        await SB.from('beta_leads').update({email_0_sent:true,email_0_sent_at:new Date().toISOString()}).eq('id',lead.id);
        results.push({target:lead.email,email_num:0,status:d.ok?'sent':d.skipped||d.error||'error'});
      }catch(e){
        results.push({target:lead.email,email_num:0,status:'err:'+String(e)});
      }
    }

    // ── Emails 2-7: send to orgs based on days since signup
    const cutoff=new Date(now.getTime()-36*24*60*60*1000).toISOString();
    const{data:orgs}=await SB.from('orgs')
      .select('id,name,email,created_at')
      .gte('created_at',cutoff);

    if(orgs?.length){
      const ids=orgs.map((o:any)=>o.id);
      const{data:sent}=await SB.from('email_sequence').select('org_id,email_num').in('org_id',ids);
      const sentSet=new Set((sent||[]).map((s:any)=>`${s.org_id}:${s.email_num}`));
      for(const org of orgs){
        if(SKIP.includes(org.email?.toLowerCase()))continue;
        const days=Math.floor((now.getTime()-new Date(org.created_at).getTime())/86400000);
        for(const[n,threshold] of Object.entries(SCHEDULE)){
          const num=Number(n);
          if(days<threshold||sentSet.has(`${org.id}:${num}`))continue;
          try{
            const d=await post({org_id:org.id,email_num:num});
            results.push({target:org.name||org.email,email_num:num,status:d.ok?'sent':d.skipped||d.error||'err'});
          }catch(e){
            results.push({target:org.name||org.email,email_num:num,status:'err:'+String(e)});
          }
        }
      }
    }

    console.log(`Scheduler v3: ${results.length} emails processed`);
    return new Response(JSON.stringify({ok:true,processed:results.length,results}),{headers:{...CORS,'Content-Type':'application/json'}});
  }catch(e){
    console.error(String(e));
    return new Response(JSON.stringify({error:String(e)}),{status:500,headers:{...CORS,'Content-Type':'application/json'}});
  }
});
