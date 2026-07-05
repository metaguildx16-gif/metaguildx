// ============================================================
// MetaGuildX Cross-Chain Hub - Backward-compatible bridge exports
// ISOLATED MODULE - No dependency on C&B system
// ============================================================

export * from "./bridge";
export {
  PLATFORM_FEE_BPS,
  SUPPORTED_CHAINS,
  SUPPORTED_TOKENS,
  TREASURY_WALLET
} from "./bridge/adapters/lifi";
