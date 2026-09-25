// Development-only console helpers.
// PROD-CONSOLE-03A: gates noisy debug/test traces so they are stripped from
// production behavior. Genuine production warnings/errors and the RPC/
// performance diagnostics established in PROD-CONSOLE-01/02 are NOT routed
// through these helpers and remain untouched.

export function devLog(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}

export function devWarn(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
}

export function devInfo(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.info(...args);
  }
}
