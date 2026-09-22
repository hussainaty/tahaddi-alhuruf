const ARABIC_LETTERS = [
  "ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص",
  "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي",
];

const COLORS = [
  { id: "blue", label: "أزرق", value: "oklch(58% 0.16 244)", ink: "oklch(98% 0.005 244)" },
  { id: "orange", label: "برتقالي", value: "oklch(70% 0.16 55)", ink: "oklch(22% 0.035 55)" },
  { id: "green", label: "أخضر", value: "oklch(62% 0.15 153)", ink: "oklch(98% 0.005 153)" },
  { id: "violet", label: "بنفسجي", value: "oklch(58% 0.17 300)", ink: "oklch(98% 0.005 300)" },
  { id: "red", label: "أحمر", value: "oklch(60% 0.2 27)", ink: "oklch(98% 0.005 27)" },
  { id: "yellow", label: "أصفر داكن", value: "oklch(56% 0.14 92)", ink: "oklch(97% 0.012 92)" },
];

const STORAGE_KEY = "tahaddi-alhuruf-demo-v1";
const app = document.querySelector("#app-main");
const toastRegion = document.querySelector("#toast-region");
const confirmDialog = document.querySelector("#confirm-dialog");
let timerInterval = null;
let pendingConfirm = null;
let claimIndex = null;

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function initialRound() {
  const shuffled = shuffle(ARABIC_LETTERS);
  return { letters: shuffled.slice(0, 25), waiting: shuffled.slice(25) };
}

function makeDefaultState() {
  const round = initialRound();
  return {
    screen: "home",
    teams: [
      { name: "فريق اليمامة", color: "blue" },
      { name: "فريق السرو", color: "orange" },
    ],
    letters: round.letters,
    waiting: round.waiting,
    owners: Array(25).fill(null),
    currentTeam: 0,
    startMode: "random",
    selected: null,
    timerMode: "30",
    customSeconds: 20,
    timerRemaining: 30,
    timerRunning: false,
    paused: false,
    winner: null,
    winningPath: [],
    history: [],
    pendingSnapshot: null,
    sound: true,
    sessionCode: "٣٨٢١",
    buzzer: null,
    phoneJoined: false,
    phoneTeam: 0,
    phoneName: "",
    round: 1,
    gameStarted: true,
  };
}

function loadState() {
  const fallback = makeDefaultState();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.owners) || saved.owners.length !== 25) return fallback;
    return {
      ...fallback,
      ...saved,
      screen: "home",
      timerRunning: false,
      paused: false,
      selected: saved.selected ?? null,
      history: Array.isArray(saved.history) ? saved.history.slice(-20) : [],
    };
  } catch {
    return fallback;
  }
}

let state = loadState();

function persist() {
  const safeState = { ...state, screen: undefined, pendingSnapshot: undefined };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeState));
}

function getColor(teamIndex) {
  return COLORS.find((color) => color.id === state.teams[teamIndex].color) || COLORS[teamIndex];
}

function setTeamVariables() {
  const one = getColor(0);
  const two = getColor(1);
  document.documentElement.style.setProperty("--team-one", one.value);
  document.documentElement.style.setProperty("--team-one-ink", one.ink);
  document.documentElement.style.setProperty("--team-two", two.value);
  document.documentElement.style.setProperty("--team-two-ink", two.ink);
}

function durationSeconds() {
  if (state.timerMode === "none") return 0;
  if (state.timerMode === "custom") return Math.max(5, Number(state.customSeconds) || 20);
  return Number(state.timerMode);
}

function formatNumber(value) {
  return new Intl.NumberFormat("ar-EG", { useGrouping: false }).format(value);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, type = "") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 2600);
}

function beep(kind = "neutral") {
  if (!state.sound) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = kind === "success" ? 680 : kind === "error" ? 190 : 420;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (kind === "success" ? 0.34 : 0.18));
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.38);
    oscillator.addEventListener("ended", () => context.close());
  } catch {
    // Audio is enhancement only.
  }
}

function setScreen(screen) {
  stopTimer();
  state.screen = screen;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  requestAnimationFrame(() => app.focus({ preventScroll: true }));
}

function updateNav() {
  document.querySelectorAll("[data-go]").forEach((button) => {
    const active = button.dataset.go === state.screen;
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.querySelector("#header-session-code").textContent = state.sessionCode;
}

function teamStyle(index) {
  const color = getColor(index);
  return `--team-color:${color.value};--team-ink:${color.ink}`;
}

function renderHome() {
  return `
    <section class="screen home-screen" aria-labelledby="home-title">
      <div class="home-copy">
        <p class="eyebrow">لعبة عربية لفريقين</p>
        <h1 id="home-title">تحدّي<br />الحروف</h1>
        <p class="lead">اختاروا الحرف، أجيبوا عن السؤال، وابنوا طريق فريقكم عبر الرقعة قبل الخصم.</p>
        <div class="button-row">
          <button class="button button-primary" type="button" data-go="setup">إعداد مسابقة</button>
          <button class="button button-secondary" type="button" data-go="how">طريقة اللعب</button>
          ${state.gameStarted ? '<button class="button button-quiet" type="button" data-go="game">متابعة الجولة</button>' : ""}
        </div>
        <div class="home-meta" aria-label="خصائص اللعبة">
          <span>رقعة ٥×٥</span>
          <span>فريقان</span>
          <span>مدير مسابقة واحد</span>
        </div>
      </div>

      <div class="home-board-card" aria-label="معاينة الرقعة">
        <div class="preview-header">
          <div>
            <p class="eyebrow">الجولة الأولى</p>
            <h2>الرقعة جاهزة</h2>
          </div>
          <span class="live-indicator">جاهز للبدء</span>
        </div>
        <div class="mini-board" aria-hidden="true">
          ${Array.from({ length: 5 }, (_, row) => `
            <div class="mini-row">
              ${state.letters.slice(row * 5, row * 5 + 5).map((letter, col) => {
                const sample = (row === 1 && col < 2) || (row === 2 && col === 2) ? "one" : (row === 3 && col > 2) ? "two" : "";
                return `<span class="mini-cell ${sample}"><span>${letter}</span></span>`;
              }).join("")}
            </div>`).join("")}
        </div>
        <div class="preview-footer">
          <span>${escapeHtml(state.teams[0].name)} ◆</span>
          <strong class="preview-timer">٣٠</strong>
          <span>● ${escapeHtml(state.teams[1].name)}</span>
        </div>
      </div>
    </section>`;
}

function renderHow() {
  return `
    <section class="screen how-screen" aria-labelledby="how-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">القواعد في دقيقة</p>
          <h1 id="how-title">كيف تجري المسابقة؟</h1>
        </div>
        <button class="button button-secondary" type="button" data-go="home">رجوع</button>
      </div>
      <div class="steps-grid">
        <article class="step-card">
          <span class="step-number">١</span>
          <h2>اختر خلية محايدة</h2>
          <p>يختار الفريق حرفاً، ثم يضغط مدير المسابقة على خليته. تتوقف بقية الخلايا حتى تسجيل النتيجة.</p>
        </article>
        <article class="step-card">
          <span class="step-number">٢</span>
          <h2>اقرأ سؤالاً من كتابك</h2>
          <p>الأسئلة والإجابات خارج المنصة. يقرأ المدير سؤالاً تبدأ إجابته بالحرف المختار.</p>
        </article>
        <article class="step-card">
          <span class="step-number">٣</span>
          <h2>سجّل النتيجة</h2>
          <p>الإجابة الصحيحة تلوّن الخلية للفريق. الإجابة الخاطئة تعيدها محايدة ومتاحة في دور لاحق.</p>
        </article>
        <article class="step-card">
          <span class="step-number">٤</span>
          <h2>أكمل المسار</h2>
          <p>الفوز ليس بعدد الخلايا؛ يفوز أول فريق يصل بين حافتيه بخلايا متجاورة عبر ضلع كامل.</p>
        </article>
        <article class="step-card step-card-wide">
          <span class="step-number">٥</span>
          <h2>جرس الأولوية (الهاتف)</h2>
          <p>عند فتح الجرس، أول فرد يضغط زر هاتفه يُقفل الجرس لبقية اللاعبين وتظهر شاشة المدير اسم فريقه فوراً — ليعرف مدير المسابقة أي فريق يجيب أولاً. القرار النهائي بيد المدير: يمنح الدور لذلك الفريق، ثم يسجّل إجابته الصحيحة أو الخاطئة كالمعتاد بزر «إجابة صحيحة»/«إجابة خاطئة»، فتنتقل الخلية إلى الفريق الفائز بالسبق. اضغط «فتح الجرس من جديد» قبل كل سؤال تنافسي.</p>
        </article>
      </div>
      <div class="direction-note">
        <div class="direction-item" style="${teamStyle(0)}">
          <strong style="color:var(--team-color)">◆ الفريق الأول</strong>
          <span>يبني مساراً من اليمين إلى اليسار.</span>
        </div>
        <div class="direction-item" style="${teamStyle(1)}">
          <strong style="color:var(--team-color)">● الفريق الثاني</strong>
          <span>يبني مساراً من الأعلى إلى الأسفل.</span>
        </div>
      </div>
    </section>`;
}

function colorOptions(teamIndex) {
  return COLORS.map((color) => {
    const otherColor = state.teams[teamIndex === 0 ? 1 : 0].color;
    return `
      <label class="color-option" title="${color.label}">
        <input type="radio" name="team-${teamIndex}-color" value="${color.id}"
          ${state.teams[teamIndex].color === color.id ? "checked" : ""}
          ${otherColor === color.id ? "disabled" : ""} />
        <span style="--swatch:${color.value};--swatch-ink:${color.ink}" aria-hidden="true">${teamIndex === 0 ? "◆" : "●"}</span>
        <span class="sr-only">${color.label}</span>
      </label>`;
  }).join("");
}

function renderSetup() {
  return `
    <section class="screen setup-screen" aria-labelledby="setup-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">قبل بدء الجولة</p>
          <h1 id="setup-title">إعداد المسابقة</h1>
        </div>
        <button class="button button-secondary" type="button" data-go="home">رجوع</button>
      </div>

      <form id="setup-form" class="setup-form">
        ${[0, 1].map((index) => `
          <section class="form-section">
            <h2>${index === 0 ? "◆ الفريق الأول" : "● الفريق الثاني"}</h2>
            <div class="field">
              <label for="team-${index}-name">اسم الفريق</label>
              <input id="team-${index}-name" name="team-${index}-name" type="text" maxlength="28" required value="${escapeHtml(state.teams[index].name)}" />
            </div>
            <fieldset class="field">
              <legend>لون الفريق</legend>
              <div class="color-options">${colorOptions(index)}</div>
            </fieldset>
          </section>`).join("")}

        <section class="form-section">
          <h2>بداية الجولة</h2>
          <fieldset class="field">
            <legend>الفريق البادئ</legend>
            <div class="segmented-options">
              ${[
                ["random", "عشوائي"],
                ["team-0", "الفريق الأول"],
                ["team-1", "الفريق الثاني"],
              ].map(([value, label]) => `
                <label>
                  <input type="radio" name="start-mode" value="${value}" ${state.startMode === value ? "checked" : ""} />
                  <span>${label}</span>
                </label>`).join("")}
            </div>
          </fieldset>
          <div class="board-size-lock">
            <div>
              <strong>حجم الرقعة</strong>
              <span>خمسة وعشرون حرفاً في كل جولة</span>
            </div>
            <strong class="size-mark">5 × 5</strong>
          </div>
        </section>

        <section class="form-section">
          <h2>المؤقّت</h2>
          <div class="field">
            <label for="timer-mode">مدة الإجابة</label>
            <select id="timer-mode" name="timer-mode">
              <option value="10" ${state.timerMode === "10" ? "selected" : ""}>١٠ ثوانٍ</option>
              <option value="15" ${state.timerMode === "15" ? "selected" : ""}>١٥ ثانية</option>
              <option value="30" ${state.timerMode === "30" ? "selected" : ""}>٣٠ ثانية</option>
              <option value="custom" ${state.timerMode === "custom" ? "selected" : ""}>مدة مخصصة</option>
              <option value="none" ${state.timerMode === "none" ? "selected" : ""}>دون مؤقّت</option>
            </select>
          </div>
          <div class="field" id="custom-timer-field" ${state.timerMode !== "custom" ? "hidden" : ""}>
            <label for="custom-seconds">الثواني</label>
            <input id="custom-seconds" name="custom-seconds" type="number" min="5" max="180" value="${state.customSeconds}" />
          </div>
        </section>

        <section class="form-section form-section-wide">
          <div class="panel-heading">
            <div>
              <h2>حروف الجولة</h2>
              <p class="empty-note">تتغيّر المواقع فقط عند إعادة التوزيع. الحروف الثلاثة المؤجلة تدخل الجولة التالية تلقائياً.</p>
            </div>
            <button class="button button-secondary" type="button" id="reshuffle-letters">إعادة توزيع الحروف</button>
          </div>
          <div class="setup-summary">
            <p>الجولة ${formatNumber(state.round)} · ${formatNumber(state.letters.length)} حرفاً · محفوظة تلقائياً</p>
            <button class="button button-primary" type="submit">ابدأ الجولة</button>
          </div>
        </section>
      </form>
    </section>`;
}

function snapshot() {
  return {
    owners: [...state.owners],
    currentTeam: state.currentTeam,
    selected: null,
    timerRemaining: durationSeconds(),
    timerRunning: false,
    winner: null,
    winningPath: [],
  };
}

function renderTeamStatus(index) {
  const current = state.currentTeam === index && !state.winner;
  return `
    <div class="team-status ${current ? "current" : ""}" style="${teamStyle(index)}">
      <span class="team-symbol" aria-hidden="true">${index === 0 ? "◆" : "●"}</span>
      <div>
        <strong>${escapeHtml(state.teams[index].name)}</strong>
        <small>${index === 0 ? "اليمين ↔ اليسار" : "الأعلى ↕ الأسفل"}</small>
      </div>
    </div>`;
}

function edgeClass(q, r) {
  const edge0 = q === 0 || q === 4;
  const edge1 = r === 0 || r === 4;
  if (edge0 && edge1) return "edge-both";
  if (edge0) return "edge-team-0";
  if (edge1) return "edge-team-1";
  return "";
}

function renderBoard(interactive = true) {
  return `
    <div class="hex-board" role="grid" aria-label="رقعة الحروف، خمسة صفوف وخمسة أعمدة">
      ${Array.from({ length: 5 }, (_, r) => `
        <div class="hex-row" data-row="${r}" role="row">
          ${Array.from({ length: 5 }, (_, q) => {
            const index = r * 5 + q;
            const owner = state.owners[index];
            const selected = state.selected === index;
            const winningIndex = state.winningPath.indexOf(index);
            const disabled = !interactive || state.winner !== null || (state.selected !== null && !selected) || owner !== null || state.paused;
            const classes = [
              "hex-cell",
              edgeClass(q, r),
              selected ? "selected" : "",
              owner !== null ? `owner-${owner}` : "",
              claimIndex === index ? "just-claimed" : "",
              winningIndex >= 0 ? "winning" : "",
            ].filter(Boolean).join(" ");
            const label = owner === null ? `حرف ${state.letters[index]}, خلية محايدة` : `حرف ${state.letters[index]}, مملوكة لـ${state.teams[owner].name}`;
            return `<button class="${classes}" type="button" role="gridcell" data-cell="${index}" ${disabled ? "disabled" : ""} aria-label="${escapeHtml(label)}" style="--path-delay:${Math.max(0, winningIndex) * 120}ms"><span aria-hidden="true">${state.letters[index]}</span></button>`;
          }).join("")}
        </div>`).join("")}
    </div>`;
}

function renderArena(interactive = true, audience = false) {
  return `
    <section class="arena" aria-label="ساحة اللعب">
      <div class="stage-backdrop" aria-hidden="true"></div>
      <div class="board-stage">
        <div class="goal-frame" aria-hidden="true"></div>
        ${renderBoard(interactive)}
      </div>
      ${audience ? `<p class="audience-caption">${state.selected !== null ? `السؤال الآن على حرف «${state.letters[state.selected]}»` : `الدور على ${escapeHtml(state.teams[state.currentTeam].name)}`}</p>` : ""}
    </section>`;
}

function renderTopbar() {
  return `
    <div class="game-topbar">
      ${renderTeamStatus(0)}
      <div class="turn-status" aria-live="polite">
        <span>${state.paused ? "المسابقة متوقفة مؤقتاً" : state.selected !== null ? "بانتظار حكم المدير" : "الدور الآن"}</span>
        <strong>${escapeHtml(state.teams[state.currentTeam].name)}</strong>
      </div>
      ${renderTeamStatus(1)}
    </div>`;
}

function renderGame() {
  const hasSelection = state.selected !== null;
  const timerOff = durationSeconds() === 0;
  const buzzerTeam = state.buzzer ? state.buzzer.team : null;
  return `
    <section class="screen game-screen" aria-label="شاشة مدير المسابقة">
      ${renderTopbar()}
      <div class="game-layout">
        ${renderArena(true)}
        <aside class="host-panel" aria-label="أدوات مدير المسابقة">
          <section class="control-card">
            <h2>السؤال الحالي</h2>
            <div class="selected-letter">
              <span class="selected-letter-glyph" aria-hidden="true">${hasSelection ? state.letters[state.selected] : "—"}</span>
              <p>${hasSelection ? `اقرأ سؤالاً تبدأ إجابته بحرف <strong>«${state.letters[state.selected]}»</strong> من كتاب الأسئلة.` : "اختر خلية محايدة من الرقعة لبدء السؤال."}</p>
            </div>
          </section>

          <section class="timer-card ${state.timerRemaining <= 5 && hasSelection && !timerOff ? "urgent" : ""}" aria-label="المؤقت">
            <div>
              <span>${timerOff ? "المؤقّت متوقف من الإعداد" : state.timerRemaining === 0 ? "انتهى الوقت" : state.timerRunning ? "الوقت المتبقي" : "المؤقّت"}</span>
              <div class="timer-value">${timerOff ? "—" : formatNumber(state.timerRemaining)}</div>
            </div>
            <button class="button button-secondary" type="button" id="timer-toggle" ${!hasSelection || timerOff ? "disabled" : ""}>${state.timerRunning ? "إيقاف" : "تشغيل"}</button>
          </section>

          <div class="answer-actions">
            <button class="button button-success" type="button" id="answer-correct" ${!hasSelection ? "disabled" : ""}>إجابة صحيحة</button>
            <button class="button button-danger" type="button" id="answer-wrong" ${!hasSelection ? "disabled" : ""}>إجابة خاطئة</button>
          </div>

          <section class="control-card">
            <h2>أدوات الجولة</h2>
            <div class="utility-actions">
              <button class="button button-secondary" type="button" id="undo-action" ${state.history.length === 0 ? "disabled" : ""}>تراجع</button>
              <button class="button button-secondary" type="button" id="pause-action">${state.paused ? "استئناف" : "إيقاف مؤقت"}</button>
              <button class="button button-secondary" type="button" id="sound-action">الصوت: ${state.sound ? "مفعّل" : "مكتوم"}</button>
              <button class="button button-secondary" type="button" id="end-action">إنهاء المسابقة</button>
            </div>
          </section>

          <section class="buzzer-card">
            <div class="panel-heading">
              <h2>جرس الفريقين</h2>
              <span class="live-indicator">متصل</span>
            </div>
            ${state.buzzer ? `
              <div class="buzzer-result locked" style="${teamStyle(buzzerTeam)}">
                <strong style="color:var(--team-color)">${buzzerTeam === 0 ? "◆" : "●"} ${escapeHtml(state.teams[buzzerTeam].name)}</strong>
                <span>${escapeHtml(state.buzzer.name || "أحد أفراد الفريق")} ضغط أولاً</span>
              </div>
              <button class="button button-secondary" type="button" id="reset-buzzer">فتح الجرس من جديد</button>` : `
              <div class="buzzer-result">لم يضغط أي فريق بعد. افتح شاشة الهاتف لتجربة الجرس.</div>
              <button class="button button-secondary" type="button" data-go="phone">افتح هاتف الفريق</button>`}
          </section>
        </aside>
      </div>
    </section>`;
}

function renderAudience() {
  return `
    <section class="screen audience-screen" aria-label="شاشة العرض للجمهور">
      ${renderTopbar()}
      ${renderArena(false, true)}
    </section>`;
}

function renderPhone() {
  const team = state.phoneTeam;
  const color = getColor(team);
  const locked = state.buzzer !== null;
  const ownLock = locked && state.buzzer.team === team && state.buzzer.name === (state.phoneName || "لاعب");
  return `
    <section class="screen phone-screen" aria-labelledby="phone-title">
      <div class="phone-copy">
        <p class="eyebrow">واجهة المتسابق</p>
        <h1 id="phone-title">هاتفك هو الجرس.</h1>
        <p>يدخل كل فريق رمز الجلسة مرة واحدة. أول ضغطة تصل إلى شاشة المدير وتقفل الزر لدى بقية المشاركين.</p>
        <div class="direction-item">
          <strong>للعرض التجريبي</strong>
          <span>اضغط الجرس هنا، ثم انتقل إلى شاشة «المدير» لترى اسم الفريق الذي سبق.</span>
        </div>
      </div>

      <div class="phone-device" aria-label="معاينة شاشة هاتف الفريق">
        <div class="phone-inner">
          <div class="phone-top">
            <span><i class="phone-status-dot"></i>متصل بالجلسة</span>
            <strong>${state.sessionCode}</strong>
          </div>
          ${!state.phoneJoined ? `
            <div>
              <p class="eyebrow">انضم إلى المسابقة</p>
              <h2>اختر فريقك</h2>
            </div>
            <form id="phone-join-form" class="join-form">
              <div class="field">
                <label for="phone-name">اسمك</label>
                <input id="phone-name" name="phone-name" type="text" maxlength="24" placeholder="مثال: ريم" value="${escapeHtml(state.phoneName)}" required />
              </div>
              <fieldset class="field">
                <legend>الفريق</legend>
                <div class="phone-team-options">
                  ${[0, 1].map((index) => {
                    const optionColor = getColor(index);
                    return `<label class="phone-team-option" style="--option-color:${optionColor.value}">
                      <input type="radio" name="phone-team" value="${index}" ${state.phoneTeam === index ? "checked" : ""} />
                      <span>${index === 0 ? "◆" : "●"}<br />${escapeHtml(state.teams[index].name)}</span>
                    </label>`;
                  }).join("")}
                </div>
              </fieldset>
              <button class="button button-primary" type="submit">دخول الجلسة</button>
            </form>` : `
            <div class="buzzer-view">
              <span class="buzzer-team-name">${team === 0 ? "◆" : "●"} ${escapeHtml(state.teams[team].name)}</span>
              <button class="buzzer-button ${locked ? "locked" : ""}" type="button" id="phone-buzzer" ${locked ? "disabled" : ""} style="--buzzer-color:${color.value};--buzzer-ink:${color.ink}">
                ${locked ? "تم القفل" : "اضغط"}
              </button>
              <div class="buzzer-message" aria-live="polite">
                ${!locked ? "جاهز — انتظر السؤال" : ownLock ? `<strong>أنت الأسرع</strong>أجب الآن أمام مدير المسابقة` : `<strong>${escapeHtml(state.teams[state.buzzer.team].name)} سبق</strong>انتظر حتى يفتح المدير الجرس`}
              </div>
            </div>
            <button class="button button-quiet phone-footer-action" type="button" id="leave-phone">تبديل اللاعب أو الفريق</button>`}
        </div>
      </div>
    </section>`;
}

function renderWinner() {
  const winner = state.winner ?? 0;
  const color = getColor(winner);
  return `
    <section class="screen winner-screen" aria-labelledby="winner-title">
      <div class="winner-card" style="--winner-color:${color.value};--winner-ink:${color.ink}">
        <span class="winner-symbol" aria-hidden="true">${winner === 0 ? "◆" : "●"}</span>
        <p class="eyebrow">اكتمل المسار</p>
        <h1 id="winner-title">${escapeHtml(state.teams[winner].name)} يفوز</h1>
        <p>${winner === 0 ? "وصل الفريق بين الحافتين اليمنى واليسرى." : "وصل الفريق بين الحافتين العليا والسفلى."}</p>
        <div class="button-row">
          <button class="button button-primary" type="button" id="replay-round">إعادة الجولة</button>
          <button class="button button-secondary" type="button" id="new-round">جولة جديدة</button>
          <button class="button button-quiet" type="button" data-go="setup">الإعدادات</button>
          <button class="button button-quiet" type="button" data-go="audience">عرض مسار الفوز</button>
        </div>
      </div>
    </section>`;
}

function render() {
  setTeamVariables();
  const views = {
    home: renderHome,
    how: renderHow,
    setup: renderSetup,
    game: renderGame,
    audience: renderAudience,
    phone: renderPhone,
    winner: renderWinner,
  };
  app.innerHTML = (views[state.screen] || renderHome)();
  updateNav();
  bindViewEvents();
}

function bindViewEvents() {
  app.querySelectorAll("[data-cell]").forEach((cell) => cell.addEventListener("click", handleCellSelection));

  const setupForm = document.querySelector("#setup-form");
  if (setupForm) {
    setupForm.addEventListener("submit", startGameFromSetup);
    setupForm.querySelectorAll('input[name$="-color"]').forEach((input) => input.addEventListener("change", handleColorChange));
    setupForm.querySelector("#timer-mode").addEventListener("change", (event) => {
      document.querySelector("#custom-timer-field").hidden = event.target.value !== "custom";
    });
    document.querySelector("#reshuffle-letters").addEventListener("click", reshuffleLetters);
  }

  document.querySelector("#answer-correct")?.addEventListener("click", () => resolveAnswer(true));
  document.querySelector("#answer-wrong")?.addEventListener("click", () => resolveAnswer(false));
  document.querySelector("#timer-toggle")?.addEventListener("click", toggleTimer);
  document.querySelector("#undo-action")?.addEventListener("click", undoLastAction);
  document.querySelector("#pause-action")?.addEventListener("click", togglePause);
  document.querySelector("#sound-action")?.addEventListener("click", toggleSound);
  document.querySelector("#end-action")?.addEventListener("click", requestEndGame);
  document.querySelector("#reset-buzzer")?.addEventListener("click", resetBuzzer);
  document.querySelector("#phone-join-form")?.addEventListener("submit", joinPhone);
  document.querySelector("#phone-buzzer")?.addEventListener("click", pressBuzzer);
  document.querySelector("#leave-phone")?.addEventListener("click", leavePhone);
  document.querySelector("#replay-round")?.addEventListener("click", replayRound);
  document.querySelector("#new-round")?.addEventListener("click", newRound);
}

function handleColorChange(event) {
  const teamIndex = Number(event.target.name.match(/team-(\d)-color/)[1]);
  state.teams[teamIndex].color = event.target.value;
  render();
}

function startGameFromSetup(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.teams[0].name = String(data.get("team-0-name") || "الفريق الأول").trim();
  state.teams[1].name = String(data.get("team-1-name") || "الفريق الثاني").trim();
  state.teams[0].color = String(data.get("team-0-color") || "blue");
  state.teams[1].color = String(data.get("team-1-color") || "orange");
  state.startMode = String(data.get("start-mode") || "random");
  state.timerMode = String(data.get("timer-mode") || "30");
  state.customSeconds = Number(data.get("custom-seconds")) || 20;
  state.currentTeam = state.startMode === "random" ? Math.floor(Math.random() * 2) : Number(state.startMode.split("-")[1]);
  state.owners = Array(25).fill(null);
  state.selected = null;
  state.timerRemaining = durationSeconds();
  state.timerRunning = false;
  state.paused = false;
  state.winner = null;
  state.winningPath = [];
  state.history = [];
  state.pendingSnapshot = null;
  state.buzzer = null;
  state.gameStarted = true;
  persist();
  setScreen("game");
  showToast(`بدأت الجولة. الدور على ${state.teams[state.currentTeam].name}.`, "success");
}

function reshuffleLetters() {
  const previous = state.letters.join("");
  let next = shuffle(state.letters);
  while (next.join("") === previous) next = shuffle(state.letters);
  state.letters = next;
  persist();
  render();
  showToast("تغيّرت مواقع الحروف، وبقيت مجموعة الجولة كما هي.");
}

function handleCellSelection(event) {
  const index = Number(event.currentTarget.dataset.cell);
  if (state.selected !== null || state.owners[index] !== null || state.paused || state.winner !== null) return;
  state.pendingSnapshot = snapshot();
  state.selected = index;
  state.timerRemaining = durationSeconds();
  state.timerRunning = durationSeconds() > 0;
  state.buzzer = null;
  if (state.timerRunning) startTimer();
  persist();
  render();
  beep();
}

function startTimer() {
  stopTimer(false);
  if (!state.timerRunning || state.timerRemaining <= 0) return;
  timerInterval = window.setInterval(() => {
    if (!state.timerRunning || state.paused) return;
    state.timerRemaining = Math.max(0, state.timerRemaining - 1);
    if (state.timerRemaining <= 5 && state.timerRemaining > 0) beep("error");
    if (state.timerRemaining === 0) {
      stopTimer(false);
      state.timerRunning = false;
      beep("error");
      showToast("انتهى الوقت — سجّل الإجابة خاطئة عند التأكد.", "error");
    }
    persist();
    if (state.screen === "game" || state.screen === "audience") render();
  }, 1000);
}

function stopTimer(setState = true) {
  if (timerInterval) window.clearInterval(timerInterval);
  timerInterval = null;
  if (setState) state.timerRunning = false;
}

function toggleTimer() {
  if (state.timerRunning) {
    stopTimer();
    showToast("أوقف المدير المؤقّت.");
  } else if (state.timerRemaining > 0) {
    state.timerRunning = true;
    startTimer();
  }
  persist();
  render();
}

function resolveAnswer(correct) {
  if (state.selected === null) return;
  stopTimer();
  const index = state.selected;
  const answeredBy = state.currentTeam;
  state.history.push(state.pendingSnapshot || snapshot());
  state.history = state.history.slice(-20);

  if (correct) {
    state.owners[index] = answeredBy;
    claimIndex = index;
    beep("success");
  } else {
    beep("error");
  }

  state.selected = null;
  state.pendingSnapshot = null;
  state.timerRemaining = durationSeconds();
  state.buzzer = null;

  if (correct) {
    const path = findWinningPath(answeredBy);
    if (path.length) {
      state.winner = answeredBy;
      state.winningPath = path;
      persist();
      state.screen = "audience";
      render();
      window.setTimeout(() => {
        beep("success");
        state.screen = "winner";
        persist();
        render();
      }, Math.max(1250, path.length * 120 + 650));
      return;
    }
  }

  state.currentTeam = answeredBy === 0 ? 1 : 0;
  persist();
  render();
  showToast(correct ? `سُجّلت الخلية لـ${state.teams[answeredBy].name}.` : "عادت الخلية محايدة وانتقل الدور.", correct ? "success" : "error");
  window.setTimeout(() => { claimIndex = null; }, 450);
}

function neighbors(index) {
  const q = index % 5;
  const r = Math.floor(index / 5);
  const rowNeighbors = r % 2 === 0 ? [q - 1, q] : [q, q + 1];
  return [
    [q - 1, r],
    [q + 1, r],
    ...rowNeighbors.flatMap((nextQ) => [[nextQ, r - 1], [nextQ, r + 1]]),
  ].filter(([nextQ, nextR]) => nextQ >= 0 && nextQ < 5 && nextR >= 0 && nextR < 5)
    .map(([nextQ, nextR]) => nextR * 5 + nextQ);
}

function findWinningPath(team) {
  const starts = [];
  for (let index = 0; index < 25; index += 1) {
    const q = index % 5;
    const r = Math.floor(index / 5);
    if (state.owners[index] === team && (team === 0 ? q === 0 : r === 0)) starts.push(index);
  }

  const queue = [...starts];
  const visited = new Set(starts);
  const parent = new Map();
  let end = null;

  while (queue.length) {
    const current = queue.shift();
    const q = current % 5;
    const r = Math.floor(current / 5);
    if ((team === 0 && q === 4) || (team === 1 && r === 4)) {
      end = current;
      break;
    }
    neighbors(current).forEach((next) => {
      if (!visited.has(next) && state.owners[next] === team) {
        visited.add(next);
        parent.set(next, current);
        queue.push(next);
      }
    });
  }

  if (end === null) return [];
  const path = [end];
  while (parent.has(path[0])) path.unshift(parent.get(path[0]));
  return path;
}

function undoLastAction() {
  if (!state.history.length) return;
  const performUndo = () => {
    const previous = state.history.pop();
    Object.assign(state, previous);
    state.pendingSnapshot = null;
    stopTimer();
    persist();
    state.screen = "game";
    render();
    showToast("تم التراجع عن آخر نتيجة.");
  };
  if (state.winner !== null) requestConfirm("التراجع عن الفوز؟", "سيعود آخر حرف إلى حالته السابقة وتُستأنف الجولة.", performUndo);
  else performUndo();
}

function togglePause() {
  state.paused = !state.paused;
  persist();
  render();
  showToast(state.paused ? "أُوقفت المسابقة مؤقتاً." : "استؤنفت المسابقة.");
}

function toggleSound() {
  state.sound = !state.sound;
  persist();
  render();
  if (state.sound) beep();
}

function requestEndGame() {
  requestConfirm("إنهاء المسابقة؟", "ستبقى بيانات الإعداد محفوظة، لكن ستُمسح نتيجة الجولة الحالية.", () => {
    stopTimer();
    state.owners = Array(25).fill(null);
    state.selected = null;
    state.winner = null;
    state.winningPath = [];
    state.history = [];
    state.gameStarted = false;
    persist();
    setScreen("home");
  });
}

function requestConfirm(title, copy, callback) {
  document.querySelector("#confirm-title").textContent = title;
  document.querySelector("#confirm-copy").textContent = copy;
  pendingConfirm = callback;
  confirmDialog.showModal();
}

confirmDialog.addEventListener("close", () => {
  if (confirmDialog.returnValue === "confirm" && pendingConfirm) pendingConfirm();
  pendingConfirm = null;
});

function joinPhone(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.phoneName = String(data.get("phone-name") || "لاعب").trim();
  state.phoneTeam = Number(data.get("phone-team") || 0);
  state.phoneJoined = true;
  persist();
  render();
}

function pressBuzzer() {
  if (state.buzzer) return;
  state.buzzer = { team: state.phoneTeam, name: state.phoneName || "لاعب", at: Date.now() };
  persist();
  beep("success");
  render();
}

function resetBuzzer() {
  state.buzzer = null;
  persist();
  render();
  showToast("الجرس مفتوح للفريقين.");
}

function leavePhone() {
  state.phoneJoined = false;
  persist();
  render();
}

function replayRound() {
  state.owners = Array(25).fill(null);
  state.selected = null;
  state.timerRemaining = durationSeconds();
  state.timerRunning = false;
  state.winner = null;
  state.winningPath = [];
  state.history = [];
  state.buzzer = null;
  state.currentTeam = state.startMode === "random" ? Math.floor(Math.random() * 2) : Number(state.startMode.split("-")[1]);
  persist();
  setScreen("game");
}

function newRound() {
  const required = [...state.waiting];
  const candidates = shuffle(state.letters);
  const chosen = [...required, ...candidates.slice(0, 22)];
  state.waiting = candidates.slice(22);
  state.letters = shuffle(chosen);
  state.round += 1;
  state.owners = Array(25).fill(null);
  state.selected = null;
  state.timerRemaining = durationSeconds();
  state.timerRunning = false;
  state.winner = null;
  state.winningPath = [];
  state.history = [];
  state.buzzer = null;
  state.currentTeam = state.startMode === "random" ? Math.floor(Math.random() * 2) : Number(state.startMode.split("-")[1]);
  persist();
  setScreen("game");
  showToast("بدأت جولة جديدة، ودخلت الحروف المؤجلة إلى الرقعة.", "success");
}

document.addEventListener("click", (event) => {
  const navigation = event.target.closest("[data-go]");
  if (!navigation) return;
  const target = navigation.dataset.go;
  if ((target === "game" || target === "audience") && !state.gameStarted) {
    showToast("ابدأ من الإعداد أولاً.");
    setScreen("setup");
    return;
  }
  if (target === "winner" && state.winner === null) {
    showToast("معاينة شاشة الفوز للفريق الأول.");
  }
  setScreen(target);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.timerRunning) {
    state.timerRunning = false;
    stopTimer();
    persist();
  }
});

render();
