import React, { useState, useEffect, useRef, useCallback } from "react";
import { SB } from "./supabase.js";

// Direct messaging: Messages page + ChatWindow — extracted from App.jsx.

export function Messages({ userId, orgName, openConvId, onClearOpenConv }) {
  const [conversations, setConversations] = useState([]);
  const [orgNames,      setOrgNames]      = useState({});
  const [activeConv,    setActiveConv]    = useState(openConvId || null);
  const [loading,       setLoading]       = useState(true);
  const [showNew,       setShowNew]       = useState(false);
  const [searchOrg,     setSearchOrg]     = useState("");
  const [foundOrgs,     setFoundOrgs]     = useState([]);
  const [unreadCounts,  setUnreadCounts]  = useState({});

  const loadConvs = useCallback(async () => {
    const { data } = await SB.from("conversations")
      .select("*")
      .or(`org_a.eq.${userId},org_b.eq.${userId}`)
      .order("last_at", { ascending: false });
    setConversations(data || []);

    // Load org names for all participants
    const ids = new Set();
    (data||[]).forEach(c => { ids.add(c.org_a); ids.add(c.org_b); });
    ids.delete(userId);
    if (ids.size > 0) {
      const { data: orgs } = await SB.from("orgs").select("id,name").in("id", [...ids]);
      const map = {};
      (orgs||[]).forEach(o => map[o.id] = o.name);
      map[userId] = orgName || "You";
      setOrgNames(map);
    }

    // Count unread per conversation
    const { data: unread } = await SB.from("messages")
      .select("conversation_id")
      .eq("read", false)
      .neq("sender_id", userId);
    const counts = {};
    (unread||[]).forEach(m => { counts[m.conversation_id] = (counts[m.conversation_id]||0)+1; });
    setUnreadCounts(counts);

    setLoading(false);
  }, [userId, orgName]);

  useEffect(() => { loadConvs(); }, [loadConvs]);

  // Handle externally-opened conv (from marketplace contact button)
  useEffect(() => {
    if (openConvId) { setActiveConv(openConvId); onClearOpenConv?.(); }
  }, [openConvId]);

  // Realtime: new conversations
  useEffect(() => {
    const ch = SB.channel("convs-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" },
        () => loadConvs())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" },
        () => loadConvs())
      .subscribe();
    return () => SB.removeChannel(ch);
  }, [loadConvs]);

  // Search orgs for new general conversation
  const searchOrgs = async (q) => {
    if (q.length < 2) { setFoundOrgs([]); return; }
    const { data } = await SB.from("orgs").select("id,name,location")
      .ilike("name", `%${q}%`).neq("id", userId).limit(8);
    setFoundOrgs(data || []);
  };

  const startGeneralConv = async (targetOrg) => {
    setSearchOrg(""); setFoundOrgs([]); setShowNew(false);
    // Check for existing general conv
    const { data: existing } = await SB.from("conversations")
      .select("id")
      .is("item_id", null)
      .eq("org_a", userId)
      .eq("org_b", targetOrg.id)
      .single();
    if (existing) { setActiveConv(existing.id); return; }
    const { data: newConv } = await SB.from("conversations").insert({
      item_id: null, org_a: userId, org_b: targetOrg.id,
      item_name: null, last_message: "", last_at: new Date().toISOString(),
    }).select().single();
    if (newConv) { await loadConvs(); setActiveConv(newConv.id); }
  };

  const totalUnread = Object.values(unreadCounts).reduce((s,n)=>s+n,0);

  return (
    <div style={{display:"flex",height:"calc(100vh - 60px)",background:"var(--cream)"}}>

      {/* ── Conversation List (left panel) ── */}
      <div style={{width:320,minWidth:280,borderRight:"1px solid var(--border)",
        display:"flex",flexDirection:"column",background:"var(--cream)"}}>
        {/* Header */}
        <div style={{padding:"16px 16px 10px",borderBottom:"1px solid var(--border)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700}}>
              Messages {totalUnread>0&&<span style={{fontSize:13,background:"var(--ink)",color:"var(--gold)",borderRadius:9,padding:"1px 7px",marginLeft:6}}>{totalUnread}</span>}
            </div>
            <button className="btn btn-g btn-sm" onClick={()=>setShowNew(!showNew)}>+ New</button>
          </div>
          {/* Search to start new general conversation */}
          {showNew && (
            <div style={{marginBottom:8}}>
              <input
                value={searchOrg}
                onChange={e=>{ setSearchOrg(e.target.value); searchOrgs(e.target.value); }}
                placeholder="Search organizations…"
                style={{width:"100%",background:"var(--parch)",border:"1.5px solid var(--border)",borderRadius:7,
                  padding:"7px 10px",fontSize:13,fontFamily:"'Raleway',sans-serif",color:"var(--ink)",
                  outline:"none",boxSizing:"border-box"}}
                autoFocus
              />
              {foundOrgs.length > 0 && (
                <div style={{border:"1px solid var(--border)",borderRadius:7,marginTop:4,background:"#fff",overflow:"hidden"}}>
                  {foundOrgs.map(o => (
                    <div key={o.id} onClick={()=>startGeneralConv(o)}
                      style={{padding:"8px 12px",cursor:"pointer",borderBottom:"1px solid var(--border)",fontSize:13}}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--parch)"}
                      onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <div style={{fontWeight:600}}>{o.name}</div>
                      {o.location&&<div style={{fontSize:11,color:"var(--muted)"}}>📍 {o.location}</div>}
                    </div>
                  ))}
                </div>
              )}
              {searchOrg.length>=2&&foundOrgs.length===0&&(
                <div style={{fontSize:12,color:"var(--muted)",marginTop:4,textAlign:"center"}}>No organizations found</div>
              )}
            </div>
          )}
        </div>

        {/* Conversation list */}
        <div style={{flex:1,overflowY:"auto"}}>
          {loading ? (
            <div style={{textAlign:"center",padding:32,color:"var(--muted)"}}>Loading…</div>
          ) : conversations.length === 0 ? (
            <div style={{textAlign:"center",padding:40}}>
              <div style={{fontSize:36,marginBottom:10}}>💬</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,marginBottom:6}}>No messages yet</div>
              <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.5}}>
                Start a conversation by finding a program in Backstage Exchange, or wait for someone to reach out to you here.
              </div>
            </div>
          ) : (
            conversations.map(conv => {
              const otherId = conv.org_a === userId ? conv.org_b : conv.org_a;
              const otherName = orgNames[otherId] || "Unknown Program";
              const isActive = activeConv === conv.id;
              const unread = unreadCounts[conv.id] || 0;
              const lastAt = conv.last_at ? new Date(conv.last_at).toLocaleDateString([], {month:"short",day:"numeric"}) : "";
              return (
                <div key={conv.id} onClick={()=>setActiveConv(conv.id)}
                  style={{padding:"12px 16px",cursor:"pointer",borderBottom:"1px solid var(--border)",
                    background:isActive?"rgba(212,168,67,.08)":"transparent",
                    borderLeft:isActive?"3px solid var(--gold)":"3px solid transparent",
                    transition:"all .15s"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                    <div style={{width:38,height:38,borderRadius:"50%",
                      background:"linear-gradient(135deg,var(--gold),var(--amber))",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🎭</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                        <div style={{fontWeight:unread>0?800:600,fontSize:13,overflow:"hidden",
                          textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{otherName}</div>
                        <div style={{fontSize:10,color:"var(--faint)",marginLeft:6,flexShrink:0}}>{lastAt}</div>
                      </div>
                      {conv.item_name && (
                        <div style={{fontSize:11,color:"var(--amber)",marginBottom:2,fontWeight:600}}>
                          📦 {conv.item_name}
                        </div>
                      )}
                      <div style={{fontSize:12,color:"var(--muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis"}}>{conv.last_message || "No messages yet"}</span>
                        {unread > 0 && (
                          <span style={{background:"var(--ink)",color:"var(--gold)",borderRadius:"50%",
                            width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",
                            fontSize:10,fontWeight:800,flexShrink:0,marginLeft:6}}>{unread}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Chat Window (right panel) ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",background:"var(--cream)"}}>
        {activeConv ? (
          <ChatWindow
            convId={activeConv}
            currentUserId={userId}
            orgNames={{...orgNames, [userId]: orgName||"You"}}
            onClose={()=>setActiveConv(null)}
            onUnreadChange={loadConvs}
            onDeleted={async()=>{ setActiveConv(null); await loadConvs(); }}
          />
        ) : (
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
            justifyContent:"center",gap:12,color:"var(--muted)"}}>
            <div style={{fontSize:56}}>💬</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"var(--ink)"}}>Your Messages</div>
            <div style={{fontSize:14,color:"var(--muted)",maxWidth:340,textAlign:"center",lineHeight:1.6}}>
              Select a conversation on the left, or click "+ New" to message any organization. You can also contact programs directly from Backstage Exchange.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatWindow({ convId, currentUserId, orgNames, onClose, onUnreadChange, onDeleted }) {
  const [messages,  setMessages]  = useState([]);
  const [conv,      setConv]      = useState(null);
  const [body,      setBody]      = useState("");
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const bottomRef = useRef();
  const inputRef  = useRef();

  // Load conversation + messages
  const load = useCallback(async () => {
    const { data: convData } = await SB.from("conversations").select("*").eq("id", convId).single();
    setConv(convData);
    const { data: msgs } = await SB.from("messages")
      .select("*").eq("conversation_id", convId).order("created_at");
    setMessages(msgs || []);
    setLoading(false);
    // Mark messages as read
    await SB.from("messages").update({ read: true })
      .eq("conversation_id", convId)
      .neq("sender_id", currentUserId)
      .eq("read", false);
    onUnreadChange?.();
  }, [convId, currentUserId]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    const channel = SB.channel(`conv-${convId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `conversation_id=eq.${convId}`
      }, payload => {
        // Deduplicate — only add if this message ID isn't already in state
        setMessages(p => p.some(m => m.id === payload.new.id) ? p : [...p, payload.new]);
        if (payload.new.sender_id !== currentUserId) {
          SB.from("messages").update({ read: true }).eq("id", payload.new.id);
          onUnreadChange?.();
        }
      }).subscribe();
    return () => SB.removeChannel(channel);
  }, [convId, currentUserId]);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    const { data: msg } = await SB.from("messages").insert({
      conversation_id: convId,
      sender_id:       currentUserId,
      body:            text,
    }).select().single();
    // Don't add to state here — realtime subscription handles it
    // This prevents the duplicate message bug
    await SB.from("conversations").update({ last_message: text, last_at: new Date().toISOString() }).eq("id", convId);

    // Notify recipient
    const otherId = conv?.org_a === currentUserId ? conv?.org_b : conv?.org_a;
    if (otherId) {
      const { data: { session } } = await SB.auth.getSession();
      fetch("https://ldmmphwivnnboyhlxipl.supabase.co/functions/v1/message-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({
          conversation_id: convId,
          recipient_id:    otherId,
          message_preview: text.slice(0, 200),
          item_name:       conv?.item_name || null,
          sender_name:     orgNames?.[currentUserId] || "A theatre program",
        })
      }).catch(() => {});
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const otherId = conv ? (conv.org_a === currentUserId ? conv.org_b : conv.org_a) : null;
  const otherName = otherId ? (orgNames?.[otherId] || "Unknown Program") : "…";

  const fmt = ts => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday ? d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : d.toLocaleDateString([], {month:"short",day:"numeric"}) + " " + d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Header */}
      <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",
        background:"var(--parch)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,var(--gold),var(--amber))",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🎭</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{otherName}</div>
            {conv?.item_name && <div style={{fontSize:11,color:"var(--muted)"}}>Re: {conv.item_name}</div>}
          </div>
          <button onClick={async()=>{ if(!window.confirm("Delete this conversation and all its messages? This can't be undone."))return; const{error}=await SB.from("conversations").delete().eq("id",convId); if(error){alert("Couldn't delete this conversation. Please try again.");return;} (onDeleted||onClose)(); }}
            title="Delete conversation" style={{background:"none",border:"none",color:"#c2185b",
            cursor:"pointer",fontSize:16,padding:"0 4px",lineHeight:1}}>🗑</button>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--muted)",
            cursor:"pointer",fontSize:20,padding:"0 4px",lineHeight:1}}>✕</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:8}}>
        {loading ? (
          <div style={{textAlign:"center",padding:32,color:"var(--muted)"}}>Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{textAlign:"center",padding:32,color:"var(--muted)"}}>
            <div style={{fontSize:32,marginBottom:8}}>💬</div>
            <div style={{fontSize:13}}>Start the conversation!</div>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} style={{display:"flex",flexDirection:"column",
                alignItems:isMe?"flex-end":"flex-start"}}>
                <div style={{maxWidth:"80%",padding:"9px 13px",borderRadius:isMe?"14px 14px 4px 14px":"14px 14px 14px 4px",
                  background:isMe?"var(--ink)":"var(--parch)",
                  color:isMe?"var(--gold)":"var(--ink)",
                  border:isMe?"none":"1px solid var(--border)",
                  fontSize:14,lineHeight:1.5}}>
                  {msg.body}
                </div>
                <div style={{fontSize:10,color:"var(--faint)",marginTop:3,paddingLeft:4,paddingRight:4}}>
                  {fmt(msg.created_at)}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{padding:"12px",borderTop:"1px solid var(--border)",flexShrink:0,background:"var(--cream)"}}>
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <textarea
            ref={inputRef}
            value={body}
            onChange={e=>setBody(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); }}}
            placeholder="Type a message… (Enter to send)"
            rows={2}
            style={{flex:1,background:"var(--parch)",border:"1.5px solid var(--border)",borderRadius:8,
              padding:"8px 11px",fontSize:13,fontFamily:"'Raleway',sans-serif",color:"var(--ink)",
              outline:"none",resize:"none",boxSizing:"border-box"}}
            onFocus={e=>e.target.style.borderColor="var(--gold)"}
            onBlur={e=>e.target.style.borderColor="var(--border)"}
          />
          <button className="btn btn-g" onClick={send} disabled={!body.trim()||sending}
            style={{padding:"10px 16px",fontSize:13,flexShrink:0}}>
            {sending?"…":"Send"}
          </button>
        </div>
        <div style={{fontSize:10,color:"var(--faint)",marginTop:4}}>Shift+Enter for new line</div>
      </div>
    </div>
  );
}
