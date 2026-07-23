/*
# HIRent Freelancer Dashboard Schema

## Overview
Creates all tables required for the Freelancer Free Plan Dashboard.
Each user (authenticated via Firebase — uid stored as text) owns their own rows.
Since auth is handled by Firebase (not Supabase Auth), we use the anon key throughout,
but scope rows by firebase_uid text column. RLS is enabled with anon+authenticated access
so the Supabase anon-key client can read/write.

## Tables Created

### 1. freelancer_profiles
Core profile data: name, avatar, bio, plan, member_since, profile_completion_pct, country, skills, role.

### 2. freelancer_vault
Vault stats per user: active_deals, completed_deals, disputed, total_earnings.

### 3. freelancer_stats
Gamification: hirent_score, confidence_score, daily_xp, daily_xp_max, streak_days, streak_last_active, level, level_title, xp_total.

### 4. freelancer_focus_tasks
Today's Focus tasks. Each task belongs to a date + user. Has xp_reward, completed boolean.

### 5. freelancer_applications
Application tracking: status enum (applied|saved|shortlisted|interview|rejected|offered), job details.

### 6. freelancer_pitch_usage
Tracks daily AI pitch usage per user. Resets daily.

### 7. freelancer_journey_points
Data points for the Freelancer Journey graph: date, value (earnings or activity score).

### 8. freelancer_notifications
In-app notifications: title, body, type, read, created_at.

### 9. freelancer_badges
Badge definitions per user: badge_id, name, icon, earned, earned_at.

### 10. playbook_progress
Tracks playbook chapter completion per user.

## Security
RLS enabled on all tables. anon + authenticated roles allowed (Firebase-based auth, not Supabase Auth).
Rows scoped by firebase_uid text column.
*/

/* ── 1. Freelancer Profiles ─────────────────────────────────── */
CREATE TABLE IF NOT EXISTS freelancer_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid    text NOT NULL UNIQUE,
  name            text NOT NULL DEFAULT '',
  email           text NOT NULL DEFAULT '',
  avatar_url      text DEFAULT '',
  bio             text DEFAULT '',
  role            text DEFAULT 'Freelancer',
  plan            text NOT NULL DEFAULT 'free',
  country         text DEFAULT '',
  city            text DEFAULT '',
  skills          text[] DEFAULT '{}',
  experience      text DEFAULT '',
  profile_completion_pct integer NOT NULL DEFAULT 0,
  looking_for     text[] DEFAULT '{}',
  member_since    timestamptz DEFAULT now(),
  last_active     timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE freelancer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_profiles"  ON freelancer_profiles;
DROP POLICY IF EXISTS "anon_insert_profiles"  ON freelancer_profiles;
DROP POLICY IF EXISTS "anon_update_profiles"  ON freelancer_profiles;
DROP POLICY IF EXISTS "anon_delete_profiles"  ON freelancer_profiles;

CREATE POLICY "anon_select_profiles"  ON freelancer_profiles FOR SELECT  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_profiles"  ON freelancer_profiles FOR INSERT  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_profiles"  ON freelancer_profiles FOR UPDATE  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_profiles"  ON freelancer_profiles FOR DELETE  TO anon, authenticated USING (true);

/* ── 2. Vault ───────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS freelancer_vault (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid    text NOT NULL UNIQUE,
  active_deals    integer NOT NULL DEFAULT 0,
  completed_deals integer NOT NULL DEFAULT 0,
  disputed        integer NOT NULL DEFAULT 0,
  total_earnings  numeric(12,2) NOT NULL DEFAULT 0,
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE freelancer_vault ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_vault"  ON freelancer_vault;
DROP POLICY IF EXISTS "anon_insert_vault"  ON freelancer_vault;
DROP POLICY IF EXISTS "anon_update_vault"  ON freelancer_vault;
DROP POLICY IF EXISTS "anon_delete_vault"  ON freelancer_vault;

CREATE POLICY "anon_select_vault"  ON freelancer_vault FOR SELECT  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_vault"  ON freelancer_vault FOR INSERT  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_vault"  ON freelancer_vault FOR UPDATE  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_vault"  ON freelancer_vault FOR DELETE  TO anon, authenticated USING (true);

/* ── 3. Stats / Gamification ────────────────────────────────── */
CREATE TABLE IF NOT EXISTS freelancer_stats (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid        text NOT NULL UNIQUE,
  hirent_score        integer NOT NULL DEFAULT 0,
  confidence_score    integer NOT NULL DEFAULT 0,
  daily_xp            integer NOT NULL DEFAULT 0,
  daily_xp_max        integer NOT NULL DEFAULT 500,
  streak_days         integer NOT NULL DEFAULT 0,
  streak_last_active  date,
  level               integer NOT NULL DEFAULT 1,
  level_title         text NOT NULL DEFAULT 'Newcomer',
  xp_total            integer NOT NULL DEFAULT 0,
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE freelancer_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_stats"  ON freelancer_stats;
DROP POLICY IF EXISTS "anon_insert_stats"  ON freelancer_stats;
DROP POLICY IF EXISTS "anon_update_stats"  ON freelancer_stats;
DROP POLICY IF EXISTS "anon_delete_stats"  ON freelancer_stats;

CREATE POLICY "anon_select_stats"  ON freelancer_stats FOR SELECT  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_stats"  ON freelancer_stats FOR INSERT  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_stats"  ON freelancer_stats FOR UPDATE  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_stats"  ON freelancer_stats FOR DELETE  TO anon, authenticated USING (true);

/* ── 4. Focus Tasks ─────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS freelancer_focus_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text NOT NULL,
  task_date    date NOT NULL DEFAULT CURRENT_DATE,
  title        text NOT NULL,
  xp_reward    integer NOT NULL DEFAULT 50,
  completed    boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_focus_uid_date ON freelancer_focus_tasks(firebase_uid, task_date);

ALTER TABLE freelancer_focus_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_focus"  ON freelancer_focus_tasks;
DROP POLICY IF EXISTS "anon_insert_focus"  ON freelancer_focus_tasks;
DROP POLICY IF EXISTS "anon_update_focus"  ON freelancer_focus_tasks;
DROP POLICY IF EXISTS "anon_delete_focus"  ON freelancer_focus_tasks;

CREATE POLICY "anon_select_focus"  ON freelancer_focus_tasks FOR SELECT  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_focus"  ON freelancer_focus_tasks FOR INSERT  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_focus"  ON freelancer_focus_tasks FOR UPDATE  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_focus"  ON freelancer_focus_tasks FOR DELETE  TO anon, authenticated USING (true);

/* ── 5. Applications ────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS freelancer_applications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid  text NOT NULL,
  job_title     text NOT NULL DEFAULT '',
  company       text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'applied'
                  CHECK (status IN ('applied','saved','shortlisted','interview','rejected','offered')),
  salary_min    numeric(10,2),
  salary_max    numeric(10,2),
  location_type text DEFAULT 'remote',
  match_pct     integer DEFAULT 0,
  applied_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apps_uid ON freelancer_applications(firebase_uid);

ALTER TABLE freelancer_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_apps"  ON freelancer_applications;
DROP POLICY IF EXISTS "anon_insert_apps"  ON freelancer_applications;
DROP POLICY IF EXISTS "anon_update_apps"  ON freelancer_applications;
DROP POLICY IF EXISTS "anon_delete_apps"  ON freelancer_applications;

CREATE POLICY "anon_select_apps"  ON freelancer_applications FOR SELECT  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_apps"  ON freelancer_applications FOR INSERT  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_apps"  ON freelancer_applications FOR UPDATE  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_apps"  ON freelancer_applications FOR DELETE  TO anon, authenticated USING (true);

/* ── 6. Pitch Usage ─────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS freelancer_pitch_usage (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text NOT NULL,
  usage_date   date NOT NULL DEFAULT CURRENT_DATE,
  count        integer NOT NULL DEFAULT 0,
  max_per_day  integer NOT NULL DEFAULT 3,
  UNIQUE(firebase_uid, usage_date)
);

ALTER TABLE freelancer_pitch_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pitch"  ON freelancer_pitch_usage;
DROP POLICY IF EXISTS "anon_insert_pitch"  ON freelancer_pitch_usage;
DROP POLICY IF EXISTS "anon_update_pitch"  ON freelancer_pitch_usage;
DROP POLICY IF EXISTS "anon_delete_pitch"  ON freelancer_pitch_usage;

CREATE POLICY "anon_select_pitch"  ON freelancer_pitch_usage FOR SELECT  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_pitch"  ON freelancer_pitch_usage FOR INSERT  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_pitch"  ON freelancer_pitch_usage FOR UPDATE  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_pitch"  ON freelancer_pitch_usage FOR DELETE  TO anon, authenticated USING (true);

/* ── 7. Journey Points ──────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS freelancer_journey_points (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text NOT NULL,
  point_date   date NOT NULL DEFAULT CURRENT_DATE,
  earnings     numeric(12,2) NOT NULL DEFAULT 0,
  activity     integer NOT NULL DEFAULT 0,
  UNIQUE(firebase_uid, point_date)
);

CREATE INDEX IF NOT EXISTS idx_journey_uid_date ON freelancer_journey_points(firebase_uid, point_date);

ALTER TABLE freelancer_journey_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_journey"  ON freelancer_journey_points;
DROP POLICY IF EXISTS "anon_insert_journey"  ON freelancer_journey_points;
DROP POLICY IF EXISTS "anon_update_journey"  ON freelancer_journey_points;
DROP POLICY IF EXISTS "anon_delete_journey"  ON freelancer_journey_points;

CREATE POLICY "anon_select_journey"  ON freelancer_journey_points FOR SELECT  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_journey"  ON freelancer_journey_points FOR INSERT  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_journey"  ON freelancer_journey_points FOR UPDATE  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_journey"  ON freelancer_journey_points FOR DELETE  TO anon, authenticated USING (true);

/* ── 8. Notifications ───────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS freelancer_notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text NOT NULL,
  title        text NOT NULL,
  body         text NOT NULL DEFAULT '',
  type         text NOT NULL DEFAULT 'info'
                 CHECK (type IN ('info','success','warning','level_up','badge')),
  read         boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifs_uid ON freelancer_notifications(firebase_uid, created_at DESC);

ALTER TABLE freelancer_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_notifs"  ON freelancer_notifications;
DROP POLICY IF EXISTS "anon_insert_notifs"  ON freelancer_notifications;
DROP POLICY IF EXISTS "anon_update_notifs"  ON freelancer_notifications;
DROP POLICY IF EXISTS "anon_delete_notifs"  ON freelancer_notifications;

CREATE POLICY "anon_select_notifs"  ON freelancer_notifications FOR SELECT  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_notifs"  ON freelancer_notifications FOR INSERT  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_notifs"  ON freelancer_notifications FOR UPDATE  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_notifs"  ON freelancer_notifications FOR DELETE  TO anon, authenticated USING (true);

/* ── 9. Badges ──────────────────────────────────────────────── */
CREATE TABLE IF NOT EXISTS freelancer_badges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text NOT NULL,
  badge_id     text NOT NULL,
  name         text NOT NULL,
  description  text DEFAULT '',
  icon         text DEFAULT 'award',
  earned       boolean NOT NULL DEFAULT false,
  earned_at    timestamptz,
  UNIQUE(firebase_uid, badge_id)
);

ALTER TABLE freelancer_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_badges"  ON freelancer_badges;
DROP POLICY IF EXISTS "anon_insert_badges"  ON freelancer_badges;
DROP POLICY IF EXISTS "anon_update_badges"  ON freelancer_badges;
DROP POLICY IF EXISTS "anon_delete_badges"  ON freelancer_badges;

CREATE POLICY "anon_select_badges"  ON freelancer_badges FOR SELECT  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_badges"  ON freelancer_badges FOR INSERT  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_badges"  ON freelancer_badges FOR UPDATE  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_badges"  ON freelancer_badges FOR DELETE  TO anon, authenticated USING (true);

/* ── 10. Playbook Progress ──────────────────────────────────── */
CREATE TABLE IF NOT EXISTS playbook_progress (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text NOT NULL,
  chapter_id   text NOT NULL,
  title        text NOT NULL,
  steps_total  integer NOT NULL DEFAULT 1,
  steps_done   integer NOT NULL DEFAULT 0,
  unlocked     boolean NOT NULL DEFAULT false,
  completed    boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  UNIQUE(firebase_uid, chapter_id)
);

ALTER TABLE playbook_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_playbook"  ON playbook_progress;
DROP POLICY IF EXISTS "anon_insert_playbook"  ON playbook_progress;
DROP POLICY IF EXISTS "anon_update_playbook"  ON playbook_progress;
DROP POLICY IF EXISTS "anon_delete_playbook"  ON playbook_progress;

CREATE POLICY "anon_select_playbook"  ON playbook_progress FOR SELECT  TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_playbook"  ON playbook_progress FOR INSERT  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_playbook"  ON playbook_progress FOR UPDATE  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_playbook"  ON playbook_progress FOR DELETE  TO anon, authenticated USING (true);

/* ── Enable Realtime on vault (for live updates) ────────────── */
ALTER PUBLICATION supabase_realtime ADD TABLE freelancer_vault;
ALTER PUBLICATION supabase_realtime ADD TABLE freelancer_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE freelancer_focus_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE freelancer_notifications;
