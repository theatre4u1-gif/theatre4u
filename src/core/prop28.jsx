import React, { useState, useEffect } from "react";
import { SB } from "./supabase.js";

// Prop 28 funding/compliance page — extracted from App.jsx.

export function Prop28Page({userId, org, onNav}) {
  const [purchases,   setPurchases]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [migrating,   setMigrating]   = useState(false);
  const [migrated,    setMigrated]    = useState(false);
  const [migrateMsg,  setMigrateMsg]  = useState("");
  const [alreadyMigrated, setAlreadyMigrated] = useState(false);

  useEffect(()=>{
    if(!userId) return;
    (async()=>{
      setLoading(true);
      const [pr, sr] = await Promise.all([
        SB.from("prop28_purchases").select("*").eq("org_id", userId).order("date_purchased", {ascending:false}),
        SB.from("funding_sources").select("id,name").eq("org_id", userId).eq("vertical", org?.vertical||"theatre").ilike("name", "%prop 28%"),
      ]);
      setPurchases(pr.data || []);
      if (sr.data && sr.data.length > 0) setAlreadyMigrated(true);
      setLoading(false);
    })();
  }, [userId, org?.vertical]);

  const handleMigrate = async () => {
    if (!window.confirm(
      "This will create a \"Prop 28\" funding source in your Funding Tracker and copy your " +
      purchases.length + " purchase record" + (purchases.length !== 1 ? "s" : "") +
      " as expenditures. Your original Prop 28 records are preserved. Continue?"
    )) return;

    setMigrating(true);
    setMigrateMsg("");

    try {
      // 1. Create the funding source
      const totalCost = purchases.reduce((a, p) => a + (parseFloat(p.cost) || 0), 0);
      const years = [...new Set(purchases.map(p => p.school_year).filter(Boolean))];
      const fiscalYear = years.length === 1 ? years[0] : years.join(", ");

      const { data: src, error: srcErr } = await SB.from("funding_sources").insert({
        org_id:       userId,
        vertical:     org?.vertical||"theatre",
        name:         "Prop 28",
        source_type:  "state_grant",
        funder:       "California Department of Education",
        total_amount: totalCost || null,
        fiscal_year:  fiscalYear || null,
        notes:        "Migrated from Prop 28 tracker. Arts and music education funding per AB 30 (2022).",
        is_active:    true,
      }).select().single();

      if (srcErr) throw new Error("Could not create funding source: " + srcErr.message);

      // 2. Insert each purchase as an expenditure
      let imported = 0, failed = 0;
      for (const p of purchases) {
        const { error: expErr } = await SB.from("funding_expenditures").insert({
          org_id:            userId,
          vertical:          org?.vertical||"theatre",
          funding_source_id: src.id,
          description:       p.item_description || "Prop 28 purchase",
          amount:            parseFloat(p.cost) || 0,
          purchase_date:     p.date_purchased || null,
          vendor:            p.vendor || null,
          category:          p.arts_discipline ? "Arts — " + p.arts_discipline : "Arts & Music",
          notes:             [
            p.school_year    ? "School year: " + p.school_year : null,
            p.grade_levels?.length ? "Grades: " + p.grade_levels.join(", ") : null,
            p.students_served ? "Students served: " + p.students_served : null,
            p.supplement_not_supplant ? "Supplement not supplant: Yes" : null,
            p.notes          ? p.notes : null,
          ].filter(Boolean).join(" | ") || null,
        });
        if (expErr) { failed++; console.error("Exp insert error:", expErr); }
        else imported++;
      }

      setMigrated(true);
      setMigrateMsg(
        imported + " record" + (imported !== 1 ? "s" : "") + " copied to Funding Tracker" +
        (failed > 0 ? " (" + failed + " failed — check console)" : "") + "."
      );
    } catch(err) {
      setMigrateMsg("Migration failed: " + (err.message || "Unknown error. Please try again."));
    } finally {
      setMigrating(false);
    }
  };

  const card = {background:"var(--parch)",border:"1px solid var(--border)",borderRadius:10,padding:16,marginBottom:12};

  if (loading) return <div style={{textAlign:"center",padding:60,color:"var(--faint)"}}>Loading Prop 28 records…</div>;

  return (
    <div style={{maxWidth:860,margin:"0 auto"}}>

      {/* Header */}
      <div style={{marginBottom:20}}>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,marginBottom:4}}>Prop 28 Records</h2>
        <p style={{color:"var(--faint)",fontSize:13,lineHeight:1.6}}>
          Your Prop 28 (AB 30) arts and music education purchase records.
        </p>
      </div>

      {/* Migration banner */}
      <div style={{...card, background:"linear-gradient(135deg,rgba(212,168,67,.10),rgba(212,168,67,.04))",
        borderColor:"rgba(212,168,67,.3)", marginBottom:20}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
          <div style={{fontSize:32,flexShrink:0}}>📋</div>
          <div style={{flex:1,minWidth:260}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>
              Prop 28 tracking has moved to the Funding Tracker
            </div>
            <p style={{fontSize:13,color:"var(--faint)",lineHeight:1.6,marginBottom:10}}>
              Your existing Prop 28 data is preserved below. Use the Funding Tracker to record
              and organize all your program funding — grants, district allocations, booster funds,
              and Prop 28 — in one place.
            </p>
            {alreadyMigrated && !migrated ? (
              <div style={{fontSize:13,color:"var(--green)",fontWeight:600}}>
                ✓ Already migrated — a "Prop 28" source exists in your Funding Tracker.
                {" "}<button style={{background:"none",border:"none",color:"var(--gold)",cursor:"pointer",
                  fontFamily:"inherit",fontSize:13,fontWeight:700,padding:0}}
                  onClick={()=>onNav("funding")}>Go to Funding Tracker →</button>
              </div>
            ) : migrated ? (
              <div>
                <div style={{fontSize:13,color:"var(--green)",fontWeight:600,marginBottom:8}}>
                  ✓ {migrateMsg}
                </div>
                <button className="btn btn-g" style={{fontSize:13}}
                  onClick={()=>onNav("funding")}>
                  Open Funding Tracker →
                </button>
              </div>
            ) : purchases.length === 0 ? (
              <div style={{fontSize:13,color:"var(--faint)"}}>
                No Prop 28 records to migrate.{" "}
                <button style={{background:"none",border:"none",color:"var(--gold)",cursor:"pointer",
                  fontFamily:"inherit",fontSize:13,fontWeight:700,padding:0}}
                  onClick={()=>onNav("funding")}>Go to Funding Tracker →</button>
              </div>
            ) : (
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <button className="btn btn-g" style={{fontSize:13}}
                  disabled={migrating} onClick={handleMigrate}>
                  {migrating ? "Migrating…" : "Migrate " + purchases.length + " Record" + (purchases.length !== 1 ? "s" : "") + " to Funding Tracker"}
                </button>
                <button style={{background:"none",border:"none",color:"var(--gold)",cursor:"pointer",
                  fontFamily:"inherit",fontSize:13,fontWeight:700,padding:0}}
                  onClick={()=>onNav("funding")}>
                  Go to Funding Tracker →
                </button>
              </div>
            )}
            {migrateMsg && !migrated && (
              <div style={{fontSize:13,color:"var(--red)",marginTop:8}}>{migrateMsg}</div>
            )}
          </div>
        </div>
      </div>

      {/* Existing records */}
      {purchases.length === 0 ? (
        <div style={{textAlign:"center",padding:48,color:"var(--faint)"}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,marginBottom:8}}>No Prop 28 records</div>
          <div style={{fontSize:13,marginBottom:16}}>
            Use the Funding Tracker to record and organize your Prop 28 spending.
          </div>
          <button className="btn btn-g" onClick={()=>onNav("funding")}>Go to Funding Tracker</button>
        </div>
      ) : (
        <div>
          <div style={{fontSize:12,color:"var(--faint)",marginBottom:12,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>
            {purchases.length} purchase record{purchases.length !== 1 ? "s" : ""}
          </div>
          {purchases.map(p => (
            <div key={p.id} style={card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{p.item_description || "—"}</div>
                  <div style={{fontSize:12,color:"var(--faint)",display:"flex",flexWrap:"wrap",gap:10,marginBottom:p.notes?6:0}}>
                    {p.school_year      && <span>📅 {p.school_year}</span>}
                    {p.arts_discipline  && <span>🎨 {p.arts_discipline}</span>}
                    {p.vendor           && <span>🏪 {p.vendor}</span>}
                    {p.students_served  && <span>👥 {p.students_served} students</span>}
                    {p.date_purchased   && <span>{new Date(p.date_purchased + "T00:00:00").toLocaleDateString()}</span>}
                  </div>
                  {p.notes && <div style={{fontSize:12,color:"var(--faint)",fontStyle:"italic"}}>{p.notes}</div>}
                </div>
                <div style={{fontWeight:800,fontSize:18,color:"var(--gold)",fontFamily:"'Playfair Display',serif",flexShrink:0}}>
                  {p.cost != null ? "$" + parseFloat(p.cost).toLocaleString("en-US",{minimumFractionDigits:2}) : "—"}
                </div>
              </div>
            </div>
          ))}
          <div style={{fontSize:12,color:"var(--faint)",marginTop:8,padding:"10px 14px",
            background:"rgba(255,255,255,.03)",borderRadius:8,border:"1px solid var(--border)"}}>
            <strong>Note:</strong> These records are read-only here. To add or edit Prop 28 spending records,
            use the Funding Tracker and select your Prop 28 funding source.
          </div>
        </div>
      )}
    </div>
  );
}
