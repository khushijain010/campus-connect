# Campus Connect

A campus social platform for IIT students: a personalised feed, cultural exchange, discovery of study groups / teams / events, and real-time chat — all driven by one recommendation engine built on the principle

> **Common Interests + Compatible Preferences + Different Backgrounds**

## Quick start

Requires **Node.js 22.5+** (uses the built-in `node:sqlite`, so there are no native modules to compile).

```bash
npm run install:all   # installs root, server and client dependencies
npm run dev           # API on :4000 + Vite client on http://localhost:5173
```

The database is created and seeded automatically on first run. Demo login:

- **Email:** `arjunm@cse.iitr.ac.in`
- **Password:** `password123`

Every seeded user has the same password. Emails follow the IITR format `<handle without dot>@<dept>.iitr.ac.in` (e.g. `riyas@ece.iitr.ac.in`, `kabirk@me.iitr.ac.in`).

| Command | What it does |
| --- | --- |
| `npm run dev` | Server (auto-reload) + client dev server |
| `npm run build && npm start` | Production: Express serves the built client on http://localhost:4000 |
| `npm run seed` | Wipe and re-seed the database (safe to run while the server is up) |
| `npm test` | API integration + recommendation unit tests (Vitest + Supertest) |
| `npm --prefix client run lint` | ESLint for the client |

## Stack

- **Client:** React 18, React Router, Vite, lucide-react icons, plain CSS design tokens (`client/src/styles.css`)
- **Server:** Express, `node:sqlite`, JWT auth (bcrypt), Multer uploads, Socket.IO for live chat, typing and notifications
- **Dark mode:** sun/moon toggle in the top bar, landing nav and login/signup; follows the OS setting until you choose, remembered in localStorage, applied before first paint (`client/src/lib/theme.jsx`, dark tokens at the end of `styles.css` and `landing.css`)
- **3D:** three.js for the landing-page hero (lazy-loaded, logged-out visitors only)
- **Tests:** Vitest + Supertest (51 tests)

## Features → where they live

| Spec section | Implementation |
| --- | --- |
| Landing page at `/` for logged-out visitors: 3D hero, aim, features, live achievements and anonymous student reviews (`GET /api/landing`), Log in / Create account | `pages/Landing.jsx`, `lib/heroScene.js`, `landing.css` |
| 4-page profile creation (basic, academic, preferences, cultural), IIT Roorkee emails (`name@<dept>.iitr.ac.in`, department auto-detected) and all 23 IITR departments, avatar upload | `pages/Onboarding.jsx`, `routes/auth.js` |
| Login with college email + password | `pages/Login.jsx` |
| **Home:** create posts (Text, Image, Link, Event, Project, Discussion, Poll) with image and PDF/document attachments, personalised *For You*, *Trending*, topic tabs (Tech, Culture, Politics, Sports, Arts, More → Academics, Life@Campus, Events, Memes, Other, Saved), upvotes, threaded comments with likes and Most Relevant / Newest sorting, share, save | `pages/Home.jsx`, `pages/PostDetail.jsx`, `components/PostCard.jsx`, `routes/posts.js` |
| Global search (people, posts, communities, events) with recent searches | `components/Layout.jsx`, `pages/SearchPage.jsx` |
| Profile view: info, interests, hobbies, cultural info; Add Friend / Message / Block / Report; match % | `pages/Profile.jsx`, `routes/users.js` |
| Reviews / testimonials (anonymous, from post-event surveys) | Home right rail, `GET /api/testimonials` |
| **Culture:** Netflix-style page: Culture of the Week billboard with a 3D topic-card fan, then sliding rows. Culture profile, Step Outside Your Circle (match-on chips, Connect/Skip), Cultural Buddy (Learn/Teach/Experience/Connect), cultural exchange events, Teach Me Something, cultural communities, cultural stories (like/comment/share/save), Culture of the Week, icebreakers | `pages/Culture.jsx`, `routes/culture.js` |
| **Discover:** Netflix-style sliding rows of interactive 3D poster cards. Search + categories, filters (time, date, location, group size, level, department), study partners, project teams, sports groups, Add Event template, general communities, Recommended For You | `pages/Discover.jsx`, `routes/activities.js` |
| Block / report on profiles, posts, groups, communities and messages | `components/ReportModal.jsx` |
| **Personal:** profile + edit, friends (view/message/remove), friend requests, communities (open/leave), your events with Manage Applications, applications with status, upcoming and past events with Submit Feedback | `pages/Personal.jsx`, `pages/EditProfile.jsx` |
| **Chats:** direct messages, group chats (auto-created per event/team), community chats; images, emoji, reactions, typing, read receipts, unread badges | `pages/Chats.jsx`, `routes/chats.js` |
| Post-event survey (rating, connection, learning, cultural, future, feedback) → anonymous testimonials | `components/SurveyModal.jsx` |
| Recommendation algorithm (people, teams, groups, events, feed) | `server/src/recommend.js` |

## Recommendation engine

`server/src/recommend.js` is pure and fully unit-tested. Each scorer returns a score plus human-readable reasons that the UI shows (e.g. *“Both into AI/ML · From Rajasthan · Speaks Tamil — which you want to learn”*).

- **People** (`scorePerson`): common ground (interests, hobbies/clubs, courses/skills, cultural interests) + compatibility (shared availability, a shared language) + difference (department, region/zone, new languages). Weights change by mode (`friends`, `outside`, `study`, `cultural`). With no common ground at all, the score is damped.
- **Cultural Buddy** (`scoreBuddy`): fit for the chosen mode/topic (for example, *Learn Language* matches people who speak a language you want to learn), plus a bonus when the other person chose the matching mode (Learn ↔ Teach).
- **Activities** (`scoreActivity`): tag/text relevance to your profile, course and skill matches, availability slot, cultural exchange preference, past activity categories, community tags and friends attending.
- **Feed** (`scorePost`): relevance to interests and courses, joined communities, recent searches, tags of posts you upvoted and friends' posts, multiplied by recency, plus engagement. **Trending** = engagement ÷ age^1.3.

## Deploy

One Node process serves the API, Socket.IO chat and the built client, so it needs a host that runs a long-lived server (not Vercel/Netlify functions). Node >= 22.13.

| Env var | Purpose |
|---|---|
| `NODE_ENV=production` | required in production; the server refuses to start without `JWT_SECRET` |
| `JWT_SECRET` | long random string used to sign login tokens |
| `PORT` | set by most hosts automatically (default 4000) |
| `DB_PATH` | SQLite file, e.g. `/var/data/campus.db` on a persistent disk |
| `UPLOAD_DIR` | folder for uploaded images/files, e.g. `/var/data/uploads` |

Build: `npm --prefix server install --omit=dev && npm --prefix client install --include=dev && npm run build` · Start: `npm start`.

- **Render (free, demo):** push to GitHub, then New → Blueprint and pick the repo (uses `render.yaml`). The free plan sleeps after ~15 min idle and its disk is wiped on every redeploy/restart, so posts and sign-ups do not persist (demo data reseeds itself).
- **Always-on VM (free, real users):** e.g. Oracle Cloud Always Free. Run with pm2, put Caddy in front for HTTPS, and keep `DB_PATH`/`UPLOAD_DIR` on the VM disk; back up the `.db` file.

## Notes

- Email rule: IIT Roorkee addresses, where the subdomain is the department (`khushi@ece.iitr.ac.in`; any subdomain is accepted). Only `iitr.ac.in` addresses are accepted (`ALLOWED_EMAIL_SUFFIXES` in `server/src/constants.js` (mirrored in `client/src/lib/college.js`). Accounts created with the old `@iit.ac.in` form are migrated automatically when the server starts (`migrateLegacyEmails` in `db.js`).
- Departments: the 23 IIT Roorkee departments (`IITR_DEPARTMENTS` in `constants.js`), each with email codes used to pre-select the department at signup.
- Seed post photos load from picsum.photos. If they can't load (for example, when offline), the app shows a placeholder. Communities and events use emoji + colour covers. Avatars fall back to coloured initials.
- Uploaded images are stored in `server/uploads/` (max 5 MB, images only). The database is `server/data/campus.db`.
- `docs/` holds the original UI mockups.
