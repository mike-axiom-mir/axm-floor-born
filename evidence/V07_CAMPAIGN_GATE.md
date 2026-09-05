# Floorborn v0.7 multi-session campaign gate

Status: **PASS on PR lane; do not auto-merge**

## Question

Can the same deterministic Floorborn lineage carry the previously isolated player mechanisms through one longer multi-session history without hidden player privileges or memory systems silently overriding each other?

## Result

Yes, within the bounded v0.7 campaign laboratory.

The exact v0.7.0 PR head passed GitHub Actions run id `33952433476` on Node 24 with:

- **52 tests passed, 0 failed**;
- v0.1 bounded-player demo PASS;
- v0.3 hidden-expedition gate PASS;
- v0.4 continuity gate PASS;
- v0.5 evidence-revision gate PASS;
- v0.6 intention-lifecycle gate PASS;
- v0.7 named multi-session campaign gate PASS.

Named proof:

```bash
npm run campaign
```

## Campaign composition

One Floorborn lineage is carried through a sequence containing:

1. a completed shared hidden expedition with recurring companion `chat-001`;
2. a later neutral reunion decision involving that same companion;
3. a separate stranger encounter with `chat-new`;
4. an adversarial hidden-world expedition selected by the host so the current lineage eventually encounters a trap through its own autonomous route;
5. recovery from that negative hidden outcome without resetting the player;
6. repeated verified support for `chat-001 / route-safe`;
7. a later decision to act on that supported signal;
8. later verified contradictions of the same companion+signal pair;
9. a later decision to verify instead of following;
10. the same signal from stranger `chat-new`, which does not inherit `chat-001` evidence;
11. a hidden expedition in which the current lineage naturally gathers an optional memory relic;
12. a later interlude where that lived relic history helps produce `signal:seek-relic`;
13. an unrelated intervening stranger-signal session while that intention remains pending;
14. exact player + campaign-ledger snapshot/restore between sessions;
15. a later matching relic opportunity where the pending intention contributes to `signal:pursue-relic-route`;
16. legal relic collection that fulfills and retires the intention;
17. a final interlude where the retired intention no longer acts as a command and Floorborn chooses `signal:finish-journey`.

## Campaign ledger

The deterministic campaign ledger closes with:

```text
campaign checkpoints: 17
forward causal links: 8
completed Floorborn sessions: 25
companion ids: chat-001, chat-new
intention records: 1
active intentions at closure: 0
final choice: signal:finish-journey
```

Each checkpoint records digests of the player snapshot, session receipts, and public state where applicable. Causal links point only forward in campaign time and carry explicit evidence strings rather than prose-only claims.

Preserved causal relations include:

```text
shared companion history
  -> later reunion choice

negative hidden outcome
  -> later recovery route

supported exact peer signal
  -> follow choice

later contradictory exact peer evidence
  -> verify choice

optional relic experience
  -> later optional intention

snapshot checkpoint
  -> preserved pending intention and lineage state

pending intention
  -> later matching opportunity choice

intention fulfillment
  -> later closure without old intention influence
```

The final player snapshot and campaign ledger both restore exactly.

## Evidence hierarchy learned under campaign pressure

The integrated campaign exposed interactions that isolated tests did not.

The resulting hierarchy is now:

### 1. Broad experience can guide ambiguity

General world patterns and companion familiarity remain useful when the current situation is not contradicted by more specific evidence.

### 2. Exact supported claim evidence may combine with broader relationship context

When the exact companion+signal relationship has supporting receipts, Floorborn may use that specific evidence together with broader companion history.

### 3. Exact contradicted claim evidence outranks broad relationship priors for that claim-dependent action

If the current action depends on `chat-001 / route-safe` and specific evidence is net contradicted, broad companion familiarity, generic peer-signal bonuses, and broad cooperation/communication priors are blocked from laundering the contradicted claim into a positive action score.

### 4. A familiar companion's brand-new claim is still unverified

Campaign pressure also exposed that merely knowing a companion must not make a new specific claim true.

For a claim-dependent action with no direct evidence about the exact companion+signal pair:

```text
unverified exact claim -> verify first
supported exact claim  -> broader context may participate
contradicted exact claim -> exact evidence blocks broad relationship priors
```

A dedicated regression verifies that Floorborn may have many prior encounters with `chat-001` and still chooses independent verification when `route-safe` is a new unverified signal.

### 5. Lifetime evidence and recent specific evidence are distinct timescales

Lifetime support/contradiction counts remain intact as history. v0.7 also retains a bounded recent verdict window for each exact companion+signal pair.

Four consecutive verified recent contradictions can temporarily revise a still-positive lifetime aggregate. Four later consecutive verified supports can reverse that current stance again.

The lifetime counts are not deleted. Recent state changes current weighting while preserving historical receipts.

## Useful failed campaign runs preserved

### Run #136: adversarial first-move assumption failed

The first campaign harness expected the current lineage to walk into a trap on its first move. Earlier campaign experience had already changed Floorborn's opening route.

Repair: the host challenge now searches for a hidden seed where the **current lineage eventually encounters a trap through its own autonomous route**. The player's accumulated history is preserved rather than erased to satisfy the harness.

### Run #138: broad relationship history overwhelmed specific contradictory evidence

After substantial positive history with `chat-001`, later verified contradictions of `route-safe` were not sufficient to change the campaign action.

Repair: specific evidence about the current claim was given precedence over broad relationship familiarity for claim-dependent actions.

### Run #146: isolated reconstruction passed while full campaign still failed

A narrow integration probe reproduced the expected companion/trap/support/contradiction sequence and passed, while the full campaign remained red.

This established that the remaining conflict was caused by additional campaign-only history rather than the isolated revision mechanism itself.

Further campaign pressure revealed two additional seams:

- lifetime aggregates can become historically sticky even after a run of newer contradictory receipts;
- broad familiarity with a companion can make a brand-new unverified signal too influential.

Both were repaired without deleting old evidence.

## Host versus player blindness

The campaign harness may inspect candidate hidden seeds to choose a useful adversarial challenge. That is a **research-host capability**, not a player capability.

Floorborn continues to receive only its ordinary bounded observation and offered legal actions. Hidden seed contents are not added to the player observation merely because the harness used them to select a challenge.

## Claim boundary

v0.7 supports this narrower statement:

> Within the AXM bounded RPG laboratory, one deterministic Floorborn lineage can carry companion-specific history, revisable claim evidence, hidden-world consequences, optional intentions, recovery, and cross-session snapshot continuity through a longer campaign, while a deterministic causal ledger identifies which earlier evidence contributed to later behavior.

It does not establish consciousness, human-like belief, trust, motivation, social understanding, or general game-playing competence.

## Next depth

The isolated-player question is now sufficiently strong to justify the first genre-transfer experiment.

The next useful gate may move the same neutral player boundary into an RTS laboratory, preserving the equality rule:

- different internal reasoning is allowed;
- same player-visible information/fog-of-war;
- same legal command vocabulary for equivalent roles;
- same effective APM/action-bandwidth limit;
- no multi-unit command payload that secretly bypasses the APM budget;
- full command receipts and replay;
- compare what Floorborn spends its limited agency on rather than merely whether it wins.
