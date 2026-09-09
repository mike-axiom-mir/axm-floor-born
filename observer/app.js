const els = Object.fromEntries([
  'sessionId','windowState','budgetState','controlState','sessionStatus','objective','ownGroups','contacts',
  'actions','actionCount','feedback','transcript','transcriptCount','resetButton',
].map((id) => [id, document.getElementById(id)]));

let state = null;
let busy = false;

await refresh('Console ready. Choose one legal action; Floorborn answers through the same world rules.');

els.resetButton.addEventListener('click', async () => {
  if (busy) return;
  await mutate('/api/reset', {}, 'Lab reset to the deterministic opening state.');
});

document.addEventListener('keydown', (event) => {
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  const buttons = [...els.actions.querySelectorAll('button:not([disabled])')];
  if (!buttons.length) return;
  const index = Math.max(0, buttons.indexOf(document.activeElement));
  const delta = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1;
  buttons[(index + delta + buttons.length) % buttons.length].focus();
  event.preventDefault();
});

async function refresh(message = '') {
  setBusy(true);
  try {
    const response = await fetch('/api/view', { cache: 'no-store' });
    if (!response.ok) throw new Error(`view failed (${response.status})`);
    state = await response.json();
    render(state);
    setFeedback(message || 'Player-facing state refreshed.');
  } catch (error) {
    setFeedback(error.message, true);
  } finally {
    setBusy(false);
  }
}

async function choose(actionId) {
  if (busy) return;
  const selected = state?.legalActions?.find((action) => action.id === actionId);
  if (!selected) return;
  await mutate('/api/action', { actionId }, `Committed ${actionLabel(selected)}. Floorborn response and world consequence are now reflected below.`);
}

async function mutate(url, payload, message) {
  setBusy(true);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `request failed (${response.status})`);
    state = body;
    render(state);
    setFeedback(message);
  } catch (error) {
    setFeedback(error.message, true);
  } finally {
    setBusy(false);
  }
}

function render(view) {
  const observation = view.observation;
  els.sessionId.textContent = view.sessionId || '—';
  els.sessionStatus.textContent = view.complete ? 'COMPLETE' : observation ? 'YOUR TURN' : 'ADVANCING';

  if (!observation) {
    els.windowState.textContent = view.complete ? 'Finished' : '—';
    els.budgetState.textContent = view.complete ? '—' : 'Waiting';
    els.controlState.textContent = view.result ? `${view.result.chatControl}–${view.result.floorbornControl}` : '—';
    els.objective.textContent = view.complete ? resultLabel(view.result) : 'Waiting for the next player-facing observation.';
    renderUnits(els.ownGroups, []);
    renderUnits(els.contacts, []);
    renderActions([]);
  } else {
    const rts = observation.rts;
    els.windowState.textContent = `${rts.windowIndex + 1} / ${rts.maxWindows}`;
    els.budgetState.textContent = `${rts.budgetRemaining} / ${rts.maxEffectiveActionsPerWindow} · ${rts.effectiveApmLimit} APM`;
    els.controlState.textContent = `${rts.controlPoints}–${rts.opponentControlPoints}`;
    els.objective.textContent = observation.party?.objective || 'Contested center control.';
    renderUnits(els.ownGroups, rts.ownGroups || [], true);
    renderUnits(els.contacts, rts.visibleEnemyContacts || [], false);
    renderActions(view.legalActions || observation.legalActions || []);
  }

  const transcript = Array.isArray(view.transcript) ? view.transcript : [];
  els.transcriptCount.textContent = String(transcript.length);
  els.transcript.replaceChildren(...transcript.map((entry) => {
    const li = document.createElement('li');
    li.textContent = transcriptText(entry);
    return li;
  }));
  if (!transcript.length) {
    const li = document.createElement('li');
    li.textContent = 'No public consequences recorded yet.';
    els.transcript.replaceChildren(li);
  }
}

function renderUnits(container, units, own = false) {
  if (!units.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = own ? 'No own groups are present in this observation.' : 'No enemy contacts are currently visible.';
    container.replaceChildren(empty);
    return;
  }
  container.replaceChildren(...units.map((unit) => unitCard(unit, own)));
}

function unitCard(unit, own) {
  const integrity = Number(unit.integrity ?? 0);
  const max = Number(unit.maxIntegrity ?? Math.max(3, integrity));
  const level = integrity <= 1 ? 'danger' : integrity === 2 ? 'warn' : 'good';
  const card = document.createElement('div');
  card.className = `unit ${level}`;
  card.style.setProperty('--meter', `${Math.max(0, Math.min(100, (integrity / Math.max(1, max)) * 100))}%`);
  const id = unit.id || unit.groupId || 'contact';
  const position = unit.position || (own ? 'known' : 'visible');
  card.innerHTML = `<div class="unit-top"><span class="unit-name"></span><span class="unit-badge"></span></div><div class="meter"><span></span></div><div class="unit-meta"></div>`;
  card.querySelector('.unit-name').textContent = pretty(id);
  card.querySelector('.unit-badge').textContent = position;
  const fort = Number(unit.fortification ?? 0);
  card.querySelector('.unit-meta').textContent = `Integrity ${integrity}${fort ? ` · Fortified ${fort}` : ''}`;
  return card;
}

function renderActions(actions) {
  els.actionCount.textContent = String(actions.length);
  const buttons = actions.map((action) => {
    const button = document.createElement('button');
    button.className = 'action';
    button.type = 'button';
    button.setAttribute('role', 'listitem');
    button.disabled = busy;
    const strong = document.createElement('strong');
    strong.textContent = actionLabel(action);
    const meta = document.createElement('span');
    const tags = Array.isArray(action.tags) && action.tags.length ? action.tags.join(' · ') : action.kind || 'legal command';
    meta.innerHTML = '<span></span><span></span>';
    meta.children[0].textContent = tags;
    meta.children[1].textContent = `cost ${action.effectiveCost ?? 0}`;
    button.append(strong, meta);
    button.addEventListener('click', () => choose(action.id));
    return button;
  });
  els.actions.replaceChildren(...buttons);
}

function actionLabel(action) {
  if (action.id === 'wait:yield-window') return 'Yield remaining window';
  const parts = String(action.id).split(':');
  const verb = pretty(parts[1] || action.kind || 'command');
  const subject = pretty(parts[2] || '');
  const target = pretty(parts[3] || action.target || '');
  return [verb, subject, target && `→ ${target}`].filter(Boolean).join(' ');
}

function transcriptText(entry) {
  if (typeof entry === 'string') return entry;
  return entry?.description || entry?.outcomeDescription || entry?.eventId || JSON.stringify(entry);
}

function resultLabel(result) {
  if (!result) return 'Session complete.';
  if (!result.winnerPlayerId) return `Session complete · draw · control ${result.chatControl}–${result.floorbornControl}.`;
  return result.winnerPlayerId === 'chat-001'
    ? `Session complete · external chat seat wins · control ${result.chatControl}–${result.floorbornControl}.`
    : `Session complete · Floorborn wins · control ${result.chatControl}–${result.floorbornControl}.`;
}

function pretty(value) {
  return String(value).replace(/^army-/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function setBusy(value) {
  busy = value;
  els.resetButton.disabled = value;
  for (const button of els.actions.querySelectorAll('button')) button.disabled = value;
}

function setFeedback(message, isError = false) {
  els.feedback.textContent = message;
  els.feedback.classList.toggle('error', isError);
}
