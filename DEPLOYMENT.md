# 🚀 Deploying VayuNetra (simple guide)

VayuNetra has **two parts**. You deploy them separately, then connect them:

| Part | What it is | Where it goes |
|---|---|---|
| **Backend** (`backend/`) | The API + ML (FastAPI / Python) | **Render** |
| **Frontend** (`frontend/`) | The website you see (Next.js) | **Vercel** |

**Do the backend FIRST** (you'll need its URL for the frontend).

Everything needed is already in the repo (`render.yaml`, `frontend/.env.example`). No code changes required.

---

## Part 1 — Backend on Render (do this first)

1. Go to **https://render.com** → sign up / log in (use "Continue with GitHub").
2. Click **New ➜ Blueprint**.
3. Pick the repo **`VayuNetra-Urban-Air-Quality-Intelligence`**.
4. Render reads `render.yaml` and shows a service called **`vayunetra-api`**. Click **Apply** / **Create**.
5. Wait for the build (about **3–6 minutes** the first time — it installs Python packages **and trains the 6 city models**). When it says **Live**, you're done.
6. Copy the service URL at the top — it looks like:
   ```
   https://vayunetra-api.onrender.com
   ```
7. Test it: open `https://vayunetra-api.onrender.com/health` in your browser. You should see `{"status":"ok",...}`.

> **Optional (AI text):** the app works fully without any keys (it uses a built-in fallback).
> To turn on the AI advisories/briefings, in Render open your service ➜ **Environment** ➜ add
> `GROQ_API_KEY` = your Groq key ➜ **Save** (it redeploys automatically).

---

## Part 2 — Frontend on Vercel

1. Go to **https://vercel.com** → sign up / log in with GitHub.
2. Click **Add New ➜ Project** and **Import** the same repo.
3. **IMPORTANT — set the Root Directory to `frontend`:**
   - On the import screen find **Root Directory** ➜ **Edit** ➜ choose **`frontend`**.
   - Framework should auto-detect as **Next.js** (leave build settings default).
4. Open **Environment Variables** and add **one**:
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE` | your Render URL from Part 1, e.g. `https://vayunetra-api.onrender.com` |
   *(no trailing slash, no quotes)*
5. Click **Deploy**. Wait ~1–2 minutes.
6. Open the Vercel URL it gives you (e.g. `https://vayunetra.vercel.app`) — that's your live app. 🎉

> If you added the variable *after* deploying, go to **Settings ➜ Environment Variables**, add it,
> then **Deployments ➜ … ➜ Redeploy** so it takes effect (this variable is baked in at build time).

---

## Part 3 — Check it works

- Open your **Vercel** URL.
- The landing page loads → click **Open Console**.
- City data, KPIs, charts, forecasts, advisories should all appear.
- The **map**: see the note below.

---

## Good to know / troubleshooting

**🗺️ The 3D map and your laptop.** The 3D map runs **in the browser using the device's GPU** — *not* on
the server. So on a locked-down laptop where 3D doesn't render, the app automatically shows the **2D
schematic map** (it never goes blank). On a normal machine / a judge's laptop, the full 3D skyline renders.
Hosting on Vercel/Render does **not** change this — it depends on whoever opens the site. The 2D fallback
guarantees the data is always visible.

**⏳ First load after a quiet period is slow (Render free tier).** The free backend "sleeps" after ~15
minutes of no use and takes **~30–60 seconds** to wake up. The first request may spin or error once — just
**wait or refresh**. To remove this, upgrade the Render service to a paid instance (no sleep), or ping
`/health` every few minutes to keep it warm.

**🔌 "Cannot reach the API" on the site.** It means the frontend can't talk to the backend. Check:
1. `NEXT_PUBLIC_API_BASE` in Vercel is **exactly** your Render URL (https, no trailing slash) — then redeploy.
2. The Render service is **Live** and `/health` works.
3. (CORS is already open in the backend, so that's not the cause.)

**🖼️ Logo / changes not showing.** Hard-refresh (`Ctrl+Shift+R`) or open in a private window — it's browser cache.

**Updating later.** Both Render and Vercel **auto-deploy** when you push to `main`. Just `git push` and they rebuild.

---

### Quick reference

| Thing | Value |
|---|---|
| Backend start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (set in `render.yaml`) |
| Backend root dir | `backend` |
| Frontend root dir | `frontend` |
| Frontend env var | `NEXT_PUBLIC_API_BASE` = Render URL |
| Health check | `GET /health` |
