// ╔══════════════════════════════════════════════════════════╗
// ║     🧮 TABLES MASTER BOT — Advanced Telegram Bot         ║
// ║     Webhook-based | All Features | Best UI               ║
// ╚══════════════════════════════════════════════════════════╝

const express = require("express");
const https = require("https");

// ─────────────────────────────────────────────
//  CONFIG — Environment variables se aata hai
// ─────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL; // Render ka URL (e.g. https://your-app.onrender.com)
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN environment variable set nahi hai!");
  process.exit(1);
}
if (!WEBHOOK_URL) {
  console.error("❌ WEBHOOK_URL environment variable set nahi hai!");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ─────────────────────────────────────────────
//  IN-MEMORY USER STATE
// ─────────────────────────────────────────────
const users = {};

function getUser(id) {
  if (!users[id]) {
    users[id] = {
      mode: null,
      quizTable: null,
      quizQ: null,
      score: 0,
      streak: 0,
      bestStreak: 0,
      total: 0,
      lives: 3,
      history: [],
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
  return "❤️".repeat(n) + "🖤".repeat(3 - n);
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
    [{ text: "🏆 Leaderboard Tips", callback_data: "tips" }, { text: "❓ Help", callback_data: "help" }],
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

// ─────────────────────────────────────────────
//  QUIZ QUESTION GENERATOR
// ─────────────────────────────────────────────
function makeQuestion(u) {
  const [min, max] = u.currentRange;
  const table = randomInt(min, max);
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

function quizKeyboard(opts, table, q) {
  const rows = [];
  for (let i = 0; i < opts.length; i += 2) {
    const row = [{ text: `${opts[i]}`, callback_data: `ans_${opts[i]}_${table}_${q}` }];
    if (opts[i + 1]) row.push({ text: `${opts[i + 1]}`, callback_data: `ans_${opts[i + 1]}_${table}_${q}` });
    rows.push(row);
  }
  rows.push([{ text: "🏠 Menu", callback_data: "menu" }, { text: "⏭ Skip", callback_data: "skip_quiz" }]);
  return { inline_keyboard: rows };
}

// ─────────────────────────────────────────────
//  MESSAGES
// ─────────────────────────────────────────────
function welcomeMsg(name) {
  return `
╔══════════════════════════╗
║  🧮 <b>Tables Master Bot</b>  ║
╚══════════════════════════╝

Namaste <b>${name}</b>! 🙏

Main tumhara personal <b>Pahada</b> (Tables) teacher hoon!
Tum <b>11 se 30 tak</b> ki tables yahan aasani se seekh sakte ho.

<b>🎮 Modes available hain:</b>
📖 <b>Learn</b> — Table dekhna & padhna
⚡ <b>Quick Quiz</b> — MCQ questions
🎯 <b>Challenge</b> — 10 sawaalon ka set
❤️ <b>Survival</b> — 3 lives, survive karo!
🏃 <b>Speed Round</b> — Jaldi jawab do

Neeche menu se mode chunno 👇
`;
}

function progressMsg(u, name) {
  const acc = u.total > 0 ? Math.round((u.score / u.total) * 100) : 0;
  return `
📊 <b>TERI PROGRESS — ${name}</b>

${getLevelEmoji(u.score)} Level: <b>${getLevelName(u.score)}</b>
✅ Sahi jawab: <b>${u.score}</b>
❌ Galat jawab: <b>${u.total - u.score}</b>
📈 Accuracy: <b>${acc}%</b>
🔥 Best Streak: <b>${u.bestStreak}</b>
🎯 Kul sawaal: <b>${u.total}</b>

<b>Progress Bar:</b>
${progressBar(acc)}

💡 Tip: Roz 15 min practice karo, exam crack!
`;
}

function progressBar(pct) {
  const filled = Math.round(pct / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled) + ` ${pct}%`;
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
//  CHALLENGE Q HELPER
// ─────────────────────────────────────────────
async function startChallengeQ(chatId, msgId, u) {
  u.challengeQ++;
  if (u.challengeQ > u.challengeTotal) {
    const pct = Math.round((u.challengeScore / u.challengeTotal) * 100);
    const stars = pct >= 90 ? "⭐⭐⭐" : pct >= 70 ? "⭐⭐" : "⭐";
    const text = `🎯 <b>CHALLENGE COMPLETE!</b>\n\n${stars}\nScore: <b>${u.challengeScore}/${u.challengeTotal}</b>\nAccuracy: <b>${pct}%</b>\n\n${pct >= 90 ? "🏆 Outstanding!" : pct >= 70 ? "👍 Achha kiya!" : "💪 Aur practice karo!"}`;
    u.score += u.challengeScore;
    u.total += u.challengeTotal;
    u.mode = null;
    if (msgId) {
      await editMessage(chatId, msgId, text, { reply_markup: { inline_keyboard: [[{ text: "🔄 Again", callback_data: "mode_challenge" }, { text: "🏠 Menu", callback_data: "menu" }]] } });
    } else {
      await sendMessage(chatId, text, { reply_markup: { inline_keyboard: [[{ text: "🔄 Again", callback_data: "mode_challenge" }, { text: "🏠 Menu", callback_data: "menu" }]] } });
    }
    return;
  }
  const { table, q, ans, opts } = makeQuestion(u);
  u.quizTable = table; u.quizQ = q; u.quizAns = ans;
  const txt = `🎯 <b>CHALLENGE</b> — Sawaal ${u.challengeQ}/${u.challengeTotal}\n\n✅ Score: ${u.challengeScore}\n\n❓ <b>${table} × ${q} = ?</b>`;
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

    if (data === "menu") {
      u.mode = null;
      await editMessage(chatId, msgId, welcomeMsg(name), { reply_markup: MAIN_MENU });
      return;
    }

    if (data === "progress") {
      await editMessage(chatId, msgId, progressMsg(u, name), {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Menu", callback_data: "menu" }]] },
      });
      return;
    }

    if (data === "tips") {
      const tips = `
🏆 <b>EXAM TIPS — Tables ke liye</b>

1️⃣ <b>Pattern Trick (11 ki table):</b>
   11×11=121, 11×12=132... last 2 digits badhte hain!

2️⃣ <b>Square Trick (15×15=225):</b>
   15² = 225 (yaad rakho!)

3️⃣ <b>Reverse check:</b>
   17×13 = 13×17 — dono same!

4️⃣ <b>Near-round trick:</b>
   19×7 = 20×7 - 7 = 140-7 = 133

5️⃣ <b>Daily practice:</b>
   Roz 1 table mazboot karo

6️⃣ <b>Speed tip:</b>
   Tables bolte waqt rhythm banao — jaise rap!

7️⃣ <b>Test trick:</b>
   Agar yaad na aaye, paas wali table se calculate karo

💡 <b>Secret:</b> 20+ tables = 20×n + (table-20)×n
Example: 23×7 = 20×7 + 3×7 = 140+21 = 161
`;
      await editMessage(chatId, msgId, tips, {
        reply_markup: { inline_keyboard: [[{ text: "⚡ Quiz Try Karo", callback_data: "mode_quiz" }, { text: "🔙 Menu", callback_data: "menu" }]] },
      });
      return;
    }

    if (data === "help") {
      const help = `
❓ <b>BOT HELP</b>

<b>Commands:</b>
/start — Bot shuru karo
/menu — Menu dekhna
/progress — Apni progress
/table 17 — Table 17 dekhna
/quiz — Quick quiz shuru
/reset — Progress reset

<b>Modes:</b>
📖 Learn — Pura table padho
⚡ Quiz — MCQ format
🎯 Challenge — 10 sawaal ka set
❤️ Survival — 3 lives
🏃 Speed — Fast answers

<b>Range Filter:</b>
Sirf kuch tables practice karo (e.g. 11-15)

Bot banaya gaya hai aapki padhai ke liye! 📚
`;
      await editMessage(chatId, msgId, help, {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Menu", callback_data: "menu" }]] },
      });
      return;
    }

    if (data === "random_table") {
      const n = randomInt(11, 30);
      const text = `🎲 <b>Random Table: ${n}</b>\n\n<code>${getTable(n)}</code>\n\n✨ Isko yaad karo, phir quiz try karo!`;
      await editMessage(chatId, msgId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⚡ Isi table ka Quiz", callback_data: `quiz_${n}` }, { text: "🎲 Aur random", callback_data: "random_table" }],
            [{ text: "🔙 Menu", callback_data: "menu" }],
          ],
        },
      });
      return;
    }

    if (data === "mode_learn") {
      await editMessage(chatId, msgId, "📖 <b>Konsi table dekhni hai?</b>\n\nEk chunno:", { reply_markup: tableSelectKeyboard("learn") });
      return;
    }
    if (data === "mode_quiz") {
      await editMessage(chatId, msgId, "⚡ <b>Konsi table ka quiz?</b>\n\nEk chunno ya Random:", { reply_markup: tableSelectKeyboard("quiz") });
      return;
    }
    if (data === "mode_challenge") {
      await editMessage(chatId, msgId, "🎯 <b>Challenge Mode</b>\n10 sawaal aayenge, score banao!\n\nRange chunno:", { reply_markup: rangeKeyboard() });
      u.mode = "challenge_pending";
      return;
    }
    if (data === "mode_survival") {
      await editMessage(chatId, msgId, "❤️ <b>Survival Mode</b>\n3 galtiyon mein game over!\n\nRange chunno:", { reply_markup: rangeKeyboard() });
      u.mode = "survival_pending";
      return;
    }
    if (data === "mode_speed") {
      await editMessage(chatId, msgId, "🏃 <b>Speed Round</b>\n5 sawaal, jaldi answer do!\n\nRange chunno:", { reply_markup: rangeKeyboard() });
      u.mode = "speed_pending";
      return;
    }
    if (data === "mode_practice") {
      const t = `
📚 <b>Practice Set — All Tables 11-30</b>

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

    if (data.startsWith("learn_")) {
      const n = data === "learn_random" ? randomInt(11, 30) : parseInt(data.split("_")[1]);
      const text = `
📖 <b>Table of ${n}</b>
━━━━━━━━━━━━━━━━━━━
<code>${getTable(n)}</code>
━━━━━━━━━━━━━━━━━━━

💡 <b>Trick:</b> ${getTrick(n)}
`;
      await editMessage(chatId, msgId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `⚡ ${n} ka Quiz`, callback_data: `quiz_${n}` }, { text: "📖 Aur table", callback_data: "mode_learn" }],
            [{ text: "🔙 Menu", callback_data: "menu" }],
          ],
        },
      });
      return;
    }

    if (data.startsWith("quiz_")) {
      u.mode = "quiz";
      const { table, q, ans, opts } = makeQuestion(u);
      u.quizTable = table;
      u.quizQ = q;
      u.quizAns = ans;
      const txt = `⚡ <b>QUIZ TIME!</b>\n\n${getLevelEmoji(u.score)} Score: <b>${u.score}</b> | 🔥 Streak: <b>${u.streak}</b>\n\n❓ <b>${table} × ${q} = ?</b>\n\nSahi option chunno:`;
      await editMessage(chatId, msgId, txt, { reply_markup: quizKeyboard(opts, table, q) });
      return;
    }

    if (data.startsWith("ans_")) {
      const parts = data.split("_");
      const chosen = parseInt(parts[1]);
      const table = parseInt(parts[2]);
      const q = parseInt(parts[3]);
      const correct = table * q;
      u.total++;

      if (chosen === correct) {
        u.score++;
        u.streak++;
        if (u.streak > u.bestStreak) u.bestStreak = u.streak;
        const sm = streakMsg(u.streak);
        const msg = `✅ <b>SAHI JAWAB!</b> 🎉\n\n${table} × ${q} = <b>${correct}</b>\n\n🔥 Streak: <b>${u.streak}</b> ${sm}\n${getLevelEmoji(u.score)} Score: <b>${u.score}</b>\n\nAgle sawaal ke liye:`;
        const { table: nt, q: nq, ans: na, opts } = makeQuestion(u);
        u.quizTable = nt; u.quizQ = nq; u.quizAns = na;
        await editMessage(chatId, msgId, msg + `\n\n❓ <b>${nt} × ${nq} = ?</b>`, { reply_markup: quizKeyboard(opts, nt, nq) });
      } else {
        u.streak = 0;
        if (u.mode === "survival") {
          u.lives--;
          if (u.lives <= 0) {
            await editMessage(chatId, msgId, `💀 <b>GAME OVER!</b>\n\nSahi jawab tha: <b>${correct}</b>\n\n📊 Final Score: <b>${u.score}</b>\n\nPhir try karo!`, {
              reply_markup: { inline_keyboard: [[{ text: "🔄 Play Again", callback_data: "mode_survival" }, { text: "🏠 Menu", callback_data: "menu" }]] },
            });
            u.mode = null; u.lives = 3;
            return;
          }
        }
        // Challenge mode score tracking
        if (u.mode === "challenge") {
          const { table: nt, q: nq, ans: na, opts } = makeQuestion(u);
          u.quizTable = nt; u.quizQ = nq; u.quizAns = na;
          const msg = `❌ <b>GALAT!</b>\n\n${table} × ${q} = <b>${correct}</b>\n\nTumne chuna: ${chosen}\n\n🔥 Streak toot gayi!\n\nAgle sawaal:`;
          await editMessage(chatId, msgId, msg + `\n\n❓ <b>${nt} × ${nq} = ?</b>`, { reply_markup: quizKeyboard(opts, nt, nq) });
          u.challengeQ++;
          if (u.challengeQ > u.challengeTotal) {
            await startChallengeQ(chatId, msgId, u);
          }
          return;
        }
        const msg = `❌ <b>GALAT!</b>\n\n${table} × ${q} = <b>${correct}</b>\n\nTumne chuna: ${chosen}\n${u.mode === "survival" ? `\n${heart(u.lives)} Lives bachi\n` : ""}\n🔥 Streak toot gayi!\n\nAgle sawaal:`;
        const { table: nt, q: nq, ans: na, opts } = makeQuestion(u);
        u.quizTable = nt; u.quizQ = nq; u.quizAns = na;
        await editMessage(chatId, msgId, msg + `\n\n❓ <b>${nt} × ${nq} = ?</b>`, { reply_markup: quizKeyboard(opts, nt, nq) });
      }
      return;
    }

    if (data === "start_challenge") {
      u.mode = "challenge";
      u.challengeScore = 0;
      u.challengeQ = 0;
      u.challengeTotal = 10;
      await startChallengeQ(chatId, msgId, u);
      return;
    }

    if (data === "start_survival") {
      u.mode = "survival";
      u.lives = 3;
      u.score = 0;
      const { table, q, ans, opts } = makeQuestion(u);
      u.quizTable = table; u.quizQ = q; u.quizAns = ans;
      const txt = `❤️ <b>SURVIVAL MODE</b>\n\n${heart(3)} 3 lives\n\n❓ <b>${table} × ${q} = ?</b>`;
      await editMessage(chatId, msgId, txt, { reply_markup: quizKeyboard(opts, table, q) });
      return;
    }

    if (data === "skip_quiz") {
      const { table, q, ans, opts } = makeQuestion(u);
      u.quizTable = table; u.quizQ = q; u.quizAns = ans;
      await editMessage(chatId, msgId, `⏭ <b>Skipped!</b>\n\n❓ <b>${table} × ${q} = ?</b>`, { reply_markup: quizKeyboard(opts, table, q) });
      return;
    }

    if (data.startsWith("range_")) {
      const parts = data.split("_");
      u.currentRange = [parseInt(parts[1]), parseInt(parts[2])];
      const pending = u.mode;
      if (pending === "challenge_pending") {
        u.mode = "challenge";
        u.challengeScore = 0; u.challengeQ = 0; u.challengeTotal = 10;
        await startChallengeQ(chatId, msgId, u);
      } else if (pending === "survival_pending") {
        u.mode = "survival"; u.lives = 3;
        const { table, q, ans, opts } = makeQuestion(u);
        u.quizTable = table; u.quizQ = q; u.quizAns = ans;
        await editMessage(chatId, msgId, `❤️ <b>SURVIVAL MODE</b>\n\n${heart(3)} 3 lives\n\n❓ <b>${table} × ${q} = ?</b>`, { reply_markup: quizKeyboard(opts, table, q) });
      } else if (pending === "speed_pending") {
        u.mode = "speed"; u.speedScore = 0; u.speedQ = 0; u.speedTotal = 5;
        const { table, q, ans, opts } = makeQuestion(u);
        u.quizTable = table; u.quizQ = q; u.quizAns = ans;
        await editMessage(chatId, msgId, `🏃 <b>SPEED ROUND!</b>\n\nSawaal 1/5\n\n❓ <b>${table} × ${q} = ?</b>\n\n⚡ Jaldi answer karo!`, { reply_markup: quizKeyboard(opts, table, q) });
      } else {
        await editMessage(chatId, msgId, welcomeMsg(name), { reply_markup: MAIN_MENU });
      }
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
      await sendMessage(chatId, "✅ Progress reset ho gayi! /start karo.", { reply_markup: MAIN_MENU });
      return;
    }

    if (text === "/quiz") {
      await sendMessage(chatId, "⚡ <b>Konsi table ka quiz?</b>", { reply_markup: tableSelectKeyboard("quiz") });
      return;
    }

    if (text.startsWith("/table")) {
      const n = parseInt(text.split(" ")[1]);
      if (n >= 11 && n <= 30) {
        await sendMessage(chatId, `📖 <b>Table of ${n}</b>\n\n<code>${getTable(n)}</code>\n\n💡 ${getTrick(n)}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: `⚡ ${n} ka Quiz`, callback_data: `quiz_${n}` }, { text: "🔙 Menu", callback_data: "menu" }],
            ],
          },
        });
      } else {
        await sendMessage(chatId, "❌ 11 se 30 ke beech number do!\nExample: /table 17", { reply_markup: MAIN_MENU });
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
    console.error("Update error:", err);
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
