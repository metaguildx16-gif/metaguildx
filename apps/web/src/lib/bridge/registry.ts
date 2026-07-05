import type { IBridgeProvider } from "./types";
import { LiFiAdapter } from "./adapters/lifi";

const lifiAdapter = new LiFiAdapter();

export function getProvider(
  _fromChainId: number,
  _toChainId: number
): IBridgeProvider {
  return lifiAdapter;
}
