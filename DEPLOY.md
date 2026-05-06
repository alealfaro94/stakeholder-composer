# Stakeholder Update Composer — Deploy to Vercel + Supabase

## What's in this project

```
api/
  generate.js       ← Vercel serverless — proxies Anthropic API (key stays server-side)
  jira.js           ← Vercel serverless — proxies Jira REST API (avoids CORS)
src/
  StakeholderComposer.jsx  ← main React component
  lib/supabase.js          ← Supabase client + save/load helpers
  main.jsx
supabase-schema.sql        ← run once in Supabase SQL editor
vercel.json
package.json
.env.example               ← copy to .env.local for local dev
```

---

## Step 1 — Supabase setup (~5 min)

1. Go to [supabase.com](https://supabase.com) → "New project"
2. Give it a name (e.g. `stakeholder-composer`) and a strong database password. Save the password somewhere safe.
3. Once the project is ready, open **SQL Editor** → **New query**
4. Paste the contents of `supabase-schema.sql` and click **Run**
5. Go to **Project Settings → API** and copy:
   - **Project URL** → this is your `VITE_SUPABASE_URL`
   - **anon / public** key → this is your `VITE_SUPABASE_ANON_KEY`

---

## Step 2 — Get your Anthropic API key (~2 min)

1. Go to [console.anthropic.com/account/keys](https://console.anthropic.com/account/keys)
2. Click **Create Key** → copy it
3. This will be your `ANTHROPIC_API_KEY` — it never touches the browser

---

## Step 3 — Deploy to Vercel (~5 min)

### Option A — GitHub (recommended)

1. Push this project to a GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Initial deploy: Stakeholder Update Composer"
   # create a repo on github.com, then:
   git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) → **New Project** → import your GitHub repo

3. Vercel will auto-detect it as a Vite project. Before clicking **Deploy**, add Environment Variables:

   | Key                   | Value                              | Environment    |
   |-----------------------|------------------------------------|----------------|
   | `ANTHROPIC_API_KEY`   | `sk-ant-api03-...`                 | Production      |
   | `VITE_SUPABASE_URL`   | `https://xxxx.supabase.co`         | Production      |
   | `VITE_SUPABASE_ANON_KEY` | `eyJ...`                        | Production      |

4. Click **Deploy**. Done — your app will be live at `https://your-app.vercel.app`.

### Option B — Vercel CLI

```bash
npm install -g vercel
vercel login
cd stakeholder-composer
vercel
# follow prompts, then add env vars:
vercel env add ANTHROPIC_API_KEY
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod
```

---

## Step 4 — Local development

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
cp .env.example .env.local
# Edit .env.local with your real keys

# 3. Start the dev server
npm run dev
# → http://localhost:5173
```

> **Note on local /api/ routes:** Vite's dev server doesn't run Vercel serverless functions.
> For local dev you have two options:
> - Use [Vercel CLI dev mode](https://vercel.com/docs/cli/dev): `vercel dev` (runs both React + API functions together)
> - Or temporarily add your Anthropic key directly in the browser via the standalone HTML version for testing

---

## Step 5 — Configure Jira (in the app itself)

Once deployed, open your app URL and click **Settings**:
- **Jira Domain**: `carters.atlassian.net`
- **Jira Email**: your Atlassian email
- **Jira API Token**: generate at [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens)

These are saved in your browser's localStorage — not stored on any server.

---

## Architecture overview

```
Browser                     Vercel Edge              External APIs
  │                              │                        │
  ├─ POST /api/generate ────────►│── fetch ──────────────►│ api.anthropic.com
  │    { prompt }                │   { x-api-key: env }   │
  │◄── { content }──────────────┤◄──────────────────────┤
  │                              │                        │
  ├─ POST /api/jira ────────────►│── fetch ──────────────►│ your.atlassian.net
  │    { domain, email, token,   │   { Authorization }    │
  │      jql }                   │                        │
  │◄── { issues } ──────────────┤◄──────────────────────┤
  │                              │
  ├─ Supabase JS SDK ────────────────────────────────────►│ supabase.co
  │    (direct, with anon key)                            │   sprint_updates table
```

The Anthropic API key **never reaches the browser**. The Jira token is passed through the proxy but is never logged or stored server-side.

---

## Supabase tables

### `sprint_updates`

| Column        | Type        | Description                          |
|---------------|-------------|--------------------------------------|
| `id`          | uuid PK     | Auto-generated                       |
| `created_at`  | timestamptz | Auto-set                             |
| `project_name`| text        | From form field                      |
| `sprint`      | text        | From form field                      |
| `form_data`   | jsonb       | Full form state snapshot             |
| `outputs`     | jsonb       | All 4 generated update texts         |
| `label`       | text        | Optional user-defined save name      |

Row Level Security is enabled with open anon policies. To restrict access to authenticated users, replace the RLS policies with `USING (auth.uid() IS NOT NULL)` after enabling Supabase Auth.
