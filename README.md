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

## Production

GitHub Pages deploys from `main` via `.github/workflows/pages.yml`.

Required repository variables/secrets for the workflow:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (or anon key)

Admin creates sessions in Learning Platform Admin → **Group Generator**.
