---
name: V4 Habit Engine architecture
description: High-level design of the V4 habit formation layer added to the workout planner.
---

## Architecture

V4 adds a habit-formation layer on top of the existing AI workout planner. It includes:

- XP engine with levels and a public surface that validates reason but never amount.
- Habit Score (0–100) computed server-side from workout, check-in, diet proxy, and review inputs.
- Gym check-in, achievement badges, event analytics, and recovery/ Sunday planning flows.

## Migration strategy

Use two sequential migrations: one for the new tables, and a second for idempotency constraints. This lets the constraint layer be rolled back independently if needed.

## Key design decision

All duplicate-award prevention lives at the DB layer. Application-layer guards are only for fast-path UX; they cannot be the only enforcement.
