/* ============================================================================
   Theatre4u / ArtsTracker — embeddable inventory widget
   ----------------------------------------------------------------------------
   Lets any arts program show its PUBLIC, listed items on its own website.
   Reads only public data (a profile the program has made public + items the
   program has listed on the Exchange). No private inventory is ever exposed.

   Embed on any site (WordPress, Wix, Squarespace, Google Sites, school CMS):

     <div id="t4u-widget"></div>
     <script src="https://theatre4u.org/widget.js"
             data-org="your-program-slug"
             data-target="t4u-widget"
             data-limit="12"></script>

   Options (all optional except data-org):
     data-org     the program slug (from My Profile -> Public Profile URL)
     data-target  id of the container to render into (else renders inline)
     data-limit   max items to show (default 12)
     data-title   heading text (default "Available from <program name>")
     data-brand   "theatre4u" or "artstracker" (else inferred from script host)

   Design: light and airy so it blends into any site, with the brand's gold
   accent, a Playfair Display headline, and a small logo credit.
   ============================================================================ */
(function () {
  "use strict";
  var SB_URL = "https://ldmmphwivnnboyhlxipl.supabase.co";
  // Public anon key — safe to expose by design; restricted to public data by
  // row-level security (same key the public profile page already uses).
  var SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbW1waHdpdm5uYm95aGx4aXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxODA2MDUsImV4cCI6MjA3OTc1NjYwNX0.U2acfM5Ew7leACj4TWEy7EKwHi92270B1lt78dEjEfA";

  var script = document.currentScript;
  if (!script) { var s = document.getElementsByTagName("script"); script = s[s.length - 1]; }
  var slug  = (script.getAttribute("data-org") || "").trim();
  var limit = parseInt(script.getAttribute("data-limit") || "12", 10) || 12;
  var title = script.getAttribute("data-title") || "";
  var brand = (script.getAttribute("data-brand") || "").toLowerCase();
  if (!brand) brand = /artstracker/i.test((script.src || "") + location.hostname) ? "artstracker" : "theatre4u";
  var BRAND = brand === "artstracker"
    ? { name: "ArtsTracker", url: "https://artstracker.org", mark: "https://artstracker.org/logo-mark-artstracker.png" }
    : { name: "Theatre4u",  url: "https://theatre4u.org",  mark: "https://theatre4u.org/logo-mark-theatre4u.png" };

  var host = script.getAttribute("data-target") && document.getElementById(script.getAttribute("data-target"));
  if (!host) { host = document.createElement("div"); script.parentNode.insertBefore(host, script.nextSibling); }

  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }
  function note(t){ return '<div style="font:14px/1.5 system-ui,sans-serif;color:#8a8378;padding:12px 0">' + esc(t) + '</div>'; }
  function api(path){
    return fetch(SB_URL + "/rest/v1/" + path, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } })
      .then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });
  }
  function priceOf(it){
    if (it.mkt === "For Loan") return "Free to borrow";
    var p = [];
    if ((it.mkt === "For Rent" || it.mkt === "Rent or Sale") && it.rent && it.rent !== "0") p.push("$" + it.rent + " rent");
    if ((it.mkt === "For Sale" || it.mkt === "Rent or Sale") && it.sale && it.sale !== "0") p.push("$" + it.sale + " sale");
    return p.join("  ·  ") || (it.mkt || "");
  }

  // Inject brand font + scoped styles once.
  function ensureAssets(){
    if (document.getElementById("t4uw-assets")) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap";
    document.head.appendChild(link);
    var st = document.createElement("style");
    st.id = "t4uw-assets";
    st.textContent = [
      ".t4uw-root{font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#2a2520;max-width:1000px;margin:0 auto;box-sizing:border-box}",
      ".t4uw-root *{box-sizing:border-box}",
      ".t4uw-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}",
      ".t4uw-title{font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:23px;font-weight:700;line-height:1.15;margin:0;color:#1a0f00}",
      ".t4uw-btn{font-size:13px;font-weight:700;color:#1a0f00;background:linear-gradient(135deg,#e2ba4e,#c69a33);padding:9px 17px;border-radius:999px;text-decoration:none;white-space:nowrap;box-shadow:0 1px 2px rgba(0,0,0,.14);transition:filter .15s}",
      ".t4uw-btn:hover{filter:brightness(1.06)}",
      ".t4uw-rule{height:2px;background:linear-gradient(90deg,#d4a843,rgba(212,168,67,0));border-radius:2px;margin-bottom:18px}",
      ".t4uw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px}",
      ".t4uw-card{display:flex;flex-direction:column;background:#fff;border:1px solid #ece7dd;border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;box-shadow:0 1px 3px rgba(26,15,0,.06);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}",
      ".t4uw-card:hover{transform:translateY(-3px);box-shadow:0 12px 26px rgba(26,15,0,.13);border-color:#e6cf95}",
      ".t4uw-img{aspect-ratio:1/1;background:#f6f1e7 center/cover no-repeat}",
      ".t4uw-ph{aspect-ratio:1/1;background:linear-gradient(135deg,rgba(212,168,67,.20),rgba(212,168,67,.05));display:flex;align-items:center;justify-content:center;font-size:34px}",
      ".t4uw-cbody{padding:11px 12px 13px}",
      ".t4uw-name{font-weight:700;font-size:14px;line-height:1.25;color:#2a2520;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".t4uw-meta{font-size:12px;color:#a37f2c;font-weight:600;margin-top:3px}",
      ".t4uw-empty{border:1px dashed #e2d9c6;border-radius:14px;padding:22px;text-align:center;color:#8a8378;font-size:14px}",
      ".t4uw-foot{margin-top:16px;display:flex;align-items:center;gap:6px;font-size:11px;color:#9a9488}",
      ".t4uw-foot img{height:15px;width:auto;vertical-align:middle;opacity:.92}",
      ".t4uw-foot a{color:#a37f2c;text-decoration:none;font-weight:700}"
    ].join("");
    document.head.appendChild(st);
  }

  if (!slug) { host.innerHTML = note("Add data-org=\"your-program-slug\" to the embed code."); return; }
  ensureAssets();
  host.innerHTML = note("Loading…");

  api("orgs?slug=eq." + encodeURIComponent(slug) + "&profile_public=eq.true&select=id,name,type,location,logo_url&limit=1").then(function(orgs){
    var org = orgs && orgs[0];
    if (!org) { host.innerHTML = ""; return; }   // private or not found -> render nothing
    var q = "items?org_id=eq." + encodeURIComponent(org.id)
      + "&mkt=neq." + encodeURIComponent("Not Listed")
      + "&avail=eq." + encodeURIComponent("In Stock")
      + "&review_status=eq." + encodeURIComponent("approved")  // never surface pending student items
      + "&select=name,category,img,images,mkt,rent,sale,condition,display_id"
      + "&order=added.desc&limit=" + limit;
    api(q).then(function(items){ render(org, items || []); });
  });

  function render(org, items){
    var pageUrl = BRAND.url + "/#/org/" + encodeURIComponent(slug);
    var head = title || ("Available from " + org.name);
    var h = '<div class="t4uw-root">';
    h += '<div class="t4uw-head"><h3 class="t4uw-title">' + esc(head) + '</h3>'
       + '<a class="t4uw-btn" href="' + pageUrl + '" target="_blank" rel="noopener">See full page →</a></div>';
    h += '<div class="t4uw-rule"></div>';

    if (!items.length) {
      h += '<div class="t4uw-empty">This program has not listed items for sharing yet. '
         + '<a href="' + pageUrl + '" target="_blank" rel="noopener" style="color:#a37f2c;font-weight:700;text-decoration:none">Visit their page →</a></div>';
    } else {
      h += '<div class="t4uw-grid">';
      items.forEach(function(it){
        var img = it.img || (Array.isArray(it.images) && it.images[0]) || "";
        var link = it.display_id ? (BRAND.url + "/#/item/" + encodeURIComponent(it.display_id)) : pageUrl;
        h += '<a class="t4uw-card" href="' + link + '" target="_blank" rel="noopener">';
        h += img ? '<div class="t4uw-img" style="background-image:url(\'' + esc(img) + '\')"></div>'
                 : '<div class="t4uw-ph">🎭</div>';
        h += '<div class="t4uw-cbody"><div class="t4uw-name">' + esc(it.name) + '</div>'
           + '<div class="t4uw-meta">' + esc(priceOf(it)) + '</div></div></a>';
      });
      h += '</div>';
    }

    h += '<div class="t4uw-foot"><img src="' + BRAND.mark + '" alt="" onerror="this.style.display=\'none\'"> Powered by '
       + '<a href="' + BRAND.url + '" target="_blank" rel="noopener">' + BRAND.name + '</a></div>';
    h += '</div>';
    host.innerHTML = h;
  }
})();
