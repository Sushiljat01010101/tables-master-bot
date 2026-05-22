// ╔══════════════════════════════════════════════════════════╗
// ║   🧮 Tables Master Bot — Tables + Squares + Cubes        ║
// ║   Webhook-based | Full Working | All Modes               ║
// ╚══════════════════════════════════════════════════════════╝

const express = require("express");
const https = require("https");

// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) { console.error("❌ BOT_TOKEN set nahi hai!"); process.exit(1); }
if (!WEBHOOK_URL) { console.error("❌ WEBHOOK_URL set nahi hai!"); process.exit(1); }

// ─────────────────────────────────────────────
//  USER STATE
// ─────────────────────────────────────────────
const users = {};

function getUser(id) {
  if (!users[id]) {
    users[id] = {
      subject: null,          // "table" | "square" | "cube"
      mode: null,
      // Quiz
      quizFixedNum: null,     // specific number/table fixed for quiz session
      quizAns: null,
      // General stats (across all subjects)
      score: 0,
      streak: 0,
      bestStreak: 0,
      total: 0,
      // Challenge
      challengeScore: 0,
      challengeQ: 0,
      challengeTotal: 10,
      // Survival
      lives: 3,
      survivalScore: 0,
      // Speed
      speedScore: 0,
      speedQ: 0,
      speedTotal: 5,
      // Range
      currentRange: [11, 30],
      lastActive: Date.now(),
    };
  }
  return users[id];
}

function defaultRangeFor(subject) {
  return subject === "table" ? [11, 30] : [1, 30];
}

// ─────────────────────────────────────────────
//  TELEGRAM HELPERS
// ─────────────────────────────────────────────
function apiCall(method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: "api.telegram.org",
        path: `/bot${BOT_TOKEN}/${method}`,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      },
      (res) => {
        let raw = "";
        res.on("data", (d) => (raw += d));
        res.on("end", () => resolve(JSON.parse(raw)));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function sendMessage(chatId, text, extra = {}) {
  return apiCall("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}
function editMessage(chatId, msgId, text, extra = {}) {
  return apiCall("editMessageText", { chat_id: chatId, message_id: msgId, text, parse_mode: "HTML", ...extra });
}
function answerCallback(id, text = "") {
  return apiCall("answerCallbackQuery", { callback_query_id: id, text });
}

// ─────────────────────────────────────────────
//  MATH HELPERS
// ─────────────────────────────────────────────
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTableText(n) {
  const rows = [];
  for (let i = 1; i <= 10; i++) {
    rows.push(`${n} × ${String(i).padStart(2)} = <b>${n * i}</b>`);
  }
  return rows.join("\n");
}

function getSquareListText(from, to) {
  const rows = [];
  for (let i = from; i <= to; i++) {
    rows.push(`${i}² = <b>${i * i}</b>`);
  }
  return rows.join("\n");
}

function getCubeListText(from, to) {
  const rows = [];
  for (let i = from; i <= to; i++) {
    rows.push(`${i}³ = <b>${i * i * i}</b>`);
  }
  return rows.join("\n");
}

// ─────────────────────────────────────────────
//  QUESTION GENERATOR
//  Returns: { subCode, num, q, ans, opts, qText }
//  subCode: "t" (table) | "s" (square) | "c" (cube)
// ─────────────────────────────────────────────
function makeQuestion(u, fixedNum = null) {
  const subject = u.subject || "table";
  const [min, max] = u.currentRange;

  if (subject === "square") {
    const n = (fixedNum !== null) ? fixedNum : randomInt(min, max);
    const ans = n * n;
    const opts = squareCubeWrongs(n, ans, "square");
    return { subCode: "s", num: n, q: null, ans, opts, qText: `${n}² = ?` };
  }

  if (subject === "cube") {
    const n = (fixedNum !== null) ? fixedNum : randomInt(min, max);
    const ans = n * n * n;
    const opts = squareCubeWrongs(n, ans, "cube");
    return { subCode: "c", num: n, q: null, ans, opts, qText: `${n}³ = ?` };
  }

  // Table (default)
  const table = (fixedNum !== null) ? fixedNum : randomInt(min, max);
  const q = randomInt(1, 10);
  const ans = table * q;
  const opts = tableWrongs(ans);
  return { subCode: "t", num: table, q, ans, opts, qText: `${table} × ${q} = ?` };
}

function tableWrongs(ans) {
  const deltas = [-2, -1, 1, 2, 3, -3, 5, -5, 10, -10];
  const wrongs = new Set();
  while (wrongs.size < 3) {
    const w = ans + pickRandom(deltas) * randomInt(1, 3);
    if (w > 0 && w !== ans) wrongs.add(w);
  }
  return [ans, ...[...wrongs]].sort(() => Math.random() - 0.5);
}

function squareCubeWrongs(n, ans, type) {
  // Use squares/cubes of nearby numbers — more educational!
  const candidates = [];
  for (let d = -6; d <= 6; d++) {
    if (d === 0) continue;
    const near = n + d;
    if (near < 1) continue;
    const w = type === "square" ? near * near : near * near * near;
    if (w !== ans && w > 0) candidates.push(w);
  }
  candidates.sort(() => Math.random() - 0.5);
  const wrongs = candidates.slice(0, 3);
  return [ans, ...wrongs].sort(() => Math.random() - 0.5);
}

// ─────────────────────────────────────────────
//  EMOJI & DISPLAY HELPERS
// ─────────────────────────────────────────────
const LEVEL_EMOJI = ["🌱", "⭐", "🔥", "💎", "👑"];
function getLevelEmoji(score) {
  if (score < 10) return LEVEL_EMOJI[0];
  if (score < 25) return LEVEL_EMOJI[1];
  if (score < 50) return LEVEL_EMOJI[2];
  if (score < 100) return LEVEL_EMOJI[3];
  return LEVEL_EMOJI[4];
}
function getLevelName(score) {
  if (score < 10) return "Beginner";
  if (score < 25) return "Student";
  if (score < 50) return "Scholar";
  if (score < 100) return "Expert";
  return "MASTER 👑";
}
function streakMsg(s) {
  if (s >= 10) return "🔥🔥🔥 LEGENDARY!";
  if (s >= 7) return "🔥🔥 Amazing!";
  if (s >= 5) return "🔥 Great streak!";
  if (s >= 3) return "⚡ Nice streak!";
  return "";
}
function heart(n) {
  const safe = Math.max(0, Math.min(3, n));
  return "❤️".repeat(safe) + "🖤".repeat(3 - safe);
}
function progressBar(pct) {
  const filled = Math.round(pct / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled) + ` ${pct}%`;
}
function subjectLabel(subject) {
  if (subject === "square") return "🔲 Squares";
  if (subject === "cube") return "🔳 Cubes";
  return "📊 Tables";
}
function subjectEmoji(subject) {
  if (subject === "square") return "🔲";
  if (subject === "cube") return "🔳";
  return "📊";
}

// ─────────────────────────────────────────────
//  KEYBOARDS
// ─────────────────────────────────────────────

// Subject selection (shown on /start and change_subject)
const SUBJECT_MENU = {
  inline_keyboard: [
    [
      { text: "📊 Tables (11-30)", callback_data: "subj_table" },
      { text: "🔲 Squares (1-30)", callback_data: "subj_square" },
    ],
    [
      { text: "🔳 Cubes (1-30)", callback_data: "subj_cube" },
    ],
    [{ text: "❓ Help", callback_data: "help" }],
  ],
};

// Main menu — same for all subjects, shows subject label
function mainMenu(subject) {
  const s = subjectEmoji(subject);
  return {
    inline_keyboard: [
      [{ text: "📖 Learn / Dekhna", callback_data: "mode_learn" }, { text: "⚡ Quiz", callback_data: "mode_quiz" }],
      [{ text: "🎯 Challenge Mode", callback_data: "mode_challenge" }, { text: "❤️ Survival Mode", callback_data: "mode_survival" }],
      [{ text: "🏃 Speed Round", callback_data: "mode_speed" }, { text: "📊 Meri Progress", callback_data: "progress" }],
      [{ text: "🏆 Tips & Tricks", callback_data: "tips" }, { text: "❓ Help", callback_data: "help" }],
      [{ text: `🔄 Subject Badlo (${subjectLabel(subject)})`, callback_data: "change_subject" }],
    ],
  };
}

// Number select keyboard for quiz/learn (configurable range)
function numberSelectKeyboard(mode, min, max) {
  const rows = [];
  const perRow = (max - min + 1) <= 20 ? 5 : 6;
  for (let i = min; i <= max; i += perRow) {
    const row = [];
    for (let j = i; j < i + perRow && j <= max; j++) {
      row.push({ text: `${j}`, callback_data: `${mode}_${j}` });
    }
    rows.push(row);
  }
  rows.push([{ text: "🔀 Random", callback_data: `${mode}_random` }, { text: "🔙 Menu", callback_data: "menu" }]);
  return { inline_keyboard: rows };
}

// Range keyboard for table modes (challenge/survival/speed)
const TABLE_RANGE_KB = {
  inline_keyboard: [
    [{ text: "11-15", callback_data: "range_11_15" }, { text: "16-20", callback_data: "range_16_20" }],
    [{ text: "21-25", callback_data: "range_21_25" }, { text: "26-30", callback_data: "range_26_30" }],
    [{ text: "11-20", callback_data: "range_11_20" }, { text: "21-30", callback_data: "range_21_30" }],
    [{ text: "🌍 ALL (11-30)", callback_data: "range_11_30" }, { text: "🔙 Menu", callback_data: "menu" }],
  ],
};

// Range keyboard for square/cube modes
const SQ_CUBE_RANGE_KB = {
  inline_keyboard: [
    [{ text: "1-10", callback_data: "range_1_10" }, { text: "11-20", callback_data: "range_11_20" }],
    [{ text: "21-30", callback_data: "range_21_30" }, { text: "🌍 ALL (1-30)", callback_data: "range_1_30" }],
    [{ text: "🔙 Menu", callback_data: "menu" }],
  ],
};

function rangeKeyboardFor(subject) {
  return subject === "table" ? TABLE_RANGE_KB : SQ_CUBE_RANGE_KB;
}

// Learn list range keyboard for squares/cubes
const SQ_CUBE_LEARN_KB = {
  inline_keyboard: [
    [{ text: "1 to 10", callback_data: "learnlist_1_10" }, { text: "11 to 20", callback_data: "learnlist_11_20" }],
    [{ text: "21 to 30", callback_data: "learnlist_21_30" }, { text: "📋 ALL (1-30)", callback_data: "learnlist_1_30" }],
    [{ text: "🔙 Menu", callback_data: "menu" }],
  ],
};

// Quiz keyboard — encodes subject type in callback
function quizKeyboard(opts, subCode, num, q = null) {
  const suffix = subCode === "s" ? `s_${num}` : subCode === "c" ? `c_${num}` : `t_${num}_${q}`;
  const rows = [];
  for (let i = 0; i < opts.length; i += 2) {
    const row = [{ text: `${opts[i]}`, callback_data: `ans_${opts[i]}_${suffix}` }];
    if (opts[i + 1] !== undefined) row.push({ text: `${opts[i + 1]}`, callback_data: `ans_${opts[i + 1]}_${suffix}` });
    rows.push(row);
  }
  rows.push([{ text: "🏠 Menu", callback_data: "menu" }, { text: "⏭ Skip", callback_data: "skip_quiz" }]);
  return { inline_keyboard: rows };
}

// ─────────────────────────────────────────────
//  MESSAGE BUILDERS
// ─────────────────────────────────────────────
function subjectSelectMsg(name) {
  return `╔══════════════════════════╗
║  🧮 <b>Tables Master Bot</b>  ║
╚══════════════════════════╝

Namaste <b>${name}</b>! 🙏

Aaj kya seekhna chahte ho?
Ek subject chunno 👇

📊 <b>Tables</b> — 11 se 30 tak pahade
🔲 <b>Squares</b> — 1 se 30 tak varg (n²)
🔳 <b>Cubes</b> — 1 se 30 tak ghan (n³)`;
}

function mainMenuMsg(subject, name) {
  const sl = subjectLabel(subject);
  const desc =
    subject === "square"
      ? "1 se 30 tak ke <b>Varg (Squares)</b> — n²"
      : subject === "cube"
      ? "1 se 30 tak ke <b>Ghan (Cubes)</b> — n³"
      : "11 se 30 tak ke <b>Pahade (Tables)</b>";
  return `${subjectEmoji(subject)} <b>${sl} — ${name}</b>

${desc}

<b>🎮 Modes:</b>
📖 Learn — List dekho aur yaad karo
⚡ Quiz — MCQ sawaal (fixed ya random)
🎯 Challenge — 10 sawaalon ka set
❤️ Survival — 3 lives, survive karo
🏃 Speed Round — 5 sawaal jaldi!

Mode chunno 👇`;
}

function progressMsg(u, name) {
  const acc = u.total > 0 ? Math.round((u.score / u.total) * 100) : 0;
  return `📊 <b>TERI PROGRESS — ${name}</b>

${getLevelEmoji(u.score)} Level: <b>${getLevelName(u.score)}</b>
✅ Sahi jawab: <b>${u.score}</b>
❌ Galat jawab: <b>${u.total - u.score}</b>
📈 Accuracy: <b>${acc}%</b>
🔥 Best Streak: <b>${u.bestStreak}</b>
🎯 Kul sawaal: <b>${u.total}</b>

<b>Progress Bar:</b>
${progressBar(acc)}

💡 Tip: Roz thoda practice, exam mein top!`;
}

// ─────────────────────────────────────────────
//  TABLE TRICKS
// ─────────────────────────────────────────────
function getTrick(n) {
  const tricks = {
    11: "11×n: digits repeat barhte hain! 11×13=143, 11×14=154",
    12: "12×n = 10n + 2n. Example: 12×7 = 70+14 = 84",
    13: "13×n = 10n + 3n. Example: 13×8 = 80+24 = 104",
    14: "14×7=98, 14×8=112 — yaad karo!",
    15: "15×n = 10n + 5n. Example: 15×6 = 60+30 = 90",
    16: "16 = 2⁴. Powers: 16,32,48,64,80...",
    17: "17×6=102 — century cross! 17×n = 20n - 3n",
    18: "18×n = 20n - 2n. 18×7 = 140-14 = 126",
    19: "19×n = 20n - n. 19×8 = 160-8 = 152",
    20: "20×n = 2n followed by 0. Simple!",
    21: "21×n = 20n + n. 21×7 = 140+7 = 147",
    22: "22×n = 20n + 2n. 22×6 = 120+12 = 132",
    23: "23×n = 20n + 3n. 23×5 = 100+15 = 115",
    24: "24×n = 25n - n. 24×4 = 100-4 = 96",
    25: "25×4=100! 25×n = 100×n/4",
    26: "26×n = 25n + n. 26×4 = 100+4 = 104",
    27: "27×n = 30n - 3n. 27×4 = 120-12 = 108",
    28: "28×n = 30n - 2n. 28×5 = 150-10 = 140",
    29: "29×n = 30n - n. 29×7 = 210-7 = 203",
    30: "30×n = 3n followed by 0. 30×8 = 240",
  };
  return tricks[n] || `${n} × n — practice karo!`;
}

function getSquareTrick(n) {
  const specials = {
    1: "1² = 1 (hamesha 1!)",
    5: "5² = 25 (5 ke square ka last digit hamesha 5 ya 0!)",
    10: "10² = 100 (zeros double!)",
    11: "11² = 121 (palindrome!)",
    12: "12² = 144 (dozen ka square)",
    15: "15² = 225 (yaad rakho!)",
    20: "20² = 400 (zeros double)",
    25: "25² = 625 (yaad rakho!)",
    30: "30² = 900 (zeros double)",
  };
  if (specials[n]) return specials[n];
  // General tricks
  if (n % 5 === 0) return `${n}² = ${n*n} (5 ke multiple ka square!)`;
  if (n % 10 === 0) return `${n}² = ${n*n} (10 ke multiple)`;
  // (a+b)² trick
  const a = Math.round(n / 10) * 10;
  const b = n - a;
  if (a > 0 && b !== 0) {
    return `${n}² = (${a}+${b})² = ${a}²+2×${a}×${b}+${b}² = ${a*a}+${2*a*b}+${b*b} = ${n*n}`;
  }
  return `${n}² = ${n*n}`;
}

function getCubeTrick(n) {
  const specials = {
    1: "1³ = 1 (hamesha 1!)",
    2: "2³ = 8 (yaad karo: 2×2×2)",
    3: "3³ = 27 (yaad karo!)",
    5: "5³ = 125 (easy!)",
    10: "10³ = 1000 (3 zeros!)",
    11: "11³ = 1331 (pattern: 1-3-3-1!)",
    12: "12³ = 1728",
    15: "15³ = 3375",
    20: "20³ = 8000 (3 zeros!)",
    30: "30³ = 27000",
  };
  if (specials[n]) return specials[n];
  return `${n}³ = ${n}×${n}×${n} = ${n*n}×${n} = ${n*n*n}`;
}

// ─────────────────────────────────────────────
//  CHALLENGE FIRST QUESTION
// ─────────────────────────────────────────────
async function startChallengeFirst(chatId, msgId, u) {
  u.challengeQ = 1;
  u.challengeScore = 0;
  const qr = makeQuestion(u);
  u.quizAns = qr.ans;
  const txt = `🎯 <b>CHALLENGE MODE</b>\n\nSawaal <b>1/${u.challengeTotal}</b> | ✅ Score: 0\n\n❓ <b>${qr.qText}</b>`;
  const kb = quizKeyboard(qr.opts, qr.subCode, qr.num, qr.q);
  if (msgId) {
    await editMessage(chatId, msgId, txt, { reply_markup: kb });
  } else {
    await sendMessage(chatId, txt, { reply_markup: kb });
  }
}

// ─────────────────────────────────────────────
//  MAIN HANDLER
// ─────────────────────────────────────────────
async function handleUpdate(update) {

  // ── CALLBACK QUERY ──
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const msgId = cb.message.message_id;
    const data = cb.data;
    const u = getUser(chatId);
    const name = cb.from.first_name || "Student";
    u.lastActive = Date.now();

    await answerCallback(cb.id);

    // ── SUBJECT SELECTION ──
    if (data.startsWith("subj_")) {
      const sub = data.split("_")[1]; // "table" | "square" | "cube"
      u.subject = sub;
      u.mode = null;
      u.quizFixedNum = null;
      u.currentRange = defaultRangeFor(sub);
      await editMessage(chatId, msgId, mainMenuMsg(sub, name), { reply_markup: mainMenu(sub) });
      return;
    }

    // ── CHANGE SUBJECT ──
    if (data === "change_subject") {
      u.mode = null;
      await editMessage(chatId, msgId, subjectSelectMsg(name), { reply_markup: SUBJECT_MENU });
      return;
    }

    // ── MENU ──
    if (data === "menu") {
      u.mode = null;
      u.quizFixedNum = null;
      if (!u.subject) {
        await editMessage(chatId, msgId, subjectSelectMsg(name), { reply_markup: SUBJECT_MENU });
      } else {
        await editMessage(chatId, msgId, mainMenuMsg(u.subject, name), { reply_markup: mainMenu(u.subject) });
      }
      return;
    }

    // ── PROGRESS ──
    if (data === "progress") {
      await editMessage(chatId, msgId, progressMsg(u, name), {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Menu", callback_data: "menu" }]] },
      });
      return;
    }

    // ── TIPS ──
    if (data === "tips") {
      const sub = u.subject || "table";
      let tips = "";
      if (sub === "square") {
        tips = `🔲 <b>SQUARE TRICKS (n²)</b>

1️⃣ <b>1 se 10 tak yaad karo pehle:</b>
   1,4,9,16,25,36,49,64,81,100

2️⃣ <b>(a+b)² formula:</b>
   14² = (10+4)² = 100+80+16 = 196

3️⃣ <b>n ke paas ka square:</b>
   16² = 15²+15+16 = 225+31 = 256

4️⃣ <b>Ending trick:</b>
   5 se khatam hone wala → ends in 25
   Example: 15²=225, 25²=625

5️⃣ <b>Special values yaad karo:</b>
   11²=121, 12²=144, 15²=225, 20²=400, 25²=625

6️⃣ <b>Difference of squares:</b>
   n² - (n-1)² = 2n-1
   Example: 16²-15² = 31`;
      } else if (sub === "cube") {
        tips = `🔳 <b>CUBE TRICKS (n³)</b>

1️⃣ <b>1 se 10 tak yaad karo:</b>
   1,8,27,64,125,216,343,512,729,1000

2️⃣ <b>Last digit pattern:</b>
   1³→1, 2³→8, 3³→7, 4³→4, 5³→5
   6³→6, 7³→3, 8³→2, 9³→9, 0³→0

3️⃣ <b>n³ = n × n²:</b>
   15³ = 15 × 225 = 3375

4️⃣ <b>Near round trick:</b>
   19³ = (20-1)³ = 8000-3×400+3×20-1 = 6859

5️⃣ <b>Special yaad karo:</b>
   10³=1000, 11³=1331, 12³=1728
   15³=3375, 20³=8000, 25³=15625

6️⃣ <b>Difference:</b>
   n³ - (n-1)³ = 3n² - 3n + 1`;
      } else {
        tips = `📊 <b>TABLE TRICKS</b>

1️⃣ <b>19×n = 20n - n:</b>  19×8 = 160-8 = 152
2️⃣ <b>18×n = 20n - 2n:</b>  18×7 = 140-14 = 126
3️⃣ <b>29×n = 30n - n:</b>  29×6 = 180-6 = 174
4️⃣ <b>25×4 = 100 (trick):</b>  25×8 = 200
5️⃣ <b>21+ tables = 20n + extra×n:</b>
   23×7 = 20×7 + 3×7 = 140+21 = 161
6️⃣ <b>Near-round method:</b>
   17×9 = 17×10 - 17 = 170-17 = 153`;
      }
      await editMessage(chatId, msgId, tips, {
        reply_markup: { inline_keyboard: [[{ text: "⚡ Quiz Try Karo", callback_data: "mode_quiz" }, { text: "🔙 Menu", callback_data: "menu" }]] },
      });
      return;
    }

    // ── HELP ──
    if (data === "help") {
      const help = `❓ <b>BOT HELP</b>

<b>Commands:</b>
/start — Subject select karo
/menu — Menu dekhna
/progress — Progress dekho
/table 17 — Table 17 dekho
/square 15 — 15² dekho
/cube 12 — 12³ dekho
/reset — Progress reset

<b>3 Subjects:</b>
📊 Tables (11-30) — Pahade
🔲 Squares (1-30) — Varg (n²)
🔳 Cubes (1-30) — Ghan (n³)

<b>5 Modes (har subject mein):</b>
📖 Learn — List dekho
⚡ Quiz — MCQ (fixed ya random)
🎯 Challenge — 10 sawaal set
❤️ Survival — 3 lives
🏃 Speed — 5 jaldi sawaal

Kisi bhi waqt 🔄 Subject Badlo!`;
      await editMessage(chatId, msgId, help, {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Menu", callback_data: "menu" }]] },
      });
      return;
    }

    // ── MODE SELECTORS ──
    if (data === "mode_learn") {
      const sub = u.subject || "table";
      if (sub === "table") {
        await editMessage(chatId, msgId, "📖 <b>Konsi table dekhni hai?</b>", { reply_markup: numberSelectKeyboard("learn", 11, 30) });
      } else {
        const label = sub === "square" ? "Squares (n²)" : "Cubes (n³)";
        await editMessage(chatId, msgId, `📖 <b>Konsa group dekhna hai?</b>\n(${label})`, { reply_markup: SQ_CUBE_LEARN_KB });
      }
      return;
    }

    if (data === "mode_quiz") {
      const sub = u.subject || "table";
      if (sub === "table") {
        await editMessage(chatId, msgId, "⚡ <b>Konsi table ka quiz?</b>\n\nEk chunne par sirf usi table ke sawaal!", { reply_markup: numberSelectKeyboard("quiz", 11, 30) });
      } else {
        const label = sub === "square" ? "Square" : "Cube";
        await editMessage(chatId, msgId, `⚡ <b>Konse number ka ${label} quiz?</b>\n\nEk chunne par sirf usi ka quiz!`, { reply_markup: numberSelectKeyboard("quiz", 1, 30) });
      }
      return;
    }

    if (data === "mode_challenge") {
      u.mode = "challenge_pending";
      await editMessage(chatId, msgId, "🎯 <b>Challenge Mode — 10 sawaal</b>\n\nKis range se sawaal aayenge?", { reply_markup: rangeKeyboardFor(u.subject) });
      return;
    }

    if (data === "mode_survival") {
      u.mode = "survival_pending";
      await editMessage(chatId, msgId, "❤️ <b>Survival Mode — 3 lives</b>\n\nKis range se sawaal aayenge?", { reply_markup: rangeKeyboardFor(u.subject) });
      return;
    }

    if (data === "mode_speed") {
      u.mode = "speed_pending";
      await editMessage(chatId, msgId, "🏃 <b>Speed Round — 5 sawaal</b>\n\nKis range se sawaal aayenge?", { reply_markup: rangeKeyboardFor(u.subject) });
      return;
    }

    // ── RANGE SELECT ──
    if (data.startsWith("range_")) {
      const parts = data.split("_");
      u.currentRange = [parseInt(parts[1]), parseInt(parts[2])];
      const pending = u.mode;

      if (pending === "challenge_pending") {
        u.mode = "challenge";
        u.challengeTotal = 10;
        await startChallengeFirst(chatId, msgId, u);

      } else if (pending === "survival_pending") {
        u.mode = "survival";
        u.lives = 3;
        u.survivalScore = 0;
        const qr = makeQuestion(u);
        u.quizAns = qr.ans;
        await editMessage(chatId, msgId,
          `❤️ <b>SURVIVAL MODE SHURU!</b>\n\n${heart(3)} 3 lives | 🏆 Score: 0\n\n❓ <b>${qr.qText}</b>`,
          { reply_markup: quizKeyboard(qr.opts, qr.subCode, qr.num, qr.q) });

      } else if (pending === "speed_pending") {
        u.mode = "speed";
        u.speedScore = 0;
        u.speedQ = 1;
        u.speedTotal = 5;
        const qr = makeQuestion(u);
        u.quizAns = qr.ans;
        await editMessage(chatId, msgId,
          `🏃 <b>SPEED ROUND SHURU!</b>\n\nSawaal <b>1/5</b>\n\n❓ <b>${qr.qText}</b>\n\n⚡ Jaldi!`,
          { reply_markup: quizKeyboard(qr.opts, qr.subCode, qr.num, qr.q) });

      } else {
        await editMessage(chatId, msgId, mainMenuMsg(u.subject || "table", name), { reply_markup: mainMenu(u.subject || "table") });
      }
      return;
    }

    // ── LEARN LIST (squares / cubes) ──
    if (data.startsWith("learnlist_")) {
      const parts = data.split("_");
      const from = parseInt(parts[1]);
      const to = parseInt(parts[2]);
      const sub = u.subject;
      const isSq = sub === "square";
      const listText = isSq ? getSquareListText(from, to) : getCubeListText(from, to);
      const symbol = isSq ? "²" : "³";
      const label = isSq ? "Squares" : "Cubes";
      const trick = isSq
        ? `\n💡 <b>Trick:</b> ${getSquareTrick(Math.floor((from + to) / 2))}`
        : `\n💡 <b>Trick:</b> ${getCubeTrick(Math.floor((from + to) / 2))}`;
      const text = `📖 <b>${label} (${from} to ${to})</b>
━━━━━━━━━━━━━━━━━━━
<code>${listText}</code>
━━━━━━━━━━━━━━━━━━━
${trick}`;
      await editMessage(chatId, msgId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⚡ Quiz Start", callback_data: "mode_quiz" }, { text: "📖 Doosra Group", callback_data: "mode_learn" }],
            [{ text: "🔙 Menu", callback_data: "menu" }],
          ],
        },
      });
      return;
    }

    // ── LEARN TABLE (tables only) ──
    if (data.startsWith("learn_")) {
      const sub = u.subject || "table";
      const raw = data.split("_")[1];
      const n = raw === "random"
        ? randomInt(sub === "table" ? 11 : 1, sub === "table" ? 30 : 30)
        : parseInt(raw);

      let text = "";
      if (sub === "table") {
        text = `📖 <b>Table of ${n}</b>
━━━━━━━━━━━━━━━━━━━
<code>${getTableText(n)}</code>
━━━━━━━━━━━━━━━━━━━
💡 <b>Trick:</b> ${getTrick(n)}`;
      } else if (sub === "square") {
        text = `🔲 <b>Square of ${n}</b>

${n}² = ${n} × ${n} = <b>${n * n}</b>

💡 <b>Trick:</b> ${getSquareTrick(n)}`;
      } else {
        text = `🔳 <b>Cube of ${n}</b>

${n}³ = ${n} × ${n} × ${n} = ${n*n} × ${n} = <b>${n * n * n}</b>

💡 <b>Trick:</b> ${getCubeTrick(n)}`;
      }

      await editMessage(chatId, msgId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `⚡ ${n} ka Quiz`, callback_data: `quiz_${n}` }, { text: "📖 Aur dekho", callback_data: "mode_learn" }],
            [{ text: "🔙 Menu", callback_data: "menu" }],
          ],
        },
      });
      return;
    }

    // ── QUIZ START (specific number) ──
    if (data.startsWith("quiz_")) {
      const sub = u.subject || "table";
      const raw = data.split("_")[1];
      let fixedNum = null;
      if (raw !== "random") {
        const parsed = parseInt(raw);
        if (!isNaN(parsed)) fixedNum = parsed;
      }

      u.mode = "quiz";
      u.quizFixedNum = fixedNum;

      const qr = makeQuestion(u, fixedNum);
      u.quizAns = qr.ans;

      const fixedLabel = fixedNum
        ? (sub === "table" ? `Table <b>${fixedNum}</b>` : sub === "square" ? `<b>${fixedNum}²</b> ka quiz` : `<b>${fixedNum}³</b> ka quiz`)
        : `Random (range: ${u.currentRange[0]}-${u.currentRange[1]})`;

      const txt = `⚡ <b>QUIZ TIME!</b>
${fixedLabel} — sirf isi ke sawaal!

${getLevelEmoji(u.score)} Score: <b>${u.score}</b> | 🔥 Streak: <b>${u.streak}</b>

❓ <b>${qr.qText}</b>

Sahi option chunno:`;
      await editMessage(chatId, msgId, txt, { reply_markup: quizKeyboard(qr.opts, qr.subCode, qr.num, qr.q) });
      return;
    }

    // ── SKIP QUIZ ──
    if (data === "skip_quiz") {
      u.total++;
      u.streak = 0;
      const qr = makeQuestion(u, u.quizFixedNum);
      u.quizAns = qr.ans;
      await editMessage(chatId, msgId,
        `⏭ <b>Skipped!</b>\n\n❓ <b>${qr.qText}</b>`,
        { reply_markup: quizKeyboard(qr.opts, qr.subCode, qr.num, qr.q) });
      return;
    }

    // ─────────────────────────────────────────────
    //  ANSWER HANDLER
    //  Callback format:
    //    Table:  ans_<chosen>_t_<num>_<q>
    //    Square: ans_<chosen>_s_<num>
    //    Cube:   ans_<chosen>_c_<num>
    // ─────────────────────────────────────────────
    if (data.startsWith("ans_")) {
      const parts = data.split("_");
      const chosen = parseInt(parts[1]);
      const type = parts[2]; // t | s | c

      let correct, displayQ;
      if (type === "s") {
        const n = parseInt(parts[3]);
        correct = n * n;
        displayQ = `${n}²`;
      } else if (type === "c") {
        const n = parseInt(parts[3]);
        correct = n * n * n;
        displayQ = `${n}³`;
      } else {
        const tbl = parseInt(parts[3]);
        const q = parseInt(parts[4]);
        correct = tbl * q;
        displayQ = `${tbl} × ${q}`;
      }

      const isCorrect = chosen === correct;

      // Update global stats
      u.total++;
      if (isCorrect) {
        u.score++;
        u.streak++;
        if (u.streak > u.bestStreak) u.bestStreak = u.streak;
      } else {
        u.streak = 0;
      }

      const resultLine = isCorrect
        ? `✅ <b>SAHI JAWAB!</b> 🎉  ${displayQ} = <b>${correct}</b>`
        : `❌ <b>GALAT!</b>  ${displayQ} = <b>${correct}</b>  |  Tumne: ${chosen}`;

      // ── CHALLENGE MODE ──
      if (u.mode === "challenge") {
        if (isCorrect) u.challengeScore++;

        if (u.challengeQ >= u.challengeTotal) {
          const pct = Math.round((u.challengeScore / u.challengeTotal) * 100);
          const stars = pct >= 90 ? "⭐⭐⭐" : pct >= 70 ? "⭐⭐" : "⭐";
          const remark = pct >= 90 ? "🏆 Outstanding!" : pct >= 70 ? "👍 Achha kiya!" : "💪 Aur practice karo!";
          u.mode = null;
          await editMessage(chatId, msgId, `🎯 <b>CHALLENGE COMPLETE!</b>

${resultLine}

${stars}
Score: <b>${u.challengeScore}/${u.challengeTotal}</b>
Accuracy: <b>${pct}%</b>

${remark}`, {
            reply_markup: { inline_keyboard: [[{ text: "🔄 Phir Khelna", callback_data: "mode_challenge" }, { text: "🏠 Menu", callback_data: "menu" }]] },
          });
          return;
        }

        u.challengeQ++;
        const qr = makeQuestion(u);
        u.quizAns = qr.ans;
        await editMessage(chatId, msgId, `${resultLine}

🎯 <b>CHALLENGE</b> — Sawaal <b>${u.challengeQ}/${u.challengeTotal}</b> | ✅ Score: ${u.challengeScore}

❓ <b>${qr.qText}</b>`, { reply_markup: quizKeyboard(qr.opts, qr.subCode, qr.num, qr.q) });
        return;
      }

      // ── SURVIVAL MODE ──
      if (u.mode === "survival") {
        if (isCorrect) {
          u.survivalScore++;
        } else {
          u.lives--;
          if (u.lives <= 0) {
            u.mode = null;
            u.lives = 3;
            await editMessage(chatId, msgId, `${resultLine}

💀 <b>GAME OVER!</b>

🏆 Survival Score: <b>${u.survivalScore}</b>

💪 Phir try karo!`, {
              reply_markup: { inline_keyboard: [[{ text: "🔄 Play Again", callback_data: "mode_survival" }, { text: "🏠 Menu", callback_data: "menu" }]] },
            });
            return;
          }
        }
        const qr = makeQuestion(u);
        u.quizAns = qr.ans;
        await editMessage(chatId, msgId, `${resultLine}

${heart(u.lives)} Lives bachi | 🏆 Score: <b>${u.survivalScore}</b>

❓ <b>${qr.qText}</b>`, { reply_markup: quizKeyboard(qr.opts, qr.subCode, qr.num, qr.q) });
        return;
      }

      // ── SPEED ROUND ──
      if (u.mode === "speed") {
        if (isCorrect) u.speedScore++;

        if (u.speedQ >= u.speedTotal) {
          const pct = Math.round((u.speedScore / u.speedTotal) * 100);
          const remark = pct === 100 ? "⚡ PERFECT!" : pct >= 80 ? "🔥 Excellent!" : pct >= 60 ? "👍 Achha!" : "💪 Try Again!";
          u.mode = null;
          await editMessage(chatId, msgId, `${resultLine}

🏃 <b>SPEED ROUND COMPLETE!</b>

Score: <b>${u.speedScore}/${u.speedTotal}</b>
Accuracy: <b>${pct}%</b>

${remark}`, {
            reply_markup: { inline_keyboard: [[{ text: "🔄 Phir Khelna", callback_data: "mode_speed" }, { text: "🏠 Menu", callback_data: "menu" }]] },
          });
          return;
        }

        u.speedQ++;
        const qr = makeQuestion(u);
        u.quizAns = qr.ans;
        await editMessage(chatId, msgId, `${resultLine}

🏃 Sawaal <b>${u.speedQ}/${u.speedTotal}</b> | ✅ Score: ${u.speedScore}

❓ <b>${qr.qText}</b>

⚡ Jaldi!`, { reply_markup: quizKeyboard(qr.opts, qr.subCode, qr.num, qr.q) });
        return;
      }

      // ── QUIZ MODE (default) ──
      const sm = isCorrect ? streakMsg(u.streak) : "";
      const streakLine = isCorrect
        ? `🔥 Streak: <b>${u.streak}</b>${sm ? " " + sm : ""}  |  ${getLevelEmoji(u.score)} Score: <b>${u.score}</b>`
        : `🔥 Streak toot gayi!  |  ${getLevelEmoji(u.score)} Score: <b>${u.score}</b>`;
      const qr = makeQuestion(u, u.quizFixedNum);
      u.quizAns = qr.ans;
      await editMessage(chatId, msgId, `${resultLine}
${streakLine}

❓ <b>${qr.qText}</b>`, { reply_markup: quizKeyboard(qr.opts, qr.subCode, qr.num, qr.q) });
      return;
    }

    return;
  }

  // ── TEXT MESSAGE ──
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = (msg.text || "").trim();
    const name = msg.from.first_name || "Student";
    const u = getUser(chatId);
    u.lastActive = Date.now();

    if (!text) return;

    // /start — always show subject selection
    if (text === "/start") {
      await sendMessage(chatId, subjectSelectMsg(name), { reply_markup: SUBJECT_MENU });
      return;
    }

    if (text === "/menu") {
      if (!u.subject) {
        await sendMessage(chatId, subjectSelectMsg(name), { reply_markup: SUBJECT_MENU });
      } else {
        await sendMessage(chatId, mainMenuMsg(u.subject, name), { reply_markup: mainMenu(u.subject) });
      }
      return;
    }

    if (text === "/progress") {
      await sendMessage(chatId, progressMsg(u, name), {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Menu", callback_data: "menu" }]] },
      });
      return;
    }

    if (text === "/reset") {
      users[chatId] = null;
      await sendMessage(chatId, "✅ Teri progress reset ho gayi!\n\nFresh start ke liye /start karo.");
      return;
    }

    if (text === "/quiz") {
      await sendMessage(chatId, "⚡ <b>Konsa quiz?</b>", { reply_markup: SUBJECT_MENU });
      return;
    }

    // /table 17
    if (text.startsWith("/table")) {
      const n = parseInt(text.split(" ")[1]);
      if (n >= 11 && n <= 30) {
        await sendMessage(chatId, `📖 <b>Table of ${n}</b>\n\n<code>${getTableText(n)}</code>\n\n💡 ${getTrick(n)}`, {
          reply_markup: { inline_keyboard: [[{ text: `⚡ Table ${n} ka Quiz`, callback_data: `quiz_${n}` }, { text: "🔙 Menu", callback_data: "menu" }]] },
        });
      } else {
        await sendMessage(chatId, "❌ 11 se 30 ke beech number do!\nExample: <code>/table 17</code>");
      }
      return;
    }

    // /square 15
    if (text.startsWith("/square")) {
      const n = parseInt(text.split(" ")[1]);
      if (n >= 1 && n <= 30) {
        await sendMessage(chatId, `🔲 <b>Square of ${n}</b>\n\n${n}² = ${n} × ${n} = <b>${n * n}</b>\n\n💡 ${getSquareTrick(n)}`, {
          reply_markup: { inline_keyboard: [[{ text: `⚡ ${n}² ka Quiz`, callback_data: `quiz_${n}` }, { text: "🔙 Menu", callback_data: "menu" }]] },
        });
      } else {
        await sendMessage(chatId, "❌ 1 se 30 ke beech number do!\nExample: <code>/square 15</code>");
      }
      return;
    }

    // /cube 12
    if (text.startsWith("/cube")) {
      const n = parseInt(text.split(" ")[1]);
      if (n >= 1 && n <= 30) {
        await sendMessage(chatId, `🔳 <b>Cube of ${n}</b>\n\n${n}³ = ${n} × ${n} × ${n} = <b>${n * n * n}</b>\n\n💡 ${getCubeTrick(n)}`, {
          reply_markup: { inline_keyboard: [[{ text: `⚡ ${n}³ ka Quiz`, callback_data: `quiz_${n}` }, { text: "🔙 Menu", callback_data: "menu" }]] },
        });
      } else {
        await sendMessage(chatId, "❌ 1 se 30 ke beech number do!\nExample: <code>/cube 12</code>");
      }
      return;
    }

    // Default
    await sendMessage(chatId, `👋 ${name}, subject chunno:`, { reply_markup: SUBJECT_MENU });
  }
}

// ─────────────────────────────────────────────
//  EXPRESS SERVER + WEBHOOK
// ─────────────────────────────────────────────
const app = express();
app.use(express.json());

app.get("/", (req, res) => res.send("🧮 Tables Master Bot is running! ✅"));

app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  res.sendStatus(200);
  try {
    await handleUpdate(req.body);
  } catch (err) {
    console.error("Update error:", err.message);
  }
});

async function setWebhook() {
  const url = `${WEBHOOK_URL}/webhook/${BOT_TOKEN}`;
  const result = await apiCall("setWebhook", { url, allowed_updates: ["message", "callback_query"] });
  console.log("✅ Webhook:", result.ok ? "Success — " + url : result.description);
}

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await setWebhook();
});

module.exports = app;
