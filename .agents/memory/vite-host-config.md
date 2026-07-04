---
name: Vite host config for Replit
description: Required Vite server override to make the app runnable on Replit's IPv4-only webview.
---

## Rule

Vite must bind to IPv4 host `0.0.0.0` and Replit's webview port `5000` with `strictPort: true` and `allowedHosts: true`.

## Why

The project uses Lovable's TanStack Start vite config, which auto-detects sandbox and defaults to `:::8080` (IPv6). Replit containers do not support IPv6, and the webview proxy expects port 5000. Without the override, the workflow fails with `EAFNOSUPPORT`.

## How to apply

Any change to `vite.config.ts` must preserve this server block. Re-check it after config resets or re-imports.
