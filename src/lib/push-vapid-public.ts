// VAPID public key — safe to ship to the browser. Must match VAPID_PUBLIC_KEY
// on the server; the server uses the matching VAPID_PRIVATE_KEY to sign push
// requests. Rotating means updating both the secret and this constant together.
export const VAPID_PUBLIC_KEY =
  "BGAe1eWtjK0hNa63or-QrEGzGaVNrnmGnwec7doUe8pSslU2ccAejFdhJiPbDuMIj3aHQ87NDIilVNKyH3vfGLw";
