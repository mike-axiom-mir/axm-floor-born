const els = Object.fromEntries([
  'sessionId','windowState','budgetState','controlState','sessionStatus','objective','ownGroups','contacts',
  'actions','actionCount','feedback','transcript','transcriptCount','resetButton','controllerState','controllerHelp',
].map((id) => [id, document.getElementById(id)]));

const GAMEPAD_AXIS_THRESHOLD = 0.64;

let state = null;
let busy = false;
let gamepadIdentity = null;
let previousGamepadSample = null;
let gamepadStatusKey = '';

await refresh('Console ready. Choose one legal action; Floorborn answers through the same world rules.');
startGamepadPolling();

els.resetButton.addEventListener('click', async () => {
  if (busy) return;
  await mutate('/api/reset', {}, 'Lab reset to the deterministic opening state.');
});

document.addEventListener('keydown', (event) => {
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  moveActionFocus(['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1, { announce: false });
  event.preventDefault();
});

function startGamepadPolling() {
  if (typeof navigator.getGamepads !== 'function') {
    setGamepadStatus('unavailable', 'UNAVAILABLE', 'This browser does not expose the Gamepad API. Keyboard and touch remain available.');
    return;
  }

  const poll = () => {
    let pads = [];
    try {
      pads = Array.from(navigator.getGamepads() || []).filter((pad) => pad && pad.connected !== false);
    } catch {
      gamepadIdentity = null;
      previousGamepadSample = null;
      setGamepadStatus('unavailable', 'UNAVAILABLE', 'Gamepad access is unavailable here. Keyboard and touch remain available.');
      requestAnimationFrame(poll);
      return;
    }

    const pad = pads[0];
    if (!pad) {
      gamepadIdentity = null;
      previousGamepadSample = null;
      setGamepadStatus('none', 'NOT DETECTED', 'Keyboard: Arrow keys move focus; Enter or Space commits. Standard gamepad: D-pad or left stick moves focus; A commits.');
      requestAnimationFrame(poll);
      return;
    }

    if (pad.mapping !== 'standard') {
      gamepadIdentity = null;
      previousGamepadSample = null;
      setGamepadStatus('held', 'HELD · NON-STANDARD', 'Controller detected, but this browser did not report standard mapping. Keyboard and touch remain available; AXM does not guess button meanings.');
      requestAnimationFrame(poll);
      return;
    }

    const identity = `${pad.index ?? 0}:${pad.id || 'standard-gamepad'}`;
    const sample = readGamepadSample(pad);
    setGamepadStatus('ready', 'READY', 'D-pad or left stick moves focus · A commits. Inputs are edge-triggered, so holding a direction or A does not repeat a command.');

    if (identity !== gamepadIdentity) {
      gamepadIdentity = identity;
      previousGamepadSample = sample;
      requestAnimationFrame(poll);
      return;
    }

    const previous = previousGamepadSample || sample;
    if (sample.direction !== 0 && sample.direction !== previous.direction) {
      moveActionFocus(sample.direction);
    }
    if (sample.commit && !previous.commit) {
      commitFocusedGamepadAction();
    }
    previousGamepadSample = sample;
    requestAnimationFrame(poll);
  };

  requestAnimationFrame(poll);
}

function readGamepadSample(pad) {
  const upOrLeft = gamepadPressed(pad, 12) || gamepadPressed(pad, 14);
  const downOrRight = gamepadPressed(pad, 13) || gamepadPressed(pad, 15);
  let direction = upOrLeft ? -1 : downOrRight ? 1 : 0;

  if (direction === 0) {
    const x = gamepadAxis(pad, 0);
    const y = gamepadAxis(pad, 1);
    const dominant = Math.abs(x) > Math.abs(y) ? x : y;
    if (Math.abs(dominant) >= GAMEPAD_AXIS_THRESHOLD) direction = dominant < 0 ? -1 : 1;
  }

  return {
    direction,
    commit: gamepadPressed(pad, 0),
  };
}

function gamepadPressed(pad, index) {
  const button = pad.buttons?.[index];
  return Boolean(button && (button.pressed || Number(button.value) > 0.5));
}

function gamepadAxis(pad, index) {
  const value = Number(pad.axes?.[index] ?? 0);
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function moveActionFocus(delta, { announce = true } = {}) {
  const buttons = [...els.actions.querySelectorAll('button:not([disabled])')];
  if (!buttons.length) return false;
  const current = buttons.indexOf(document.activeElement);
  const next = current < 0
    ? (delta > 0 ? 0 : buttons.length - 1)
    : (current + delta + buttons.length) % buttons.length;
  buttons[next].focus();
  if (announce) {
    const label = buttons[next].querySelector('strong')?.textContent || 'legal action';
    setFeedback(`Gamepad focus · ${label}. Press A to commit.`);
  }
  return true;
}

function commitFocusedGamepadAction() {
  const focused = document.activeElement;
  if (!(focused instanceof HTMLButtonElement) || !els.actions.contains(focused) || focused.disabled) {
    if (moveActionFocus(1, { announce: false })) {
      setFeedback('Gamepad focus set. Press A again to commit the highlighted legal action.');
    }
    return;
  }
  focused.click();
}

function setGamepadStatus(mode, label, help) {
  const key = `${mode}:${label}:${help}`;
  if (key === gamepadStatusKey) return;
  gamepadStatusKey = key;
  els.controllerState.dataset.mode = mode;
  els.controllerState.textContent = label;
  els.controllerHelp.textContent = help;
}

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
  const role = unit.role || unit.classification || (own ? 'known group' : 'visible contact');
  const isCombat = role === 'combat' || role === 'combat-contact';
  const level = integrity <= 0 ? 'danger' : isCombat && integrity === 1 ? 'warn' : 'good';
  const card = document.createElement('div');
  card.className = `unit ${level}`;
  const id = unit.id || unit.groupId || 'contact';
  const position = unit.position || unit.region || (own ? 'known' : 'visible');
  card.innerHTML = `<div class="unit-top"><span class="unit-name"></span><span class="unit-badge"></span></div><div class="unit-meta"></div>`;
  card.querySelector('.unit-name').textContent = pretty(id);
  card.querySelector('.unit-badge').textContent = position;
  const fortified = Boolean(unit.fortified) || Number(unit.fortification ?? 0) > 0;
  card.querySelector('.unit-meta').textContent = `${pretty(role)} · Integrity ${integrity}${fortified ? ' · Fortified' : ''}`;
  return card;
}

function renderActions(actions) {
  els.actionCount.textContent = String(actions.length);
  const buttons = actions.map((action) => {
    const button = document.createElement('button');
    button.className = 'action';
    button.type = 'button';
    button.setAttribute('role', 'listitem');
    button.dataset.actionId = action.id;
    button.disabled = busy;
    const strong = document.createElement('strong');
    strong.textContent = actionLabel(action);
    const meta = document.createElement('span');
    const tags = Array.isArray(action.affordanceTags) && action.affordanceTags.length
      ? action.affordanceTags.join(' · ')
      : action.kind || 'legal command';
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
