## Root cause (confirmed from the built bundle)

Cloudflare Worker SSR crashes at module load with `TypeError: Class extends value [object Module] is not a constructor or null`. The culprit is the `ws` npm package, which the build bundles into the server worker at `dist/server/_libs/ws.mjs`.

Inside that bundle:

```js
var EventEmitter$1 = __require("node:events");
…
var WebSocket = class WebSocket extends EventEmitter$1 { … }   // line 2089
```

On real Node, `require('events')` returns the `EventEmitter` class itself. Under the Worker runtime's unenv shim, `__require("node:events")` returns the ES module namespace object (`[object Module]`) instead of the class. `class WebSocket extends <namespace>` throws the exact error we see, and it fires as soon as anything on the SSR path touches the `ws` module — which is every request to `/`, because the route tree pulls in Supabase.

Why `ws` is in the bundle at all: `src/integrations/supabase/auth-middleware.ts` and `src/integrations/supabase/client.server.ts` both do a top-level `import ws from 'ws'` and hand it to Supabase's `realtime.transport`. Those files are auto-generated and we're told not to edit them. Nothing in this app actually uses Supabase Realtime — the `ws` import only exists to satisfy the realtime option on Node hosts.

## Fix — alias `ws` to the Worker's native WebSocket

Cloudflare Workers already provide a global `WebSocket`. We keep the auto-generated integration files unchanged and stop the real `ws` package from being bundled by resolving `import 'ws'` to a tiny shim that exports the platform's WebSocket.

### Step 1 — add the shim

Create `src/shims/ws.ts`:

```ts
// Cloudflare Workers and modern browsers expose WebSocket globally.
// The real `ws` npm package extends Node's EventEmitter through a CJS
// require that breaks under the Worker unenv shim ("Class extends value
// [object Module]"). We only import `ws` to satisfy Supabase realtime's
// transport option, and realtime is never used in this app.
const WebSocketImpl = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;

export default WebSocketImpl as unknown as typeof WebSocket;
export { WebSocketImpl as WebSocket };
```

### Step 2 — alias `ws` in `vite.config.ts`

Extend the config so both dev and Nitro/Worker builds resolve `ws` to the shim:

```ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";

export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  vite: {
    server: { host: "0.0.0.0", port: 5000, strictPort: true, allowedHosts: true },
    resolve: {
      alias: {
        ws: path.resolve(__dirname, "src/shims/ws.ts"),
      },
    },
  },
});
```

We do NOT set `ssr.external` or `resolve.external` (project rules forbid that for the Worker SSR environment). A path alias is safe.

### Step 3 — verify

- Run `bun run build`. Confirm `dist/server/_libs/ws.mjs` is gone (or a few bytes) and no chunk contains `class WebSocket extends EventEmitter$1`.
- Reload preview `/`; it should render.
- Republish. `https://habitifyme.lovable.app/` should stop returning 500 and worker logs should stop showing the `TypeError`.

## Files touched

- `src/shims/ws.ts` — new, ~10 lines.
- `vite.config.ts` — add `resolve.alias` for `ws`.

No changes to any auto-generated Supabase integration file, no dependency install/remove, no schema or feature changes.
