/**
 * dashboard.js — HIRENT Freelancer Dashboard Logic
 *
 * Handles: auth check, data loading, live updates via Supabase Realtime,
 * pull-to-refresh, banner carousel, search rotation, drawer, logout,
 * focus tasks, journey graph, all card interactions.
 */

import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { supabase } from './supabase.js';

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
let currentUser   = null;
let bannerTimer    = null;
let bannerPaused   = false;
let currentBanner  = 0;
let journeyChart   = null;
let searchInterval = null;
let searchIndex    = 0;

const SEARCH_PLACEHOLDERS = [
  'Search freelancers...',
  'Search jobs...',
  'Search clients...',
  'Search agencies...',
  'Search startups...',
  'Search projects...',
];

const BANNER_COUNT = 5;

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
function init() {
  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.replace('login.html');
      return;
    }
    currentUser = user;
    await ensureUserData(user);
    loadAllData();
    setupRealtime();
    setupUI();
    refreshIcons();
  });
}

/* ═══════════════════════════════════════════════════════════════
   ENSURE USER DATA EXISTS IN SUPABASE
   Called on first dashboard load — creates rows if missing.
   ═══════════════════════════════════════════════════════════════ */
async function ensureUserData(user) {
  const uid = user.uid;
  const name = user.displayName || '';
  const email = user.email || '';
  const avatar = user.photoURL || '';

  /* Profile */
  const { data: profile } = await supabase.from('freelancer_profiles').select('id').eq('firebase_uid', uid).maybeSingle();
  if (!profile) {
    await supabase.from('freelancer_profiles').insert({
      firebase_uid: uid, name, email, avatar_url: avatar,
      role: 'Freelancer', profile_completion_pct: avatar ? 25 : 10,
    });
  } else if (avatar && !profile.avatar_url) {
    await supabase.from('freelancer_profiles').update({ avatar_url: avatar }).eq('firebase_uid', uid);
  }

  /* Vault */
  const { data: vault } = await supabase.from('freelancer_vault').select('id').eq('firebase_uid', uid).maybeSingle();
  if (!vault) {
    await supabase.from('freelancer_vault').insert({ firebase_uid: uid });
  }

  /* Stats */
  const { data: stats } = await supabase.from('freelancer_stats').select('id').eq('firebase_uid', uid).maybeSingle();
  if (!stats) {
    await supabase.from('freelancer_stats').insert({ firebase_uid: uid, streak_last_active: null });
  }

  /* Pitch usage today */
  await ensurePitchUsage(uid);

  /* Focus tasks today */
  await ensureFocusTasks(uid);

  /* Playbook chapters */
  await ensurePlaybook(uid);

  /* Badges */
  await ensureBadges(uid);

  /* Update last_active */
  await supabase.from('freelancer_profiles').update({ last_active: new Date().toISOString() }).eq('firebase_uid', uid);

  /* Streak logic */
  await updateStreak(uid);
}

async function ensurePitchUsage(uid) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase.from('freelancer_pitch_usage').select('id').eq('firebase_uid', uid).eq('usage_date', today).maybeSingle();
  if (!data) {
    await supabase.from('freelancer_pitch_usage').insert({ firebase_uid: uid, usage_date: today, count: 0 });
  }
}

async function ensureFocusTasks(uid) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase.from('freelancer_focus_tasks').select('id').eq('firebase_uid', uid).eq('task_date', today);
  if (!data || data.length === 0) {
    const tasks = [
      { firebase_uid: uid, task_date: today, title: 'Complete your profile', xp_reward: 50 },
      { firebase_uid: uid, task_date: today, title: 'Apply to 3 jobs', xp_reward: 100 },
      { firebase_uid: uid, task_date: today, title: 'Generate an AI pitch', xp_reward: 75 },
    ];
    await supabase.from('freelancer_focus_tasks').insert(tasks);
  }
}

async function ensurePlaybook(uid) {
  const { data } = await supabase.from('playbook_progress').select('id').eq('firebase_uid', uid);
  if (!data || data.length === 0) {
    const chapters = [
      { firebase_uid: uid, chapter_id: 'ch1', title: 'Set Up Your Profile', steps_total: 3, steps_done: 0, unlocked: true },
      { firebase_uid: uid, chapter_id: 'ch2', title: 'Land Your First Job', steps_total: 5, steps_done: 0, unlocked: false },
      { firebase_uid: uid, chapter_id: 'ch3', title: 'Build Your Portfolio', steps_total: 4, steps_done: 0, unlocked: false },
      { firebase_uid: uid, chapter_id: 'ch4', title: 'Master Client Communication', steps_total: 6, steps_done: 0, unlocked: false },
    ];
    await supabase.from('playbook_progress').insert(chapters);
  }
}

async function ensureBadges(uid) {
  const { data } = await supabase.from('freelancer_badges').select('id').eq('firebase_uid', uid);
  if (!data || data.length === 0) {
    const badges = [
      { firebase_uid: uid, badge_id: 'first_steps', name: 'First Steps', icon: 'footprints', earned: false },
      { firebase_uid: uid, badge_id: 'profile_pro', name: 'Profile Pro', icon: 'user-check', earned: false },
      { firebase_uid: uid, badge_id: 'streak_7', name: '7-Day Streak', icon: 'flame', earned: false },
      { firebase_uid: uid, badge_id: 'first_job', name: 'First Job', icon: 'briefcase', earned: false },
      { firebase_uid: uid, badge_id: 'pitch_master', name: 'Pitch Master', icon: 'sparkles', earned: false },
    ];
    await supabase.from('freelancer_badges').insert(badges);
  }
}

async function updateStreak(uid) {
  const { data: stats } = await supabase.from('freelancer_stats').select('streak_days, streak_last_active').eq('firebase_uid', uid).maybeSingle();
  if (!stats) return;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const lastActive = stats.streak_last_active;

  if (lastActive === todayStr) return; /* Already counted today */

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newStreak = 1;
  if (lastActive === yesterdayStr) {
    newStreak = (stats.streak_days || 0) + 1;
  }

  await supabase.from('freelancer_stats').update({
    streak_days: newStreak,
    streak_last_active: todayStr,
  }).eq('firebase_uid', uid);

  /* Level-up notification */
  checkLevelUp(uid, newStreak);
}

async function checkLevelUp(uid, streak) {
  const newLevel = Math.floor(streak / 3) + 1;
  const { data: stats } = await supabase.from('freelancer_stats').select('level').eq('firebase_uid', uid).maybeSingle();
  if (stats && newLevel > stats.level) {
    await supabase.from('freelancer_stats').update({
      level: newLevel,
      level_title: getLevelTitle(newLevel),
    }).eq('firebase_uid', uid);

    await supabase.from('freelancer_notifications').insert({
      firebase_uid: uid,
      title: `Level ${newLevel} Unlocked!`,
      body: `You've reached Level ${newLevel} — ${getLevelTitle(newLevel)}. Keep it up!`,
      type: 'level_up',
    });
  }
}

function getLevelTitle(level) {
  const titles = { 1: 'Newcomer', 2: 'Beginner', 3: 'Rising Star', 4: 'Pro', 5: 'Expert', 6: 'Master', 7: 'Legend' };
  return titles[level] || `Level ${level}`;
}

/* ═══════════════════════════════════════════════════════════════
   DATA LOADING
   ═══════════════════════════════════════════════════════════════ */
async function loadAllData() {
  if (!currentUser) return;
  const uid = currentUser.uid;

  await Promise.all([
    loadProfile(uid),
    loadVault(uid),
    loadStats(uid),
    loadFocusTasks(uid),
    loadApplications(uid),
    loadPitchUsage(uid),
    loadOpportunities(uid),
    loadPlaybook(uid),
    loadBadges(uid),
    loadJourney(uid, 'week'),
    loadNotifications(uid),
  ]);

  /* Trigger fade-up animations after data loads */
  observeFadeUps();
}

async function loadProfile(uid) {
  const { data } = await supabase.from('freelancer_profiles').select('*').eq('firebase_uid', uid).maybeSingle();
  if (!data) return;

  /* Avatar */
  const avatarImg = document.getElementById('headerAvatar');
  const avatarFallback = document.getElementById('avatarFallback');
  if (data.avatar_url) {
    avatarImg.src = data.avatar_url;
    avatarImg.alt = data.name || 'Profile';
    avatarImg.classList.add('loaded');
    avatarFallback.style.display = 'none';
  } else {
    avatarFallback.textContent = (data.name || 'U').charAt(0).toUpperCase();
  }

  /* Profile completion ring */
  const pct = data.profile_completion_pct || 0;
  document.getElementById('pcPct').textContent = pct + '%';
  const ring = document.getElementById('pcRingCircle');
  const circumference = 2 * Math.PI * 42;
  ring.style.strokeDashoffset = circumference - (circumference * pct / 100);

  /* Member since / last active */
  const memberSince = data.member_since ? new Date(data.member_since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';
  document.getElementById('memberSince').textContent = memberSince;
  const lastActive = data.last_active ? formatLastActive(data.last_active) : '—';
  document.getElementById('lastActive').textContent = lastActive;
}

async function loadVault(uid) {
  const { data } = await supabase.from('freelancer_vault').select('*').eq('firebase_uid', uid).maybeSingle();
  if (!data) return;
  animateNumber('vaultActive', data.active_deals || 0);
  animateNumber('vaultCompleted', data.completed_deals || 0);
  animateNumber('vaultDisputed', data.disputed || 0);
  document.getElementById('vaultEarnings').textContent = '$' + (data.total_earnings || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

async function loadStats(uid) {
  const { data } = await supabase.from('freelancer_stats').select('*').eq('firebase_uid', uid).maybeSingle();
  if (!data) return;

  animateNumber('hirentScore', data.hirent_score || 0);
  animateNumber('confidenceScore', data.confidence_score || 0);

  /* Daily XP ring */
  const xp = data.daily_xp || 0;
  const xpMax = data.daily_xp_max || 500;
  document.getElementById('xpNum').textContent = xp;
  const xpRing = document.getElementById('xpRingCircle');
  const xpCirc = 2 * Math.PI * 52;
  xpRing.style.strokeDashoffset = xpCirc - (xpCirc * Math.min(xp / xpMax, 1));

  /* Streak */
  animateNumber('streakNum', data.streak_days || 0);

  /* Level */
  document.getElementById('levelBadge').textContent = 'L' + (data.level || 1);
  document.getElementById('levelTitle').textContent = data.level_title || getLevelTitle(data.level || 1);
}

async function loadFocusTasks(uid) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase.from('freelancer_focus_tasks').select('*').eq('firebase_uid', uid).eq('task_date', today).order('created_at', { ascending: true });
  const container = document.getElementById('focusTasks');
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = '<p class="focus-xp-text">No tasks for today. Check back tomorrow!</p>';
    return;
  }

  document.getElementById('focusDate').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  container.innerHTML = data.map(task => `
    <div class="focus-task ${task.completed ? 'done' : ''}" data-id="${task.id}">
      <div class="focus-check"><i data-lucide="check"></i></div>
      <div class="focus-task-body">
        <p class="focus-task-title">${task.title}</p>
        <p class="focus-task-xp">+${task.xp_reward} XP</p>
      </div>
    </div>
  `).join('');

  /* Attach click handlers */
  container.querySelectorAll('.focus-task').forEach(el => {
    el.addEventListener('click', () => toggleFocusTask(el.dataset.id, uid));
  });

  updateFocusXpBar(data);
  refreshIcons();
}

function updateFocusXpBar(tasks) {
  const totalXp = tasks.reduce((sum, t) => sum + t.xp_reward, 0);
  const earnedXp = tasks.filter(t => t.completed).reduce((sum, t) => sum + t.xp_reward, 0);
  const pct = totalXp > 0 ? (earnedXp / totalXp) * 100 : 0;
  document.getElementById('focusXpFill').style.width = pct + '%';
  document.getElementById('focusXpText').textContent = `${earnedXp} / ${totalXp} XP today`;

  /* Update daily XP in stats table */
  if (currentUser) {
    supabase.from('freelancer_stats').update({ daily_xp: earnedXp }).eq('firebase_uid', currentUser.uid).then();
  }
}

async function toggleFocusTask(taskId, uid) {
  const { data } = await supabase.from('freelancer_focus_tasks').select('completed').eq('id', taskId).maybeSingle();
  if (!data) return;

  const newCompleted = !data.completed;
  await supabase.from('freelancer_focus_tasks').update({
    completed: newCompleted,
    completed_at: newCompleted ? new Date().toISOString() : null,
  }).eq('id', taskId);

  /* Reload focus tasks to update UI */
  loadFocusTasks(uid);
}

async function loadApplications(uid) {
  const { data } = await supabase.from('freelancer_applications').select('status').eq('firebase_uid', uid);
  if (!data) return;

  const counts = { applied: 0, saved: 0, shortlisted: 0, interview: 0, rejected: 0, offered: 0 };
  data.forEach(app => { if (counts[app.status] !== undefined) counts[app.status]++; });

  animateNumber('appApplied', counts.applied);
  animateNumber('appSaved', counts.saved);
  animateNumber('appShortlisted', counts.shortlisted);
  animateNumber('appInterview', counts.interview);
  animateNumber('appRejected', counts.rejected);
  animateNumber('appOffered', counts.offered);
}

async function loadPitchUsage(uid) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase.from('freelancer_pitch_usage').select('*').eq('firebase_uid', uid).eq('usage_date', today).maybeSingle();
  const remaining = data ? (data.max_per_day - data.count) : 3;
  document.getElementById('pitchRemaining').textContent = `${remaining} pitch${remaining !== 1 ? 'es' : ''} left today`;
}

async function loadOpportunities(uid) {
  /* Get user's skills & role for matching */
  const { data: profile } = await supabase.from('freelancer_profiles').select('skills, role, country').eq('firebase_uid', uid).maybeSingle();

  /* For demo: show 3 sample AI-recommended jobs.
     In production, this would query a jobs table with AI matching. */
  const jobs = [
    { title: 'Senior React Developer', company: 'TechFlow Inc', color: '#31D7A9', match: 95 },
    { title: 'UI/UX Designer', company: 'DesignHub', color: '#8B5CF6', match: 88 },
    { title: 'Full-Stack Engineer', company: 'LaunchPad Labs', color: '#0EA5E9', match: 82 },
  ];

  const container = document.getElementById('oppList');
  container.innerHTML = jobs.map(job => `
    <div class="opp-item" data-href="explore.html">
      <div class="opp-logo" style="background:${job.color}">${job.company.charAt(0)}</div>
      <div class="opp-body">
        <p class="opp-title">${job.title}</p>
        <p class="opp-company">${job.company}</p>
      </div>
      <span class="opp-match">${job.match}% match</span>
    </div>
  `).join('');

  /* Attach click handlers */
  container.querySelectorAll('.opp-item').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.href));
  });
}

async function loadPlaybook(uid) {
  const { data } = await supabase.from('playbook_progress').select('*').eq('firebase_uid', uid).order('chapter_id', { ascending: true });
  const container = document.getElementById('playbookChapters');
  if (!container || !data) return;

  const completed = data.filter(c => c.completed).length;
  document.getElementById('playbookProgressText').textContent = `${completed} / ${data.length}`;

  container.innerHTML = data.map(ch => {
    const pct = ch.steps_total > 0 ? (ch.steps_done / ch.steps_total) * 100 : 0;
    const icon = ch.completed ? 'check' : (ch.unlocked ? 'play' : 'lock');
    return `
      <div class="playbook-chapter ${ch.completed ? 'done' : ''} ${!ch.unlocked ? 'locked' : ''}" data-id="${ch.id}" data-href="playbook.html">
        <div class="playbook-chapter-icon"><i data-lucide="${icon}"></i></div>
        <div class="playbook-chapter-body">
          <p class="playbook-chapter-title">${ch.title}</p>
          <div class="playbook-chapter-bar"><div class="playbook-chapter-fill" style="width:${pct}%"></div></div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.playbook-chapter').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.href));
  });

  refreshIcons();
}

async function loadBadges(uid) {
  const { data } = await supabase.from('freelancer_badges').select('*').eq('firebase_uid', uid);
  const container = document.getElementById('badgesRow');
  if (!container || !data) return;

  container.innerHTML = data.slice(0, 6).map(b => `
    <div class="badge-item ${b.earned ? 'earned' : ''}" title="${b.name}">
      <i data-lucide="${b.icon || 'award'}"></i>
    </div>
  `).join('');

  refreshIcons();
}

async function loadJourney(uid, range) {
  const now = new Date();
  let startDate;
  if (range === 'week') {
    startDate = new Date(now); startDate.setDate(startDate.getDate() - 6);
  } else if (range === 'month') {
    startDate = new Date(now); startDate.setMonth(startDate.getMonth() - 1);
  } else {
    startDate = new Date(now); startDate.setFullYear(startDate.getFullYear() - 1);
  }

  const { data } = await supabase.from('freelancer_journey_points').select('*').eq('firebase_uid', uid).gte('point_date', startDate.toISOString().split('T')[0]).order('point_date', { ascending: true });

  drawJourneyGraph(data || [], range);
}

async function loadNotifications(uid) {
  const { data } = await supabase.from('freelancer_notifications').select('read').eq('firebase_uid', uid);
  const unread = data ? data.filter(n => !n.read).length : 0;
  const badge = document.getElementById('notifBadge');
  if (unread > 0) {
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

/* ═══════════════════════════════════════════════════════════════
   JOURNEY GRAPH — Canvas-based line chart
   ═══════════════════════════════════════════════════════════════ */
function drawJourneyGraph(data, range) {
  const canvas = document.getElementById('journeyCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  const h = 140;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  /* Generate labels */
  let labels, values;
  if (range === 'week') {
    labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    values = [0, 0, 0, 0, 0, 0, 0];
    data.forEach(d => {
      const day = new Date(d.point_date).getDay();
      const idx = day === 0 ? 6 : day - 1;
      values[idx] += d.earnings || 0;
    });
  } else if (range === 'month') {
    labels = []; values = [];
    for (let i = 0; i < 4; i++) labels.push(`W${i + 1}`);
    values = [0, 0, 0, 0];
    data.forEach(d => {
      const day = new Date(d.point_date).getDate();
      const week = Math.floor((day - 1) / 7);
      if (week >= 0 && week < 4) values[week] += d.earnings || 0;
    });
  } else {
    labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    values = new Array(12).fill(0);
    data.forEach(d => {
      const month = new Date(d.point_date).getMonth();
      values[month] += d.earnings || 0;
    });
  }

  const maxVal = Math.max(...values, 1);
  const padL = 10, padR = 10, padT = 16, padB = 24;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const stepX = chartW / (values.length - 1 || 1);

  /* Draw grid lines */
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = padT + (chartH / 3) * i;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
  }

  /* Draw line */
  ctx.strokeStyle = '#31D7A9';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = padL + stepX * i;
    const y = padT + chartH - (v / maxVal) * chartH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  /* Draw fill */
  ctx.lineTo(padL + stepX * (values.length - 1), padT + chartH);
  ctx.lineTo(padL, padT + chartH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grad.addColorStop(0, 'rgba(49,215,169,.2)');
  grad.addColorStop(1, 'rgba(49,215,169,0)');
  ctx.fillStyle = grad;
  ctx.fill();

  /* Draw points */
  values.forEach((v, i) => {
    const x = padL + stepX * i;
    const y = padT + chartH - (v / maxVal) * chartH;
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#31D7A9'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  });

  /* Draw labels */
  ctx.fillStyle = '#94A3B8';
  ctx.font = '10px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  values.forEach((v, i) => {
    const x = padL + stepX * i;
    ctx.fillText(labels[i] || '', x, h - 6);
  });
}

/* ═══════════════════════════════════════════════════════════════
   REALTIME SUBSCRIPTIONS
   ═══════════════════════════════════════════════════════════════ */
function setupRealtime() {
  if (!currentUser) return;
  const uid = currentUser.uid;

  /* Vault — live update */
  supabase.channel('vault-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'freelancer_vault', filter: `firebase_uid=eq.${uid}` }, () => {
      loadVault(uid);
    })
    .subscribe();

  /* Stats — live update */
  supabase.channel('stats-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'freelancer_stats', filter: `firebase_uid=eq.${uid}` }, () => {
      loadStats(uid);
    })
    .subscribe();

  /* Focus tasks — live update */
  supabase.channel('focus-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'freelancer_focus_tasks', filter: `firebase_uid=eq.${uid}` }, () => {
      loadFocusTasks(uid);
    })
    .subscribe();

  /* Notifications — live update */
  supabase.channel('notif-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'freelancer_notifications', filter: `firebase_uid=eq.${uid}` }, () => {
      loadNotifications(uid);
    })
    .subscribe();
}

/* ═══════════════════════════════════════════════════════════════
   UI SETUP
   ═══════════════════════════════════════════════════════════════ */
function setupUI() {
  setupBanner();
  setupSearchRotation();
  setupDrawer();
  setupNavigation();
  setupLogout();
  setupPullToRefresh();
  setupJourneySelect();
  setupFab();
}

/* ── Banner Carousel ────────────────────────────────────────── */
function setupBanner() {
  const track = document.getElementById('bannerTrack');
  const dotsContainer = document.getElementById('bannerDots');
  if (!track) return;

  /* Create dots */
  for (let i = 0; i < BANNER_COUNT; i++) {
    const dot = document.createElement('button');
    dot.className = 'banner-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', `Go to banner ${i + 1}`);
    dot.addEventListener('click', () => goToBanner(i));
    dotsContainer.appendChild(dot);
  }

  /* Click handlers for banners */
  track.querySelectorAll('.banner-slide').forEach(slide => {
    slide.addEventListener('click', e => {
      const cta = e.target.closest('.banner-cta');
      const href = cta ? cta.dataset.href : slide.dataset.href;
      navigate(href);
    });
  });

  /* Auto-advance */
  startBannerAuto();

  /* Pause on touch */
  track.addEventListener('touchstart', () => {
    bannerPaused = true;
    clearInterval(bannerTimer);
  }, { passive: true });

  track.addEventListener('touchend', () => {
    setTimeout(() => { bannerPaused = false; startBannerAuto(); }, 2000);
  }, { passive: true });
}

function startBannerAuto() {
  clearInterval(bannerTimer);
  bannerTimer = setInterval(() => {
    if (!bannerPaused) goToBanner(currentBanner + 1);
  }, 4000);
}

function goToBanner(index) {
  const track = document.getElementById('bannerTrack');
  const dots = document.querySelectorAll('.banner-dot');
  currentBanner = ((index % BANNER_COUNT) + BANNER_COUNT) % BANNER_COUNT;
  track.scrollTo({ left: currentBanner * track.offsetWidth, behavior: 'smooth' });
  dots.forEach((d, i) => d.classList.toggle('active', i === currentBanner));
}

/* ── Search Placeholder Rotation ────────────────────────────── */
function setupSearchRotation() {
  const el = document.getElementById('searchPlaceholder');
  if (!el) return;

  searchInterval = setInterval(() => {
    el.classList.add('fading');
    setTimeout(() => {
      searchIndex = (searchIndex + 1) % SEARCH_PLACEHOLDERS.length;
      el.textContent = SEARCH_PLACEHOLDERS[searchIndex];
      el.classList.remove('fading');
    }, 300);
  }, 2500);

  /* Search bar click */
  document.getElementById('searchBar').addEventListener('click', () => navigate('search.html'));
}

/* ── Drawer ──────────────────────────────────────────────────── */
function setupDrawer() {
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  const openBtn = document.getElementById('hamburgerBtn');
  const closeBtn = document.getElementById('drawerClose');

  function open() {
    drawer.classList.add('open');
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('visible'));
    drawer.setAttribute('aria-hidden', 'false');
  }

  function close() {
    drawer.classList.remove('open');
    overlay.classList.remove('visible');
    drawer.setAttribute('aria-hidden', 'true');
    setTimeout(() => { overlay.hidden = true; }, 300);
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);

  /* Drawer items navigate */
  drawer.querySelectorAll('.drawer-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      close();
      setTimeout(() => navigate(item.getAttribute('href')), 200);
    });
  });
}

/* ── Navigation (all clickable cards) ────────────────────────── */
function setupNavigation() {
  /* All elements with data-href */
  document.querySelectorAll('[data-href]').forEach(el => {
    /* Skip if already has a click handler (banner, drawer handled above) */
    if (el.classList.contains('banner-slide') || el.classList.contains('banner-cta') || el.classList.contains('drawer-item')) return;
    el.addEventListener('click', e => {
      if (e.target.closest('.focus-task')) return; /* Focus tasks have own handler */
      const href = el.dataset.href;
      if (href) navigate(href);
    });
  });
}

function navigate(href) {
  if (!href) return;
  window.location.href = href;
}

/* ── Logout ──────────────────────────────────────────────────── */
function setupLogout() {
  const btn = document.getElementById('logoutBtn');
  const drawerLogout = document.getElementById('drawerLogout');
  const modal = document.getElementById('logoutModal');
  const cancelBtn = document.getElementById('logoutCancel');
  const confirmBtn = document.getElementById('logoutConfirm');

  function openModal() {
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('visible'));
  }

  function closeModal() {
    modal.classList.remove('visible');
    setTimeout(() => { modal.hidden = true; }, 250);
  }

  btn.addEventListener('click', openModal);
  drawerLogout.addEventListener('click', openModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  confirmBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch {
      /* Ignore — redirect anyway */
    }
    window.location.replace('index.html');
  });
}

/* ── Pull To Refresh ─────────────────────────────────────────── */
function setupPullToRefresh() {
  const scroll = document.getElementById('dashScroll');
  const indicator = document.getElementById('ptrIndicator');
  let startY = 0;
  let pulling = false;
  let pullDist = 0;
  const THRESHOLD = 60;

  scroll.addEventListener('touchstart', e => {
    if (scroll.scrollTop <= 0) {
      startY = e.touches[0].clientY;
      pulling = true;
      pullDist = 0;
    }
  }, { passive: true });

  scroll.addEventListener('touchmove', e => {
    if (!pulling) return;
    pullDist = e.touches[0].clientY - startY;
    if (pullDist > 0 && pullDist < 120) {
      indicator.style.transform = `translateX(-50%) translateY(${Math.min(pullDist - 40, 20)}px)`;
      indicator.style.opacity = Math.min(pullDist / THRESHOLD, 1);
    }
  }, { passive: true });

  scroll.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;

    if (pullDist >= THRESHOLD) {
      indicator.classList.add('refreshing');
      indicator.style.opacity = '1';
      await refreshDashboard();
      indicator.classList.remove('refreshing');
    }

    indicator.style.transform = '';
    indicator.style.opacity = '';
  }, { passive: true });
}

async function refreshDashboard() {
  if (!currentUser) return;
  await loadAllData();
}

/* ── Journey Select ──────────────────────────────────────────── */
function setupJourneySelect() {
  const select = document.getElementById('journeySelect');
  if (!select) return;
  select.addEventListener('change', () => {
    loadJourney(currentUser.uid, select.value);
  });
}

/* ── FAB ──────────────────────────────────────────────────────── */
function setupFab() {
  const fab = document.getElementById('bnFab');
  if (!fab) return;
  fab.addEventListener('click', () => navigate('pitch.html'));
}

/* ═══════════════════════════════════════════════════════════════
   ANIMATIONS & OBSERVERS
   ═══════════════════════════════════════════════════════════════ */
function observeFadeUps() {
  const elements = document.querySelectorAll('.fade-up:not(.visible)');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  elements.forEach(el => observer.observe(el));
}

function animateNumber(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const current = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
  if (current === target) return;
  const duration = 600;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(current + (target - current) * eased);
    el.textContent = value;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════ */
function formatLastActive(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function refreshIcons() {
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

/* ═══════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
