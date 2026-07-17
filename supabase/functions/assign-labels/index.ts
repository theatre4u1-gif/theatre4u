// assign-labels — atomically assigns N labels from the pool to an org
// Called after a successful Stripe payment
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
import{createClient}from"https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:200,headers:CORS});
  const SB=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try{
    const{org_id,label_count,order_id,delivery_addr,amount_cents}=await req.json();
    if(!org_id||!label_count||label_count<1){
      return new Response(JSON.stringify({error:"org_id and label_count required"}),{status:400,headers:{...CORS,"Content-Type":"application/json"}});
    }
    // Atomically claim the next N available labels
    const{data:labels,error}=await SB.rpc('claim_label_range',{p_org_id:org_id,p_count:label_count,p_order_id:order_id});
    if(error||!labels||labels.length===0){
      console.error("claim_label_range error:",error);
      return new Response(JSON.stringify({error:"Could not assign labels. Pool may be low.",detail:error?.message}),{status:500,headers:{...CORS,"Content-Type":"application/json"}});
    }
    const codes=labels as {code:string,seq:number}[];
    const seqNums=codes.map((c:{seq:number})=>c.seq);
    const codeStart=codes[0].code;
    const codeEnd=codes[codes.length-1].code;
    const seqStart=Math.min(...seqNums);
    const seqEnd=Math.max(...seqNums);
    // Update the order with code range
    if(order_id){
      await SB.from('label_orders').update({
        code_start:codeStart,code_end:codeEnd,
        seq_start:seqStart,seq_end:seqEnd,
        status:'processing',delivery_addr:delivery_addr||null,
        amount_cents:amount_cents||0,
      }).eq('id',order_id);
    }
    console.log(`Assigned ${codes.length} labels to org ${org_id}: ${codeStart} - ${codeEnd}`);
    return new Response(JSON.stringify({ok:true,assigned:codes.length,code_start:codeStart,code_end:codeEnd,codes:codes.map((c:{code:string})=>c.code)}),{headers:{...CORS,"Content-Type":"application/json"}});
  }catch(e){
    console.error(String(e));
    return new Response(JSON.stringify({error:String(e)}),{status:500,headers:{...CORS,"Content-Type":"application/json"}});
  }
});
