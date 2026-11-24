/* ============================================================
   AI OFFICE v1 — app
   렌더링 · 좌표 배치 · 회의 오케스트레이션 · 설정/기록 저장
   ============================================================ */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const byId = id => EMPLOYEES.find(e => e.id === id);

const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const K = { settings: 'aiOffice.v1.settings', prompts: 'aiOffice.v1.prompts', history: 'aiOffice.v1.history', stats: 'aiOffice.v1.stats' };

const CEO = { id: 'ceo', name: '대표님', short: '대표님', hair: 'short', hairColor: '#2b2735', shirt: '#c9a227', skin: '#f3c9ad', glasses: false };

const state = {
  status: {},
  queue: [],
  active: null,
  running: false,
  roomBusy: { mr1: false, mr2: false },
  history: [],
  stats: { date: '', req: 0, done: 0 },
  settings: { provider: 'sim', key: '', model: '' },
  prompts: {},
  apiFailed: false,
  workTimers: {}
};

const seatEls = {};
const mseatEls = { mr1: [], mr2: [] };
const empEls = {};

/* ───────────── 유틸 ───────────── */
function shade(hex, p) {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = clamp(Math.round(r * (1 + p)), 0, 255);
  g = clamp(Math.round(g * (1 + p)), 0, 255);
  b = clamp(Math.round(b * (1 + p)), 0, 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function hhmm(d = new Date()) {
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ───────────── 아바타 SVG ───────────── */
function hairPath(style, color) {
  switch (style) {
    case 'bob':
      return `<path d="M12.2 19.6c0-7.8 5-11.6 11.8-11.6s11.8 3.8 11.8 11.6v8.2c0 2-2.7 2.3-3.2.2-.4-1.6-.3-6.2-.6-8-1.2-2.4-3.9-3.6-8-3.6s-6.8 1.2-8 3.6c-.3 1.8-.2 6.4-.6 8-.5 2.1-3.2 1.8-3.2-.2z" fill="${color}"/>`;
    case 'pony':
      return `<path d="M12.4 18.8c0-7.2 4.8-10.8 11.6-10.8s11.6 3.6 11.6 10.8c-1.7-3.5-5.4-5.2-11.6-5.2s-9.9 1.7-11.6 5.2z" fill="${color}"/>
        <ellipse cx="37" cy="26.5" rx="3.4" ry="6.4" fill="${color}" transform="rotate(14 37 26.5)"/>`;
    case 'buzz':
      return `<path d="M13.8 17.9c1.1-5.6 5-8.4 10.2-8.4s9.1 2.8 10.2 8.4c-2.1-2.2-5.4-3.3-10.2-3.3s-8.1 1.1-10.2 3.3z" fill="${color}"/>`;
    case 'wave':
      return `<path d="M12.1 19.4c0-7.7 5.1-11.4 11.9-11.4s11.9 3.7 11.9 11.4v6.8c0 2.5-3 2.9-3.5.5-.5-2.3.3-4.4-.3-5.8-1.3-1.8-4.1-2.7-8.1-2.7s-6.8.9-8.1 2.7c-.6 1.4.2 3.5-.3 5.8-.5 2.4-3.5 2-3.5-.5z" fill="${color}"/>
        <circle cx="14.2" cy="27.6" r="2.7" fill="${color}"/><circle cx="33.8" cy="27.6" r="2.7" fill="${color}"/>`;
    case 'side':
      return `<path d="M12.3 19.2c0-7.6 5-11.2 11.7-11.2s11.7 3.6 11.7 11.2c-1.4-1.4-2.2-2.6-3-4.6-2.4 1.7-6.4 2.3-11 1.6-2.6-.4-4.6-1.2-5.6-2.4-1 2.3-2.3 3.9-3.8 5.4z" fill="${color}"/>`;
    default:
      return `<path d="M12.4 18.8c0-7.2 4.8-10.8 11.6-10.8s11.6 3.6 11.6 10.8c-1.7-3.5-5.4-5.2-11.6-5.2s-9.9 1.7-11.6 5.2z" fill="${color}"/>`;
  }
}

function avatarSVG(emp) {
  const hair = emp.hairColor || '#33313d';
  const shirt = emp.shirt || '#8b7bf7';
  const skin = emp.skin || '#f6d3bd';
  const skinD = shade(skin, -0.09);
  const arm = shade(shirt, -0.1);
  const glasses = emp.glasses
    ? `<g stroke="#4a4d63" stroke-width=".95" fill="none" opacity=".9">
         <rect x="15.1" y="16.5" width="7.8" height="5.7" rx="2.1"/>
         <rect x="25.1" y="16.5" width="7.8" height="5.7" rx="2.1"/>
         <path d="M22.9 19.1h2.2"/>
       </g>` : '';
  return `<svg viewBox="0 0 48 68" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="24" cy="65.4" rx="11.6" ry="2.6" fill="#2b2c3e" opacity=".10"/>
    <rect x="18" y="50" width="5" height="12.6" rx="2.4" fill="#3d4257"/>
    <rect x="25" y="50" width="5" height="12.6" rx="2.4" fill="#3d4257"/>
    <rect x="16.3" y="60.8" width="7.6" height="3.5" rx="1.75" fill="#2b2f45"/>
    <rect x="24.1" y="60.8" width="7.6" height="3.5" rx="1.75" fill="#2b2f45"/>
    <rect x="9.6" y="33" width="5.5" height="16" rx="2.75" fill="${arm}"/>
    <rect x="32.9" y="33" width="5.5" height="16" rx="2.75" fill="${arm}"/>
    <rect x="21" y="23.5" width="6" height="7" rx="3" fill="${skinD}"/>
    <path d="M24 28c-6.9 0-10.6 4.3-10.6 11.1v7.1c0 3.1 1.7 4.3 4.4 4.3h12.4c2.7 0 4.4-1.2 4.4-4.3v-7.1C34.6 32.3 30.9 28 24 28z" fill="${shirt}"/>
    <path d="M20.5 28.6 24 33.2l3.5-4.6" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" opacity=".8"/>
    <circle cx="11.7" cy="19.6" r="2.4" fill="${skinD}"/>
    <circle cx="36.3" cy="19.6" r="2.4" fill="${skinD}"/>
    <circle cx="24" cy="19" r="11.3" fill="${skin}"/>
    ${hairPath(emp.hair, hair)}
    <ellipse cx="19.9" cy="19.6" rx="1.45" ry="1.85" fill="#2b2f45"/>
    <ellipse cx="28.1" cy="19.6" rx="1.45" ry="1.85" fill="#2b2f45"/>
    <path d="M17.7 16.3h3.3M27 16.3h3.3" stroke="${shade(hair, 0.12)}" stroke-width="1.05" stroke-linecap="round" opacity=".75"/>
    <path d="M22.2 24.4c.85.85 2.95.85 3.8 0" stroke="#b4705f" stroke-width="1.05" fill="none" stroke-linecap="round"/>
    <circle cx="16.5" cy="22.6" r="1.6" fill="#f19a8b" opacity=".26"/>
    <circle cx="31.5" cy="22.6" r="1.6" fill="#f19a8b" opacity=".26"/>
    ${glasses}
  </svg>`;
}

/* ───────────── 오피스 맵 ───────────── */
function roomInner(r, team) {
  if (r.meeting) {
    return `<span class="room-tag"><span class="room-ico">${r.icon}</span><span class="room-nm">${r.name}</span><span class="room-sub">${r.sub}</span></span>
      <div class="mscreen"></div>
      <div class="mtable"></div>
      <div class="room-busy"><i></i>회의 중</div>
      ${Array.from({ length: 8 }).map((_, i) => `<span class="mseat" data-mseat="${i}" data-room="${r.id}"></span>`).join('')}`;
  }
  const staff = EMPLOYEES.filter(e => e.room === r.id);
  const desks = r.id === 'ceo'
    ? `<div class="desk-slot">
         <div class="desk"><span class="paper"></span><span class="mug"></span><span class="mon"><i></i></span></div>
         <span class="ceo-plate">CEO · 대표님</span>
         <span class="seat" data-seat="ceo"></span>
       </div>`
    : staff.map(e => `<div class="desk-slot">
         <div class="desk"><span class="paper"></span><span class="mug"></span><span class="mon"><i></i></span></div>
         <div class="chair"></div>
         <span class="seat" data-seat="${e.id}"></span>
       </div>`).join('');
  const deco = r.id === 'qa'
    ? `<span class="deco board"></span><span class="deco p1">🪴</span>`
    : `<span class="deco p1">🪴</span>`;
  return `<span class="room-tag"><span class="room-ico">${r.icon}</span><span class="room-nm">${r.name}</span><span class="room-sub">${r.sub}</span></span>
    <span class="win"></span><span class="rug"></span>
    <div class="desk-row">${desks}</div>${deco}`;
}

function buildRooms() {
  const roomsEl = $('#rooms');
  ROOMS.forEach(r => {
    const team = TEAMS[r.team];
    const room = document.createElement('div');
    room.className = 'room' + (r.meeting ? ' room-meeting' : '');
    room.dataset.room = r.id;
    room.style.setProperty('--cs', team.soft);
    room.innerHTML = roomInner(r, team);
    roomsEl.appendChild(room);
    $$('.seat', room).forEach(s => { seatEls[s.dataset.seat] = s; });
    if (r.meeting) $$('.mseat', room).forEach(s => { mseatEls[r.id][+s.dataset.mseat] = s; });
  });
}

function buildChars() {
  const wrap = $('#chars');

  const ceo = document.createElement('div');
  ceo.className = 'emp is-ceo';
  ceo.dataset.emp = 'ceo';
  ceo.style.setProperty('--ew', 'var(--ew)');
  ceo.innerHTML = `<div class="emp-av">${avatarSVG(CEO)}</div><span class="emp-tag"><i class="s"></i>대표님</span>`;
  wrap.appendChild(ceo);
  empEls.ceo = ceo;
  CEO._el = ceo;

  EMPLOYEES.forEach(e => {
    const b = document.createElement('button');
    b.className = 'emp';
    b.type = 'button';
    b.dataset.emp = e.id;
    b.dataset.status = 'idle';
    b.setAttribute('aria-label', e.name + ' 상세 보기');
    b.innerHTML = `<span class="emp-bubble"></span>
      <div class="emp-av">${avatarSVG(e)}</div>
      <span class="emp-tag"><i class="s"></i><span class="nm">${esc(e.short)}</span><em class="st">회의 중</em></span>`;
    b.addEventListener('click', () => openEmp(e.id));
    wrap.appendChild(b);
    empEls[e.id] = b;
  });
}

function seatTarget(e) {
  if (state.status[e.id] === 'meeting' && e._mseat) return e._mseat;
  return seatEls[e.id] || seatEls.ceo;
}

function scaleEmp(id, k) {
  const el = empEls[id];
  if (!el) return;
  if (k === 1) { el.style.removeProperty('--ew'); return; }
  const base = parseFloat(getComputedStyle($('#stage')).getPropertyValue('--ew')) || 48;
  el.style.setProperty('--ew', Math.round(base * k) + 'px');
}

function placeEmp(e, animate) {
  const el = empEls[e.id];
  if (!el) return;
  const t = seatTarget(e);
  if (!t) return;
  const stage = $('#stage');
  const sr = stage.getBoundingClientRect();
  const r = t.getBoundingClientRect();
  const x = r.left - sr.left - stage.clientLeft + r.width / 2;
  const y = r.top - sr.top - stage.clientTop + r.height;
  const px = el._x == null ? x : el._x;
  const py = el._y == null ? y : el._y;
  if (!animate) el.classList.add('no-anim');
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  if (animate) {
    const dist = Math.hypot(x - px, y - py);
    const dur = clamp(dist / 300, 0.55, 1.35);
    el.style.transitionDuration = dur.toFixed(2) + 's';
    el.classList.add('walking');
    clearTimeout(el._walkT);
    el._walkT = setTimeout(() => el.classList.remove('walking'), dur * 1000 + 120);
  }
  el._x = x; el._y = y;
  if (!animate) requestAnimationFrame(() => el.classList.remove('no-anim'));
}

function layoutAll(animate) {
  const stage = $('#stage');
  const w = stage.clientWidth;
  const mobile = window.innerWidth < 860;
  const ew = mobile ? clamp(Math.round(w * 0.15), 44, 64) : clamp(Math.round(w * 0.056), 40, 62);
  stage.style.setProperty('--ew', ew + 'px');

  // 미팅룸 좌석 좌표 (반응형) — 좌석을 좌/우/상/하로 번갈아 배치해 겹침 방지
  const cx = 50, cy = mobile ? 61 : 58, rx = mobile ? 32 : 37, ry = mobile ? 18 : 20;
  const ANG = [180, 0, 270, 90, 232, 308, 128, 52];
  ['mr1', 'mr2'].forEach(rid => {
    mseatEls[rid].forEach((s, i) => {
      const a = ((ANG[i] == null ? i * 45 : ANG[i]) * Math.PI) / 180;
      s.style.left = (cx + rx * Math.cos(a)).toFixed(2) + '%';
      s.style.top = (cy + ry * Math.sin(a)).toFixed(2) + '%';
    });
  });

  requestAnimationFrame(() => {
    [CEO, ...EMPLOYEES].forEach(e => {
      if (e._el) { /* ceo uses empEls */ }
      placeEmp(e, false);
    });
  });
}

/* ───────────── 상태 · KPI ───────────── */
function setStatus(id, s) {
  state.status[id] = s;
  clearTimeout(state.workTimers[id]);
  const el = empEls[id];
  if (el) {
    el.dataset.status = s;
    const st = $('.emp-tag .st', el);
    if (st) st.textContent = s === 'meeting' ? '회의 중' : s === 'working' ? '작업 중' : '';
  }
  updateKpis();
}

function updateKpis() {
  ensureStats();
  const working = EMPLOYEES.filter(e => state.status[e.id] && state.status[e.id] !== 'idle').length;
  $('#kpiReq').textContent = state.stats.req;
  $('#kpiRun').textContent = state.active ? 1 : 0;
  $('#kpiDone').textContent = state.stats.done;
  $('#kpiWait').textContent = state.queue.length;
  $('#kpiWorking').textContent = working;
  $('#kpis').querySelector('.kpi-work').classList.toggle('on', working > 0);
}

function ensureStats() {
  const t = todayKey();
  if (state.stats.date !== t) {
    state.stats = { date: t, req: 0, done: 0 };
    LS.set(K.stats, state.stats);
  }
}

function toast(msg, kind) {
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(() => t.remove(), 3000);
}

/* ───────────── 회의록 패널 ───────────── */
function openSide(item) {
  $('#side').classList.add('open');
  document.body.classList.add('sheet-open');
  $('#sideKicker').textContent = item && item.status === 'done' ? '회의록 · 완료' : '회의록';
  $('#sideTitle').textContent = item ? item.agenda : '회의를 기다리는 중';
  const meta = $('#sideMeta');
  if (item) {
    const names = item.participants.map(id => (byId(id) || {}).short).filter(Boolean).join(' · ');
    meta.innerHTML = `<span class="meta-pill">${item.room === 'mr2' ? '미팅룸 2' : '미팅룸 1'}</span>
      <span class="meta-pill">${item.participants.length}명 · ${esc(names)}</span>
      <span class="meta-pill ${item.status === 'done' ? 'done' : 'live'}">${item.status === 'done' ? '완료' : '진행 중'}</span>`;
  } else meta.innerHTML = '';
}

function closeSide() {
  $('#side').classList.remove('open');
  document.body.classList.remove('sheet-open');
}

function scrollSide() {
  const b = $('#sideBody');
  b.scrollTop = b.scrollHeight;
}

const KIND_LABEL = { open: '소집', opinion: '의견', review: '검수', reply: '응답', report: '보고' };

function msgHTML(emp, kind, text) {
  const team = TEAMS[emp.team] || TEAMS.sec;
  return `<div class="msg ${emp.id === 'sec' ? 'sec' : ''}">
    <div class="msg-av">${avatarSVG(emp)}</div>
    <div class="msg-main">
      <div class="msg-top">
        <span class="msg-name">${esc(emp.name)}</span>
        <span class="msg-team" style="color:${team.color};background:${team.soft}">${esc(team.name)}</span>
        <span class="msg-kind">${KIND_LABEL[kind] || '발언'}</span>
        <span class="msg-time">${hhmm()}</span>
      </div>
      <div class="msg-text">${esc(text)}</div>
    </div>
  </div>`;
}

function typingHTML(name) {
  return `<div class="typing"><span class="dots"><i></i><i></i><i></i></span><span>${esc(name)} 발언 중…</span></div>`;
}

function reportHTML(rep, item) {
  const li = arr => arr.map(x => `<li>${x}</li>`).join('');
  return `<div class="report-card">
    <div class="report-head">
      <b>최종 합의 보고서</b>
      <span>${esc(rep.dateLabel)} · ${item.participants.length}명 참여 · ${item.room === 'mr2' ? '미팅룸 2' : '미팅룸 1'}</span>
    </div>
    <div class="report-body">
      <div class="report-sec"><h4>결정사항</h4><ul>${li(rep.decisions)}</ul></div>
      <div class="report-sec"><h4>근거</h4><ul>${li(rep.evidence)}</ul></div>
      <div class="report-sec"><h4>리스크 및 대응</h4><ul>${rep.risks.map(r => `<li><span class="own">${esc(r.risk)}</span> → ${esc(r.action)}</li>`).join('')}</ul></div>
      <div class="report-sec"><h4>다음 액션</h4><ul>${rep.actions.map(a => `<li><span class="own">${esc(a.owner)}</span> · ${esc(a.task)} <span class="due">${esc(a.due)}</span></li>`).join('')}</ul></div>
    </div>
    <div class="report-foot"><span>양91 실장 정리</span><span>대표님 승인 대기</span></div>
  </div>`;
}

/* ───────────── 회의 실행 ───────────── */
function requestMeeting(agenda, participants) {
  ensureStats();
  if (!agenda.trim()) { toast('안건을 입력해 주세요'); return; }
  const parts = participants.slice();
  if (!parts.includes('sec')) parts.unshift('sec');
  if (parts.length < 2) { toast('참여 직원을 1명 이상 선택해 주세요'); return; }

  const item = {
    id: 'mtg-' + Date.now(),
    agenda: agenda.trim(),
    participants: parts,
    createdAt: Date.now(),
    room: null,
    status: 'queued',
    minutes: [],
    report: null
  };
  state.stats.req++;
  LS.set(K.stats, state.stats);
  state.queue.push(item);
  updateKpis();
  if (state.active) toast('대기열에 추가했습니다 · 앞선 회의 종료 후 시작합니다');
  runQueue();
}

async function runQueue() {
  if (state.running) return;
  state.running = true;
  while (state.queue.length) {
    const item = state.queue.shift();
    updateKpis();
    await runMeeting(item);
  }
  state.running = false;
  updateKpis();
}

function freeRoom() {
  if (!state.roomBusy.mr1) return 'mr1';
  if (!state.roomBusy.mr2) return 'mr2';
  return 'mr1';
}

async function runMeeting(item) {
  const room = freeRoom();
  item.room = room;
  item.status = 'running';
  item.startedAt = Date.now();
  state.roomBusy[room] = true;
  state.active = item;
  state.apiFailed = false;

  const roomEl = $(`.room[data-room="${room}"]`);
  roomEl.classList.add('in-meeting');

  // 참여자 → 미팅룸 좌석 배정 + 이동
  const seats = mseatEls[room];
  item.participants.forEach((id, i) => {
    const e = byId(id);
    if (!e) return;
    e._mseat = seats[i % seats.length];
    setStatus(id, 'meeting');
    scaleEmp(id, 0.8);
    placeEmp(e, true);
  });
  clearBubbleAll();

  openSide(item);
  $('#sideBody').innerHTML = '';
  $('#sideFoot').innerHTML = `<span class="muted">이동 중…</span>`;
  updateKpis();

  // 모바일: 회의실이 하단 시트에 가리지 않도록 위치 고정
  if (window.innerWidth < 860) {
    setTimeout(() => {
      const head = $('.topbar').offsetHeight || 100;
      const y = roomEl.getBoundingClientRect().top + window.scrollY - head - 34;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }, 300);
  }

  // 경과 타이머
  const started = Date.now();
  const timer = setInterval(() => {
    const s = Math.floor((Date.now() - started) / 1000);
    const el = $('#sideMeta').querySelector('.meta-pill:last-child');
    if (el && item.status === 'running') el.textContent = `진행 중 ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);

  await sleep(1150); // 걸어가는 시간

  // 회의 진행
  const ctx = Engine.ctxFor(item.agenda, item.participants, Date.now() % 100000);
  const plan = Engine.planTurns(item.agenda, item.participants);
  const report = Engine.buildReport(ctx);
  item.report = report;
  const history = [];

  $('#sideFoot').innerHTML = `<span class="muted">${state.settings.provider === 'sim' || !state.settings.key ? '시뮬레이션 모드' : 'API 모드'} · 실시간 기록</span>`;

  for (const turn of plan.turns) {
    const emp = byId(turn.who) || byId('sec');
    const body = $('#sideBody');
    const tEl = document.createElement('div');
    tEl.innerHTML = typingHTML(emp.name);
    body.appendChild(tEl.firstElementChild);
    scrollSide();

    let text = null;
    const useApi = state.settings.provider !== 'sim' && state.settings.key && !state.apiFailed;

    if (useApi) {
      try {
        const sys = emp.prompt;
        const msgs = Engine.buildApiMessages(turn, ctx, history, report);
        text = await Engine.callAPI(state.settings, sys, msgs, turn.kind === 'report' ? 700 : 420);
        if (!text) throw new Error('빈 응답');
      } catch (err) {
        state.apiFailed = true;
        toast('API 호출 실패 — 시뮬레이션으로 전환합니다. (' + String(err.message || err).slice(0, 70) + ')', 'err');
        text = null;
      }
    }

    const minWait = 620 + Math.min(1100, (text ? text.length : 120) * 9);
    if (!useApi) await sleep(minWait);
    else await sleep(320);

    if (!text) text = Engine.simTurnText(turn, ctx, report);

    const typingEl = $('.typing', body);
    if (typingEl) typingEl.remove();

    if (turn.kind === 'report') {
      // 보고 턴: 발화 + 보고서 카드
      body.insertAdjacentHTML('beforeend', msgHTML(emp, 'report', text));
      const wrap = document.createElement('div');
      wrap.style.margin = '0 0 14px 39px';
      wrap.innerHTML = reportHTML(report, item);
      body.appendChild(wrap);
      // 보고서 머리글이 보이도록 위치 조정
      requestAnimationFrame(() => {
        const br = body.getBoundingClientRect();
        const wr = wrap.getBoundingClientRect();
        body.scrollTop += (wr.top - br.top) - 8;
      });
    } else {
      body.insertAdjacentHTML('beforeend', msgHTML(emp, turn.kind, text));
    }
    history.push({ name: emp.name, text });
    item.minutes.push({ id: emp.id, name: emp.name, kind: turn.kind, text, at: Date.now() });

    // 말풍선 + 발화 강조
    speakBubble(emp, text);
    scrollSide();
    await sleep(420);
  }

  clearInterval(timer);
  item.status = 'done';
  item.endedAt = Date.now();

  $('#sideKicker').textContent = '회의록 · 완료';
  const metaPill = $('#sideMeta').querySelector('.meta-pill:last-child');
  if (metaPill) { metaPill.className = 'meta-pill done'; metaPill.textContent = '완료'; }
  $('#sideFoot').innerHTML = `<span class="muted">완료 · ${Math.max(1, Math.round((item.endedAt - item.startedAt) / 1000))}초</span>
    <button class="btn ghost" id="btnSideClose2">닫기</button>`;
  $('#btnSideClose2').onclick = closeSide;

  state.stats.done++;
  LS.set(K.stats, state.stats);
  updateKpis();

  // 기록 저장
  state.history.unshift({
    id: item.id, agenda: item.agenda, at: item.endedAt, room: item.room,
    participants: item.participants, minutes: item.minutes, report: item.report
  });
  state.history = state.history.slice(0, 24);
  LS.set(K.history, state.history);

  roomEl.classList.remove('in-meeting');
  state.roomBusy[room] = false;
  state.active = null;

  // 복귀 (잠시 후)
  await sleep(2600);
  item.participants.forEach(id => {
    const e = byId(id);
    if (!e) return;
    delete e._mseat;
    setStatus(id, 'idle');
    scaleEmp(id, 1);
    placeEmp(e, true);
  });
  clearBubbleAll();
  updateKpis();
  toast('회의 완료 · ' + item.agenda, 'ok');

  // 후속 작업: 보고서 담당자를 잠시 '작업 중'으로
  setTimeout(() => followUp(item.report), 700);
}

function followUp(report) {
  if (!report || !report.actions) return;
  report.actions.forEach(a => {
    const e = EMPLOYEES.find(x => x.name === a.owner);
    if (!e || state.status[e.id] === 'meeting') return;
    setStatus(e.id, 'working');
    state.workTimers[e.id] = setTimeout(() => {
      if (state.status[e.id] === 'working') setStatus(e.id, 'idle');
    }, 15000);
  });
}

function speakBubble(emp, text) {
  const el = empEls[emp.id];
  if (!el) return;
  // 한 번에 한 명의 말풍선만 표시
  $$('.emp-bubble.show').forEach(b => {
    if (b !== $('.emp-bubble', el)) b.classList.remove('show');
  });
  const b = $('.emp-bubble', el);
  if (b) {
    const short = text.replace(/\s+/g, ' ').slice(0, 54) + (text.length > 54 ? '…' : '');
    b.textContent = short;
    b.classList.add('show');
    requestAnimationFrame(() => {
      const sr = $('#stage').getBoundingClientRect();
      const r = b.getBoundingClientRect();
      let dx = 0;
      if (r.left < sr.left + 8) dx = sr.left + 8 - r.left;
      else if (r.right > sr.right - 8) dx = sr.right - 8 - r.right;
      b.style.transform = `translate(calc(-50% + ${Math.round(dx)}px), 0) scale(1)`;
    });
    clearTimeout(el._bubT);
    el._bubT = setTimeout(() => b.classList.remove('show'), 3600);
  }
  $$('.emp.speaking').forEach(x => x.classList.remove('speaking'));
  el.classList.add('speaking');
  clearTimeout(el._spkT);
  el._spkT = setTimeout(() => el.classList.remove('speaking'), 4200);
}

function clearBubbleAll() {
  $$('.emp-bubble').forEach(b => b.classList.remove('show'));
  $$('.emp.speaking').forEach(x => x.classList.remove('speaking'));
}

/* ───────────── 업무 요청 모달 ───────────── */
const pick = new Set();

function openRequest() {
  $('#ovRequest').hidden = false;
  document.body.classList.add('locked');
  $('#agenda').value = '';
  $('#agendaCount').textContent = '0';
  pick.clear();
  ['stock', 'qa'].forEach(t => addTeam(t));
  syncPick();
  setTimeout(() => $('#agenda').focus(), 60);
}

function addTeam(teamId) {
  EMPLOYEES.filter(e => e.team === teamId).forEach(e => pick.add(e.id));
}

function buildPicker() {
  const box = $('#teamsPick');
  const order = ['sec', 'stock', 'realty', 'content', 'japan', 'qa'];
  box.innerHTML = order.map(tid => {
    const team = TEAMS[tid];
    const emps = EMPLOYEES.filter(e => e.team === tid);
    return `<div class="team-row" data-team="${tid}">
      <div class="team-row-head">
        <span class="team-dot" style="background:${team.color}"></span>
        <span class="team-name">${esc(team.name)}</span>
      </div>
      <div class="emp-chips">${emps.map(e => `
        <button type="button" class="emp-chip" data-emp="${e.id}" aria-pressed="false">
          <span class="ca">${avatarSVG(e)}</span><span>${esc(e.short)}</span>
        </button>`).join('')}</div>
    </div>`;
  }).join('');

  $$('.emp-chip', box).forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.emp;
      if (pick.has(id)) pick.delete(id);
      else {
        if (pick.size >= 8) { toast('한 회의에는 최대 8명까지 참여할 수 있습니다'); return; }
        pick.add(id);
      }
      syncPick();
    });
  });

  $('#presetRow').innerHTML = PRESETS.map(p => `<button type="button" class="preset" data-preset="${p.id}">${esc(p.label)}</button>`).join('');
  $$('.preset').forEach(b => b.addEventListener('click', () => {
    const p = PRESETS.find(x => x.id === b.dataset.preset);
    $('#agenda').value = p.agenda;
    $('#agendaCount').textContent = p.agenda.length;
    pick.clear();
    ['sec'].concat(p.teams).forEach(t => addTeam(t));
    $$('.preset').forEach(x => x.classList.toggle('on', x === b));
    syncPick();
  }));
}

function syncPick() {
  $$('.emp-chip').forEach(b => {
    const on = pick.has(b.dataset.emp);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const n = pick.size;
  $('#pickSummary').textContent = `참여 ${n}명` + (n ? ' · ' + Array.from(pick).map(id => (byId(id) || {}).short).filter(Boolean).join(' · ') : '');
  $('#btnRun').disabled = n === 0 || !$('#agenda').value.trim();
  $('#runMode').textContent = state.settings.provider !== 'sim' && state.settings.key
    ? (state.settings.provider === 'openai' ? 'API 모드 · OpenAI' : 'API 모드 · Anthropic')
    : '시뮬레이션 모드';
}

/* ───────────── 직원 상세 ───────────── */
let currentEmp = null;

function openEmp(id) {
  const e = byId(id);
  if (!e) return;
  currentEmp = id;
  $('#empAvatar').innerHTML = avatarSVG(e);
  $('#empName').textContent = e.name;
  $('#empRole').textContent = e.role;
  $('#empTeam').textContent = TEAMS[e.team].name;
  $('#empStatus').textContent = state.status[id] === 'meeting' ? '회의 중' : state.status[id] === 'working' ? '작업 중' : '대기';
  const mine = state.history.filter(h => (h.participants || []).includes(id));
  $('#empMeetings').textContent = mine.length + '회';
  $('#empDesc').textContent = e.desc;
  $('#empPrompt').value = e.prompt;
  $('#promptState').textContent = state.prompts[id] ? '수정됨 · 이 브라우저에 저장됨' : '기본 프롬프트';

  const log = $('#empLog');
  if (!mine.length) log.innerHTML = `<li class="empty">아직 참여한 회의가 없습니다.</li>`;
  else log.innerHTML = mine.slice(0, 5).map(h => {
    const d = new Date(h.at);
    return `<li><span>${esc(h.agenda)}</span><span class="t">${d.getMonth() + 1}/${d.getDate()} ${hhmm(d)}</span></li>`;
  }).join('');

  $('#ovEmp').hidden = false;
  document.body.classList.add('locked');
}

/* ───────────── API 설정 ───────────── */
const MODELS = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
  anthropic: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-sonnet-4-5']
};

function openApi() {
  const s = state.settings;
  $('#ovApi').hidden = false;
  document.body.classList.add('locked');
  setProvider(s.provider || 'sim');
  $('#apiKey').value = s.key || '';
  $('#apiModel').value = s.model || '';
  $('#apiTestResult').textContent = '';
  $('#apiTestResult').className = 'api-test';
}

function setProvider(p) {
  $$('#provSeg button').forEach(b => b.classList.toggle('on', b.dataset.prov === p));
  $('#apiFields').classList.toggle('off', p === 'sim');
  $('#apiSimNote').classList.toggle('off', p !== 'sim');
  const list = $('#modelList');
  list.innerHTML = (MODELS[p] || []).map(m => `<option value="${m}"></option>`).join('');
  if (p !== 'sim') $('#apiModel').placeholder = (MODELS[p] || [])[0] || '';
  $('#provSeg').dataset.prov = p;
}

function updateModeChip() {
  const s = state.settings;
  const chip = $('#modeChip');
  if (s.provider !== 'sim' && s.key) {
    chip.classList.add('api');
    $('#modeText').textContent = 'LIVE · API 모드 (' + (s.provider === 'openai' ? 'OpenAI' : 'Anthropic') + ')';
  } else {
    chip.classList.remove('api');
    $('#modeText').textContent = 'LIVE · 시뮬레이션 모드';
  }
  if ($('#runMode')) syncPick();
}

/* ───────────── 기록 ───────────── */
function openHistory() {
  const list = $('#hisList');
  if (!state.history.length) {
    list.innerHTML = `<li class="emp-log"><span class="empty">아직 기록이 없습니다.</span></li>`;
  } else {
    list.innerHTML = state.history.map(h => {
      const d = new Date(h.at);
      return `<li><button class="his-item" data-id="${h.id}">
        <b>${esc(h.agenda)}</b>
        <span>${d.getMonth() + 1}월 ${d.getDate()}일 ${hhmm(d)} · ${h.participants.length}명 · ${h.room === 'mr2' ? '미팅룸 2' : '미팅룸 1'}</span>
      </button></li>`;
    }).join('');
    $$('.his-item', list).forEach(b => b.addEventListener('click', () => {
      const h = state.history.find(x => x.id === b.dataset.id);
      if (h) showHistoryItem(h);
    }));
  }
  $('#ovHistory').hidden = false;
  document.body.classList.add('locked');
}

function showHistoryItem(h) {
  $('#ovHistory').hidden = true;
  openSide({ agenda: h.agenda, participants: h.participants, room: h.room, status: 'done' });
  const body = $('#sideBody');
  body.innerHTML = '';
  (h.minutes || []).forEach(m => {
    const emp = byId(m.id);
    if (!emp) return;
    body.insertAdjacentHTML('beforeend', msgHTML(emp, m.kind, m.text));
  });
  if (h.report) {
    const wrap = document.createElement('div');
    wrap.style.margin = '0 0 14px 39px';
    wrap.innerHTML = reportHTML(h.report, { participants: h.participants, room: h.room });
    body.appendChild(wrap);
  }
  $('#sideFoot').innerHTML = `<span class="muted">기록 · ${new Date(h.at).toLocaleDateString('ko-KR')}</span>
    <button class="btn ghost" id="btnSideClose3">닫기</button>`;
  $('#btnSideClose3').onclick = closeSide;
  scrollSide();
}

/* ───────────── 이벤트 바인딩 ───────────── */
function bindEvents() {
  $('#btnRequest').addEventListener('click', openRequest);
  $('#btnApi').addEventListener('click', openApi);
  $('#btnHistory').addEventListener('click', openHistory);
  $('#sideClose').addEventListener('click', closeSide);

  $('#agenda').addEventListener('input', e => {
    $('#agendaCount').textContent = e.target.value.length;
    $$('.preset').forEach(x => x.classList.remove('on'));
    syncPick();
  });

  $('#pickAll').addEventListener('click', () => {
    EMPLOYEES.slice(0, 8).forEach(e => pick.add(e.id));
    if (EMPLOYEES.length > 8) toast('한 회의에는 최대 8명까지 참여할 수 있습니다');
    syncPick();
  });
  $('#pickNone').addEventListener('click', () => { pick.clear(); syncPick(); });

  $('#btnRun').addEventListener('click', () => {
    const agenda = $('#agenda').value.trim();
    const parts = Array.from(pick);
    if (!agenda) return;
    $('#ovRequest').hidden = true;
    document.body.classList.remove('locked');
    requestMeeting(agenda, parts);
  });

  // 오버레이 닫기
  $$('.overlay').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) closeOverlay(ov); });
    $$('[data-close]', ov).forEach(b => b.addEventListener('click', () => closeOverlay(ov)));
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const open = $$('.overlay').find(o => !o.hidden);
      if (open) closeOverlay(open);
      else if ($('#side').classList.contains('open')) closeSide();
    }
  });

  // API 설정
  $$('#provSeg button').forEach(b => b.addEventListener('click', () => setProvider(b.dataset.prov)));
  $('#keyToggle').addEventListener('click', () => {
    const inp = $('#apiKey');
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    $('#keyToggle').textContent = show ? '숨기기' : '보기';
  });
  $('#btnSaveApi').addEventListener('click', () => {
    const p = $('#provSeg').dataset.prov || 'sim';
    if (p === 'sim') {
      state.settings = { provider: 'sim', key: '', model: '' };
      LS.set(K.settings, state.settings);
      updateModeChip();
      closeOverlay($('#ovApi'));
      toast('시뮬레이션 모드로 설정했습니다', 'ok');
      return;
    }
    const key = $('#apiKey').value.trim();
    if (!key) { toast('API 키를 입력해 주세요'); return; }
    state.settings = { provider: p, key, model: $('#apiModel').value.trim() };
    LS.set(K.settings, state.settings);
    updateModeChip();
    closeOverlay($('#ovApi'));
    toast('저장했습니다 · ' + (p === 'openai' ? 'OpenAI' : 'Anthropic'), 'ok');
  });
  $('#btnClearKey').addEventListener('click', () => {
    state.settings = { provider: 'sim', key: '', model: '' };
    LS.del(K.settings);
    $('#apiKey').value = '';
    setProvider('sim');
    updateModeChip();
    toast('키를 삭제하고 시뮬레이션 모드로 돌아갔습니다');
  });
  $('#btnTest').addEventListener('click', async () => {
    const p = $('#provSeg').dataset.prov || 'sim';
    const out = $('#apiTestResult');
    const s = { provider: p, key: $('#apiKey').value.trim(), model: $('#apiModel').value.trim() };
    if (p === 'sim') { out.textContent = '시뮬레이션 모드 — 키가 필요 없습니다.'; out.className = 'api-test ok'; return; }
    if (!s.key) { out.textContent = '키를 입력해 주세요.'; out.className = 'api-test err'; return; }
    out.textContent = '연결 확인 중…'; out.className = 'api-test';
    try {
      const r = await Engine.testConnection(s);
      out.textContent = r.note; out.className = 'api-test ok';
    } catch (e) {
      out.textContent = '실패: ' + String(e.message || e).slice(0, 160); out.className = 'api-test err';
    }
  });

  // 직원 프롬프트
  $('#btnPromptSave').addEventListener('click', () => {
    if (!currentEmp) return;
    const v = $('#empPrompt').value.trim();
    const def = (byId(currentEmp) || {}).defaultPrompt;
    if (!v) { toast('프롬프트가 비어 있습니다'); return; }
    if (v === def) delete state.prompts[currentEmp];
    else state.prompts[currentEmp] = v;
    LS.set(K.prompts, state.prompts);
    applyPrompts();
    $('#promptState').textContent = state.prompts[currentEmp] ? '수정됨 · 이 브라우저에 저장됨' : '기본 프롬프트';
    toast('프롬프트를 저장했습니다', 'ok');
  });
  $('#btnPromptReset').addEventListener('click', () => {
    if (!currentEmp) return;
    delete state.prompts[currentEmp];
    LS.set(K.prompts, state.prompts);
    applyPrompts();
    $('#empPrompt').value = (byId(currentEmp) || {}).defaultPrompt || '';
    $('#promptState').textContent = '기본 프롬프트';
    toast('기본 프롬프트로 복원했습니다');
  });

  window.addEventListener('resize', () => layoutAll(false));
  if (window.ResizeObserver) new ResizeObserver(() => layoutAll(false)).observe($('#stage'));
  window.addEventListener('scroll', () => {
    if (window.innerWidth < 860 && $('#side').classList.contains('open')) {
      // 시트가 열려 있으면 배경 스크롤 유지 (별도 처리 없음)
    }
  }, { passive: true });
}

function closeOverlay(ov) {
  ov.hidden = true;
  if ($$('.overlay').every(o => o.hidden)) document.body.classList.remove('locked');
}

function applyPrompts() {
  EMPLOYEES.forEach(e => { e.prompt = state.prompts[e.id] || e.defaultPrompt; });
}

/* ───────────── 부팅 ───────────── */
function boot() {
  EMPLOYEES.forEach(e => { e.defaultPrompt = e.prompt; });

  state.settings = LS.get(K.settings, { provider: 'sim', key: '', model: '' });
  state.prompts = LS.get(K.prompts, {});
  state.history = LS.get(K.history, []);
  state.stats = LS.get(K.stats, { date: todayKey(), req: 0, done: 0 });
  ensureStats();
  applyPrompts();

  buildRooms();
  buildChars();
  buildPicker();
  bindEvents();

  EMPLOYEES.forEach(e => { state.status[e.id] = 'idle'; });
  layoutAll(false);
  setTimeout(() => layoutAll(false), 120);
  setTimeout(() => layoutAll(false), 600);

  updateKpis();
  updateModeChip();
  $('#todayLabel').textContent = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  $('#clock').textContent = hhmm();
  setInterval(() => { $('#clock').textContent = hhmm(); }, 20000);

  window.addEventListener('load', () => layoutAll(false));
}

document.addEventListener('DOMContentLoaded', boot);
