# Logo Kit — placement guide

All 13 files below go in **one place: `src/public/`** (drag them in via GitHub
web or GitHub Desktop). Anything in `src/public/` is served at the site root,
so `src/public/logo-theatre4u.svg` becomes `https://theatre4u.org/logo-theatre4u.svg`.

You do **not** touch `src/index.html` for any of this. The favicon and tab icon
get set from inside `src/App.jsx` instead (one small edit — see step 2).

## What each file is for

| File | Role | Where it shows up |
|------|------|-------------------|
| `logo-theatre4u.svg` | Main wide logo (vector) | App header / sidebar / landing |
| `logo-artstracker.png` | Main wide logo | App header / sidebar / landing |
| `favicon-theatre4u.svg` + `favicon-theatre4u.png` | Browser tab icon | The little icon on the tab |
| `favicon-artstracker.png` | Browser tab icon | The little icon on the tab |
| `apple-touch-icon-*.png` (180px) | iPhone/iPad home-screen icon | "Add to Home Screen" |
| `icon-192-*.png`, `icon-512-*.png` | PWA / Android install icons | The installable app icon |
| `og-theatre4u.png`, `og-artstracker.png` (1200×630) | Social share preview | iMessage / Slack / Facebook link previews |

## The two-step rollout

**Step 1 — Drop the files in.** Put all 13 files in `src/public/`. Commit.
That alone makes them reachable by URL. Nothing breaks if they're just sitting
there unused.

**Step 2 — Wire them into `src/App.jsx`.** Two small edits (Claude will prepare
the exact code + run pre-flight before you commit):
  - Replace the emoji placeholder logo (`LogoMarkDark` / `LogoMarkLight`,
    lines ~299–304) with an `<img>` that picks the right brand logo using the
    existing `IS_THEATRE4U` / `IS_ARTSTRACKER` flags.
  - Add a few lines that set the tab favicon + touch icon at runtime based on
    hostname. This is how a single codebase serves two different tab icons
    without ever editing `src/index.html`.

## One thing that needs a decision later (not blocking)

The **social share images** (`og-*.png`) only appear in link previews if the
`<meta property="og:image">` tag is in the page's HTML head — and the head
lives in the Vite-owned `src/index.html` that you don't commit. Because one
deploy serves both domains, this needs either a `vercel.json` per-domain rule
or putting the tags in your committable public HTML pages. The images are ready
whenever you want to tackle that — flag it and Claude will walk it through.
