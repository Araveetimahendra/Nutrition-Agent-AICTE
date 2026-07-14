/**
 * NutriBot – IBM Watsonx.ai Nutrition Agent
 * Frontend JavaScript  |  app.js
 */

/* ================================================================
   STATE
   ================================================================ */
const State = {
  chatHistory:   [],
  profile:       {},
  familyMembers: [],
  hydration:     0,
  selectedDays:  1,
  tdeeData:      null,
};

/* ================================================================
   DOM HELPERS
   ================================================================ */
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function md(text) {
  if (typeof marked === 'undefined') return text;
  return marked.parse(text || '');
}

/* ================================================================
   THEME TOGGLE
   ================================================================ */
(function initTheme() {
  const saved = localStorage.getItem('nutribot-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
})();

$('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('nutribot-theme', next);
  updateThemeIcon(next);
});

function updateThemeIcon(theme) {
  $('themeIcon').className = theme === 'dark'
    ? 'bi bi-sun-fill'
    : 'bi bi-moon-stars-fill';
}

/* ================================================================
   SECTION NAVIGATION
   ================================================================ */
function showSection(id) {
  $$('.content-section').forEach(s => s.classList.add('d-none'));
  const target = $(`section-${id}`);
  if (target) {
    target.classList.remove('d-none');
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $$('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.section === id);
  });
}

$$('.nav-link[data-section]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    showSection(link.dataset.section);
    // close mobile menu
    const nav = document.querySelector('.navbar-collapse');
    if (nav.classList.contains('show')) {
      const toggler = document.querySelector('.navbar-toggler');
      toggler.click();
    }
  });
});

/* ================================================================
   DAILY TIP
   ================================================================ */
async function loadTip() {
  try {
    const res  = await fetch('/api/tip');
    const data = await res.json();
    $('tipText').textContent = data.tip || 'Stay hydrated and eat mindfully!';
  } catch {
    $('tipText').textContent = 'Eat a rainbow of vegetables to ensure you get all essential vitamins!';
  }
}

$('refreshTip').addEventListener('click', loadTip);
loadTip();

/* ================================================================
   PROFILE
   ================================================================ */
$('saveProfile').addEventListener('click', () => {
  const name   = $('profileName').value.trim();
  const age    = parseInt($('profileAge').value);
  const gender = $('profileGender').value;
  const weight = parseFloat($('profileWeight').value);
  const height = parseFloat($('profileHeight').value);
  const diet   = $('profileDiet').value;
  const goal   = $('profileGoal').value;
  const allergies = $('profileAllergies').value.trim();

  if (!name || !age || !gender || !weight || !height) {
    showToast('Please fill in all required profile fields', 'error');
    return;
  }

  State.profile = { name, age, gender, weight, height, diet, goal, allergies };
  showToast(`Profile saved for ${name}! 🎉`, 'success');

  // Auto-calculate TDEE and show stats
  calculateAndShowProfile(weight, height, age, gender, goal);
});

async function calculateAndShowProfile(weight, height, age, gender, goal) {
  try {
    const res  = await fetch('/api/tdee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight, height, age, gender, activity: 'moderate', goal }),
    });
    const data = await res.json();
    State.tdeeData = data;

    $('nutritionStats').style.display = 'block';
    renderMacroBars('macroDisplay', data);
    renderDashboardKPIs(data);

  } catch (err) {
    console.error('TDEE error:', err);
  }
}

function renderMacroBars(containerId, data) {
  const container = $(containerId);
  const total = (data.protein_g * 4) + (data.carbs_g * 4) + (data.fat_g * 9);
  container.innerHTML = `
    ${macroBar('Protein', data.protein_g, 'g', (data.protein_g*4/total*100), '#6366f1')}
    ${macroBar('Carbs',   data.carbs_g,   'g', (data.carbs_g*4/total*100),   '#f59e0b')}
    ${macroBar('Fat',     data.fat_g,     'g', (data.fat_g*9/total*100),     '#10b981')}
  `;
}

function macroBar(label, value, unit, pct, color) {
  return `
    <div class="macro-bar-item">
      <div class="bar-label">
        <span>${label}</span>
        <span style="color:${color}">${value}${unit}</span>
      </div>
      <div class="macro-bar-track">
        <div class="macro-bar-fill" style="width:${Math.round(pct)}%;background:${color}"></div>
      </div>
    </div>`;
}

/* ================================================================
   CHAT
   ================================================================ */
function appendMessage(role, content) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  msgDiv.innerHTML = `
    <div class="msg-avatar ${role}">
      <i class="bi bi-${role === 'bot' ? 'robot' : 'person-fill'}"></i>
    </div>
    <div>
      <div class="msg-bubble ${role === 'bot' ? 'markdown-body' : ''}">
        ${role === 'bot' ? md(content) : escapeHtml(content)}
      </div>
      <div class="msg-time">${time}</div>
    </div>`;

  const messages = $('chatMessages');
  messages.appendChild(msgDiv);
  messages.scrollTop = messages.scrollHeight;
  return msgDiv;
}

function appendTyping() {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message bot';
  msgDiv.id = 'typingIndicator';
  msgDiv.innerHTML = `
    <div class="msg-avatar bot"><i class="bi bi-robot"></i></div>
    <div>
      <div class="msg-bubble">
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>`;
  const messages = $('chatMessages');
  messages.appendChild(msgDiv);
  messages.scrollTop = messages.scrollHeight;
  return msgDiv;
}

async function sendMessage(messageText) {
  const text = (messageText || $('chatInput').value.trim());
  if (!text) return;

  $('chatInput').value = '';
  autoResizeTextarea($('chatInput'));
  $('sendBtn').disabled = true;
  $('quickPrompts').style.display = 'none';

  State.chatHistory.push({ role: 'user', content: text });
  appendMessage('user', text);
  const typingEl = appendTyping();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: State.chatHistory.slice(-10),
        profile: State.profile,
      }),
    });
    const data = await res.json();
    typingEl.remove();

    const reply = data.reply || 'Sorry, I could not generate a response.';
    State.chatHistory.push({ role: 'assistant', content: reply });
    appendMessage('bot', reply);

  } catch (err) {
    typingEl.remove();
    appendMessage('bot', '⚠️ Connection error. Please check your server and try again.');
  } finally {
    $('sendBtn').disabled = false;
    $('chatInput').focus();
  }
}

// Send button
$('sendBtn').addEventListener('click', () => sendMessage());

// Enter key
$('chatInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto resize textarea
$('chatInput').addEventListener('input', () => autoResizeTextarea($('chatInput')));
function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

// Quick prompts
$$('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sendMessage(btn.dataset.prompt);
  });
});

// Clear chat
$('clearChat').addEventListener('click', () => {
  State.chatHistory = [];
  $('chatMessages').innerHTML = '';
  $('quickPrompts').style.display = 'flex';
  initWelcomeMessage();
  showToast('Chat cleared', 'info');
});

// Export chat
$('exportChat').addEventListener('click', () => {
  const text = State.chatHistory
    .map(m => `[${m.role.toUpperCase()}]\n${m.content}`)
    .join('\n\n---\n\n');
  downloadText('nutribot-chat.txt', text);
  showToast('Chat exported', 'success');
});

function initWelcomeMessage() {
  appendMessage('bot',
    `## 👋 Hi! I'm NutriBot, your AI Nutrition Coach!\n\n` +
    `I'm powered by **IBM Watsonx Granite AI** and specialise in:\n` +
    `- 🥗 Indian & South-Asian meal planning\n` +
    `- 📊 Personalised calorie & macro tracking\n` +
    `- 👨‍👩‍👧 Family nutrition profiles\n` +
    `- 🌿 Ayurvedic & evidence-based diet advice\n\n` +
    `**To get started:** Save your profile on the right, or ask me anything!\n` +
    `_Try: "Create a 7-day diabetic-friendly Indian meal plan for me"_`
  );
}

initWelcomeMessage();

/* ================================================================
   BMI CALCULATOR
   ================================================================ */
$('calcBmiBtn').addEventListener('click', async () => {
  const weight   = parseFloat($('bmiWeight').value);
  const height   = parseFloat($('bmiHeight').value);
  const age      = parseInt($('bmiAge').value);
  const gender   = $('bmiGender').value;
  const activity = $('bmiActivity').value;
  const goal     = $('bmiGoal').value;

  if (!weight || !height || !age) {
    showToast('Please fill in all fields', 'error');
    return;
  }

  showLoading('Calculating your BMI and calorie needs…');

  try {
    const [bmiRes, tdeeRes] = await Promise.all([
      fetch('/api/bmi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight, height }),
      }),
      fetch('/api/tdee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight, height, age, gender, activity, goal }),
      }),
    ]);

    const bmi  = await bmiRes.json();
    const tdee = await tdeeRes.json();

    renderBMIResult(bmi);
    renderTDEEResult(tdee);

    $('bmiResults').classList.remove('d-none');
    $('bmiPlaceholder').classList.add('d-none');

  } catch (err) {
    showToast('Calculation failed. Please try again.', 'error');
  } finally {
    hideLoading();
  }
});

function renderBMIResult(bmi) {
  $('bmiNumber').textContent = bmi.bmi;

  const catEl = $('bmiCategory');
  catEl.textContent = bmi.category;
  catEl.className = 'bmi-category badge';
  const colorMap = { success: 'bg-success-custom', warning: 'bg-warning-custom', danger: 'bg-danger-custom' };
  catEl.classList.add(colorMap[bmi.color] || 'bg-success-custom');
}

function renderTDEEResult(tdee) {
  $('tdeeDisplay').innerHTML = `
    <div class="col-4"><div class="tdee-stat">
      <div class="stat-label">BMR</div>
      <div class="stat-value">${tdee.bmr}</div>
      <div class="stat-sub">kcal base</div>
    </div></div>
    <div class="col-4"><div class="tdee-stat" style="border-left:3px solid var(--accent)">
      <div class="stat-label">TDEE</div>
      <div class="stat-value">${tdee.tdee}</div>
      <div class="stat-sub">kcal/day</div>
    </div></div>
    <div class="col-4"><div class="tdee-stat">
      <div class="stat-label">Goal</div>
      <div class="stat-value">${tdee.goal === 'weight_loss' ? tdee.weight_loss : tdee.goal === 'muscle_gain' ? tdee.weight_gain : tdee.maintain}</div>
      <div class="stat-sub">kcal target</div>
    </div></div>`;

  $('macroDisplay2').innerHTML = `
    <div class="col-12"><div class="d-flex gap-3 flex-wrap">
      ${macroChip('Protein', tdee.protein_g + 'g', '#6366f1')}
      ${macroChip('Carbs',   tdee.carbs_g   + 'g', '#f59e0b')}
      ${macroChip('Fat',     tdee.fat_g     + 'g', '#10b981')}
    </div></div>`;
}

function macroChip(label, val, color) {
  return `<div style="background:${color}18;border:1px solid ${color}40;border-radius:20px;
    padding:4px 14px;font-size:12px;font-weight:600;color:${color}">
    ${label}: ${val}</div>`;
}

/* ================================================================
   DASHBOARD
   ================================================================ */
function renderDashboardKPIs(data) {
  $('kpiCalories').textContent = data.tdee || data.calories || '–';
  $('kpiProtein').textContent  = data.protein_g || '–';
  $('kpiCarbs').textContent    = data.carbs_g   || '–';
  $('kpiFat').textContent      = data.fat_g     || '–';

  // Ring chart
  const circumference = 2 * Math.PI * 80; // ≈502
  const total = (data.protein_g * 4) + (data.carbs_g * 4) + (data.fat_g * 9);
  const pctP = data.protein_g * 4 / total;
  const pctC = data.carbs_g   * 4 / total;
  const pctF = data.fat_g     * 9 / total;

  const dasharrayP = `${circumference * pctP} ${circumference}`;
  const dasharrayC = `${circumference * pctC} ${circumference}`;
  const dasharrayF = `${circumference * pctF} ${circumference}`;

  const offsetP = 0;
  const offsetC = -(circumference * pctP);
  const offsetF = -(circumference * (pctP + pctC));

  $('ringProtein').style.strokeDasharray  = dasharrayP;
  $('ringProtein').style.strokeDashoffset = offsetP;
  $('ringCarbs').style.strokeDasharray    = dasharrayC;
  $('ringCarbs').style.strokeDashoffset   = offsetC;
  $('ringFat').style.strokeDasharray      = dasharrayF;
  $('ringFat').style.strokeDashoffset     = offsetF;
  $('ringCenter').textContent             = data.tdee || data.calories;

  // Meal suggestions
  renderMealSuggestions(State.profile.diet || 'vegetarian');
}

function renderMealSuggestions(diet) {
  const meals = getMealSuggestions(diet);
  $('mealSuggestions').innerHTML = meals.map(m => `
    <div class="col-sm-6 col-lg-4">
      <div class="meal-suggestion-card">
        <div class="meal-time">${m.time}</div>
        <div class="meal-name">${m.name}</div>
        <div class="meal-cals">~${m.cals} kcal</div>
      </div>
    </div>`).join('');
}

function getMealSuggestions(diet) {
  const vegMeals = [
    { time: 'Breakfast', name: 'Poha with veggies & green chutney', cals: 280 },
    { time: 'Mid-morning', name: 'Handful of almonds + banana', cals: 200 },
    { time: 'Lunch', name: '2 rotis + dal + sabzi + curd', cals: 550 },
    { time: 'Evening', name: 'Roasted chana + chai', cals: 180 },
    { time: 'Dinner', name: 'Khichdi with ghee + raita', cals: 400 },
    { time: 'Bedtime', name: 'Turmeric milk (haldi doodh)', cals: 100 },
  ];
  const nonVegMeals = [
    { time: 'Breakfast', name: 'Egg bhurji with 2 whole wheat rotis', cals: 360 },
    { time: 'Mid-morning', name: 'Sprouts chaat with lemon', cals: 160 },
    { time: 'Lunch', name: 'Chicken curry + 1 cup rice + salad', cals: 620 },
    { time: 'Evening', name: 'Boiled eggs (2) + green tea', cals: 180 },
    { time: 'Dinner', name: 'Fish curry + 1 cup brown rice', cals: 480 },
    { time: 'Bedtime', name: 'Low-fat yoghurt', cals: 80 },
  ];
  return diet.includes('non-veg') ? nonVegMeals : vegMeals;
}

// AI Insight
async function loadAIInsight() {
  const prompt = State.profile.name
    ? `Give a short, personalised nutrition insight (3 sentences) for ${State.profile.name}, ` +
      `age ${State.profile.age}, goal: ${State.profile.goal || 'balanced'}, ` +
      `diet: ${State.profile.diet || 'Indian vegetarian'}.`
    : 'Give a practical nutrition insight focused on Indian diets. 3 sentences.';

  try {
    const res  = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prompt, history: [], profile: State.profile }),
    });
    const data = await res.json();
    $('aiInsightText').innerHTML = `<div class="markdown-body">${md(data.reply)}</div>`;
  } catch {
    $('aiInsightText').textContent = 'Stay consistent with your nutrition goals and drink plenty of water!';
  }
}

$('refreshInsight').addEventListener('click', loadAIInsight);

/* ================================================================
   HYDRATION TRACKER
   ================================================================ */
function renderHydration() {
  const visual = $('hydrationVisual');
  visual.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const glass = document.createElement('div');
    glass.className = `water-glass${i < State.hydration ? ' filled' : ''}`;
    glass.innerHTML = '<div class="fill"></div>';
    visual.appendChild(glass);
  }
  $('hydrationCount').textContent = `${State.hydration} / 8 glasses`;
}

$('hydrationPlus').addEventListener('click', () => {
  if (State.hydration < 8) {
    State.hydration++;
    renderHydration();
    if (State.hydration === 8) showToast('🎉 Great job! You\'ve hit your water goal!', 'success');
  }
});

$('hydrationMinus').addEventListener('click', () => {
  if (State.hydration > 0) {
    State.hydration--;
    renderHydration();
  }
});

renderHydration();

/* ================================================================
   MEAL PLANNER
   ================================================================ */
$$('#daySelector .day-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('#daySelector .day-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    State.selectedDays = parseInt(btn.dataset.days);
  });
});

$('generatePlanBtn').addEventListener('click', async () => {
  const diet   = $('planDiet').value;
  const spec   = $('planSpecial').value.trim();
  const cals   = $('planCalories').value;
  const prefs  = `${diet}, ${cals}${spec ? ', ' + spec : ''}`;

  showLoading('Generating your personalised meal plan with AI…');

  try {
    const res  = await fetch('/api/meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        days: State.selectedDays,
        preferences: prefs,
        profile: State.profile,
      }),
    });
    const data = await res.json();
    $('mealPlanOutput').innerHTML = `<div class="markdown-body">${md(data.plan)}</div>`;
    $('downloadPlan').classList.remove('d-none');
    $('downloadPlan').onclick = () => {
      downloadText('meal-plan.txt', data.plan);
      showToast('Meal plan downloaded!', 'success');
    };
  } catch (err) {
    $('mealPlanOutput').innerHTML = '<p class="text-danger">Failed to generate plan. Please try again.</p>';
  } finally {
    hideLoading();
  }
});

/* ================================================================
   FAMILY PROFILES
   ================================================================ */
$('addFamilyMember').addEventListener('click', () => {
  const name    = $('famName').value.trim();
  const age     = $('famAge').value;
  const gender  = $('famGender').value;
  const goal    = $('famGoal').value;
  const restr   = $('famRestrictions').value.trim();

  if (!name || !age) {
    showToast('Please enter name and age', 'error');
    return;
  }

  State.familyMembers.push({ name, age, gender, goal, restrictions: restr || 'none' });
  renderFamilyList();
  $('famName').value = $('famAge').value = $('famRestrictions').value = '';
  showToast(`${name} added to family!`, 'success');
});

function renderFamilyList() {
  const list = $('familyMembersList');
  $('memberCount').textContent = `${State.familyMembers.length} member${State.familyMembers.length !== 1 ? 's' : ''}`;

  if (!State.familyMembers.length) {
    list.innerHTML = `<div class="empty-state"><i class="bi bi-people-fill"></i><p>No family members added yet</p></div>`;
    return;
  }

  list.innerHTML = State.familyMembers.map((m, i) => `
    <div class="family-member-card mb-2">
      <div class="member-avatar">${m.name[0].toUpperCase()}</div>
      <div class="member-info">
        <div class="member-name">${escapeHtml(m.name)}</div>
        <div class="member-meta">${m.age}y · ${m.gender} · ${escapeHtml(m.goal)}</div>
        ${m.restrictions !== 'none' ? `<div class="member-meta" style="color:var(--warning)"><i class="bi bi-exclamation-circle me-1"></i>${escapeHtml(m.restrictions)}</div>` : ''}
      </div>
      <button class="btn btn-icon-sm" onclick="removeMember(${i})"><i class="bi bi-trash3"></i></button>
    </div>`).join('');
}

window.removeMember = (i) => {
  const name = State.familyMembers[i].name;
  State.familyMembers.splice(i, 1);
  renderFamilyList();
  showToast(`${name} removed`, 'info');
};

$('clearFamily').addEventListener('click', () => {
  State.familyMembers = [];
  renderFamilyList();
  $('familyPlanCard').classList.add('d-none');
  showToast('Family list cleared', 'info');
});

$('getFamilyPlan').addEventListener('click', async () => {
  if (!State.familyMembers.length) {
    showToast('Please add at least one family member', 'error');
    return;
  }

  showLoading('Generating family nutrition plan with AI…');

  try {
    const res  = await fetch('/api/family-nutrition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members: State.familyMembers }),
    });
    const data = await res.json();
    $('familyPlanOutput').innerHTML = `<div class="markdown-body">${md(data.advice)}</div>`;
    $('familyPlanCard').classList.remove('d-none');
  } catch (err) {
    showToast('Failed to generate family plan. Please try again.', 'error');
  } finally {
    hideLoading();
  }
});

/* ================================================================
   FOOD ANALYZER
   ================================================================ */
$$('.tag-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const current = $('analyzeInput').value.trim();
    $('analyzeInput').value = current ? current + '\n' + btn.dataset.food : btn.dataset.food;
  });
});

$('analyzeBtn').addEventListener('click', async () => {
  const foods = $('analyzeInput').value.trim();
  if (!foods) {
    showToast('Please enter food items to analyze', 'error');
    return;
  }

  showLoading('Analyzing nutritional content with AI…');

  try {
    const res  = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foods }),
    });
    const data = await res.json();
    $('analyzeOutput').innerHTML = `<div class="markdown-body">${md(data.analysis)}</div>`;
  } catch {
    $('analyzeOutput').innerHTML = '<p class="text-danger">Analysis failed. Please try again.</p>';
  } finally {
    hideLoading();
  }
});

/* ================================================================
   LOADING OVERLAY
   ================================================================ */
function showLoading(text = 'Processing with IBM Watsonx AI…') {
  $('loadingText').textContent = text;
  $('loadingOverlay').classList.remove('d-none');
}

function hideLoading() {
  $('loadingOverlay').classList.add('d-none');
}

/* ================================================================
   TOAST
   ================================================================ */
function showToast(message, type = 'info') {
  const icons = { success: 'check-circle-fill', error: 'exclamation-circle-fill', info: 'info-circle-fill' };
  const colors = { success: 'var(--success)', error: 'var(--danger)', info: 'var(--accent)' };

  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;
  toast.innerHTML = `
    <i class="bi bi-${icons[type]}" style="color:${colors[type]};font-size:15px"></i>
    <span>${escapeHtml(message)}</span>`;

  $('toastContainer').appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ================================================================
   UTILITIES
   ================================================================ */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ================================================================
   INIT: load dashboard tip + insight when page loads
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  loadAIInsight();
});

/* ================================================================
   AUTH  –  Login / Sign Up / Edit Profile
   ================================================================
   All auth is localStorage-based for a complete, deployable UI.
   Wire up to a real backend by replacing the _authSubmit functions
   with real API calls (POST /api/auth/login, /api/auth/register).
   ================================================================ */

/* ── Auth State ─────────────────────────────────────────────── */
const Auth = {
  get user() {
    try { return JSON.parse(localStorage.getItem('nutribot-user') || 'null'); }
    catch { return null; }
  },
  set user(data) {
    if (data) localStorage.setItem('nutribot-user', JSON.stringify(data));
    else localStorage.removeItem('nutribot-user');
  },
  get isLoggedIn() { return !!this.user; },
};

/* ── Open / Close helpers ────────────────────────────────────── */
function openModal(overlayId) {
  $(overlayId).classList.remove('d-none');
  document.body.style.overflow = 'hidden';
}
function closeModal(overlayId) {
  $(overlayId).classList.add('d-none');
  document.body.style.overflow = '';
}
function closeDropdown() {
  $('userDropdown').classList.remove('open');
}

window.openEditProfile = function () {
  const u = Auth.user;
  if (!u) return;
  $('editFirstName').value = u.firstName || '';
  $('editLastName').value  = u.lastName  || '';
  $('editEmail').value     = u.email     || '';
  $('editPassword').value  = '';
  openModal('editProfileOverlay');
};

/* ── Button wiring ───────────────────────────────────────────── */
// Desktop nav
$('navLoginBtn').addEventListener('click',   () => openModal('loginModalOverlay'));
$('navSignupBtn').addEventListener('click',  () => openModal('signupModalOverlay'));
// Mobile nav
$('mobileLoginBtn').addEventListener('click',  () => { openModal('loginModalOverlay');  document.querySelector('.navbar-collapse').classList.remove('show'); });
$('mobileSignupBtn').addEventListener('click', () => { openModal('signupModalOverlay'); document.querySelector('.navbar-collapse').classList.remove('show'); });
// Close buttons
$('closeLoginModal').addEventListener('click',  () => closeModal('loginModalOverlay'));
$('closeSignupModal').addEventListener('click', () => closeModal('signupModalOverlay'));
$('closeEditProfile').addEventListener('click', () => closeModal('editProfileOverlay'));
// Close on backdrop click
['loginModalOverlay','signupModalOverlay','editProfileOverlay'].forEach(id => {
  $(id).addEventListener('click', e => { if (e.target === $(id)) closeModal(id); });
});
// ESC key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['loginModalOverlay','signupModalOverlay','editProfileOverlay'].forEach(id => closeModal(id));
    closeDropdown();
  }
});
// Switch links
$('switchToSignup').addEventListener('click', e => { e.preventDefault(); closeModal('loginModalOverlay');  openModal('signupModalOverlay'); });
$('switchToLogin').addEventListener('click',  e => { e.preventDefault(); closeModal('signupModalOverlay'); openModal('loginModalOverlay');  });
// Avatar dropdown toggle
$('userAvatarBtn').addEventListener('click', e => {
  e.stopPropagation();
  $('userDropdown').classList.toggle('open');
});
document.addEventListener('click', () => closeDropdown());
$('userDropdown').addEventListener('click', e => e.stopPropagation());
// Logout
$('logoutBtn').addEventListener('click', e => { e.preventDefault(); authLogout(); });
$('mobileLogoutBtn').addEventListener('click', e => { e.preventDefault(); authLogout(); });
// Google social (placeholder – shows toast)
['googleLoginBtn','googleSignupBtn'].forEach(id => {
  $(id).addEventListener('click', () => showToast('Google login requires OAuth setup. Use email for now.', 'info'));
});
// Forgot password
$('forgotPasswordLink').addEventListener('click', e => {
  e.preventDefault();
  showToast('Password reset link sent to your email (demo mode)', 'info');
});

/* ── Password visibility toggles ────────────────────────────── */
$$('.auth-eye-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = $(btn.dataset.target);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.querySelector('i').className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
  });
});

/* ── Password strength meter ─────────────────────────────────── */
$('signupPassword').addEventListener('input', () => {
  const val = $('signupPassword').value;
  const strength = scorePassword(val);
  const fill  = $('strengthFill');
  const label = $('strengthLabel');
  const levels = [
    { pct: 0,   bg: '',             text: '' },
    { pct: 25,  bg: '#ef4444',      text: 'Weak' },
    { pct: 50,  bg: '#f59e0b',      text: 'Fair' },
    { pct: 75,  bg: '#3b82f6',      text: 'Good' },
    { pct: 100, bg: '#10b981',      text: 'Strong' },
  ];
  const lvl = levels[strength];
  fill.style.width      = lvl.pct + '%';
  fill.style.background = lvl.bg;
  label.textContent     = lvl.text;
  label.style.color     = lvl.bg;
});

function scorePassword(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score);
}

/* ── Validation helpers ──────────────────────────────────────── */
function fieldError(inputId, errorId, message) {
  const inp = $(inputId);
  const err = $(errorId);
  if (inp) { inp.classList.add('input-error'); inp.classList.remove('input-valid'); }
  if (err) err.textContent = message;
  return false;
}
function fieldOk(inputId, errorId) {
  const inp = $(inputId);
  const err = $(errorId);
  if (inp) { inp.classList.remove('input-error'); inp.classList.add('input-valid'); }
  if (err) err.textContent = '';
  return true;
}
function clearFieldState(inputId, errorId) {
  const inp = $(inputId);
  const err = $(errorId);
  if (inp) { inp.classList.remove('input-error','input-valid'); }
  if (err) err.textContent = '';
}
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

/* ── LOGIN submit ────────────────────────────────────────────── */
$('loginSubmitBtn').addEventListener('click', () => {
  const email    = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  let valid = true;

  clearFieldState('loginEmail',    'loginEmailError');
  clearFieldState('loginPassword', 'loginPasswordError');

  if (!email)              valid = fieldError('loginEmail', 'loginEmailError', 'Email is required');
  else if (!isValidEmail(email)) valid = fieldError('loginEmail', 'loginEmailError', 'Enter a valid email address');
  else                           fieldOk('loginEmail', 'loginEmailError');

  if (!password)           valid = valid && fieldError('loginPassword', 'loginPasswordError', 'Password is required');
  else if (password.length < 6) valid = valid && fieldError('loginPassword', 'loginPasswordError', 'Password must be at least 6 characters');
  else                     fieldOk('loginPassword', 'loginPasswordError');

  if (!valid) return;

  // Simulate async login
  setSubmitLoading('loginSubmitBtn', true);
  setTimeout(() => {
    setSubmitLoading('loginSubmitBtn', false);

    // Check if a registered user exists
    const stored = JSON.parse(localStorage.getItem('nutribot-registered') || 'null');
    if (stored && stored.email === email && stored.password === password) {
      _completeLogin({ firstName: stored.firstName, lastName: stored.lastName, email: stored.email });
    } else if (!stored && email && password.length >= 6) {
      // Demo fallback: any well-formed credentials work
      const firstName = email.split('@')[0];
      _completeLogin({ firstName, lastName: '', email });
    } else {
      fieldError('loginPassword', 'loginPasswordError', 'Incorrect email or password');
    }
  }, 900);
});

/* ── SIGN UP submit ──────────────────────────────────────────── */
$('signupSubmitBtn').addEventListener('click', () => {
  const firstName = $('signupFirstName').value.trim();
  const lastName  = $('signupLastName').value.trim();
  const email     = $('signupEmail').value.trim();
  const password  = $('signupPassword').value;
  const confirm   = $('signupConfirm').value;
  const terms     = $('signupTerms').checked;
  let valid = true;

  ['signupFirstName','signupLastName','signupEmail','signupPassword','signupConfirm']
    .forEach((id, i) => clearFieldState(id, ['signupFirstNameError','signupLastNameError','signupEmailError','signupPasswordError','signupConfirmError'][i]));
  $('signupTermsError').textContent = '';

  if (!firstName) valid = fieldError('signupFirstName', 'signupFirstNameError', 'Required');
  else fieldOk('signupFirstName', 'signupFirstNameError');

  if (!email)              { valid = valid && fieldError('signupEmail', 'signupEmailError', 'Email is required'); }
  else if (!isValidEmail(email)) { valid = valid && fieldError('signupEmail', 'signupEmailError', 'Enter a valid email address'); }
  else fieldOk('signupEmail', 'signupEmailError');

  if (!password)            { valid = valid && fieldError('signupPassword', 'signupPasswordError', 'Password is required'); }
  else if (password.length < 8) { valid = valid && fieldError('signupPassword', 'signupPasswordError', 'Min. 8 characters'); }
  else fieldOk('signupPassword', 'signupPasswordError');

  if (!confirm)             { valid = valid && fieldError('signupConfirm', 'signupConfirmError', 'Please confirm your password'); }
  else if (confirm !== password) { valid = valid && fieldError('signupConfirm', 'signupConfirmError', 'Passwords do not match'); }
  else fieldOk('signupConfirm', 'signupConfirmError');

  if (!terms) {
    $('signupTermsError').textContent = 'You must agree to the terms to continue';
    valid = false;
  }

  if (!valid) return;

  setSubmitLoading('signupSubmitBtn', true);
  setTimeout(() => {
    setSubmitLoading('signupSubmitBtn', false);
    // Store the registration
    localStorage.setItem('nutribot-registered', JSON.stringify({ firstName, lastName, email, password }));
    // Show success state
    showSignupSuccess(firstName);
    // Auto login after 2s
    setTimeout(() => {
      closeModal('signupModalOverlay');
      _completeLogin({ firstName, lastName, email });
    }, 2000);
  }, 1000);
});

/* ── Edit profile save ───────────────────────────────────────── */
$('editProfileSaveBtn').addEventListener('click', () => {
  const firstName = $('editFirstName').value.trim();
  const email     = $('editEmail').value.trim();
  if (!firstName || !email) { showToast('Name and email are required', 'error'); return; }

  setSubmitLoading('editProfileSaveBtn', true);
  setTimeout(() => {
    setSubmitLoading('editProfileSaveBtn', false);
    const updated = { ...Auth.user, firstName, lastName: $('editLastName').value.trim(), email };
    Auth.user = updated;
    // Also update registered user
    const stored = JSON.parse(localStorage.getItem('nutribot-registered') || 'null');
    if (stored) localStorage.setItem('nutribot-registered', JSON.stringify({ ...stored, ...updated }));
    refreshAuthUI();
    closeModal('editProfileOverlay');
    showToast('Profile updated successfully!', 'success');
  }, 700);
});

/* ── Internal helpers ────────────────────────────────────────── */
function _completeLogin(userData) {
  Auth.user = userData;
  closeModal('loginModalOverlay');
  refreshAuthUI();
  showToast(`Welcome back, ${userData.firstName}! 👋`, 'success');
  // Pre-fill the nutrition profile if empty
  if (!State.profile.name && userData.firstName) {
    $('profileName').value = userData.firstName + (userData.lastName ? ' ' + userData.lastName : '');
  }
}

function authLogout() {
  Auth.user = null;
  refreshAuthUI();
  closeDropdown();
  showToast('You have been logged out', 'info');
}

function refreshAuthUI() {
  const loggedIn = Auth.isLoggedIn;
  const user     = Auth.user || {};
  const initial  = (user.firstName || 'U')[0].toUpperCase();
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';

  // Guest / logged-in toggle
  $('authGuestBtns').classList.toggle('d-none', loggedIn);
  $('userMenu').classList.toggle('d-none', !loggedIn);
  $('mobileGuestLinks').classList.toggle('d-none', loggedIn);
  $('mobileLogoutLink').classList.toggle('d-none', !loggedIn);

  if (loggedIn) {
    // Update all avatar/name displays
    $('userAvatarDisplay').textContent = initial;
    $('userNameNav').textContent       = user.firstName || 'User';
    $('udAvatar').textContent          = initial;
    $('udName').textContent            = fullName;
    $('udEmail').textContent           = user.email || '';
  }
}

function showSignupSuccess(firstName) {
  const modal = $('signupModal');
  modal.innerHTML = `
    <div class="auth-success-state">
      <div class="auth-success-icon"><i class="bi bi-check-lg"></i></div>
      <div class="auth-success-title">Account Created! 🎉</div>
      <div class="auth-success-sub">Welcome to NutriBot, <strong>${escapeHtml(firstName)}</strong>!<br>Logging you in now…</div>
    </div>`;
}

function setSubmitLoading(btnId, loading) {
  const btn = $(btnId);
  if (!btn) return;
  btn.querySelector('.btn-label').classList.toggle('d-none', loading);
  btn.querySelector('.btn-spinner').classList.toggle('d-none', !loading);
  btn.disabled = loading;
}

/* ── Run on startup ──────────────────────────────────────────── */
refreshAuthUI();
