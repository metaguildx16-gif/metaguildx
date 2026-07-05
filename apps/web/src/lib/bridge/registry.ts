import type { IBridgeProvider } from "./types";
import { LiFiAdapter } from "./adapters/lifi";
import { OwltoAdapter } from "./adapters/owlto";

const lifiAdapter = new LiFiAdapter();
const owltoAdapter = new OwltoAdapter();

const OPBNB_CHAIN_ID = 204;

export function getProvider(fromChainId: number, toChainId: number): IBridgeProvider {
  if (owltoAdapter.supportsRoute(fromChainId, toChainId)) {
    return owltoAdapter;
  }
  // opBNB routes not supported by LI.FI - return owlto which will show no route
  if (fromChainId === OPBNB_CHAIN_ID || toChainId === OPBNB_CHAIN_ID) {
    return owltoAdapter;
  }
  return lifiAdapter;
}
