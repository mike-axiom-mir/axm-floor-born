# Floorborn deterministic public discovery

This repository explicitly opts the bounded Floorborn player process into AXM public-safe capability discovery.

The declared capability is `axm.floorborn.bounded-player-process`. The registry is generated from the same `package.json`, executable `src/capability.js` descriptor, and Apache-2.0 license that define the portable package boundary. The generator refuses to widen the package's local/offline contract, maturity status, process schemas, player protocols, or no-authority boundary.

Regenerate after an intentional capability-boundary change:

```bash
node tools/generate-public-capabilities.mjs --write
```

Verify committed discovery evidence without rewriting it:

```bash
node tools/generate-public-capabilities.mjs --check
node --test test/public-capability-discovery.test.js
```

The integration workflow additionally builds the pinned Discovery Buddy source at `565c38ecf93a9d563b02211258d8d36fcb1162b5` into its deterministic one-file `discovery-buddy.pyz`, removes that source checkout, and uses only the zipapp to scan, verify, and query this repository. That proves the discovery handoff without creating a runtime dependency on Discovery Buddy.

## Authority boundary

A discovery hit means only that this exact source tree explicitly declares the bounded Floorborn process and that the declaration matches its checked source evidence.

Discovery does not run Floorborn, install it, select it for a game, apply a returned action, mutate a game, publish a package, merge a branch, or establish CANON. A consumer must separately review and verify the provider, construct a player-visible observation, invoke the bounded process deliberately, and admit any candidate action through its own game-defined player door.

## Pattern provenance

The generated public-discovery pattern is adapted from `mike-axiom-mir/axm-EchoWorld@6987cf842a0f17e03f2ef679d07ec5782b30664b`. No EchoWorld or Discovery Buddy runtime code is copied into Floorborn.
