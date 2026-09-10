# Classroom Group Generator

Mobile-first student app for temporary classroom grouping sessions.

Students open a teacher-provided link such as:

`https://acerosa.github.io/classroom-group-generator/?s=ABC123`

They enter their name, wait, and see their published group. There is no login.

## Local development

```bash
cp .env.example .env
npm install
npm run dev
```

Use browser-safe Supabase values only (URL + anon/publishable key). Never put the service role key in this app.

Vite env names used by the app:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (fallback: `VITE_SUPABASE_ANON_KEY`)

## Production

GitHub Pages deploys from `main` via `.github/workflows/pages.yml`.

Required GitHub Actions configuration (same hosted Supabase project as
`learning-platform-admin`):

- Repository variable `VITE_SUPABASE_URL`
- Repository secret `VITE_SUPABASE_PUBLISHABLE_KEY`

The workflow maps those into the Vite build. Without them, production shows
**Not configured**.

Admin creates sessions in Learning Platform Admin → **Group Generator**.
