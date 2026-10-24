import "server-only";

// The privileged connection: it skips row level security. Only background jobs, webhooks and
// tests may use it, and they must scope every query by workspace themselves. ESLint blocks
// importing this file from the rest of the app.
export { db as adminDb } from "./connection";
