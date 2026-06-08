// ── Geo helpers (US states + zip→coords + distance) ──────────────────────────
// Extracted from App.jsx as the first step of the ArtsTracker modularization.
// Pure leaf utilities — no React, no app state.

export const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];

export const STATE_NAMES = {AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",DC:"Washington DC"};

// Free zip code lookup — no API key needed
export async function zipToCoords(zip) {
  // Try zippopotam.us first (fast, reliable for most zips)
  try {
    const zc1 = new AbortController();
    setTimeout(()=>zc1.abort(),5000);
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`,{signal:zc1.signal});
    if (res.ok) {
      const d = await res.json();
      const place = d.places?.[0];
      if (place) return {
        lat: parseFloat(place.latitude),
        lng: parseFloat(place.longitude),
        city: place["place name"],
        state: place["state abbreviation"],
      };
    }
  } catch { /* fall through */ }

  // Fallback 1: Nominatim postal code search
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&limit=1`,
      { headers: { "User-Agent": "Theatre4u/1.0 (hello@theatre4u.org)" } }
    );
    const data = await r.json();
    if (data?.[0]) return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      city: data[0].display_name?.split(",")[0] || zip,
      state: "CA",
    };
  } catch { /* fall through */ }

  // Fallback 2: US Census Bureau geocoder (no key, authoritative)
  try {
    const r = await fetch(
      `https://geocoding.geo.census.gov/geocoder/locations/address?street=&city=&state=&zip=${zip}&benchmark=Public_AR_Current&format=json`
    );
    const d = await r.json();
    const match = d?.result?.addressMatches?.[0];
    if (match) return {
      lat: match.coordinates.y,
      lng: match.coordinates.x,
      city: match.addressComponents?.city || zip,
      state: match.addressComponents?.state || "",
    };
  } catch { /* fall through */ }

  return null;
}

// Haversine distance in miles (client-side for instant filtering)
export function milesBetween(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
