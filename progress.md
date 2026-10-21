# Campus Connect — Progress & Session Handoff

_Last updated: 2026-10-20 (end of session 1, after request 8: dark mode)_

Read this first when starting a new session. It records what was built, how it fits together, the decisions made (and why), known issues, and what's left to do. The README covers how to run the app; this file covers everything else.

---

## 1. Project summary

**Campus Connect** is a social platform for **IIT Roorkee** students. It has four main tabs (Home feed, Culture, Discover, Chats), a Personal/profile area under the top-right avatar, a public landing page for logged-out visitors, and one recommendation engine shared by every tab. Its matching rule is:

> **Common Interests + Compatible Preferences + Different Backgrounds**
> e.g. ECE + AI/ML + Photography + Kerala ↔ Mechanical + AI/ML + Photography + Rajasthan

- **Location:** `C:\Users\Khushi Jain\Desktop\Work\Acads\SEM-5\Outreach\campus-connect\`. Not a git repository.
- **Original spec:** the long feature list the user pasted in the first message (4-page signup → Feed → Cultural page → Discover → Profile button → Chats → Post-event survey → Recommendation algorithm). Every section is implemented (§6).
- **UI mockups:** `docs/image1.png … image7.png`.
  - image1: Chats → Direct Messages
  - image2: Chats → Communities
  - image3: Login + the 4 onboarding pages ("ConnectU" in the mockup; we use **CampusConnect**)
  - image4: Personal page
  - image5: Chats → Groups
  - image6: Culture page
  - image7: Home/Feed. The user later sent a sharper feed mockup (For You, Trending, Tech, Create Post, Post Detail, Culture subcategory); Home follows that one.
- **Look and feel today:**
  - **Palette:** shared with the landing page. Navy text `#0f1d3a`, primary blue `#1f6feb` with a blue→violet gradient (`--grad`) for emphasis, soft blue surfaces, and the logo's amber/red/green used sparingly.
  - **Fonts:** Plus Jakarta Sans for headings, Inter for body text.
  - **Themes:** light and **dark mode** (§6, Design system).
- **The user's taste so far** (this matters for future UI work):
  - Liked: the landing page; Netflix-style sliding rows; interactive 3D cards.
  - Disliked: tabs replacing the stacked Culture/Discover sections; the same 3D globe repeated across pages.
  - Wants: clean, uncluttered and "catchy", without losing the old structure.

---

## 2. How to run

Node.js **22.5+** is required (built-in `node:sqlite`). The machine has Node v26.1.0 and npm 12.

```bash
cd campus-connect
npm run install:all      # root + server + client deps
npm run dev              # API :4000 (node --watch) + Vite :5173 (proxies /api, /uploads, /socket.io)
npm run build && npm start   # production: Express serves client/dist on :4000
npm run seed             # wipe and re-seed the DB in place (works even while the server is running)
npm test                 # server tests (Vitest + Supertest): 51 passing
npm --prefix client run lint   # ESLint (clean)
```

- **Demo login:** `arjunm@cse.iitr.ac.in` / `password123`. Every seeded user has the same password.
- **Seed email pattern:** `collegeEmail(handle without the dot, department)` = `<local>@<first dept code>.iitr.ac.in`.
  - Examples: `arjunm@cse.iitr.ac.in`, `riyas@ece.iitr.ac.in`, `aikot@ece.iitr.ac.in`, `rahulnair@cse.iitr.ac.in`, `kabirk@me.iitr.ac.in`.
  - Seed departments map as CSE→cse, ECE→ece, Mechanical→me, Civil→ce, Electrical→ee.
- The DB auto-seeds on first start if it's empty (`seedIfEmpty` in `server/src/index.js`). On every start, `openDb()` also migrates old `@iit.ac.in` accounts to the IITR format (§5).
- **Data files:** the database is `server/data/campus.db` and uploads go to `server/uploads/`. Both are gitignored.

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Client | React 18 + Vite 6 + React Router 6 | Plain JSX (no TypeScript), lucide-react icons, one hand-written CSS design system (`styles.css`) plus `landing.css`. Light/dark themes come from CSS variables |
| Server | Express 4 (ESM) | `server/src/app.js` exports `createApp()`, used by `index.js` and the tests |
| DB | `node:sqlite` (`DatabaseSync`) | No native modules. Helpers `q.get/all/run`, `tx()`, `parse()` in `db.js` |
| Auth | JWT (7 days) + bcryptjs | Token in localStorage as `cc_token`. Set `JWT_SECRET` in production |
| Realtime | Socket.IO | Rooms `user:<id>` and `conv:<id>`. Events: `message`, `reaction`, `typing`, `unread`, `notification` |
| Uploads | Multer | Avatars and chat images ≤5 MB (`upload`). Posts take up to 6 images + 1 document (PDF/Office/ZIP/TXT) ≤10 MB (`postUpload`) |
| 3D (WebGL) | three.js 0.169 (plain, no React wrapper) | Lazy-loaded chunk (~130 kB gzipped). See "3D" in §6 for where it's used |
| 3D (CSS) | CSS transforms + pointer-driven CSS variables | Poster/people card tilt and the Culture topic fan (`useTilt` in `cards.jsx`). No library |
| Tests | Vitest + Supertest; playwright-core for browser walkthroughs | Server tests use an in-memory DB (`openDb(':memory:')` then `seed()`) |
| Lint | ESLint 9 flat config | `client/eslint.config.js` (react + react-hooks plugins) |

---

## 4. Repository structure

```
campus-connect/
├── package.json            # root scripts (concurrently)
├── README.md               # user-facing overview + feature→file map
├── progress.md             # ← this file
├── docs/image1-7.png       # UI mockups
├── tools/                  # browser walkthroughs (playwright-core + installed Chrome), see §10
│   ├── e2e-walkthrough.mjs # full app walkthrough, 19 steps
│   ├── e2e-feed.mjs        # Home feed, 10 steps
│   ├── e2e-landing.mjs     # landing page, 9 steps
│   └── e2e-dark.mjs        # dark mode: toggle, persistence, every page in dark
├── server/
│   ├── src/
│   │   ├── index.js        # http + socket.io bootstrap, hourly completePastActivities()
│   │   ├── app.js          # express app, routers, static client/dist, error handler
│   │   ├── db.js           # SCHEMA, openDb (+ comments.parent_id migration, migrateLegacyEmails), helpers, hydrate*()
│   │   ├── constants.js    # OPTIONS, IITR_DEPARTMENTS, collegeEmail(), isCollegeEmail, ALLOWED_EMAIL_SUFFIX(ES), REGIONS→zone, ICEBREAKERS, slotOf
│   │   ├── recommend.js    # PURE scoring functions (no DB), fully unit tested
│   │   ├── services.js     # notify, friendIds, hiddenIds (blocks), ensureDm, conversation helpers, completePastActivities, featuredTestimonials
│   │   ├── realtime.js     # setIo/emitToUser/emitToConversation (no-op in tests)
│   │   ├── upload.js       # multer configs (upload, postUpload), UPLOAD_DIR, fileUrl
│   │   ├── auth.js         # signToken / verifyToken / auth middleware (updates last_seen)
│   │   ├── seed.js         # demo data, DEMO_EMAIL/DEMO_PASSWORD, writeDemoPdf(); `node src/seed.js` = drop tables + reseed
│   │   └── routes/
│   │       ├── auth.js         # /meta, /landing (public), /auth/check, /auth/register, /auth/login, /auth/me
│   │       ├── users.js        # profile, edit, friends, requests, block, reports, notifications
│   │       ├── posts.js        # feed, posts, polls, comments, upvote/save, testimonials, search
│   │       ├── activities.js   # communities + activities (events/groups), applications, survey, /me/activities
│   │       ├── culture.js      # culture of week, step outside, buddy, icebreakers, /recommendations
│   │       └── chats.js        # conversations, messages, reactions, read state
│   └── tests/  api.test.js · feed.test.js · recommend.test.js
└── client/
    ├── index.html          # fonts; inline script that applies the theme before first paint; theme-color meta
    ├── vite.config.js      # dev proxy; chunkSizeWarningLimit 600 (three.js chunk)
    └── src/
        ├── main.jsx        # initTheme(), providers
        ├── App.jsx         # routes; RequireAuth (shows lazy Landing at "/" when logged out) / PublicOnly
        ├── styles.css      # design tokens + all component styles + responsive rules + dark-mode block at the end
        ├── landing.css     # landing page only (prefix lp-), with its own dark block at the end
        ├── lib/
        │   ├── api.js · auth.jsx (AuthProvider: user, meta/options, unreadChats) · socket.js · format.js · toast.jsx
        │   ├── theme.jsx       # initTheme, useTheme, ThemeToggle (light/dark, follows OS until chosen)
        │   ├── college.js      # isCollegeEmail, departmentFromEmail, EMAIL_EXAMPLE (mirrors server rules)
        │   ├── heroScene.js    # landing-page 3D "connection globe" (three.js)
        │   └── scene3d.js      # small 3D glossy-shape scenes, presets: home, discover (unused now), chats
        ├── components/
        │   ├── Layout.jsx      # sidebar (Home, Culture, Discover, Chats + gradient "Step outside" card), topbar: SearchBox, ThemeToggle, Notifications, ProfileMenu
        │   ├── ui.jsx          # Avatar, Cover, Img, Modal, Dropdown, OptionGrid, Field, Group, Tabs, Empty, Spinner, Stars, StatusPill, useApi
        │   ├── cards.jsx       # useTilt, JoinButton, ActivityCard (poster), ActivityRow, CommunityTile (poster), PersonCard, kindColor
        │   ├── Row.jsx         # Netflix-style sliding row (title, icon, sub, action, ‹ › arrows, snap, edge fades)
        │   ├── Scene3D.jsx     # lazy wrapper for heroScene/scene3d with CSS-blob fallback
        │   ├── PostCard.jsx    # PostCard (+ `bare`, `compact`), StoryCard, RichText, splitHashtags, Poll, usePostActions
        │   ├── CreatePostModal.jsx · AddEventModal.jsx · SurveyModal.jsx · ReportModal.jsx
        │   └── ProfileForm.jsx # shared signup / edit sections (Basic, Academic, Preference, Cultural)
        └── pages/  Landing · Login · Onboarding · Home · PostDetail · SearchPage · Profile · Culture · Discover
                    ActivityPage (+ManageApplications) · CommunityPage · Personal · EditProfile · Chats
```

### Client routes

| Path | Page |
|---|---|
| `/` | Logged out: **Landing page**. Logged in: Home feed. Other app URLs still redirect logged-out users to `/login` |
| `/login`, `/signup` | Login and 4-step Onboarding (public only; logged-in users are sent to `/`) |
| `/post/:id` | Post detail + comments |
| `/search?q=` | Full search results |
| `/u/:handle` | Another user's profile |
| `/culture` | Culture page |
| `/discover` (`?category=`, `?tab=communities` scrolls to Communities) | Discover |
| `/activity/:id` | Event/group detail (Manage Applications, Submit Feedback) |
| `/community/:id` | Community page |
| `/chats` (`?c=<convId>&draft=<text>&type=`) | Chats |
| `/personal` (`?feedback=<id>`, `?manage=<id>`, `?tab=requests`) | Personal page (avatar menu → Your profile) |
| `/personal/edit` (`#culture`) | Edit profile |

---

## 5. Data model (SQLite)

| Table | Purpose / notable columns |
|---|---|
| `users` | Profile. List fields are stored as JSON text: `courses, skills, hobbies, interests, clubs, languages_spoken, languages_interested, cultural_interests, foods, festivals, music_art, availability`. `department` holds the short label (`CSE`, `ECE`, `Mechanical`…; see `IITR_DEPARTMENTS`). `last_seen` (online = seen within 5 min) |
| `posts` | `kind` (post / story), `type` (text, image, link, event, project, discussion, poll), `topic`, `story_category`, `images` JSON, `link_url`, `meta` JSON (`title, date, time, location, lookingFor, skills, teamSize, file{url,name,size,type}, poll{options}`), `tags` JSON, `community_id`, `visibility` (public / friends / department), `views` |
| `post_upvotes`, `post_saves` | toggles |
| `comments` | `parent_id` (one reply level; deeper replies are flattened to the top-level comment) |
| `comment_likes`, `poll_votes` | `poll_votes` has PK (post, user), so changing a vote is an upsert |
| `searches` | search history, used as a feed signal and for "recent searches" |
| `friendships` | `status` pending / accepted |
| `blocks`, `reports` | report `target_type`: user, post, comment, activity, community, message |
| `skips` | people skipped in "Step Outside Your Circle" |
| `communities`, `community_members` | `category` Academic / Hobbies / Entertainment / Sports / Culture, `is_cultural`, `emoji`, `color`, `role` admin / member |
| `activities`, `activity_members` | `kind` event / study / project / sports / teach. `type` Hobby / Sports / Study / Cultural / Project. `category` = a Discover category. `is_cultural_exchange`, `status` open / completed; member `status` pending / accepted / rejected |
| `conversations`, `conversation_members`, `messages`, `message_reactions` | `type` dm / group / community. Groups tie to `activity_id`, communities to `community_id`. `last_read_id` drives unread counts and read ticks |
| `feedback` | survey answers. `featured=1` (consented, rating ≥4, comment ≥15 chars) makes it an anonymous testimonial |
| `buddy_prefs` | last Cultural Buddy mode and topic per user |
| `cultures` | Culture of the Week entries. `topics` JSON (Food, Festivals, Music, Language, Traditions…, plus `regions`) |
| `notifications` | `type`, `text`, `link`, `is_read` |

**Migrations:** there is no migration framework. `openDb()` runs `CREATE TABLE IF NOT EXISTS`, then:
- adds `comments.parent_id` if it's missing;
- runs `migrateLegacyEmails()`, which rewrites old-format emails. `x@iit.ac.in` becomes `x@<dept code>.iitr.ac.in`, and `x@cse.iit.ac.in` becomes `x@cse.iitr.ac.in`. It's idempotent and skips any address that would clash.

New columns need a similar `PRAGMA table_info` check there.

---

## 6. Feature status (all done)

### Design system & dark mode (requests 5 and 8)
- **Tokens:** everything lives in `:root` in `styles.css`.
  - Surfaces: `--bg`, `--surface`, `--surface-2/3`, `--border`, `--border-2`.
  - Text: `--text`, `--text-2/3`.
  - Brand: `--primary`, `--primary-soft`, `--primary-ink`, `--grad`, `--grad-navy`.
  - Status: `--success/-soft`, `--warning/-soft`, `--danger/-soft`.
  - Shadows, plus `--display` (the heading font).
  - Theme helpers: `--ink`/`--on-ink` (the strong fill for active chips/tabs/toasts, which inverts in dark), `--glass`, `--glass-strong`, `--topbar-bg`, `--glow-1/2`, `--tint-base`, `--banner-grad`, `--side-grad`, `--fan-grad`, `--chat-bg`, `--primary-soft-2`, `--primary-soft-border`.
- **Rule for new UI:** use these tokens, not literal `#fff` or navy, or dark mode breaks. The only literal colours left are things that stay the same in both themes, such as white tags on colourful posters and white buttons on gradients.
- **Components:**
  - Gradient primary buttons; navy pill tabs and chips.
  - Gradient active sidebar item and a gradient "Step outside your circle" sidebar card.
  - Gradient chat bubbles for your own messages.
  - Profile cover banners on Personal and Profile (avatar overlapping the cover).
  - Softer cards with a hover lift.
- **Dark mode:**
  - `lib/theme.jsx` provides `initTheme`, `useTheme` and `ThemeToggle`. The choice is stored as `cc_theme` in localStorage; with no choice it follows `prefers-color-scheme` live.
  - The inline script in `index.html` sets `<html data-theme>` before first paint, so there's no flash.
  - The toggle (sun/moon) is in the app top bar, the landing nav and the top-right corner of login/signup.
  - A `.theme-anim` class gives a 0.3 s colour transition on toggle only.
  - Dark values are in `:root[data-theme="dark"]` at the end of `styles.css`, and `landing.css` has its own dark block.
- **Responsive:**
  - ≤1080px: rails stack under the main column.
  - ≤820px: the sidebar becomes a 76px icon rail.
  - ≤640px (phones): the sidebar becomes a **bottom tab bar** and the topbar shrinks.
  - Horizontal overflow is tested on every main page at 390px.

### 3D: where it is and isn't
- **Landing hero only:** the WebGL "connection globe" (`lib/heroScene.js`). **The user found the globe repetitive elsewhere, so don't reuse it in the app.**
- **Home:** the WebGL glossy-shapes banner (`Scene3D preset="home"`).
- **Chats:** 3D speech bubbles in the empty state (`preset="chats"`).
- **Discover and Culture: no WebGL.** Their 3D is CSS: poster cards that tilt toward the cursor with emoji parallax and glare, people cards that tilt, and the Culture topic-card fan.
- WebGL scenes pause offscreen or in hidden tabs, respect reduced motion, fall back to CSS blobs without WebGL, and dispose themselves on unmount.

### Landing page (request 4): `/` when logged out
- `pages/Landing.jsx` + `landing.css` (classes prefixed `lp-`), lazy-loaded from `App.jsx`.
- **Hero:** headline "Find your people across every culture" and the formula in the lead text.
  - Create account / Log in buttons, plus a trust row with the live rating and student count.
  - The 3D globe follows the mouse and can be dragged to spin.
  - Glass cards float over it: a match card, an event, a chat bubble and "New friend from Assam".
- **Sections, in order:**
  1. Interest/culture chip marquee.
  2. **Our aim:** the formula as tilt cards.
  3. **Features** bento with mini CSS mock-ups.
  4. **How it works** (3 steps).
  5. **Achievements:** a dark band with count-up stats and "what we've built".
  6. **Reviews:** two auto-scrolling rows that pause on hover.
  7. Final CTA, then the footer.
- **Numbers and reviews are live** from public `GET /api/landing`: student, region, department, community, activity and friendship counts; survey averages; and up to 9 featured anonymous testimonials. It returns no emails, handles or names. If the call fails, the page shows `FALLBACK_REVIEWS` and dashes.
- Copy says "Made for IIT Roorkee students · .iitr.ac.in only".
- **Navigation:** the Login and Signup logos link back to `/`, Login has "Back to home", and **Log out returns to the landing page**.

### Onboarding & auth
- **4 pages**, each validated before moving on:
  1. Name, handle, college email, password, picture. Handle and email availability are checked live via `/auth/check`.
  2. Department, year, courses, skills, and "When are you usually free?" (availability).
  3. Hobbies, academic interests, clubs, bio.
  4. Region, languages spoken, languages to learn, cultural interests, food, festivals, music/movies/art.
- Most option groups have an "Add other…" custom chip.
- Finishing creates the account and redirects to `/login?registered=1&email=…`, per the spec.
- **Email rule: IITR-only.**
  - Addresses must be `name@<dept>.iitr.ac.in` (e.g. `khushi@ece.iitr.ac.in`). Any department subdomain is accepted, and so is bare `iitr.ac.in`.
  - `@iit.ac.in` and look-alikes (`fakeiitr.ac.in`, `iitr.ac.in.evil.com`) are rejected, which is tested.
  - Code: `ALLOWED_EMAIL_SUFFIXES = ['iitr.ac.in']` and `isCollegeEmail` in `constants.js`, mirrored in `client/src/lib/college.js`.
- **Departments:**
  - `IITR_DEPARTMENTS` in `constants.js` lists all **23 IIT Roorkee academic departments** (from iitr.ac.in/Departments) as `{ value, name, codes }`.
  - `value` is the short label shown in the app (CSE, ECE, Electrical, Mechanical, Civil… which match the seed). The signup and Discover dropdowns show full names.
  - `codes` are **guessed** email subdomains; IITR's real codes couldn't be confirmed online. The first code builds seeded and migrated addresses.
  - At signup, `departmentFromEmail()` pre-selects the department when the subdomain matches and shows "Looks like you're in ECE…". It stays editable.
- `/api/meta` returns `options.departments` (labels), `options.departmentInfo` (full objects), `emailSuffix` and `emailSuffixes`.

### Home / Feed
- **Welcome banner** (`WelcomeBanner` in `Home.jsx`):
  - "Good morning/afternoon/evening, <first name> 👋".
  - Quick links: People you'd click with → Discover, Culture of the week → Culture, and "N unread" → Chats when there are unread messages.
  - A **Create Post** button and the 3D shapes scene.
- **Tabs:** sticky navy pill tabs. For You, Trending, Tech, Culture, Politics, Sports, Arts, then More ▾ (Academics, Life@Campus, Events, Memes, Other, Saved posts). The feed is a centred single column (`.feed-col`, max 760px) with no right rail.
- **Post card:**
  - Header: "Dept · Nth Year · time ago".
  - Content: trailing hashtags become pills; file attachment card (red PDF icon); link, event, project and poll blocks; image grid.
  - Actions: heart (= upvote), comment, Share, bookmark.
  - ••• menu: "Why you're seeing this" (recommendation reasons), Copy link, Delete or Block/Report.
- **Create Post:**
  - Types: Text, Image, Link, Event, Project, Discussion, Poll.
  - Paperclip document attachment and an emoji picker.
  - Topic chips (For You = no topic), optional community, Visibility, Post button.
- **Post detail:**
  - "← Back" and the post.
  - "Comments (N)" with a Most Relevant / Newest / Oldest dropdown.
  - Comments with like and Reply (one nested level).
  - ••• menu with delete (author or post owner) and report.
  - A comment bar at the bottom.
- **Reviews & Testimonials:** shown inline after the 3rd post on For You (anonymous survey feedback).
- **Global search** (top bar): live dropdown with People, Communities, Events & groups and Posts, plus recent searches. Enter opens `/search`. Searches are logged as a feed signal.

### Culture page (request 6 layout: "Netflix" style, the old structure made nicer)
- **Culture of the Week billboard:**
  - A full-width banner in the culture's own colour with a large faded emoji watermark.
  - Prev/next arrows, topic pills, and **Explore Culture**, which opens the topics, students from that region and their stories.
  - On the right, an interactive **3D fan of topic cards** (Food, Festivals, Music…). It spreads on hover and leans toward the cursor.
- **Step Outside Your Circle:**
  - "Match based on" chips: Interests, Hobbies, Department, Region, Language.
  - A carousel with a match ring, Connect and Skip. Skips are stored and can be reset.
- **Cultural Buddy:** Learn / Teach / Experience / Connect plus a topic. Find Buddy lists matches, each with a pre-filled DM.
- **Sliding rows** (`Row.jsx`): Cultural Exchange Events (View all → Discover?category=Culture), Teach Me Something (+ Teach something), Cultural Communities.
- **Cultural Stories / Mini Cards:** category filter and Share your story, alongside the Cultural Icebreaker and Your Culture Profile cards.

### Discover (request 6 layout)
- **Search card:** a header with Add Event, the search box, category chips (Study, Projects, Sports, Events, Hobbies, Games, Culture) and a Filters panel.
- **Filters:** Time, Date, Location, Group Size and Level as chips; Department as a **dropdown of the 23 IITR departments** (23 chips were too noisy).
- **Sliding rows of poster cards:**
  1. Recommended For You
  2. People you'd connect with
  3. Study Partner
  4. Study partners for your courses
  5. Project / Team Formation (+ Start a project)
  6. Sports / Activity Groups
  7. Events & Hobbies
  8. General Communities (with a category dropdown)
- When searching or filtering, the rows are replaced by a People row and a "Matching activities" grid.
- **Poster card** (`ActivityCard` / `CommunityTile`):
  - Vivid gradient art with a large emoji, a category tag, and a level or "✓ Joined/Requested" tag.
  - Title and date are always visible.
  - On hover or keyboard focus: the card tilts in 3D, the emoji lifts with parallax, a glare follows the cursor, and a drawer slides up with location, reason, capacity bar, "N spots left" and the Join button.
  - On touch screens the drawer is always open.
- **People card:** gradient band, avatar ring, match % ring, reasons, Connect + Message.
- **Add Event template:** Title, Type, Date, Time, People (capacity), Location, Level, Description, Requirements; plus Course/Department for Study and Looking for/Skills for Project; and Tags.
- **Join rules:** `project` and `study` need organiser approval (Apply to Join / Request to Join). Sports, events and teach sessions are open-join, subject to capacity.
- Creating an activity auto-joins the creator and creates its group chat. Accepted members are added to that chat.

### Personal page (avatar menu → "Your profile")
- **Profile card:** cover banner, Edit Profile, and Friend Requests (accept/decline).
- **Your Connections:** See all modal with View Profile, Message and Remove.
- **Your Communities:** Open / Leave.
- **Your Events / Groups:** counts plus a **Manage Applications** modal (accept / reject / remove).
- **Right column:** Event Applications (Pending / Accepted / Rejected), Upcoming Events, and Completed Events (Submit Feedback or your rating).
- **Edit Profile:** every signup field, plus a blocked-users list with Unblock.

### Profile view (`/u/:handle`)
- Cover banner, info, stats, interests, academics, cultural info, and a match ring with reasons.
- **Actions:** Add Friend / Requested / Accept / Friends→Remove, Message, Block/Report, Unblock.
- **Cultural Icebreaker:** Use Question opens a DM pre-filled with the question; also Skip and Start Chat.
- Posts tab and the person's communities.

### Chats
- **Tabs:** segmented Direct Messages / Communities / Groups. Each list has search, unread badges and the last message.
- **Conversation view:**
  - Day separators and grouped senders.
  - Read ticks in DMs.
  - Reactions and message reporting.
  - Image attachments and an emoji picker.
  - Live typing indicator, in-chat search, and "Load earlier".
- **Empty state:** 3D speech bubbles.
- **Right info panel:**
  - DMs: profile, about, interests, media, shared events/groups, Block/Report.
  - Community and group chats: cover, Leave/Report, about, members, upcoming events, media.
- **Who can message whom:** any two users can DM unless one blocked the other. Event, team and community group chats are created automatically.

### Post-event survey
- Triggered when an activity completes. That happens when its date passes (`completePastActivities`, run on request and hourly) or when the organiser clicks "Mark completed". Participants get a notification that deep-links to the survey.
- **Questions:**
  - Rating 1–5.
  - Yes/no: met someone new, learned something, cultural learning, would join again.
  - Free text.
  - A consent checkbox for appearing as an anonymous testimonial.

### Block / Report
- Available on profiles, posts, comments, groups/activities, communities and messages.
- **Reasons:** Harassment, Spam, Fake Profile, Offensive Content, Inappropriate Behaviour.
- **Blocking** hides each person's profile, posts, comments, DMs and recommendations from the other, and removes any friendship.

---

## 7. Recommendation engine (`server/src/recommend.js`)

All scorers are pure functions returning `{ score: 0..1, reasons: string[] }`. The reasons are shown in the UI.

- **`scorePerson(me, other, { mode, focus })`**
  - **Modes:** `friends | outside | study | cultural`.
  - **Weights** (common / compatible / different): friends .55/.25/.20, outside .45/.15/.40, study .65/.30/.05, cultural .35/.20/.45.
  - **Common:** overlap coefficient over interests, hobbies+clubs, courses/skills and cultural interests.
  - **Compatible:** shared availability, and a shared language.
  - **Different:** department, region (a different *zone* scores higher), and new languages (bonus if it's one you want to learn).
  - **Focus chips:** Interests/Hobbies double those weights. Department/Region/Language triple the matching difference weight *and require* that difference.
  - With zero common ground the score is multiplied by 0.45.
- **`scoreBuddy(me, other, mode, topic, otherPref)`:** topic fit.
  - Learn Language: they speak a language in my `languages_interested`.
  - Connect Regional/National/International: uses the zone from `REGIONS`.
  - A complementary preference (Learn↔Teach) adds +0.5.
  - Final score = 0.65·fit + 0.35·cultural person score.
- **`scoreActivity(me, act, ctx)`:**
  - Relevance of expanded profile tags (the `RELATED` synonym map) to title, tags, skills and course, plus course and skill matches.
  - Bonuses, capped at +0.4: availability slot, cultural exchange, past categories, community tags, friends attending.
- **`scoreCommunity`:** tag relevance, cultural interest, friends who are members.
- **`scorePost(me, post, ctx)`:**
  - Relevance: interests, courses, communities, liked tags, friends, plus **recent searches** (newest 3 +1.0, older +0.4).
  - That is multiplied by recency `exp(-h/72)`, then engagement is added.
  - Your own post is boosted to the top for 1 hour.
- **`trendingScore`:** `(upvotes·3 + comments·2 + views·0.1 + 1) / (hours + 2)^1.3`.
- **Consumers:**
  - `/posts?tab=foryou|trending`
  - `/recommendations` (people, studyPartners, culturalBuddies, teams, events, groups)
  - `/culture/outside` and `/culture/buddy`
  - `/activities?sort=recommended`
  - `/communities`

---

## 8. API reference (all under `/api`; everything except `meta`, `landing` and `auth/*` needs a Bearer token)

```
GET  /meta                         options (incl. departments, departmentInfo), icebreakers, emailSuffix, emailSuffixes
GET  /landing                      PUBLIC: live stats + featured anonymous testimonials (no personal data)
POST /auth/check | /auth/register (multipart: profile JSON + avatar) | /auth/login
GET  /auth/me
PUT  /users/me (multipart: profile JSON + avatar)
GET  /users/me/friends | /users/me/requests | /users/me/blocked
GET  /users/:handle
POST/DELETE /users/:id/friend ; POST /users/:id/friend/accept ; POST/DELETE /users/:id/block
POST /reports {target_type, target_id, reason, details}
GET  /notifications ; POST /notifications/read
GET  /posts ?tab=foryou|trending|saved|<Topic> &page &kind=story &category &community &user=<handle>
POST /posts (multipart: kind,type,content,topic,story_category,visibility,community_id,link_url,meta JSON,tags, images[], file)
GET/DELETE /posts/:id ; POST /posts/:id/upvote | /save | /vote {option}
GET/POST /posts/:id/comments (?sort=relevant|newest|oldest ; body {content, parent_id})
POST /comments/:id/like ; DELETE /comments/:id
GET  /testimonials ; GET /search ?q&type=all|people|posts|communities|activities&log=0 ; GET /search/recent
GET  /communities ?cultural=1&category&joined=1 ; GET /communities/:id ; POST/DELETE /communities/:id/join
GET  /activities ?kind&category&cultural=1&time&date&location&size&level&department&q&sort=recommended (comma lists)
GET/POST /activities(/:id) ; POST/DELETE /activities/:id/apply ; POST /activities/:id/applications/:userId {status}
POST /activities/:id/complete | /feedback ; GET /me/activities → {created, applications, upcoming, past}
GET  /culture/week?offset ; GET /culture/outside?focus=A,B ; POST /culture/skip/:id ; DELETE /culture/skips
GET/POST /culture/buddy {mode, topic} ; GET /culture/icebreakers ; GET /recommendations?mode=
GET  /chats?type=dm|group|community ; GET /chats/unread ; POST /chats/dm/:userId
GET  /chats/:id ; GET/POST /chats/:id/messages (?before ; multipart content + image) ; POST /chats/:id/read
POST /messages/:id/react {emoji}
```

---

## 9. Seed data (`server/src/seed.js`)

- **20 users** with varied departments, regions and languages, including exchange students Aiko (Japan) and Minji (South Korea). **Arjun Mehta** (`arjunm`, `arjunm@cse.iitr.ac.in`) is the demo user: CSE, 3rd year, Rajasthan.
- **24 communities** (15 cultural) and **8 cultures** for Culture of the Week.
- **About 45 activities:** study groups, projects, sports, hobby events, cultural exchange events, Teach Me Something sessions, and 6 past events with survey feedback that becomes testimonials.
- **Arjun's project "AI-based Traffic Detection":** 8 applications (3 accepted, 3 pending, 2 rejected, 1 opening), matching the spec's example.
- **About 36 posts:**
  - An image post, a project post with hashtag pills, and the system-design post with a **real generated PDF** (`uploads/systems-design-notes.pdf`).
  - A poll, a Politics post, a Memes post, and 10 cultural stories.
  - Random upvotes, comments, likes and replies.
- **Chats:** DMs between Arjun and 6 friends (the Riya chat is copied from image1), community chats (Cultural Exchange is copied from image2), and activity group chats.
- **Images:** posts use `picsum.photos/seed/cc-*`, which needs internet; `Img` falls back to a placeholder. Covers are emoji + colour, and avatars fall back to coloured initials.
- `npm run seed` drops and recreates every table **in place** (deleting the file failed with EPERM while a server held it open).

---

## 10. Testing

- **`npm test`: 51 tests, all passing.**
  - `recommend.test.js`: the spec's matching example, focus constraints, study mode, buddy Learn Language / Connect International, activity scoring, the feed search signal.
  - `api.test.js`:
    - Accounts and access: auth; **IITR email rules** (subdomains accepted; `@iit.ac.in` and look-alikes rejected); **demo-email format and the `migrateLegacyEmails` migration**; the **23-department list**; public `/api/landing` (and no personal data leaks); registration with avatar.
    - Content and social: posts and validation, upvotes and notifications, saved, visibility, search, testimonials, friends, block/report.
    - Activities and chat: capacity, the approval flow, filters, completion and survey, community chat membership, DM unread/read/reactions, culture endpoints, recommendations.
  - `feed.test.js`: polls, file attachments (PDF accepted, .exe rejected), threaded comments, likes, sorting, deletion permissions, comment reports, the topic list.
- **Browser walkthroughs** (`tools/`): `playwright-core` with the **installed Chrome**. Headless Edge exits immediately here.
  - Setup: playwright-core 1.49.1 is installed at `%TEMP%\cc-e2e` (`C:/Users/KHUSHI~1/AppData/Local/Temp/cc-e2e`); reinstall with `npm i playwright-core@1.49.1` in any folder if it's gone.
  - Usage: `node tools/<script> <screenshotDir> <playwrightDir> [baseUrl]`.
  - **Run them against a scratch server**, not the user's :4000: `cd server && PORT=4100 DB_PATH=<scratch>.db node src/index.js`.
  - `e2e-walkthrough.mjs` (default :4000; pass `http://localhost:4100`) needs a **fresh DB** because it registers `kavya@ece.iitr.ac.in` and checks that ECE is auto-detected. Its 19 steps cover signup, every page, the Culture rows and fan, Discover rows and poster hover, filters, add event, Manage Applications, survey, chats and mobile overflow on 5 pages.
  - `e2e-feed.mjs` (:4100, 10 steps): tabs, More menu, poll vote, create poll, post detail and replies, mobile.
  - `e2e-landing.mjs` (:4100 or 3rd arg, 9 steps): landing at `/`, WebGL ready, drag-to-spin, live stats and reviews, CTAs, login → feed, logout → landing, deep links → `/login`, tablet and mobile.
  - `e2e-dark.mjs` (:4100 or 3rd arg): follows the OS (light), toggles to dark, persists across reload, every page in dark, poster hover, chat, Create Post modal, toggling back, and mobile overflow.
  - Chrome runs with `--use-angle=swiftshader` so WebGL works headless. It's slow, so the scripts use long timeouts (90 s for screenshots, 45 s for the canvas). A screenshot timeout there is almost always slowness, not a bug.
  - **Last results (request 8):** every step of all four passes with **zero console or page errors**.
- **Bugs found through screenshots and fixed:**
  - Tiny avatars.
  - Your own new post dropping off For You page 1.
  - Mobile overflow (grid children needed `min-width: 0`).
  - Narrow chat bubbles, and a collapsed chat side card.
  - Chats overflowing at 390px.
  - Personal's right column squeezed on phones (an inline grid style replaced by `.with-rail.wide-rail`).
  - The squashed "Use Question" button.
  - A spinner nested inside a `<p>` in `Row`.

---

## 11. Decisions and deviations (tell the user if revisiting)

1. **Sidebar:** Home, Culture, Discover, Chats. **Personal was removed from the left panel at the user's request**; it's under the avatar menu (Your profile / View as others see it / Edit profile / Log out). The newest mockup says "Cultural Calendar" and "Chat"; we kept "Culture" and "Chats".
2. **Home has no right rail** (to match the feed mockup). Testimonials sit inline in the feed. The welcome banner was added in request 5 and the user didn't object.
3. **Recommendation reasons** on feed cards live in the ••• menu ("Why you're seeing this").
4. **Discussion** is kept as a post type alongside **Poll**. **Events** is a topic under "More".
5. **Upvote is shown as a heart** (mockup); the backend still calls it upvote.
6. **Not implemented:** the call/video buttons and "Forgot password" from the mockups (they need calling and email services). They were left out rather than shown as dead buttons.
7. **Availability** was added to signup page 2 because the recommendation spec uses it.
8. **Testimonials** need consent (checked by default), rating ≥4 and a comment of at least 15 characters.
9. **Branding:** "CampusConnect" with the colourful people logo (`client/public/logo.svg`).
10. **Culture and Discover layout:** the request-5 version (tabs + 3D banners) was **rejected by the user**. They wanted the old stacked sections as Netflix-style sliding rows with nicer, interactive cards. Don't reintroduce tabs there.
11. **The 3D globe is landing-only** (the user found it repetitive). In-app 3D is the Home shapes, the Chats bubbles, and CSS 3D cards/fan.
12. **Email rule:** the original spec said `.iit.ac.in`. The user then asked for **IIT Roorkee** addresses (`name@<dept>.iitr.ac.in`) and confirmed **IITR-only**, with demo accounts in that format. Old accounts are migrated automatically. **Department email codes are guesses**; any subdomain is accepted, and an unknown code just doesn't pre-select a department.
13. **Landing stats are live database numbers** (20 students in the seed), not marketing figures. Swap in fixed numbers in `Landing.jsx` if the user wants.
14. **Dark mode** follows the OS until the user toggles. There's no separate "System" option in the UI; clearing `cc_theme` from localStorage returns to following the OS.

---

## 12. Environment gotchas (important for the next session)

- **Shell:** Git Bash on Windows. **Heredocs containing backticks or `${…}` break** ("unexpected EOF"). Write patch scripts as `.cjs` files in the scratchpad with the Write tool and run them with `node`; this worked well all session.
- When generating JS through `node -e`, regex escapes like `\/` and `\.` get lost. Edit regexes with the Edit tool.
- **Port 4000 belongs to the user's own server** (started by them; the PID changes, last seen 23180). Don't kill it. For testing, start your own scratch server on **:4100** with a throwaway `DB_PATH`, and stop it afterwards by PID from `netstat -ano | grep ":4100 .*LISTENING"`. **Never run `taskkill /IM node.exe`**; that was done once early on and killed every Node process on the machine.
- The user runs `npm run dev`. The server uses `node --watch`, so server edits restart it automatically, and Vite hot-reloads the client. If they ever use `npm start`, client changes need `npm run build`.
- `rm` of glob paths after `cd` is blocked by a safety check. Use explicit absolute paths. 5 leftover test images in `server/uploads/` were left for the user to delete.
- npm 12 warns that install scripts are blocked (esbuild's postinstall). Builds still work.
- `vite build` sometimes reports "built in ~2s" because of caching; that's normal.

---

## 13. Possible next steps / ideas (not started)

- **Deployment, needed before real students can use it and chat.** Chat already works between any accounts on the same server, but today it only runs on the user's laptop. Checklist:
  - Run `npm run build && npm start` on a host with a **persistent disk** for `server/data/` (SQLite) and `server/uploads/`, such as a small VM, or Render/Railway with a volume. Not serverless.
  - Set a long random **`JWT_SECRET`** (the default `campus-connect-dev-secret` would let anyone forge logins). Also set `PORT`.
  - Serve over **HTTPS** behind a proxy that passes **WebSockets** through.
  - Start with a fresh database instead of the demo seed, so real students don't see fake people.
  - Add **email verification** (an OTP to the `@<dept>.iitr.ac.in` inbox) before launch. Right now anyone can register with an IITR-looking address they don't own.
  - Optional: restrict CORS (currently `*`), rate-limit `/api/auth/*`, and back up the SQLite file. One Node process with SQLite is fine for a few hundred to a few thousand students.
- Confirm IITR's real email subdomain codes with the user and correct `IITR_DEPARTMENTS[].codes`.
- Password reset by email.
- A "System" option in the theme toggle (light / dark / follow OS).
- Rename the sidebar items to the mockup's labels ("Cultural Calendar", "Chat") if wanted, possibly with a real month-grid Cultural Calendar.
- Admin/moderation dashboard for `reports`, and a curation UI for testimonials (`feedback.featured`).
- Pagination or infinite scroll for chat lists and Discover rows (the feed already paginates, 12 per page).
- Live read-receipt updates in an open DM (currently they refresh on reload).
- Remove the unused `discover` preset from `lib/scene3d.js` if it stays unused.

---

## 14. Session log

1. **Request 1:** built the whole project from the spec and the 7 mockups, unifying their UI and palette: server, client, recommendation engine, seed data, 38 tests, ESLint, a browser walkthrough and the README.
2. **Request 2:** redesigned Home, Create Post and Post Detail to match the sharper feed mockup.
   - Added Poll posts, document attachments, threaded and likeable comments with sorting, comment reports, and the Politics/Memes/Other topics with a More menu.
   - Removed Personal from the sidebar and made reseeding work in place. 47 tests.
3. **Request 3:** wrote this `progress.md` and copied the browser walkthroughs into `tools/`.
4. **Request 4:** added the designer landing page with the three.js globe hero, aim/formula, features bento, how-it-works, live achievements and student reviews, and login/create-account buttons.
   - Added public `GET /api/landing` (48 tests). Logout now lands on the landing page.
5. **Request 5 (main-site redesign):** a new design system matching the landing palette, Plus Jakarta Sans headings, the phone bottom tab bar, and `Scene3D` + `scene3d.js` (Home banner, Chats empty state). Also fixed mobile overflow on Chats and Personal.
   - Culture and Discover temporarily became tabbed pages with 3D banners; the user rejected that in request 6.
6. **Request 6 (user feedback):**
   - Culture and Discover went back to the old structure as **Netflix-style sliding rows** with **interactive 3D poster cards**, people cards, and the Culture **topic-card fan billboard**. The globe is now landing-only.
   - Login/signup moved to IIT Roorkee emails with all 23 departments and department auto-detection. 50 tests.
7. **Request 7:** **IITR-only.** Demo accounts became `<handle>@<dept>.iitr.ac.in` (demo login `arjunm@cse.iitr.ac.in`), `@iit.ac.in` is rejected, and old accounts are migrated on server start. 51 tests.
   - The user asked whether real users can chat. Answer: yes (any two users can DM unless blocked, and groups/communities get chats automatically), but only once the app is deployed somewhere everyone can reach (§13).
8. **Request 8: dark mode.**
   - Theme tokens and a dark block in `styles.css` and `landing.css`.
   - `lib/theme.jsx` and the no-flash inline script in `index.html`.
   - The toggle in the top bar, the landing nav and login/signup.
   - `tools/e2e-dark.mjs` added. All four walkthroughs pass with zero console errors.
9. **Request 9:** rewrote this file so every section matches the current state.
