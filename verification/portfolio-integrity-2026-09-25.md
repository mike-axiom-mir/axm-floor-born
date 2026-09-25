# Align discovery metadata with the current repository license

Date: 2026-09-25 UTC

Base commit: `8b686b699eb4a80ad53409871311e7822a4140b2`

The current LICENSE and LICENSE_BOUNDARY.md declare PolyForm-Noncommercial-1.0.0, while package metadata or the public discovery generator still declared Apache-2.0. This repair aligns current metadata and its admission checks with the existing repository declaration, then regenerates the exact discovery receipt.

No LICENSE text, historical snapshot, third-party notice, donor source, runtime capability, execution authority or CANON state is changed. Historical license grants remain historical evidence.

## Verification

`npm test`: 137 tests passed.
