# Ijwi — Backlog

Status legend: **[✓]** shipped this session · **[ ]** not built · **[~]** partial / scaffolded only.

Order within a section ≈ leverage, not effort.

---

## 1. Shipped (2026-06-07 session)
- [✓] Real Supabase env wired + Google sign-in tested end-to-end
- [✓] Mobile bottom nav (Today / Dash / Tests / Survey · Day/Night · Out)
- [✓] Session detail drawer (audio playback + transcript + talk-time bar)
- [✓] Questionnaire form (q1–q10, 1–5 scale, anxiety items tagged)
- [✓] Facilitator "Today" card (session #, progress, silent count, recent activity)
- [✓] Cohort comparison chart (Base vs Foundation, solid + hatched bars)
- [✓] Roster search + cohort tabs + silent-only toggle + CSV export
- [✓] Day / Night theme toggle (localStorage-persisted, no FOUC)
- [✓] Monochrome rectangles design system (Vision UI dark → B&W brutalist)

---

## 2. Operations & seeding
*The boring things that block a real pilot.*

- [ ] **CSV student seeding** — pre-create rows so the dashboard isn't empty on Day 1
- [ ] **"Today's session #" + topic setter** — facilitator-editable, stored in a `pilot_config` table
- [ ] **Promote / demote facilitator button** in student detail
- [ ] **24-day session calendar grid** — visual of who's done #N
- [ ] **Attendance check-in** — "who's in the lab today" so "X / Y done today" is real
- [ ] **Annotations / notes** on student detail ("she was sick all week")
- [ ] **Flagged students inbox** — silent / low-talk students as a queue
- [ ] **Cohort-wide kill switch** — pause all sessions if something goes sideways

## 3. Engagement (for students)
*Pilot retention is the silent killer.*

- [ ] **Streak counter + day badges** on portal
- [ ] **"What the tutor remembers about you"** preview on portal (Mem0 read)
- [ ] **Pre-session warm-up** (one-line text) + **post-session reflection** (self-rating)
- [ ] **Multi-language UI** — Kinyarwanda / English / French toggle
- [ ] **30-second daily voice diary** — separate from sessions; agent never replies
- [ ] **Time machine** — Day 1 vs today self-comparison
- [ ] **Graduation screen at Day 24** + auto-generated portrait + best clip

## 4. Insight & research
- [ ] **Talk-time sparkline per student** (on each roster row)
- [ ] **Per-student talk-time waterfall** across 24 sessions
- [ ] **Topic-engagement chart** — which prompts produce longest talk-time
- [ ] **Live Mem0 memory inspector** in student detail
- [ ] **Transcript search across cohort** ("find anyone who mentioned politics")
- [ ] **Weekly auto-portrait per student** — Mem0 → 3-line summary
- [ ] **"This week, in your voice"** — agent writes a 3-line essay *as* the student
- [ ] **Failure log** — `pilot_failures` table → input for the methods paper

## 5. AI-native (uses Mem0 + transcripts you already have)
- [ ] **Auto-rubric CEFR scoring** via Claude on each transcript
- [ ] **Coach suggestions for facilitator** — "push Eric on X tomorrow"
- [ ] **Adaptive prompt difficulty** — ease off if silent 30s, escalate if crushing it

## 6. Voice analytics
- [ ] **WPM / pause-ratio / filler-word counters** over time
- [ ] **Pronunciation heatmap** — phonemes the student struggles with → feeds IXL

## 7. Cultural fit (Rwanda-specific)
- [ ] **Mother-tongue scaffolding** — student can say a word in Kinyarwanda mid-sentence
- [ ] **Local-context prompts** — umuganda, ubudehe, gacaca in the 24-session arc

## 8. Parent / community loop
- [ ] **Weekly parent SMS** with a consented clip
- [ ] **Public opt-in audio showcase wall** (Day 1 vs Day 24)

## 9. Safety / compliance
- [ ] **Distress / safety filter** on transcripts → escalation flow
- [ ] **Recording retention countdown** per recording (consent compliance)
- [ ] **Audit log** — who viewed which student's transcript

## 10. Distribution / board
- [ ] **Public anonymized board view** — read-only URL for funders / ministry
- [ ] **Print-friendly weekly digest** — B/W aesthetic prints cleanly
- [ ] **Daily facilitator email digest** — cron Edge Function → Resend

## 11. Hardware / lab ops
- [ ] **Mic check + silence baseline** before first session
- [ ] **Bandwidth probe** — warn before a call if MTN is too slow

## 12. Production-readiness
- [ ] **Vercel deploy** + Supabase Site URL + Google OAuth allowlist
- [ ] **`ELEVENLABS_WEBHOOK_SECRET` wired** — signature verification on the post-call webhook
- [ ] **ElevenLabs paid tier** — lifts the 10k-char cap, unlocks MCP

## 13. Wow / demo (for funder visits)
- [ ] **Live cohort radio** — anonymized concurrent sessions stream in the corner
- [ ] **Voice fingerprint identity card** — each student's spectrogram printed as their ID

---

## Strategic notes (read before queuing anything above)

- **The next thing to do is run it.** Two real students for one real week will reorder this whole list.
- **Lock the surface for the duration of the pilot.** Every mid-pilot change risks contaminating your data.
- **Pick 3 hard "did it work" metrics before Day 1.** Everything else is decoration.
- **Highest leverage on the pilot itself:** auto-rubric CEFR scoring (continuous signal instead of pre/post bookends).
- **Highest leverage on the next pitch:** opt-in audio showcase wall (audio is more persuasive than KPIs).
- **Actual Day-1 blocker:** CSV student seeding.
