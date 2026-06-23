// STORAGE LOCATIONS — RoomMap, StorageRack, LocationsPanel, LocationFormModal.
// Extracted from App.jsx. LocationsPanel is the entry point (Inventory's
// Locations tab); the other three are module-internal.
import React, { useState, useEffect, useRef, useCallback } from "react";
import { SB } from "./supabase.js";
import { Modal } from "./ui.jsx";
import { EM } from "./messages.js";
import { CAT } from "./inventory.js";
import { PIN_COLORS, ROW_LABELS, COL_LABELS } from "./storage-map.js";
import { QR } from "./qr.js";

// ══════════════════════════════════════════════════════════════════════════════
// STORAGE LOCATIONS — manage named locations, browse items by location
// ══════════════════════════════════════════════════════════════════════════════
// ── Room Map sub-component ──────────────────────────────────────────────────
function RoomMap({ loc, items, userId, onUpdate, vertical="theatre" }) {
  const [pins,        setPins]        = useState(loc.map_pins || []);
  const [adding,      setAdding]      = useState(false);
  const [pending,     setPending]     = useState(null);
  const [pinMode,     setPinMode]     = useState("link");   // "link" | "new"
  const [pinName,     setPinName]     = useState("");
  const [pinNotes,    setPinNotes]    = useState("");
  const [linkedLocId, setLinkedLocId] = useState("");
  const [allLocs,     setAllLocs]     = useState([]);
  const [locsLoaded,  setLocsLoaded]  = useState(false);
  const [selPin,      setSelPin]      = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const fileRef = useRef();

  // Load all named locations for this org when pin form opens
  useEffect(() => {
    if (!pending || locsLoaded) return;
    SB.from("storage_locations")
      .select("id,name,location_type,code")
      .eq("org_id", userId)
      .eq("vertical", vertical)
      .neq("id", loc.id)
      .order("name")
      .then(({ data }) => { setAllLocs(data || []); setLocsLoaded(true); });
  }, [pending]);

  const savePins = async (newPins) => {
    await SB.from("storage_locations").update({ map_pins: newPins }).eq("id", loc.id);
    setPins(newPins);
    onUpdate({ ...loc, map_pins: newPins });
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    const ext  = file.name.split(".").pop();
    const path = `${userId}/${loc.id}.${ext}`;
    const { error } = await SB.storage.from("room-photos").upload(path, file, { upsert: true, contentType: file.type });
    if (!error) {
      const { data: { publicUrl } } = SB.storage.from("room-photos").getPublicUrl(path);
      await SB.from("storage_locations").update({ map_photo_url: publicUrl }).eq("id", loc.id);
      onUpdate({ ...loc, map_photo_url: publicUrl });
    }
    setUploading(false);
  };

  const onMapClick = (e) => {
    if (!adding) return;
    if (e.target.closest(".pin-dot")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(2);
    const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(2);
    setPending({ x: parseFloat(x), y: parseFloat(y) });
    setPinName(""); setPinNotes(""); setLinkedLocId(""); setPinMode("link");
  };

  const savePin = async () => {
    const color = PIN_COLORS[pins.length % PIN_COLORS.length];
    let newPin;
    if (pinMode === "link" && linkedLocId) {
      const linked = allLocs.find(l => l.id === linkedLocId);
      if (!linked) return;
      newPin = { id: Date.now(), x: pending.x, y: pending.y, name: linked.name, notes: pinNotes.trim(), color, linked_location_id: linked.id };
    } else {
      if (!pinName.trim()) return;
      newPin = { id: Date.now(), x: pending.x, y: pending.y, name: pinName.trim(), notes: pinNotes.trim(), color };
    }
    const newPins = [...pins, newPin];
    await savePins(newPins);
    setPending(null); setAdding(false);
  };

  const deletePin = async (id) => {
    const newPins = pins.filter(p => p.id !== id);
    await savePins(newPins);
    setSelPin(null);
  };

  // Get item count for a pin — use linked location if set, otherwise fall back to room location
  const getPinItemCount = (pin) => {
    if (pin.linked_location_id) {
      return items.filter(it => it.location_id === pin.linked_location_id).length;
    }
    return items.filter(it => it.location_id === loc.id && it.pin_id === pin.id).length;
  };

  const canSave = pinMode === "link" ? !!linkedLocId : !!pinName.trim();
  const photoUrl = loc.map_photo_url;
  const inp = { background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,padding:"8px 10px",color:"var(--text)",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box" };
  const typeIcon = (t) => t==="room"?"🗺️":t==="rack"?"🏗️":"📦";

  // Locations not yet placed on this map
  const unplacedLocs = allLocs.filter(l => !pins.find(p => p.linked_location_id === l.id));

  return (
    <div>
      {!photoUrl ? (
        <div style={{ border:"2px dashed var(--border)",borderRadius:10,padding:32,textAlign:"center",cursor:"pointer",background:"var(--parch)" }} onClick={() => fileRef.current?.click()}>
          <div style={{ fontSize:32,marginBottom:8 }}>📷</div>
          <div style={{ fontWeight:700,fontSize:14,marginBottom:4 }}>Upload a photo of this room</div>
          <div style={{ fontSize:12,color:"var(--muted)",marginBottom:12 }}>Take a photo on your phone and upload it here</div>
          {uploading ? <div style={{ color:"var(--muted)",fontSize:13 }}>Uploading…</div> : <button className="btn btn-o" onClick={e=>{e.stopPropagation();fileRef.current?.click();}}>Choose Photo</button>}
          <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>uploadPhoto(e.target.files[0])} />
        </div>
      ) : (
        <div>
          <div style={{ display:"flex",gap:8,marginBottom:10,alignItems:"center",flexWrap:"wrap" }}>
            <button className={`btn ${adding?"btn-g":"btn-o"}`} style={{ fontSize:12 }} onClick={() => { setAdding(!adding); setPending(null); }}>
              {adding ? "✕ Cancel" : "📍 Add Pin"}
            </button>
            <button className="btn btn-o" style={{ fontSize:12 }} onClick={() => fileRef.current?.click()}>🔄 Change Photo</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>uploadPhoto(e.target.files[0])} />
            {adding && <span style={{ fontSize:12,color:"var(--muted)",fontStyle:"italic" }}>Tap anywhere on the photo to drop a pin</span>}
          </div>

          <div style={{ position:"relative",borderRadius:10,overflow:"hidden",border:"1px solid var(--border)",cursor:adding?"crosshair":"default" }} onClick={onMapClick}>
            <img src={photoUrl} style={{ width:"100%",display:"block",userSelect:"none" }} draggable={false} />
            {pins.map((pin, i) => (
              <div key={pin.id} className="pin-dot" style={{ position:"absolute",left:`${pin.x}%`,top:`${pin.y}%`,transform:"translate(-50%,-100%)",cursor:"pointer",zIndex:10 }} onClick={e=>{ e.stopPropagation(); setSelPin(selPin?.id===pin.id?null:pin); }}>
                <div style={{ background:pin.color,borderRadius:"50% 50% 50% 0",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",transform:"rotate(-45deg)",border:"2px solid rgba(0,0,0,0.2)" }}>
                  <span style={{ transform:"rotate(45deg)",color:"#fff",fontSize:11,fontWeight:700 }}>{i+1}</span>
                </div>
                {selPin?.id===pin.id && (
                  <div style={{ position:"absolute",bottom:34,left:"50%",transform:"translateX(-50%)",background:"var(--dark2)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 12px",minWidth:180,zIndex:20,whiteSpace:"nowrap" }}>
                    <div style={{ fontWeight:700,fontSize:13,color:"var(--goldink)",marginBottom:2 }}>{pin.name}</div>
                    {pin.linked_location_id && <div style={{ fontSize:10,color:"var(--muted)",marginBottom:4 }}>🔗 Linked location</div>}
                    {pin.notes && <div style={{ fontSize:11,color:"var(--muted)",marginBottom:6 }}>{pin.notes}</div>}
                    <div style={{ fontSize:11,color:"var(--muted)",marginBottom:6 }}>{getPinItemCount(pin)} items stored here</div>
                    <button onClick={()=>deletePin(pin.id)} style={{ fontSize:11,color:"var(--red)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0 }}>Remove pin</button>
                  </div>
                )}
              </div>
            ))}
            {pending && (
              <div style={{ position:"absolute",left:`${pending.x}%`,top:`${pending.y}%`,transform:"translate(-50%,-100%)",pointerEvents:"none" }}>
                <div style={{ background:"var(--gold)",borderRadius:"50% 50% 50% 0",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",transform:"rotate(-45deg)",border:"2px solid rgba(0,0,0,0.3)" }}>
                  <span style={{ transform:"rotate(45deg)",color:"#1a0f00",fontSize:13 }}>?</span>
                </div>
              </div>
            )}
          </div>

          {pending && (
            <div style={{ marginTop:12,padding:14,background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10 }}>
              <div style={{ fontWeight:700,fontSize:13,marginBottom:12 }}>Place a pin here</div>

              {/* Mode toggle */}
              <div style={{ display:"flex",gap:6,marginBottom:14 }}>
                <button onClick={()=>setPinMode("link")} style={{ flex:1,padding:"7px 0",fontSize:12,borderRadius:7,border:pinMode==="link"?"1.5px solid var(--gold)":"1px solid var(--border)",background:pinMode==="link"?"rgba(212,168,67,.1)":"var(--white)",color:pinMode==="link"?"var(--amber)":"var(--muted)",cursor:"pointer",fontFamily:"inherit",fontWeight:pinMode==="link"?700:400 }}>
                  🔗 Link existing location
                </button>
                <button onClick={()=>setPinMode("new")} style={{ flex:1,padding:"7px 0",fontSize:12,borderRadius:7,border:pinMode==="new"?"1.5px solid var(--gold)":"1px solid var(--border)",background:pinMode==="new"?"rgba(212,168,67,.1)":"var(--white)",color:pinMode==="new"?"var(--amber)":"var(--muted)",cursor:"pointer",fontFamily:"inherit",fontWeight:pinMode==="new"?700:400 }}>
                  ✏️ Create new pin
                </button>
              </div>

              {pinMode === "link" ? (
                <div>
                  <div style={{ fontSize:12,color:"var(--muted)",marginBottom:8 }}>Choose an existing location to place on this map:</div>
                  {!locsLoaded ? (
                    <div style={{ fontSize:12,color:"var(--muted)",padding:"8px 0" }}>Loading locations…</div>
                  ) : unplacedLocs.length === 0 ? (
                    <div style={{ fontSize:12,color:"var(--muted)",padding:"8px 0",fontStyle:"italic" }}>All your locations are already on this map. Use "Create new pin" to add a new one.</div>
                  ) : (
                    <div style={{ display:"flex",flexDirection:"column",gap:6,maxHeight:200,overflowY:"auto" }}>
                      {unplacedLocs.map(l => (
                        <div key={l.id} onClick={() => setLinkedLocId(linkedLocId===l.id?"":l.id)}
                          style={{ padding:"8px 10px",border:linkedLocId===l.id?"1.5px solid var(--gold)":"1px solid var(--border)",borderRadius:8,cursor:"pointer",background:linkedLocId===l.id?"rgba(212,168,67,.1)":"var(--white)",display:"flex",alignItems:"center",gap:8 }}>
                          <span style={{ fontSize:16 }}>{typeIcon(l.location_type)}</span>
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontWeight:700,fontSize:13,color:linkedLocId===l.id?"var(--amber)":"var(--text)" }}>{l.name}</div>
                            {l.code && <div style={{ fontSize:11,fontFamily:"monospace",color:"var(--muted)" }}>{l.code}</div>}
                          </div>
                          {linkedLocId===l.id && <span style={{ fontSize:16 }}>✓</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <input style={{ ...inp,marginBottom:8 }} value={pinName} onChange={e=>setPinName(e.target.value)} placeholder="e.g. Red Costume Tubs, Prop Shelf B" autoFocus onKeyDown={e=>e.key==="Enter"&&savePin()} />
                </div>
              )}

              <textarea style={{ ...inp,minHeight:40,resize:"vertical",marginTop:10,marginBottom:10 }} value={pinNotes} onChange={e=>setPinNotes(e.target.value)} placeholder="Optional notes — row 3, left side, grey metal rack…" />

              <div style={{ display:"flex",gap:8 }}>
                <button className="btn btn-g" style={{ flex:1 }} onClick={savePin} disabled={!canSave}>
                  {pinMode==="link" ? "Place Pin" : "Save Pin"}
                </button>
                <button className="btn btn-o" onClick={()=>{ setPending(null); setAdding(false); }}>Cancel</button>
              </div>
            </div>
          )}

          {pins.length > 0 && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",marginBottom:6 }}>Pinned locations</div>
              {pins.map((pin, i) => (
                <div key={pin.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"var(--parch)",border:"1px solid var(--border)",borderRadius:8,marginBottom:5,cursor:"pointer" }} onClick={()=>setSelPin(selPin?.id===pin.id?null:pin)}>
                  <div style={{ width:20,height:20,borderRadius:"50%",background:pin.color,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    <span style={{ fontSize:10,fontWeight:700,color:"#fff" }}>{i+1}</span>
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                      {pin.linked_location_id && <span style={{ fontSize:11,marginRight:4 }}>🔗</span>}
                      {pin.name}
                    </div>
                    <div style={{ fontSize:11,color:"var(--muted)" }}>{getPinItemCount(pin)} items</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Storage Rack sub-component ──────────────────────────────────────────────
function StorageRack({ loc, items, onUpdate }) {
  const [rows,     setRows]     = useState(loc.rack_rows     || 3);
  const [cols,     setCols]     = useState(loc.rack_cols     || 4);
  const [slots,    setSlots]    = useState(loc.rack_slots    || {});
  const [rowStyle, setRowStyle] = useState(loc.rack_row_style || "alpha");
  const [colStyle, setColStyle] = useState(loc.rack_col_style || "num");
  const [selSlot,  setSelSlot]  = useState(null);

  const getRLabel = i => (ROW_LABELS[rowStyle] || ROW_LABELS.alpha)[i] || String(i+1);
  const getCLabel = j => (COL_LABELS[colStyle] || COL_LABELS.num)[j]  || "";
  const slotKey   = (i,j) => `${getRLabel(i)}-${j+1}`;

  const saveRack = async (newRows, newCols, newSlots, newRowStyle, newColStyle) => {
    await SB.from("storage_locations").update({ rack_rows:newRows, rack_cols:newCols, rack_slots:newSlots, rack_row_style:newRowStyle, rack_col_style:newColStyle }).eq("id", loc.id);
    onUpdate({ ...loc, rack_rows:newRows, rack_cols:newCols, rack_slots:newSlots, rack_row_style:newRowStyle, rack_col_style:newColStyle });
  };

  const addRow = () => { if(rows<8){ const r=rows+1; setRows(r); saveRack(r,cols,slots,rowStyle,colStyle); } };
  const addCol = () => { if(cols<6){ const c=cols+1; setCols(c); saveRack(rows,c,slots,rowStyle,colStyle); } };
  const removeRow = () => { if(rows>1){ const r=rows-1; setRows(r); saveRack(r,cols,slots,rowStyle,colStyle); } };
  const removeCol = () => { if(cols>1){ const c=cols-1; setCols(c); saveRack(rows,c,slots,rowStyle,colStyle); } };

  const slotItems = selSlot ? items.filter(it => it.location_id===loc.id && it.rack_slot===selSlot) : [];
  const inp = { background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,padding:"6px 10px",color:"var(--text)",fontSize:12,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box" };

  return (
    <div>
      <div style={{ display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center" }}>
        <button className="btn btn-o bsm" style={{ fontSize:11 }} onClick={addRow}>+ Row</button>
        <button className="btn btn-o bsm" style={{ fontSize:11 }} onClick={removeRow} disabled={rows<=1}>− Row</button>
        <button className="btn btn-o bsm" style={{ fontSize:11 }} onClick={addCol}>+ Column</button>
        <button className="btn btn-o bsm" style={{ fontSize:11 }} onClick={removeCol} disabled={cols<=1}>− Column</button>
        <select value={rowStyle} onChange={e=>{ setRowStyle(e.target.value); saveRack(rows,cols,slots,e.target.value,colStyle); }} style={{ ...inp,width:"auto",fontSize:11 }}>
          <option value="alpha">Rows: A, B, C</option>
          <option value="num">Rows: 1, 2, 3</option>
          <option value="shelf">Rows: Shelf 1, 2</option>
          <option value="custom">Rows: Top, Middle</option>
        </select>
        <select value={colStyle} onChange={e=>{ setColStyle(e.target.value); saveRack(rows,cols,slots,rowStyle,e.target.value); }} style={{ ...inp,width:"auto",fontSize:11 }}>
          <option value="num">Cols: 1, 2, 3</option>
          <option value="alpha">Cols: A, B, C</option>
          <option value="none">No col labels</option>
        </select>
      </div>

      <div style={{ border:"1px solid var(--border)",borderRadius:10,overflow:"hidden",background:"var(--parch)" }}>
        <div style={{ overflowX:"auto",padding:12 }}>
          {colStyle !== "none" && (
            <div style={{ display:"grid",gridTemplateColumns:`44px repeat(${cols},1fr)`,gap:4,marginBottom:4 }}>
              <div />
              {Array.from({length:cols},(_,j)=>(
                <div key={j} style={{ textAlign:"center",fontSize:11,color:"var(--muted)",fontWeight:700 }}>{getCLabel(j)}</div>
              ))}
            </div>
          )}
          {Array.from({length:rows},(_,i)=>(
            <div key={i} style={{ display:"grid",gridTemplateColumns:`44px repeat(${cols},1fr)`,gap:4,marginBottom:4 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:6,fontSize:11,fontWeight:700,color:"var(--muted)" }}>{getRLabel(i)}</div>
              {Array.from({length:cols},(_,j)=>{
                const key = slotKey(i,j);
                const slotItemList = items.filter(it=>it.location_id===loc.id&&it.rack_slot===key);
                const hasItems = slotItemList.length>0;
                const isSel = selSlot===key;
                return (
                  <div key={j} onClick={()=>setSelSlot(isSel?null:key)}
                    style={{ cursor:"pointer",borderRadius:6,border:isSel?"1.5px solid var(--red)":hasItems?"1px solid var(--gold)":"1px solid var(--border)",background:isSel?"rgba(194,24,91,.1)":hasItems?"rgba(212,168,67,.1)":"var(--white)",padding:"6px 4px",minHeight:48,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",transition:"all 0.1s" }}>
                    {hasItems ? (
                      <>
                        <span style={{ fontSize:14 }}>🧥</span>
                        <span style={{ fontSize:10,color:isSel?"var(--red)":"var(--amber)",marginTop:2 }}>{slotItemList.length} item{slotItemList.length>1?"s":""}</span>
                      </>
                    ) : (
                      <span style={{ fontSize:12,color:"var(--border)" }}>+</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selSlot && (
        <div style={{ marginTop:12,padding:12,background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10 }}>
          <div style={{ fontWeight:700,fontSize:13,marginBottom:8,color:"var(--goldink)" }}>Slot {selSlot}</div>
          {slotItems.length===0 ? (
            <div style={{ fontSize:12,color:"var(--muted)",textAlign:"center",padding:"12px 0" }}>Empty — assign items to this slot by editing an item and selecting this location + slot.</div>
          ) : (
            slotItems.map(it=>(
              <div key={it.id} style={{ fontSize:12,padding:"6px 0",borderBottom:"1px solid var(--linen)" }}>{it.name}</div>
            ))
          )}
        </div>
      )}

      <div style={{ marginTop:8,fontSize:11,color:"var(--muted)" }}>{rows} rows · {cols} columns · click any slot to see what's stored there</div>
    </div>
  );
}

// ── Main LocationsPanel ─────────────────────────────────────────────────────
export function LocationsPanel({ userId, items, onEditItem, onDeleteItem, vertical="theatre" }) {
  const [locations,    setLocations]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(null);
  const [active,       setActive]       = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [browseItems,  setBrowseItems]  = useState([]);
  const [activeRoom,   setActiveRoom]   = useState(null);
  const [msg,          setMsg]          = useState("");

  const flash = m => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await SB.from("storage_locations")
      .select("*")
      .eq("org_id", userId)
      .eq("vertical", vertical)
      .order("sort_order")
      .order("name");
    const locs = data || [];
    setLocations(locs);
    if (locs.length > 0 && !activeRoom) setActiveRoom(locs[0].id);
    setLoading(false);
  }, [userId, vertical]);

  useEffect(() => { load(); }, [load]);

  const saveLocation = async (f) => {
    setSaving(true);
    const payload = { name: f.name.trim(), code: (f.code||"").trim() || null, description: (f.description||"").trim() || null, location_type: f.location_type || "named", updated_at: new Date().toISOString() };
    if (active) {
      const { data, error } = await SB.from("storage_locations").update(payload).eq("id", active.id).select().single();
      if (error) { flash("❌ " + EM.fundingSave.body); }
      else { setLocations(p => p.map(x => x.id === data.id ? data : x)); flash("✓ Location updated"); setModal(null); setActive(null); }
    } else {
      const { data, error } = await SB.from("storage_locations").insert({ org_id: userId, vertical, ...payload, map_pins: [], rack_slots: {} }).select().single();
      if (error) { flash("❌ " + EM.fundingSave.body); }
      else { setLocations(p => [...p, data]); setActiveRoom(data.id); flash("✓ Location added"); setModal(null); }
    }
    setSaving(false);
  };

  const deleteLocation = async (id) => {
    if (!window.confirm("Delete this location? Items assigned here will lose their location link, but won't be deleted.")) return;
    await SB.from("storage_locations").delete().eq("id", id);
    const remaining = locations.filter(x => x.id !== id);
    setLocations(remaining);
    if (activeRoom === id) setActiveRoom(remaining[0]?.id || null);
    flash("Location removed");
  };

  const browseLocation = (loc) => {
    setActive(loc);
    const matched = items.filter(i => i.location_id === loc.id || (i.location && i.location.toLowerCase() === loc.name.toLowerCase()));
    setBrowseItems(matched);
    setModal("browse");
  };

  const updateLoc = (updated) => {
    setLocations(p => p.map(x => x.id === updated.id ? updated : x));
  };

  // Print QR label for a location container
  const printLocationQR = async (loc) => {
    const qrUrl = `https://theatre4u.org/#/location/${loc.id}`;
    const qrSrc = await QR.toDataURL(qrUrl, 200);
    if (!qrSrc) return;
    const w = window.open("", "_blank", "width=420,height=540");
    if (!w) return;
    const itemCount = items.filter(i => i.location_id === loc.id || (i.location && i.location.toLowerCase() === loc.name.toLowerCase())).length;
    w.document.write(`<html><head><title>QR – ${loc.name}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px}
      img{margin:12px 0;border:1px solid #eee;border-radius:6px}
      h2{margin-bottom:2px;font-size:20px}.code{font-size:28px;font-weight:900;font-family:monospace;color:#c4761a;margin:4px 0}
      p{color:#666;font-size:13px;margin:3px 0}</style></head>
      <body>
      <p style="font-size:11px;color:#bbb;margin-bottom:4px">📦 Storage Location</p>
      <h2>${loc.name}</h2>
      ${loc.code ? `<div class="code">${loc.code}</div>` : ""}
      ${loc.description ? `<p style="color:#888;font-style:italic">${loc.description}</p>` : ""}
      <p style="font-weight:700;color:#333">${itemCount} item${itemCount !== 1 ? "s" : ""}</p>
      <img src="${qrSrc}" width="180" height="180"/>
      <p style="font-size:11px;margin-top:8px;color:#aaa">Theatre4u™ — Scan to view contents</p>
      <script>setTimeout(function(){window.print()},300)<\/script>
      </body></html>`);
    w.document.close();
  };

  const card = { background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,padding:14,marginBottom:10 };
  const inp  = { background:"var(--white)",border:"1px solid var(--border)",borderRadius:6,padding:"8px 10px",color:"var(--text)",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box" };
  const lbl  = { fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",display:"block",marginBottom:4 };

  const currentLoc = locations.find(l => l.id === activeRoom) || null;
  const locItems   = currentLoc ? items.filter(i => i.location_id === currentLoc.id) : [];
  const typeIcon   = (t) => t==="room"?"🗺️":t==="rack"?"🏗️":"📦";

  return (
    <div>
      {msg && <div style={{ position:"fixed",top:16,right:16,zIndex:9999,background:"var(--cream)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 16px",fontSize:13,fontWeight:600,color:msg.startsWith("❌")?"var(--red)":"var(--green)",boxShadow:"0 4px 20px rgba(0,0,0,.4)" }}>{msg}</div>}

      {loading ? (
        <div style={{ textAlign:"center",padding:48,color:"var(--muted)" }}>Loading locations…</div>
      ) : locations.length === 0 ? (
        <div className="empty">
          <div className="empty-ico">📦</div>
          <h3>No locations yet</h3>
          <p>Add your first storage location — a room with a photo map, a costume rack, or a simple named location.</p>
          <button className="btn btn-g" onClick={() => { setActive(null); setModal("add"); }}>+ Add First Location</button>
        </div>
      ) : (
        <div>
          {/* ── Room tab bar ── */}
          <div style={{ display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center" }}>
            {locations.map(loc => (
              <button key={loc.id} onClick={() => setActiveRoom(loc.id)}
                style={{ padding:"5px 12px",fontSize:13,borderRadius:8,border:activeRoom===loc.id?"1.5px solid var(--gold)":"1px solid var(--border)",background:activeRoom===loc.id?"rgba(212,168,67,.1)":"var(--parch)",color:activeRoom===loc.id?"var(--amber)":"var(--muted)",cursor:"pointer",fontFamily:"inherit",fontWeight:activeRoom===loc.id?700:400,whiteSpace:"nowrap" }}>
                {typeIcon(loc.location_type)} {loc.name}
              </button>
            ))}
            <button onClick={() => { setActive(null); setModal("add"); }}
              style={{ padding:"5px 10px",fontSize:13,borderRadius:8,border:"1px dashed var(--border)",background:"transparent",color:"var(--muted)",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap" }}>
              + Add Location
            </button>
          </div>

          {/* ── Active location panel ── */}
          {currentLoc && (
            <div style={card}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:8,flexWrap:"wrap" }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ fontSize:20 }}>{typeIcon(currentLoc.location_type)}</span>
                  <span style={{ fontWeight:700,fontSize:15 }}>{currentLoc.name}</span>
                  {currentLoc.code && <span style={{ fontFamily:"monospace",fontWeight:800,fontSize:13,color:"var(--amber)",background:"rgba(196,118,26,.12)",padding:"2px 8px",borderRadius:4 }}>{currentLoc.code}</span>}
                  <span style={{ fontSize:11,color:"var(--muted)",background:"var(--white)",border:"1px solid var(--border)",padding:"2px 7px",borderRadius:10 }}>
                    {currentLoc.location_type==="room"?"Room map":currentLoc.location_type==="rack"?"Storage rack":"Named location"}
                  </span>
                </div>
                <div style={{ display:"flex",gap:6 }}>
                  <button className="btn btn-o bsm" style={{ fontSize:11 }} onClick={() => browseLocation(currentLoc)}>📋 {locItems.length} items</button>
                  <button className="btn btn-o bsm" style={{ fontSize:11 }} onClick={() => printLocationQR(currentLoc)}>🖨 QR Label</button>
                  <button className="btn btn-o bsm" onClick={() => { setActive(currentLoc); setModal("edit"); }}>Edit</button>
                  <button className="btn btn-d bsm" onClick={() => deleteLocation(currentLoc.id)}>Delete</button>
                </div>
              </div>

              {currentLoc.description && <div style={{ fontSize:12,color:"var(--muted)",marginBottom:12,fontStyle:"italic" }}>{currentLoc.description}</div>}

              {currentLoc.location_type === "room" && (
                <RoomMap loc={currentLoc} items={items} userId={userId} onUpdate={updateLoc} vertical={vertical} />
              )}
              {currentLoc.location_type === "rack" && (
                <StorageRack loc={currentLoc} items={items} onUpdate={updateLoc} />
              )}
              {currentLoc.location_type === "named" && (
                <div style={{ fontSize:13,color:"var(--muted)",padding:"16px 0",textAlign:"center" }}>
                  Named location — items are assigned here through the item edit form.<br/>
                  <button className="btn btn-o" style={{ marginTop:10,fontSize:12 }} onClick={() => browseLocation(currentLoc)}>Browse {locItems.length} item{locItems.length!==1?"s":""} in this location</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {(modal === "add" || modal === "edit") && (
        <LocationFormModal
          initial={modal === "edit" ? active : null}
          saving={saving}
          onSave={saveLocation}
          onCancel={() => { setModal(null); setActive(null); }}
          inp={inp} lbl={lbl}
        />
      )}

      {/* ── Browse items modal ── */}
      {modal === "browse" && active && (
        <Modal title={`${typeIcon(active.location_type)} ${active.name}${active.code ? " · " + active.code : ""}`} onClose={() => { setModal(null); setActive(null); setBrowseItems([]); }}>
          <div style={{ marginBottom:12,fontSize:13,color:"var(--muted)" }}>{browseItems.length} item{browseItems.length!==1?"s":""} in this location</div>
          {browseItems.length === 0 ? (
            <div style={{ textAlign:"center",padding:32,color:"var(--muted)" }}>
              <div style={{ fontSize:36,marginBottom:8 }}>📭</div>
              <div>No items assigned to this location yet.</div>
              <div style={{ fontSize:12,marginTop:6 }}>Assign items here by editing them and selecting this location.</div>
            </div>
          ) : (
            browseItems.map(item => {
              const cat = CAT[item.category] || CAT.other;
              return (
                <div key={item.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--linen)" }}>
                  <div style={{ width:36,height:36,background:cat.color+"22",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>{cat.icon}</div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:700,fontSize:13 }}>{item.name}</div>
                    <div style={{ fontSize:11,color:"var(--muted)",display:"flex",gap:8 }}>
                      {item.display_id && <span style={{ fontFamily:"monospace",fontWeight:800,color:"var(--amber)" }}>{item.display_id}</span>}
                      <span>{cat.label}</span>
                      <span>{item.condition}</span>
                      <span>×{item.qty}</span>
                    </div>
                  </div>
                  <button className="btn btn-o bsm" onClick={() => { setModal(null); onEditItem(item); }}>Edit</button>
                </div>
              );
            })
          )}
        </Modal>
      )}
    </div>
  );
}

function LocationFormModal({ initial, saving, onSave, onCancel, inp, lbl }) {
  const blank = { name:"", code:"", description:"", location_type: initial?.location_type || "named" };
  const [f, setF] = useState(initial || blank);
  const upd = (k,v) => setF(p => ({ ...p, [k]:v }));
  const types = [
    { id:"named", icon:"📦", label:"Named location", desc:"Simple text location — closet, shelf, container" },
    { id:"room",  icon:"🗺️", label:"Room map",       desc:"Upload a photo and drop pins on it" },
    { id:"rack",  icon:"🏗️", label:"Storage rack",   desc:"Build a virtual rack with rows and slots" },
  ];
  return (
    <Modal title={(initial ? "Edit" : "Add") + " Storage Location"} onClose={onCancel}>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        {!initial && (
          <div>
            <label style={lbl}>Location type</label>
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              {types.map(t => (
                <div key={t.id} onClick={() => upd("location_type", t.id)}
                  style={{ padding:"10px 12px",border:f.location_type===t.id?"1.5px solid var(--gold)":"1px solid var(--border)",borderRadius:8,cursor:"pointer",background:f.location_type===t.id?"rgba(212,168,67,.08)":"var(--parch)",display:"flex",alignItems:"center",gap:10 }}>
                  <span style={{ fontSize:20 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontWeight:700,fontSize:13,color:f.location_type===t.id?"var(--amber)":"var(--text)" }}>{t.label}</div>
                    <div style={{ fontSize:11,color:"var(--muted)" }}>{t.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
          <label style={lbl}>Location name *</label>
          <input style={inp} value={f.name} onChange={e=>upd("name",e.target.value)} placeholder={f.location_type==="room"?"e.g. Costume Storage Room":f.location_type==="rack"?"e.g. Costume Rack A":"e.g. Storage Container 1, Prop Room Shelf 3"} autoFocus />
        </div>
        <div>
          <label style={lbl}>Short code <span style={{ fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10 }}>(optional — for labels)</span></label>
          <input style={{ ...inp,fontFamily:"monospace",letterSpacing:2,textTransform:"uppercase" }} value={f.code||""} onChange={e=>upd("code",e.target.value.toUpperCase())} placeholder="e.g. SC1, CCA" maxLength={8} />
        </div>
        <div>
          <label style={lbl}>Description <span style={{ fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:10 }}>(optional)</span></label>
          <textarea style={{ ...inp,minHeight:56,resize:"vertical" }} value={f.description||""} onChange={e=>upd("description",e.target.value)} placeholder="Upstage right, blue rolling rack, near loading dock…" />
        </div>
        <div style={{ display:"flex",gap:8,justifyContent:"flex-end",paddingTop:12,borderTop:"1px solid var(--border)" }}>
          <button className="btn btn-o" onClick={onCancel}>Cancel</button>
          <button className="btn btn-g" disabled={!f.name.trim()||saving} style={{ opacity:!f.name.trim()||saving?0.45:1 }} onClick={() => { if(f.name.trim()) onSave(f); }}>
            {saving ? "Saving…" : initial ? "Save Changes" : "Add Location"}
          </button>
        </div>
      </div>
    </Modal>
  );
}