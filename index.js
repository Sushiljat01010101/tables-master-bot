// ╔══════════════════════════════════════════════════════════╗
// ║     🧮 TABLES MASTER BOT — Advanced Telegram Bot         ║
// ║     Webhook-based | All Features | Full Working          ║
// ╚══════════════════════════════════════════════════════════╝

const express = require("express");
const https = require("https");

// ─────────────────────────────────────────────
//  CONFIG — Environment variables se aata hai
// ─────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) { console.error("❌ BOT_TOKEN set nahi hai!"); process.exit(1); }
if (!WEBHOOK_URL) { console.error("❌ WEBHOOK_URL set nahi hai!"); process.exit(1); }

// ─────────────────────────────────────────────
//  IN-MEMORY USER STATE
// ─────────────────────────────────────────────
const users = {};

function getUser(id) {
  if (!users[id]) {
    users[id] = {
      mode: null,
      // Quiz
      quizFixedTable: null,   // FIX: specific table ya null for random
      quizTable: null,
      quizQ: null,
      quizAns: null,
      // General stats
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
      survivalScore: 0,       // FIX: separate survival score
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

// ─────────────────────────────────────────────
//  TELEGRAM API HELPERS
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

function answerCallback(id, text = "") {
  return apiCall("answerCallbackQuery", { callback_query_id: id, text });
}

function editMessage(chatId, msgId, text, extra = {}) {
  return apiCall("editMessageText", { chat_id: chatId, message_id: msgId, text, parse_mode: "HTML", ...extra });
}

// ─────────────────────────────────────────────
//  TABLE LOGIC
// ─────────────────────────────────────────────
function getTable(n, from = 1, to = 10) {
  const rows = [];
  for (let i = from; i <= to; i++) {
    rows.push(`${n} × ${String(i).padStart(2)} = <b>${n * i}</b>`);
  }
  return rows.join("\n");
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─────────────────────────────────────────────
//  QUIZ QUESTION GENERATOR  — FIX: fixedTable support
// ─────────────────────────────────────────────
function makeQuestion(u, fixedTable = null) {
  const [min, max] = u.currentRange;
  // FIX: agar fixedTable diya hai toh wahi use karo, warna range se random
  const table = (fixedTable !== null && fixedTable >= 11 && fixedTable <= 30)
    ? fixedTable
    : randomInt(min, max);
  const q = randomInt(1, 10);
  const ans = table * q;

  const wrongs = new Set();
  while (wrongs.size < 3) {
    const delta = pickRandom([-2, -1, 1, 2, 3, -3, 5, -5, 10, -10]);
    const w = ans + delta * randomInt(1, 3);
    if (w > 0 && w !== ans) wrongs.add(w);
  }
  const opts = [ans, ...[...wrongs]].sort(() => Math.random() - 0.5);
  return { table, q, ans, opts };
}

// ─────────────────────────────────────────────
//  EMOJI HELPERS
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
  if (s >= 10) return "🔥🔥🔥 LEGENDARY STREAK!";
  if (s >= 7) return "🔥🔥 Amazing streak!";
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

// ─────────────────────────────────────────────
//  KEYBOARDS
// ─────────────────────────────────────────────
const MAIN_MENU = {
  inline_keyboard: [
    [{ text: "📖 Table Dekhna (Learn)", callback_data: "mode_learn" }, { text: "⚡ Quick Quiz", callback_data: "mode_quiz" }],
    [{ text: "🎯 Challenge Mode", callback_data: "mode_challenge" }, { text: "❤️ Survival Mode", callback_data: "mode_survival" }],
    [{ text: "🏃 Speed Round", callback_data: "mode_speed" }, { text: "📊 Meri Progress", callback_data: "progress" }],
    [{ text: "🎲 Random Table", callback_data: "random_table" }, { text: "📚 Practice Set", callback_data: "mode_practice" }],
    [{ text: "🏆 Tips & Tricks", callback_data: "tips" }, { text: "❓ Help", callback_data: "help" }],
  ],
};

function tableSelectKeyboard(mode) {
  const rows = [];
  for (let i = 11; i <= 30; i += 5) {
    const row = [];
    for (let j = i; j < i + 5 && j <= 30; j++) {
      row.push({ text: `${j}`, callback_data: `${mode}_${j}` });
    }
    rows.push(row);
  }
  rows.push([{ text: "🔀 Random", callback_data: `${mode}_random` }, { text: "🔙 Menu", callback_data: "menu" }]);
  return { inline_keyboard: rows };
}

function rangeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "11-15", callback_data: "range_11_15" }, { text: "16-20", callback_data: "range_16_20" }],
      [{ text: "21-25", callback_data: "range_21_25" }, { text: "26-30", callback_data: "range_26_30" }],
      [{ text: "11-20", callback_data: "range_11_20" }, { text: "21-30", callback_data: "range_21_30" }],
      [{ text: "🌍 ALL (11-30)", callback_data: "range_11_30" }, { text: "🔙 Menu", callback_data: "menu" }],
    ],
  };
}

function quizKeyboard(opts, table, q) {
  const rows = [];
  for (let i = 0; i < opts.length; i += 2) {
    const row = [{ text: `${opts[i]}`, callback_data: `ans_${opts[i]}_${table}_${q}` }];
    if (opts[i + 1] !== undefined) row.push({ text: `${opts[i + 1]}`, callback_data: `ans_${opts[i + 1]}_${table}_${q}` });
    rows.push(row);
  }
  rows.push([{ text: "🏠 Menu", callback_data: "menu" }, { text: "⏭ Skip", callback_data: "skip_quiz" }]);
  return { inline_keyboard: rows };
}

// ─────────────────────────────────────────────
//  MESSAGES
// ─────────────────────────────────────────────
function welcomeMsg(name) {
  return `╔══════════════════════════╗
║  🧮 <b>Tables Master Bot</b>  ║
╚══════════════════════════╝

Namaste <b>${name}</b>! 🙏

Main tumhara personal <b>Pahada</b> (Tables) teacher hoon!
Tum <b>11 se 30 tak</b> ki tables yahan aasani se seekh sakte ho.

<b>🎮 Modes available hain:</b>
📖 <b>Learn</b> — Table dekhna &amp; padhna
⚡ <b>Quick Quiz</b> — Specific table ka MCQ
🎯 <b>Challenge</b> — 10 sawaalon ka set
❤️ <b>Survival</b> — 3 lives, survive karo!
🏃 <b>Speed Round</b> — 5 sawaal jaldi jawab do

Neeche menu se mode chunno 👇`;
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

💡 Tip: Roz 15 min practice karo, exam crack!`;
}

// ─────────────────────────────────────────────
//  TABLE TRICKS
// ─────────────────────────────────────────────
function getTrick(n) {
  const tricks = {
    11: "11×11=121, 11×12=132 — digits ek-ek badhte hain!",
    12: "12 = 10+2, toh 12×n = 10n + 2n",
    13: "13×n = 10n + 3n — split karo!",
    14: "14×7=98, 14×8=112 — yaad karo!",
    15: "15² = 225, 15×n = 10n + 5n",
    16: "16 = 2⁴, powers of 2: 16,32,64...",
    17: "17×6=102 — century cross!",
    18: "18×n = 20n - 2n (subtract trick!)",
    19: "19×n = 20n - n (easiest trick!)",
    20: "20×n = 2×10×n — bas zero lagao!",
    21: "21×n = 20n + n",
    22: "22×n = 20n + 2n",
    23: "23×4=92, 23×5=115",
    24: "24×n = 25n - n",
    25: "25×4=100 (yaad rakho!)",
    26: "26×n = 25n + n",
    27: "27×4=108, 27×3=81",
    28: "28×n = 30n - 2n",
    29: "29×n = 30n - n (easiest!)",
    30: "30×n = 3×10×n — bas zero lagao!",
  };
  return tricks[n] || `${n} × n — practice karo!`;
}

// ─────────────────────────────────────────────
//  CHALLENGE FIRST QUESTION STARTER
// ─────────────────────────────────────────────
async function startChallengeFirst(chatId, msgId, u) {
  u.challengeQ = 1;
  u.challengeScore = 0;
  const { table, q, ans, opts } = makeQuestion(u);
  u.quizTable = table; u.quizQ = q; u.quizAns = ans;
  const txt = `🎯 <b>CHALLENGE MODE</b>\n\nSawaal <b>1/${u.challengeTotal}</b> | ✅ Score: 0\n\n❓ <b>${table} × ${q} = ?</b>`;
  if (msgId) {
    await editMessage(chatId, msgId, txt, { reply_markup: quizKeyboard(opts, table, q) });
  } else {
    await sendMessage(chatId, txt, { reply_markup: quizKeyboard(opts, table, q) });
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

    // MENU
    if (data === "menu") {
      u.mode = null;
      u.quizFixedTable = null;
      await editMessage(chatId, msgId, welcomeMsg(name), { reply_markup: MAIN_MENU });
      return;
    }

    // PROGRESS
    if (data === "progress") {
      await editMessage(chatId, msgId, progressMsg(u, name), {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Menu", callback_data: "menu" }]] },
      });
      return;
    }

    // TIPS
    if (data === "tips") {
      const tips = `🏆 <b>EXAM TIPS — Tables ke liye</b>

1️⃣ <b>Pattern Trick (11 ki table):</b>
   11×11=121, 11×12=132 — last 2 digits badhte hain!

2️⃣ <b>Square Trick:</b>
   15² = 225, 25² = 625 (yaad rakho!)

3️⃣ <b>Reverse check:</b>
   17×13 = 13×17 — dono same!

4️⃣ <b>Near-round trick:</b>
   19×7 = 20×7 - 7 = 140 - 7 = 133

5️⃣ <b>20+ tables ka secret:</b>
   23×7 = 20×7 + 3×7 = 140 + 21 = 161

6️⃣ <b>Subtract trick:</b>
   29×n = 30n - n  |  18×n = 20n - 2n

7️⃣ <b>Daily practice tip:</b>
   Roz 1 table ko 5 baar likhkar yaad karo!`;
      await editMessage(chatId, msgId, tips, {
        reply_markup: { inline_keyboard: [[{ text: "⚡ Quiz Try Karo", callback_data: "mode_quiz" }, { text: "🔙 Menu", callback_data: "menu" }]] },
      });
      return;
    }

    // HELP
    if (data === "help") {
      const help = `❓ <b>BOT HELP</b>

<b>Commands:</b>
/start — Bot shuru karo
/menu — Menu dekhna
/progress — Apni progress
/table 17 — Table 17 dekhna
/quiz — Quick quiz shuru
/reset — Progress reset

<b>Modes:</b>
📖 <b>Learn</b> — Pura table padho
⚡ <b>Quiz</b> — Specific table ka MCQ (table fixed rehti hai!)
🎯 <b>Challenge</b> — 10 sawaal, score banao
❤️ <b>Survival</b> — 3 galtiyan, survive karo
🏃 <b>Speed</b> — 5 sawaal jaldi jawab do

<b>Range:</b> Challenge/Survival/Speed ke liye range chunna hoga`;
      await editMessage(chatId, msgId, help, {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Menu", callback_data: "menu" }]] },
      });
      return;
    }

    // RANDOM TABLE
    if (data === "random_table") {
      const n = randomInt(11, 30);
      const text = `🎲 <b>Random Table: ${n}</b>\n\n<code>${getTable(n)}</code>\n\n💡 <b>Trick:</b> ${getTrick(n)}\n\n✨ Isko yaad karo, phir quiz try karo!`;
      await editMessage(chatId, msgId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `⚡ Table ${n} ka Quiz`, callback_data: `quiz_${n}` }, { text: "🎲 Aur random", callback_data: "random_table" }],
            [{ text: "🔙 Menu", callback_data: "menu" }],
          ],
        },
      });
      return;
    }

    // MODE SELECTORS
    if (data === "mode_learn") {
      await editMessage(chatId, msgId, "📖 <b>Konsi table dekhni hai?</b>\n\nEk chunno:", { reply_markup: tableSelectKeyboard("learn") });
      return;
    }

    if (data === "mode_quiz") {
      await editMessage(chatId, msgId, "⚡ <b>Konsi table ka quiz khelna hai?</b>\n\nEk specific table chunne par sirf <u>usi table ke sawaal</u> aayenge!", { reply_markup: tableSelectKeyboard("quiz") });
      return;
    }

    if (data === "mode_challenge") {
      u.mode = "challenge_pending";
      await editMessage(chatId, msgId, "🎯 <b>Challenge Mode</b>\n10 sawaal aayenge, score banao!\n\nKis range se sawaal aayenge?", { reply_markup: rangeKeyboard() });
      return;
    }

    if (data === "mode_survival") {
      u.mode = "survival_pending";
      await editMessage(chatId, msgId, "❤️ <b>Survival Mode</b>\n3 galtiyon mein game over!\n\nKis range se sawaal aayenge?", { reply_markup: rangeKeyboard() });
      return;
    }

    if (data === "mode_speed") {
      u.mode = "speed_pending";
      await editMessage(chatId, msgId, "🏃 <b>Speed Round</b>\n5 sawaal, jaldi answer do!\n\nKis range se sawaal aayenge?", { reply_markup: rangeKeyboard() });
      return;
    }

    if (data === "mode_practice") {
      const t = `📚 <b>Practice Set — All Tables 11-30</b>

Yeh ek structured practice plan hai:

<b>Day 1-2:</b> Tables 11, 12, 13
<b>Day 3-4:</b> Tables 14, 15, 16
<b>Day 5-6:</b> Tables 17, 18, 19
<b>Day 7-8:</b> Tables 20, 21, 22
<b>Day 9-10:</b> Tables 23, 24, 25
<b>Day 11-12:</b> Tables 26, 27, 28
<b>Day 13-14:</b> Tables 29, 30
<b>Day 15:</b> Full revision + quiz

Abhi kahan se shuru karein?`;
      await editMessage(chatId, msgId, t, { reply_markup: tableSelectKeyboard("learn") });
      return;
    }

    // RANGE SELECT (for challenge / survival / speed)
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
        const { table, q, ans, opts } = makeQuestion(u);
        u.quizTable = table; u.quizQ = q; u.quizAns = ans;
        await editMessage(chatId, msgId,
          `❤️ <b>SURVIVAL MODE SHURU!</b>\n\n${heart(3)} 3 lives\n🏆 Score: 0\n\n❓ <b>${table} × ${q} = ?</b>`,
          { reply_markup: quizKeyboard(opts, table, q) });

      } else if (pending === "speed_pending") {
        u.mode = "speed";
        u.speedScore = 0;
        u.speedQ = 1;
        u.speedTotal = 5;
        const { table, q, ans, opts } = makeQuestion(u);
        u.quizTable = table; u.quizQ = q; u.quizAns = ans;
        await editMessage(chatId, msgId,
          `🏃 <b>SPEED ROUND SHURU!</b>\n\nSawaal <b>1/5</b>\n\n❓ <b>${table} × ${q} = ?</b>\n\n⚡ Jaldi answer karo!`,
          { reply_markup: quizKeyboard(opts, table, q) });

      } else {
        await editMessage(chatId, msgId, welcomeMsg(name), { reply_markup: MAIN_MENU });
      }
      return;
    }

    // LEARN TABLE
    if (data.startsWith("learn_")) {
      const n = data === "learn_random" ? randomInt(11, 30) : parseInt(data.split("_")[1]);
      const text = `📖 <b>Table of ${n}</b>
━━━━━━━━━━━━━━━━━━━
<code>${getTable(n)}</code>
━━━━━━━━━━━━━━━━━━━

💡 <b>Trick:</b> ${getTrick(n)}`;
      await editMessage(chatId, msgId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `⚡ Table ${n} ka Quiz`, callback_data: `quiz_${n}` }, { text: "📖 Aur table", callback_data: "mode_learn" }],
            [{ text: "🔙 Menu", callback_data: "menu" }],
          ],
        },
      });
      return;
    }

    // ─── FIX: QUIZ START — specific table fixed rehti hai ───
    if (data.startsWith("quiz_")) {
      // Parse fixed table number (null agar random)
      let fixedTable = null;
      if (data !== "quiz_random") {
        const parsed = parseInt(data.split("_")[1]);
        if (!isNaN(parsed) && parsed >= 11 && parsed <= 30) {
          fixedTable = parsed;
        }
      }

      u.mode = "quiz";
      u.quizFixedTable = fixedTable; // FIX: store for all subsequent questions

      const { table, q, ans, opts } = makeQuestion(u, fixedTable);
      u.quizTable = table; u.quizQ = q; u.quizAns = ans;

      const tableLabel = fixedTable
        ? `Table <b>${fixedTable}</b> ka quiz — sirf isi table ke sawaal!`
        : `Random quiz — range ${u.currentRange[0]}-${u.currentRange[1]}`;

      const txt = `⚡ <b>QUIZ TIME!</b>
${tableLabel}

${getLevelEmoji(u.score)} Score: <b>${u.score}</b> | 🔥 Streak: <b>${u.streak}</b>

❓ <b>${table} × ${q} = ?</b>

Sahi option chunno:`;
      await editMessage(chatId, msgId, txt, { reply_markup: quizKeyboard(opts, table, q) });
      return;
    }

    // ─── FIX: SKIP — fixed table use karo ───
    if (data === "skip_quiz") {
      u.total++;
      const { table, q, ans, opts } = makeQuestion(u, u.quizFixedTable);
      u.quizTable = table; u.quizQ = q; u.quizAns = ans;
      u.streak = 0;
      const tableLabel = u.quizFixedTable ? `Table ${u.quizFixedTable}` : "Random";
      await editMessage(chatId, msgId,
        `⏭ <b>Skipped!</b> (${tableLabel})\n\n❓ <b>${table} × ${q} = ?</b>`,
        { reply_markup: quizKeyboard(opts, table, q) });
      return;
    }

    // ─────────────────────────────────────────────
    //  ANSWER HANDLER — FULLY FIXED
    // ─────────────────────────────────────────────
    if (data.startsWith("ans_")) {
      const parts = data.split("_");
      const chosen = parseInt(parts[1]);
      const table = parseInt(parts[2]);
      const q = parseInt(parts[3]);
      const correct = table * q;
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

      // Result line
      const resultLine = isCorrect
        ? `✅ <b>SAHI JAWAB!</b> 🎉  ${table} × ${q} = <b>${correct}</b>`
        : `❌ <b>GALAT!</b>  ${table} × ${q} = <b>${correct}</b>  |  Tumne: ${chosen}`;

      // ── CHALLENGE MODE ──
      if (u.mode === "challenge") {
        if (isCorrect) u.challengeScore++;

        // Check agar yeh last sawaal tha
        if (u.challengeQ >= u.challengeTotal) {
          const pct = Math.round((u.challengeScore / u.challengeTotal) * 100);
          const stars = pct >= 90 ? "⭐⭐⭐" : pct >= 70 ? "⭐⭐" : "⭐";
          const remark = pct >= 90 ? "🏆 Outstanding!" : pct >= 70 ? "👍 Achha kiya!" : "💪 Aur practice karo!";
          const endTxt = `🎯 <b>CHALLENGE COMPLETE!</b>

${resultLine}

${stars}
Score: <b>${u.challengeScore}/${u.challengeTotal}</b>
Accuracy: <b>${pct}%</b>

${remark}`;
          u.mode = null;
          await editMessage(chatId, msgId, endTxt, {
            reply_markup: { inline_keyboard: [[{ text: "🔄 Phir Khelna", callback_data: "mode_challenge" }, { text: "🏠 Menu", callback_data: "menu" }]] },
          });
          return;
        }

        // Agla sawaal
        u.challengeQ++;
        const { table: nt, q: nq, ans: na, opts } = makeQuestion(u);
        u.quizTable = nt; u.quizQ = nq; u.quizAns = na;
        const challengeTxt = `${resultLine}

🎯 <b>CHALLENGE</b> — Sawaal <b>${u.challengeQ}/${u.challengeTotal}</b> | ✅ Score: ${u.challengeScore}

❓ <b>${nt} × ${nq} = ?</b>`;
        await editMessage(chatId, msgId, challengeTxt, { reply_markup: quizKeyboard(opts, nt, nq) });
        return;
      }

      // ── SURVIVAL MODE ──
      if (u.mode === "survival") {
        if (isCorrect) {
          u.survivalScore++;
        } else {
          u.lives--;
          if (u.lives <= 0) {
            const endTxt = `${resultLine}

💀 <b>GAME OVER!</b>

🏆 Survival Score: <b>${u.survivalScore}</b>

Phir try karo! 💪`;
            u.mode = null;
            u.lives = 3;
            await editMessage(chatId, msgId, endTxt, {
              reply_markup: { inline_keyboard: [[{ text: "🔄 Play Again", callback_data: "mode_survival" }, { text: "🏠 Menu", callback_data: "menu" }]] },
            });
            return;
          }
        }
        const { table: nt, q: nq, ans: na, opts } = makeQuestion(u);
        u.quizTable = nt; u.quizQ = nq; u.quizAns = na;
        const survivalTxt = `${resultLine}

${heart(u.lives)} Lives bachi | 🏆 Score: <b>${u.survivalScore}</b>

❓ <b>${nt} × ${nq} = ?</b>`;
        await editMessage(chatId, msgId, survivalTxt, { reply_markup: quizKeyboard(opts, nt, nq) });
        return;
      }

      // ── SPEED ROUND ──
      if (u.mode === "speed") {
        if (isCorrect) u.speedScore++;

        // Check agar last sawaal tha
        if (u.speedQ >= u.speedTotal) {
          const pct = Math.round((u.speedScore / u.speedTotal) * 100);
          const remark = pct === 100 ? "⚡ PERFECT SPEED!" : pct >= 80 ? "🔥 Excellent!" : pct >= 60 ? "👍 Achha!" : "💪 Aur karo!";
          const endTxt = `${resultLine}

🏃 <b>SPEED ROUND COMPLETE!</b>

Score: <b>${u.speedScore}/${u.speedTotal}</b>
Accuracy: <b>${pct}%</b>

${remark}`;
          u.mode = null;
          await editMessage(chatId, msgId, endTxt, {
            reply_markup: { inline_keyboard: [[{ text: "🔄 Phir Khelna", callback_data: "mode_speed" }, { text: "🏠 Menu", callback_data: "menu" }]] },
          });
          return;
        }

        // Agla sawaal
        u.speedQ++;
        const { table: nt, q: nq, ans: na, opts } = makeQuestion(u);
        u.quizTable = nt; u.quizQ = nq; u.quizAns = na;
        const speedTxt = `${resultLine}

🏃 Sawaal <b>${u.speedQ}/${u.speedTotal}</b> | ✅ Score: ${u.speedScore}

❓ <b>${nt} × ${nq} = ?</b>

⚡ Jaldi!`;
        await editMessage(chatId, msgId, speedTxt, { reply_markup: quizKeyboard(opts, nt, nq) });
        return;
      }

      // ── QUIZ MODE (default) — FIX: quizFixedTable use hoga ──
      const sm = isCorrect ? streakMsg(u.streak) : "";
      const streakInfo = isCorrect
        ? `🔥 Streak: <b>${u.streak}</b>${sm ? " " + sm : ""}\n${getLevelEmoji(u.score)} Score: <b>${u.score}</b>`
        : `🔥 Streak toot gayi!`;
      const { table: nt, q: nq, ans: na, opts } = makeQuestion(u, u.quizFixedTable);
      u.quizTable = nt; u.quizQ = nq; u.quizAns = na;
      const tableLabel = u.quizFixedTable ? `Table <b>${u.quizFixedTable}</b>` : "Random";
      const quizTxt = `${resultLine}
${streakInfo}

❓ <b>${nt} × ${nq} = ?</b>  (${tableLabel})`;
      await editMessage(chatId, msgId, quizTxt, { reply_markup: quizKeyboard(opts, nt, nq) });
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

    if (text === "/start" || text === "/menu") {
      await sendMessage(chatId, welcomeMsg(name), { reply_markup: MAIN_MENU });
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
      await sendMessage(chatId, "✅ Teri progress reset ho gayi!\n\nFresh start ke liye /start karo.", {
        reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu" }]] },
      });
      return;
    }

    if (text === "/quiz") {
      await sendMessage(chatId, "⚡ <b>Konsi table ka quiz?</b>\n\nEk specific table chunne par sirf usi table ke sawaal aayenge!", { reply_markup: tableSelectKeyboard("quiz") });
      return;
    }

    if (text.startsWith("/table")) {
      const n = parseInt(text.split(" ")[1]);
      if (n >= 11 && n <= 30) {
        await sendMessage(chatId, `📖 <b>Table of ${n}</b>\n\n<code>${getTable(n)}</code>\n\n💡 <b>Trick:</b> ${getTrick(n)}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: `⚡ Table ${n} ka Quiz`, callback_data: `quiz_${n}` }, { text: "🔙 Menu", callback_data: "menu" }],
            ],
          },
        });
      } else {
        await sendMessage(chatId, "❌ 11 se 30 ke beech number do!\nExample: <code>/table 17</code>", { reply_markup: MAIN_MENU });
      }
      return;
    }

    await sendMessage(chatId, `👋 ${name}, menu se mode chunno:`, { reply_markup: MAIN_MENU });
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
  console.log("✅ Webhook set:", result.ok ? "Success — " + url : result.description);
}

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await setWebhook();
});

module.exports = app;
