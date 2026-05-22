# 🧮 Tables Master Bot — Render Hosting Guide

## Render par Deploy karne ke Steps

---

### STEP 1 — GitHub par Upload karo

1. GitHub.com par jao aur **new repository** banao (naam: `tables-master-bot`)
2. Apne computer mein `render-bot` folder ke andar jao
3. Yeh commands chalao:

```
git init
git add .
git commit -m "Tables Master Bot"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/tables-master-bot.git
git push -u origin main
```

---

### STEP 2 — Render Account banao

1. **render.com** par jao
2. Sign up karo (GitHub se sign up karna best hai)

---

### STEP 3 — New Web Service banao

1. Render Dashboard mein **"New +"** button dabao
2. **"Web Service"** choose karo
3. **"Connect a repository"** pe apna `tables-master-bot` repo select karo
4. Yeh settings rakho:
   - **Name:** `tables-master-bot` (ya jo chahiye)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Instance Type:** `Free` (free mein kaam karega)
5. **"Create Web Service"** dabao

---

### STEP 4 — Environment Variables Set karo (SABSE ZARURI)

Service ban jaane ke baad:

1. Left menu mein **"Environment"** pe click karo
2. **"Add Environment Variable"** pe click karo aur yeh dono add karo:

| Key | Value |
|-----|-------|
| `BOT_TOKEN` | Apna bot token (@BotFather se mila hua) |
| `WEBHOOK_URL` | `https://your-app-name.onrender.com` (Step 5 mein milega) |

---

### STEP 5 — Apna Render URL jaano

1. Render dashboard mein apni service ka naam click karo
2. Upar **`.onrender.com`** wala URL copy karo
3. Yeh URL `WEBHOOK_URL` mein daalo (Step 4 mein wapas jao)

Example: `https://tables-master-bot-xxxx.onrender.com`

---

### STEP 6 — Deploy karo

1. Environment variables save karne ke baad service **automatically redeploy** hogi
2. Logs mein yeh dikhega: `✅ Webhook set: Success`
3. Ab Telegram par apne bot ko `/start` bhejo — kaam karega!

---

## Zaruri Baat — Free Plan ka Limitation

Render ke **free plan** mein agar bot ko 15 minute tak koi message nahi aata toh server **"sleep"** ho jaata hai. Pehla message aane mein ~30 second lag sakta hai bot ko "jaagna" padta hai.

**Solution (keep-alive):** Koi bhi free uptime service use karo jo har 10 min mein ping karti rahe:
- **UptimeRobot** (uptimerobot.com) — free hai, apna Render URL add karo, HTTP monitor set karo, interval 5 minutes

---

## Bot Commands

| Command | Kaam |
|---------|------|
| `/start` | Bot shuru karo |
| `/menu` | Main menu |
| `/progress` | Apni progress dekho |
| `/table 17` | Table 17 dekho |
| `/quiz` | Quiz shuru karo |
| `/reset` | Progress reset karo |
