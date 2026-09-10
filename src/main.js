import { createClient } from "@supabase/supabase-js";

const POLL_MS = 2500;
const STORAGE_PREFIX = "cgg-participant:";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

const app = document.getElementById("app");

function sessionCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("s") || "").trim().toUpperCase();
}

function storageKey(joinCode) {
  return `${STORAGE_PREFIX}${joinCode}`;
}

function readStoredParticipant(joinCode) {
  try {
    const raw = window.localStorage.getItem(storageKey(joinCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.participantToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeParticipant(joinCode, payload) {
  window.localStorage.setItem(
    storageKey(joinCode),
    JSON.stringify({
      participantToken: payload.participantToken,
      displayName: payload.displayName,
      clientKey: payload.clientKey,
    }),
  );
}

function ensureClientKey(joinCode) {
  const existing = readStoredParticipant(joinCode)?.clientKey;
  if (existing) return existing;
  const key =
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `client-${Date.now()}-${Math.random().toString(16).slice(2)}`) +
    `-cgg`;
  return key.slice(0, 128);
}

function render(html) {
  app.innerHTML = html;
}

function configMissing() {
  render(`
    <section class="card" aria-labelledby="title">
      <p class="eyebrow">Classroom groups</p>
      <h1 id="title">Not configured</h1>
      <p class="lead">This student app needs browser-safe Supabase settings before it can join sessions.</p>
    </section>
  `);
}

function renderMissingCode() {
  render(`
    <section class="card" aria-labelledby="title">
      <p class="eyebrow">Classroom groups</p>
      <h1 id="title">Join with a session link</h1>
      <p class="lead">Ask your teacher for the QR code or link. It looks like a page ending with <code>?s=ABC123</code>.</p>
    </section>
  `);
}

function renderJoin(joinCode, { error = "", name = "" } = {}) {
  render(`
    <section class="card" aria-labelledby="title">
      <p class="eyebrow">Classroom groups</p>
      <h1 id="title">Enter your name</h1>
      <p class="hint">Session code <strong>${joinCode}</strong></p>
      <form class="form" id="join-form">
        <label for="display-name">Your name</label>
        <input id="display-name" name="displayName" type="text" autocomplete="name" maxlength="80" required minlength="2" value="${escapeAttr(name)}" />
        <button class="button-primary" type="submit">Join</button>
      </form>
      ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
    </section>
  `);

  document.getElementById("join-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("display-name");
    const displayName = input.value.trim();
    input.disabled = true;
    event.submitter.disabled = true;
    try {
      await joinSession(joinCode, displayName);
    } catch (caught) {
      renderJoin(joinCode, {
        error: humaniseError(caught),
        name: displayName,
      });
    }
  });
}

function renderWaiting(displayName) {
  render(`
    <section class="card waiting" aria-live="polite">
      <div class="check" aria-hidden="true">✓</div>
      <h1>You’re in!</h1>
      <p class="student-name">${escapeHtml(displayName)}</p>
      <p class="status">Waiting for your teacher to generate the groups…</p>
    </section>
  `);
}

function renderAwaitingAssignment(displayName) {
  render(`
    <section class="card waiting" aria-live="polite">
      <div class="check" aria-hidden="true">✓</div>
      <h1>You’re in!</h1>
      <p class="student-name">${escapeHtml(displayName)}</p>
      <p class="status">Your teacher knows you’re here and will assign you to a group shortly.</p>
    </section>
  `);
}

function renderAssigned(status) {
  const teammates = Array.isArray(status.teammates) ? status.teammates : [];
  render(`
    <section class="card reveal" aria-live="polite">
      <div class="reveal__mark" aria-hidden="true">🎉</div>
      <p class="eyebrow">You’re in</p>
      <h1 class="group-name">${escapeHtml(status.groupName || "Your group")}</h1>
      <ul class="teammates">
        ${teammates
          .map((name) => {
            const yours = name === status.displayName;
            return `<li class="${yours ? "is-you" : ""}">${escapeHtml(name)}${yours ? ' <span class="sr-only">(you)</span>' : ""}</li>`;
          })
          .join("")}
      </ul>
    </section>
  `);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function humaniseError(error) {
  const message = String(error?.message || error || "");
  if (message.includes("GROUPING_SESSION_NOT_FOUND") || message.includes("GROUPING_JOIN_CODE_INVALID")) {
    return "That session code was not found. Check the link from your teacher.";
  }
  if (message.includes("GROUPING_SESSION_CLOSED")) {
    return "This session has closed.";
  }
  if (message.includes("GROUPING_DISPLAY_NAME_INVALID")) {
    return "Please enter a name between 2 and 80 characters.";
  }
  if (message.includes("GROUPING_PARTICIPANT_NOT_FOUND")) {
    return "Your place in this session could not be found. Please join again.";
  }
  return "Could not join right now. Please try again.";
}

function createApi() {
  return createClient(supabaseUrl, supabaseKey, {
    db: { schema: "api" },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function joinSession(joinCode, displayName) {
  const clientKey = ensureClientKey(joinCode);
  const client = createApi();
  const { data, error } = await client.rpc("join_grouping_session", {
    p_join_code: joinCode,
    p_display_name: displayName,
    p_client_key: clientKey,
  });
  if (error) throw error;
  const payload = {
    participantToken: data.participantToken,
    displayName: data.displayName,
    clientKey,
  };
  storeParticipant(joinCode, payload);
  await showJoinedState(joinCode, payload);
}

async function fetchStatus(participantToken) {
  const client = createApi();
  const { data, error } = await client.rpc("my_grouping_status", {
    p_participant_token: participantToken,
  });
  if (error) throw error;
  return data;
}

let pollTimer = null;

function stopPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function showJoinedState(joinCode, stored) {
  stopPolling();
  const apply = async () => {
    const status = await fetchStatus(stored.participantToken);
    if (status.state === "assigned") {
      stopPolling();
      renderAssigned(status);
      return;
    }
    if (status.state === "awaiting_assignment") {
      renderAwaitingAssignment(status.displayName || stored.displayName);
      return;
    }
    renderWaiting(status.displayName || stored.displayName);
  };

  try {
    await apply();
  } catch (caught) {
    window.localStorage.removeItem(storageKey(joinCode));
    renderJoin(joinCode, { error: humaniseError(caught) });
    return;
  }

  pollTimer = window.setInterval(() => {
    void apply().catch(() => undefined);
  }, POLL_MS);
}

async function boot() {
  if (!supabaseUrl || !supabaseKey) {
    configMissing();
    return;
  }

  const joinCode = sessionCodeFromUrl();
  if (!joinCode) {
    renderMissingCode();
    return;
  }

  if (!/^[A-Z2-9]{6}$/.test(joinCode)) {
    renderJoin(joinCode, {
      error: "That session code does not look valid. Use the link or QR code from your teacher.",
    });
    return;
  }

  const stored = readStoredParticipant(joinCode);
  if (stored?.participantToken) {
    await showJoinedState(joinCode, stored);
    return;
  }

  renderJoin(joinCode);
}

boot();
