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
     data-org     the program slug (from My Profile → Public Profile URL)
     data-target  id of the container to render into (else renders inline)
     data-limit   max items to show (default 12)
     data-title   heading text (default "Available from <program name>")
     data-brand   "theatre4u" or "artstracker" (else inferred from script host)
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
    ? { name: "ArtsTracker", url: "https://artstracker.org" }
    : { name: "Theatre4u",  url: "https://theatre4u.org" };

  // Target container
  var host = script.getAttribute("data-target") && document.getElementById(script.getAttribute("data-target"));
  if (!host) { host = document.createElement("div"); script.parentNode.insertBefore(host, script.nextSibling); }

  if (!slug) { host.innerHTML = msg("Add data-org=\"your-program-slug\" to the embed code."); return; }

  var G = "#d4a843", INK = "#1a0f00";
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }
  function msg(t){ return '<div style="font:14px/1.5 system-ui,sans-serif;color:#666;padding:14px">' + esc(t) + '</div>'; }
  function api(path){
    return fetch(SB_URL + "/rest/v1/" + path, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } })
      .then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });
  }
  function price(it){
    if (it.mkt === "For Loan") return "Free to borrow";
    var parts = [];
    if ((it.mkt === "For Rent" || it.mkt === "Rent or Sale") && it.rent) parts.push("$" + it.rent + " rent");
    if ((it.mkt === "For Sale" || it.mkt === "Rent or Sale") && it.sale) parts.push("$" + it.sale + " sale");
    return parts.join(" · ") || it.mkt || "";
  }

  host.innerHTML = msg("Loading…");

  var qslug = encodeURIComponent(slug);
  api("orgs?slug=eq." + qslug + "&profile_public=eq.true&select=id,name,type,location,logo_url&limit=1").then(function(orgs){
    var org = orgs && orgs[0];
    if (!org) { host.innerHTML = ""; return; }  // private or not found → render nothing
    var q = "items?org_id=eq." + encodeURIComponent(org.id)
      + "&mkt=neq." + encodeURIComponent("Not Listed")
      + "&avail=eq." + encodeURIComponent("In Stock")
      + "&select=name,category,img,images,mkt,rent,sale,condition,display_id"
      + "&order=added.desc&limit=" + limit;
    api(q).then(function(items){
      render(org, items || []);
    });
  });

  function render(org, items){
    var pageUrl = BRAND.url + "/#/org/" + encodeURIComponent(slug);
    var head = title || ("Available from " + org.name);
    var css = "font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1f2430;box-sizing:border-box";
    var html = '<div style="' + css + ';max-width:960px;margin:0 auto">';
    html += '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px">'
          + '<h3 style="margin:0;font-size:20px;font-weight:800">' + esc(head) + '</h3>'
          + '<a href="' + pageUrl + '" target="_blank" rel="noopener" style="font-size:13px;color:' + INK + ';background:' + G + ';padding:7px 14px;border-radius:8px;text-decoration:none;font-weight:700;white-space:nowrap">See full page &rarr;</a>'
          + '</div>';

    if (!items.length) {
      html += '<div style="border:1px solid #eee;border-radius:12px;padding:20px;text-align:center;color:#666;font-size:14px">'
            + 'This program has not listed items for sharing yet. '
            + '<a href="' + pageUrl + '" target="_blank" rel="noopener" style="color:#b8860b">Visit their page &rarr;</a></div>';
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px">';
      items.forEach(function(it){
        var img = it.img || (Array.isArray(it.images) && it.images[0]) || "";
        var link = it.display_id ? (BRAND.url + "/#/item/" + encodeURIComponent(it.display_id)) : pageUrl;
        html += '<a href="' + link + '" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;border:1px solid #ececec;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.05)">';
        html += img
          ? '<div style="aspect-ratio:1/1;background:#f4f4f4 center/cover no-repeat url(' + esc(img) + ')"></div>'
          : '<div style="aspect-ratio:1/1;background:#f4f4f4;display:flex;align-items:center;justify-content:center;font-size:34px">🎭</div>';
        html += '<div style="padding:10px 11px">'
              + '<div style="font-weight:700;font-size:14px;line-height:1.25;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(it.name) + '</div>'
              + '<div style="font-size:12px;color:#777">' + esc(price(it)) + '</div>'
              + '</div></a>';
      });
      html += '</div>';
    }

    html += '<div style="margin-top:12px;font-size:11px;color:#9aa">Powered by '
          + '<a href="' + BRAND.url + '" target="_blank" rel="noopener" style="color:#b8860b;text-decoration:none">' + BRAND.name + '</a></div>';
    html += '</div>';
    host.innerHTML = html;
  }
})();
