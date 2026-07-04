// Cloudflare Workers and modern browsers expose WebSocket globally.
// The real `ws` npm package extends Node's EventEmitter through a CJS
// require that breaks under the Worker unenv shim ("Class extends value
// [object Module]"). We only import `ws` to satisfy Supabase realtime's
// transport option, and realtime is never used in this app.
const WebSocketImpl = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;

export default WebSocketImpl as unknown as typeof WebSocket;
export { WebSocketImpl as WebSocket };
