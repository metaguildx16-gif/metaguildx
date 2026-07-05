import type { IBridgeProvider } from "./types";
import { LiFiAdapter } from "./adapters/lifi";
import { OwltoAdapter } from "./adapters/owlto";

const lifiAdapter = new LiFiAdapter();
const owltoAdapter = new OwltoAdapter();

export function getProvider(fromChainId: number, toChainId: number): IBridgeProvider {
  if (owltoAdapter.supportsRoute(fromChainId, toChainId)) {
    return owltoAdapter;
  }
  return lifiAdapter;
}
