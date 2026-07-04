---
name: XP engine idempotency and security design
description: Core rules for the XP system to prevent duplicate awards and client-side abuse.
---

## Rules

1. **Clients never supply XP amounts.** The public XP server function accepts only a typed `reason` from the allowed set; the server derives the amount from a single source of truth.

2. **Idempotency is enforced at the DB layer, not the app layer.** Options:
   - Atomic conditional update with a returned-row count check (e.g., workout completion).
   - DB unique index with conflict handling (e.g., one gym check-in per day).
   - Deterministic dedupe key with a unique index on the XP table (e.g., once-per-week rewards).

3. **Internal XP helper is a plain function.** It accepts an optional dedupe key and returns a flag indicating whether an insert was skipped due to a conflict.

## Why

Read-then-write application guards create race conditions under concurrent requests. DB constraints are atomic.

## How to apply

Any new XP-awarding action must choose one of the three enforcement options above before implementation.
