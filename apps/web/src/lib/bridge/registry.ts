import type { IBridgeProvider } from "./types";
import { BNBBridgeAdapter } from "./adapters/bnbbridge";
import { LiFiAdapter } from "./adapters/lifi";

const bnbBridgeAdapter = new BNBBridgeAdapter();
const lifiAdapter = new LiFiAdapter();

export function getProvider(fromChainId: number, toChainId: number): IBridgeProvider {
  if (bnbBridgeAdapter.supportsRoute(fromChainId, toChainId)) {
    return bnbBridgeAdapter;
  }
  return lifiAdapter;
}
