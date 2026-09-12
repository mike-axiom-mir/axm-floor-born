const els = {
  session: document.getElementById('sessionId'),
  window: document.getElementById('windowState'),
  budget: document.getElementById('budgetState'),
  control: document.getElementById('controlState'),
  status: document.getElementById('sessionStatus'),
  own: document.getElementById('ownGroups'),
  contacts: document.getElementById('contacts'),
  transcript: document.getElementById('transcript'),
  summary: document.getElementById('responseSummary'),
};

let baseline = null;
let flushTimer = null;
let armed = false;

const observer = new MutationObserver(() => scheduleFlush());
for (const target of [els.window, els.budget, els.control, els.status, els.own, els.contacts, els.transcript]) {
  observer.observe(target, { childList: true, subtree: true, characterData: true });
}

armWhenReady();

function armWhenReady(attempt = 0) {
  const rendered = els.status.textContent.trim() !== 'CONNECTING'
    && els.window.textContent.trim() !== '—'
    && els.transcript.children.length > 0;
  if (rendered) {
    baseline = snapshotVisibleDom();
    armed = true;
    els.summary.textContent = 'DISPLAY Δ ONLY · ready to mark the next player-visible state change.';
    els.summary.dataset.mode = 'ready';
    return;
  }
  if (attempt >= 100) {
    els.summary.textContent = 'DISPLAY Δ ONLY · visible-response observer could not establish an opening baseline.';
    els.summary.dataset.mode = 'held';
    return;
  }
  setTimeout(() => armWhenReady(attempt + 1), 50);
}

function scheduleFlush() {
  if (!armed || flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushVisibleDelta();
  }, 0);
}

function flushVisibleDelta() {
  const next = snapshotVisibleDom();
  if (!baseline) {
    baseline = next;
    return;
  }

  clearMarkers();

  if (next.session !== baseline.session || next.transcript.length < baseline.transcript.length) {
    baseline = next;
    els.summary.textContent = 'DISPLAY Δ ONLY · opening player-visible state restored; no prior highlight is carried forward.';
    els.summary.dataset.mode = 'reset';
    return;
  }

  const changes = [];
  if (next.window !== baseline.window) {
    mark(els.window, 'status');
    changes.push(`window ${baseline.window} → ${next.window}`);
  }
  if (next.budget !== baseline.budget) {
    mark(els.budget, 'status');
    changes.push(`budget ${baseline.budget} → ${next.budget}`);
  }
  if (next.control !== baseline.control) {
    mark(els.control, 'status');
    changes.push(`control ${baseline.control} → ${next.control}`);
  }
  if (next.status !== baseline.status) {
    mark(els.status, 'status');
    changes.push(`status ${baseline.status} → ${next.status}`);
  }

  const ownChanged = markChangedUnits(els.own, baseline.own, next.own);
  const contactChanged = markChangedUnits(els.contacts, baseline.contacts, next.contacts);
  if (ownChanged) changes.push(`${ownChanged} own-group visible update${ownChanged === 1 ? '' : 's'}`);
  if (contactChanged) changes.push(`${contactChanged} contact visible update${contactChanged === 1 ? '' : 's'}`);

  const newTranscriptCount = Math.max(0, next.transcript.length - baseline.transcript.length);
  if (newTranscriptCount) {
    const items = [...els.transcript.querySelectorAll('li')];
    for (const item of items.slice(-newTranscriptCount)) mark(item, 'consequence');
    changes.push(`${newTranscriptCount} new public consequence${newTranscriptCount === 1 ? '' : 's'}`);
  }

  if (changes.length) {
    els.summary.textContent = `VISIBLE RESPONSE · ${changes.join(' · ')}. Presentation only; game truth is unchanged by these markers.`;
    els.summary.dataset.mode = 'changed';
  } else {
    els.summary.textContent = 'DISPLAY Δ ONLY · the refreshed player-visible state did not expose a new visible change.';
    els.summary.dataset.mode = 'steady';
  }

  baseline = next;
}

function snapshotVisibleDom() {
  return {
    session: text(els.session),
    window: text(els.window),
    budget: text(els.budget),
    control: text(els.control),
    status: text(els.status),
    own: unitMap(els.own),
    contacts: unitMap(els.contacts),
    transcript: [...els.transcript.querySelectorAll('li')].map((item) => text(item)),
  };
}

function unitMap(container) {
  return new Map([...container.querySelectorAll('.unit')].map((card) => {
    const name = text(card.querySelector('.unit-name')) || text(card);
    return [name, text(card)];
  }));
}

function markChangedUnits(container, before, after) {
  let count = 0;
  for (const card of container.querySelectorAll('.unit')) {
    const name = text(card.querySelector('.unit-name')) || text(card);
    if (before.get(name) !== after.get(name)) {
      mark(card, 'unit');
      count += 1;
    }
  }
  return count;
}

function mark(element, kind) {
  element.classList.add('observed-change');
  element.dataset.observedChange = kind;
}

function clearMarkers() {
  for (const element of document.querySelectorAll('.observed-change')) {
    element.classList.remove('observed-change');
    delete element.dataset.observedChange;
  }
}

function text(element) {
  return element?.textContent?.replace(/\s+/g, ' ').trim() || '';
}
