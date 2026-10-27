(function(){
"use strict";

/* ---------- data ---------- */
const D = window.QUIZ_DATA || {};
const SUBJECTS = [
  {n:1, name:"1과목", full:"금융상품 및 세제", exam:20, color:"var(--s1)"},
  {n:2, name:"2과목", full:"투자운용 및 전략Ⅱ · 투자분석", exam:30, color:"var(--s2)"},
  {n:3, name:"3과목", full:"직무윤리·법규 · 투자운용 및 전략Ⅰ · 거시경제·분산투자", exam:50, color:"var(--s3)"},
  {n:0, name:"2026", full:"2026 달라진 점", exam:0, color:"var(--s0)"}
];
const ORDER = ["s1_tax","s1_product","s1_realestate","s2_alt","s2_global","s2_analysis","s2_risk",
  "s3_ethics","s3_law","s3_kofia","s3_equity","s3_bond","s3_deriv","s3_perf","s3_macro","s3_portfolio","s0_2026"];
const AREAS = ORDER.filter(id => D[id] && Array.isArray(D[id].questions));
const Q = {};          // qid -> question (with area)
AREAS.forEach(id => D[id].questions.forEach(q => { Q[q.id] = Object.assign({area:id}, q); }));
const subjOf = n => SUBJECTS.find(s => s.n === n);
const areaColor = id => subjOf(D[id].subject).color;

/* ---------- storage ---------- */
const K = {stats:"tuunsa-stats", sess:"tuunsa-session", opts:"tuunsa-opts", theme:"tuunsa-theme", mock:"tuunsa-mock"};
function load(k, d){ try{ const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } }
function save(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
let STATS = load(K.stats, {});
let OPTS = Object.assign({shuffleQ:true, shuffleC:true}, load(K.opts, {}));
let MOCK = Object.assign({runs:0, seen:{}}, load(K.mock, {}));   // 모의고사 출제 이력: qid -> 출제 횟수
let S = load(K.sess, null);
if (S && (!Array.isArray(S.items) || S.items.some(it => !Q[it.qid]))) S = null;

/* ---------- helpers ---------- */
const $view = document.getElementById("view");
const practiceHtml = q => q.practice ? `<div class="practice"><h3>실무에서는</h3><p>${esc(q.practice)}</p></div>` : "";
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function shuffle(a){ a = a.slice(); for(let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function toast(msg){ const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role","status"); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 1800); }
function areaStats(id){
  const qs = D[id].questions; let seen = 0, good = 0, bad = 0;
  qs.forEach(q => { const s = STATS[q.id]; if(s){ seen++; if(s.last) good++; else bad++; } });
  return {total:qs.length, seen, good, bad};
}
const wrongIds = () => Object.keys(STATS).filter(id => Q[id] && STATS[id].last === 0);

/* ---------- sessions ---------- */
function makeItem(qid){
  const q = Q[qid];
  return {qid, order: q.type === "mc" ? (OPTS.shuffleC ? shuffle([0,1,2,3]) : [0,1,2,3]) : null};
}
function start(mode, title, qids, keepOrder){
  if(!qids.length){ toast("풀 문제가 없습니다."); return; }
  const ids = (OPTS.shuffleQ && !keepOrder) ? shuffle(qids) : qids.slice();
  S = {mode, title, items: ids.map(makeItem), i:0, ans:{}, startedAt: Date.now()};
  save(K.sess, S); renderQuiz();
}
function startArea(id){ start("area", D[id].title, D[id].questions.map(q => q.id)); }
function startSubject(n){
  const ids = AREAS.filter(a => D[a].subject === n).flatMap(a => D[a].questions.map(q => q.id));
  const s = subjOf(n); start("subject", `${s.name} 전체`, ids);
}
function startWrong(){ start("wrong", "오답노트", wrongIds()); }
const MOCK_AREAS = () => AREAS.filter(a => D[a].subject > 0 && D[a].examCount > 0);
const mockPool = () => MOCK_AREAS().reduce((n, a) => n + D[a].questions.length, 0);
const mockSeenCount = () => MOCK_AREAS().reduce((n, a) => n + D[a].questions.filter(q => MOCK.seen[q.id]).length, 0);
function startMock(){
  // 실제 출제 비율대로 영역별 문항 추출.
  // 같은 문제가 반복되지 않도록 모의고사에 덜 나온 문제부터 뽑고, 같은 횟수면 최근에 틀린 문제를 먼저,
  // 그다음은 무작위. 문제은행을 한 바퀴 다 돌아야 같은 문제가 다시 나온다.
  const ids = [];
  MOCK_AREAS().forEach(a => {
    const n = D[a].examCount;
    const ranked = shuffle(D[a].questions)
      .map(q => ({q, seen: MOCK.seen[q.id] || 0, wrong: STATS[q.id] && STATS[q.id].last === 0 ? 0 : 1}))
      .sort((x, y) => x.seen - y.seen || x.wrong - y.wrong);
    shuffle(ranked.slice(0, n)).forEach(r => ids.push(r.q.id));
  });
  ids.forEach(id => { MOCK.seen[id] = (MOCK.seen[id] || 0) + 1; });
  MOCK.runs++; save(K.mock, MOCK);
  start("mock", `실전 모의고사 ${MOCK.runs}회`, ids, true);
}

/* ---------- home ---------- */
function renderHome(){
  document.title = "투운사 모의고사";
  const total = Object.keys(Q).length;
  const seen = Object.keys(STATS).filter(id => Q[id]).length;
  const good = Object.keys(STATS).filter(id => Q[id] && STATS[id].last === 1).length;
  const wrong = wrongIds().length;
  const resume = S && S.i < S.items.length;
  let h = `<section class="card hero">
    <p><b>과목을 고르고 문제를 풀면 바로 정답과 해설이 나옵니다.</b> <span class="muted small">진행 기록은 이 기기 브라우저에 저장됩니다.</span></p>
    <div class="stats">
      <div class="stat"><b>${total}</b><span>전체 문제</span></div>
      <div class="stat"><b>${seen}</b><span>풀어본 문제</span></div>
      <div class="stat"><b>${seen ? Math.round(good/seen*100) : 0}%</b><span>최근 정답률</span></div>
    </div>
    ${resume ? `<button class="btn primary block" id="resume">이어서 풀기 · ${esc(S.title)} ${S.i+1}/${S.items.length}</button>` : ""}
    <button class="btn ${resume ? "" : "primary"} block" id="mock">실전 모의고사 100문항 <span class="small" style="font-weight:500">· 실제 출제 비율</span></button>
    <p class="muted small mockinfo">${MOCK.runs ? `모의고사 ${MOCK.runs}회 · 지금까지 출제된 문제 ${mockSeenCount()} / ${mockPool()}` : "풀 때마다 다른 문제가 나옵니다. 문제은행을 한 바퀴 다 돌 때까지 같은 문제는 다시 나오지 않습니다."}</p>
    <button class="btn block" id="wrong" ${wrong ? "" : "disabled"}>오답노트 ${wrong ? `${wrong}문제 다시 풀기` : "· 아직 틀린 문제 없음"}</button>
    <div class="opts">
      <label><input type="checkbox" id="optQ" ${OPTS.shuffleQ ? "checked" : ""}> 문제 순서 섞기</label>
      <label><input type="checkbox" id="optC" ${OPTS.shuffleC ? "checked" : ""}> 보기 순서 섞기</label>
    </div>
  </section>`;
  SUBJECTS.slice().sort((a,b) => (a.n||9) - (b.n||9)).forEach(s => {
    const areas = AREAS.filter(a => D[a].subject === s.n);
    if(!areas.length) return;
    const qn = areas.reduce((n,a) => n + D[a].questions.length, 0);
    h += `<section class="subject" style="--c:${s.color}">
      <div class="subject-head"><span class="dot"></span><h2>${esc(s.name === "2026" ? s.full : s.name)}</h2>
        <span class="sub">${s.exam ? `시험 ${s.exam}문항 · ` : ""}문제 ${qn}개</span></div>
      ${s.n ? `<p class="muted small" style="margin:-4px 0 10px">${esc(s.full)}</p>` : `<p class="muted small" style="margin:-4px 0 10px">세법 개정, 시험 일정·구성 등 정리노트 이후 바뀐 내용</p>`}
      <div class="areas">${areas.map(a => {
        const st = areaStats(a), d = D[a];
        return `<button class="card area" data-area="${a}" style="--c:${s.color}">
          <span class="t">${esc(d.title)}</span>
          <span class="m">${d.examCount ? `시험 ${d.examCount}문항 · ` : ""}문제 ${st.total}개 · 푼 문제 ${st.seen}${st.seen ? ` · 정답 ${st.good}` : ""}</span>
          <span class="meter" aria-hidden="true"><i class="g" style="width:${st.good/st.total*100}%"></i><i class="b" style="width:${st.bad/st.total*100}%"></i></span>
        </button>`;
      }).join("")}</div>
      ${areas.length > 1 ? `<button class="btn block subj-all" data-subj="${s.n}">${esc(s.name)} 전체 ${qn}문제 풀기</button>` : ""}
    </section>`;
  });
  h += `<p class="foot">출처: 개인 정리노트 「금융 관련 내용 정리」를 바탕으로 문제화하고, 2026년 세법·시험 변경사항을 반영했습니다.
    시험 구성과 합격 기준(과목별 40% 이상, 전체 70% 이상)은 한국금융투자협회 공지를 기준으로 합니다.
    최종 확인은 <a href="https://license.kofia.or.kr" target="_blank" rel="noopener">금융투자협회 자격시험센터</a>에서 하세요.<br>
    <button class="linkbtn" id="reset">학습 기록 모두 지우기</button></p>`;
  $view.innerHTML = h;
  const on = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
  on("resume", () => {
    const n = S.items.findIndex((_, i) => S.ans[i] === undefined);
    S.i = n < 0 ? S.items.length : n; save(K.sess, S); renderQuiz();
  });
  on("mock", startMock); on("wrong", startWrong);
  document.getElementById("optQ").onchange = e => { OPTS.shuffleQ = e.target.checked; save(K.opts, OPTS); };
  document.getElementById("optC").onchange = e => { OPTS.shuffleC = e.target.checked; save(K.opts, OPTS); };
  $view.querySelectorAll("[data-area]").forEach(b => b.onclick = () => startArea(b.dataset.area));
  $view.querySelectorAll("[data-subj]").forEach(b => b.onclick = () => startSubject(+b.dataset.subj));
  let armed = false;
  on("reset", e => {
    if(!armed){ armed = true; e.target.textContent = "한 번 더 누르면 모든 기록이 지워집니다"; setTimeout(() => { armed = false; if(e.target.isConnected) e.target.textContent = "학습 기록 모두 지우기"; }, 3000); return; }
    STATS = {}; S = null; MOCK = {runs:0, seen:{}}; save(K.stats, STATS); save(K.mock, MOCK); localStorage.removeItem(K.sess); toast("기록을 지웠습니다."); renderHome();
  });
  window.scrollTo(0,0);
}

/* ---------- quiz ---------- */
function renderQuiz(){
  if(!S) return renderHome();
  if(S.i >= S.items.length) return renderResult();
  const it = S.items[S.i], q = Q[it.qid], d = D[q.area], color = areaColor(q.area);
  const picked = S.ans[S.i];             // ox: true/false, mc: original choice index
  const done = picked !== undefined;
  const correct = done && picked === q.answer;
  document.title = `${S.i+1}/${S.items.length} · 투운사 모의고사`;
  let body;
  if(q.type === "ox"){
    const cls = v => !done ? "" : (v === q.answer ? "correct" : (v === picked ? "wrong" : ""));
    body = `<div class="ox" role="group" aria-label="O 또는 X 선택">
      <button class="oxbtn ${cls(true)}" data-ox="1" ${done ? "disabled" : ""} aria-label="O, 맞다">O<small>맞다</small></button>
      <button class="oxbtn ${cls(false)}" data-ox="0" ${done ? "disabled" : ""} aria-label="X, 틀리다">X<small>틀리다</small></button>
    </div>`;
  } else {
    body = `<div class="choices">${it.order.map((orig, k) => {
      let cls = "";
      if(done){ cls = orig === q.answer ? "correct" : (orig === picked ? "wrong" : "dim"); }
      return `<button class="choice ${cls}" data-c="${orig}" ${done ? "disabled" : ""}><span class="n">${k+1}</span><span>${esc(q.choices[orig])}</span></button>`;
    }).join("")}</div>`;
  }
  let verdict = "";
  if(done){
    const ansText = q.type === "ox" ? (q.answer ? "정답 O" : "정답 X") : `정답 ${it.order.indexOf(q.answer)+1}번`;
    verdict = `<div class="verdict ${correct ? "good" : "bad"}" role="status">
        <span class="mark" aria-hidden="true">${correct ? "O" : "X"}</span><span>${correct ? "정답" : "오답"}</span>
        <span class="ans">${esc(ansText)}</span></div>
      <div class="explain"><h3>해설</h3><p>${esc(q.explain)}</p>${practiceHtml(q)}${q.ref ? `<div class="ref">정리노트 · ${esc(q.ref)}</div>` : ""}</div>`;
  }
  const last = S.i + 1 === S.items.length;
  const answered = Object.keys(S.ans).length;
  $view.innerHTML = `
    <div class="qtop"><span class="count">${S.i+1} / ${S.items.length}</span><span>${esc(S.title)}</span><span class="spacer"></span>
      <button class="linkbtn" id="quit">${answered ? "그만하고 채점" : "나가기"}</button></div>
    <div class="bar" aria-hidden="true"><i style="width:${(S.i + (done?1:0))/S.items.length*100}%"></i></div>
    <article class="card qcard" style="--c:${color}">
      <span class="tag">${esc(d.title)}</span>
      <p class="qtext">${esc(q.q)}</p>
      ${body}
      ${verdict}
    </article>
    <div class="qnav">
      <button class="btn" id="prev" ${S.i ? "" : "disabled"} aria-label="이전 문제">이전</button>
      <button class="btn primary" id="next" ${done ? "" : "disabled"}>${last ? "결과 보기" : "다음 문제"}</button>
    </div>
    <p class="kbd">키보드: 1~4로 답하고 Enter로 다음</p>`;
  $view.querySelectorAll("[data-ox]").forEach(b => b.onclick = () => answer(b.dataset.ox === "1"));
  $view.querySelectorAll("[data-c]").forEach(b => b.onclick = () => answer(+b.dataset.c));
  document.getElementById("next").onclick = next;
  document.getElementById("prev").onclick = () => { if(S.i){ S.i--; save(K.sess, S); renderQuiz(); } };
  document.getElementById("quit").onclick = () => {
    if(!answered){ S = null; localStorage.removeItem(K.sess); renderHome(); return; }
    S.items = S.items.slice(0, Math.max(...Object.keys(S.ans).map(Number)) + 1);
    S.i = S.items.length; save(K.sess, S); renderResult();
  };
  if(done){ const v = $view.querySelector(".verdict"); if(v && v.getBoundingClientRect().top > innerHeight - 140) v.scrollIntoView({behavior:"smooth", block:"start"}); }
  else window.scrollTo(0,0);
}
function answer(v){
  if(!S || S.ans[S.i] !== undefined) return;
  const q = Q[S.items[S.i].qid];
  S.ans[S.i] = v;
  const ok = v === q.answer;
  const st = STATS[q.id] || {c:0, w:0};
  if(ok) st.c++; else st.w++;
  st.last = ok ? 1 : 0; st.t = Date.now();
  STATS[q.id] = st;
  save(K.stats, STATS); save(K.sess, S);
  if(navigator.vibrate && !ok) try{ navigator.vibrate(60); }catch(e){}
  renderQuiz();
}
function next(){
  if(!S || S.ans[S.i] === undefined) return;
  S.i = S.i + 1; save(K.sess, S); renderQuiz();
}

/* ---------- result ---------- */
function renderResult(){
  if(!S) return renderHome();
  document.title = "결과 · 투운사 모의고사";
  const rows = S.items.map((it, i) => ({it, q:Q[it.qid], a:S.ans[i]})).filter(r => r.a !== undefined);
  const good = rows.filter(r => r.a === r.q.answer).length;
  const pct = rows.length ? Math.round(good/rows.length*100) : 0;
  const wrongRows = rows.filter(r => r.a !== r.q.answer);
  let table = "";
  if(S.mode === "mock" || S.mode === "subject" || S.mode === "wrong"){
    const bySubj = {}, byArea = {};
    rows.forEach(r => {
      const sj = D[r.q.area].subject;
      (bySubj[sj] = bySubj[sj] || {g:0,n:0}).n++; if(r.a === r.q.answer) bySubj[sj].g++;
      (byArea[r.q.area] = byArea[r.q.area] || {g:0,n:0}).n++; if(r.a === r.q.answer) byArea[r.q.area].g++;
    });
    if(S.mode === "mock"){
      const fails = SUBJECTS.filter(s => s.n && bySubj[s.n] && bySubj[s.n].g / s.exam < .4);
      const full = rows.length === S.items.length;
      const passed = full && good >= 70 && !fails.length;
      table = `<div>${full ? `<span class="pass ${passed ? "ok" : "no"}">${passed ? "합격 기준 통과" : "불합격"}</span>` : `<span class="pass no">중간 채점 · ${rows.length}문항만 풀었음</span>`}
        <p class="muted small" style="margin:8px 0 0">합격 기준: 과목별 40% 이상, 100문항 중 70문항 이상</p></div>
        <table class="sc"><thead><tr><th>과목</th><th class="num">정답</th><th class="num">점수</th></tr></thead><tbody>
        ${SUBJECTS.filter(s => s.n).map(s => { const b = bySubj[s.n] || {g:0,n:0}; const p = Math.round(b.g/s.exam*100);
          return `<tr><td>${s.name} <span class="muted small">${esc(s.full)}</span></td><td class="num">${b.g}/${s.exam}</td><td class="num">${p}% ${p < 40 ? `<span class="flag">과락</span>` : ""}</td></tr>`; }).join("")}
        </tbody></table>`;
    }
    table += `<table class="sc"><thead><tr><th>영역</th><th class="num">정답</th><th class="num">정답률</th></tr></thead><tbody>
      ${AREAS.filter(a => byArea[a]).map(a => { const b = byArea[a]; return `<tr><td>${esc(D[a].title)}</td><td class="num">${b.g}/${b.n}</td><td class="num">${Math.round(b.g/b.n*100)}%</td></tr>`; }).join("")}
      </tbody></table>`;
  }
  const ansLabel = (r, v) => r.q.type === "ox" ? (v ? "O" : "X") : `${r.it.order.indexOf(v)+1}번 ${r.q.choices[v]}`;
  $view.innerHTML = `<section class="card result">
      <h2>${esc(S.title)} 결과</h2>
      <div class="score"><b>${good}</b><span class="muted">/ ${rows.length}문제 맞힘 · ${pct}%</span></div>
      ${table}
      <div class="row">
        ${wrongRows.length ? `<button class="btn primary" id="retry">틀린 ${wrongRows.length}문제 다시 풀기</button>` : ""}
        <button class="btn" id="home">처음으로</button>
      </div>
    </section>
    ${wrongRows.length ? `<h2 style="margin:22px 0 10px">틀린 문제 해설</h2><div class="wlist">${wrongRows.map(r => `
      <details class="card witem"><summary>${esc(r.q.q)}</summary>
        <p class="small" style="margin:8px 0 0"><span style="color:var(--bad)">내 답 ${esc(ansLabel(r, r.a))}</span> · <span style="color:var(--good)">정답 ${esc(ansLabel(r, r.q.answer))}</span></p>
        <div class="explain"><p>${esc(r.q.explain)}</p>${practiceHtml(r.q)}${r.q.ref ? `<div class="ref">${esc(D[r.q.area].title)} · ${esc(r.q.ref)}</div>` : ""}</div>
      </details>`).join("")}</div>` : `<p class="empty card" style="margin-top:14px">모두 맞혔습니다.</p>`}`;
  const ids = wrongRows.map(r => r.q.id);
  const rt = document.getElementById("retry"); if(rt) rt.onclick = () => start("wrong", "틀린 문제 다시 풀기", ids);
  document.getElementById("home").onclick = () => { S = null; localStorage.removeItem(K.sess); renderHome(); };
  window.scrollTo(0,0);
}

/* ---------- theme ---------- */
const THEMES = ["system","light","dark"];
let theme = load(K.theme, "system");
function applyTheme(){
  const root = document.documentElement, b = document.getElementById("themeBtn");
  if(theme === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme);
  const icon = {system:'<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
    light:'<circle cx="12" cy="12" r="4" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g>',
    dark:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor"/>'}[theme];
  b.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;
  b.title = {system:"테마: 기기 설정", light:"테마: 밝게", dark:"테마: 어둡게"}[theme];
}
document.getElementById("themeBtn").onclick = () => { theme = THEMES[(THEMES.indexOf(theme)+1) % 3]; save(K.theme, theme); applyTheme(); };
applyTheme();

/* ---------- keyboard ---------- */
document.addEventListener("keydown", e => {
  if(e.metaKey || e.ctrlKey || e.altKey || !S || S.i >= S.items.length || !$view.querySelector(".qcard")) return;
  if(e.target instanceof HTMLInputElement) return;
  const q = Q[S.items[S.i].qid], done = S.ans[S.i] !== undefined, k = e.key.toLowerCase();
  if(!done && q.type === "ox" && (k === "o" || k === "x")){ e.preventDefault(); answer(k === "o"); }
  else if(!done && q.type === "mc" && /^[1-4]$/.test(k)){ e.preventDefault(); answer(S.items[S.i].order[+k - 1]); }
  else if(done && (k === "enter" || k === "arrowright")){ e.preventDefault(); next(); }
  else if(k === "arrowleft" && S.i){ S.i--; save(K.sess, S); renderQuiz(); }
});

document.getElementById("homeBtn").onclick = renderHome;
renderHome();
})();
