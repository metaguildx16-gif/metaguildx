const RANGO_BASE_URL = "https://api.rango.exchange";
const RANGO_FALLBACK_API_KEY = "c6381a79-2817-4602-83bf-6a641a409e32";

export const RANGO_REFERRER_ADDRESS = "0xbFF19De173697D07B904a4c7b79e4A524B456991";
export const RANGO_REFERRER_FEE = "0.15";
export const DEFAULT_SLIPPAGE = "1.0";
export const BSC_USDT = "0x55d398326f99059fF775485246999027B3197955";
export const OPBNB_USDT = "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3";

export type RangoBlockchain = {
  name: string;
  displayName?: string;
  shortName?: string;
  logo?: string;
  logoUrl?: string;
  image?: string;
  chainId?: string | number;
};

export type RangoToken = {
  blockchain: string;
  symbol: string;
  address?: string | null;
  name?: string;
  decimals?: number;
  image?: string;
  logoURI?: string;
  usdPrice?: number | string;
};

export type RangoMeta = {
  blockchains: RangoBlockchain[];
  tokens: RangoToken[];
  swappers?: Array<{ id?: string; title?: string; logo?: string }>;
};

export type RangoAsset = {
  blockchain: string;
  symbol: string;
  address?: string | null;
};

export type RangoQuoteRequest = {
  from: RangoAsset;
  to: RangoAsset;
  amount: string;
  slippage?: string;
  referrerAddress?: string;
  referrerFee?: string;
};

export type RangoSwapRequest = RangoQuoteRequest & {
  walletAddress: string;
};

export type RangoQuoteResponse = Record<string, unknown>;
export type RangoSwapResponse = Record<string, unknown>;
export type RangoStatusResponse = {
  status?: "running" | "success" | "failed" | string;
  [key: string]: unknown;
};

let metaCache: RangoMeta | null = null;

function getRangoApiKey() {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  return env.VITE_RANGO_API_KEY || RANGO_FALLBACK_API_KEY;
}

async function rangoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${RANGO_BASE_URL}${path}${separator}apiKey=${encodeURIComponent(getRangoApiKey())}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      typeof errorBody === "object" && errorBody && "message" in errorBody
        ? String((errorBody as { message?: unknown }).message)
        : `Rango request failed (${response.status})`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function getRangoMeta(): Promise<RangoMeta> {
  if (metaCache) {
    return metaCache;
  }

  const meta = await rangoFetch<RangoMeta>("/basic/meta");
  metaCache = {
    blockchains: meta.blockchains ?? [],
    tokens: meta.tokens ?? [],
    swappers: meta.swappers ?? []
  };
  return metaCache;
}

export async function getRangoQuote(request: RangoQuoteRequest): Promise<RangoQuoteResponse> {
  return rangoFetch<RangoQuoteResponse>("/basic/quote", {
    method: "POST",
    body: JSON.stringify({
      ...request,
      slippage: request.slippage ?? DEFAULT_SLIPPAGE,
      referrerAddress: request.referrerAddress ?? RANGO_REFERRER_ADDRESS,
      referrerFee: request.referrerFee ?? RANGO_REFERRER_FEE
    })
  });
}

export async function getRangoSwap(request: RangoSwapRequest): Promise<RangoSwapResponse> {
  return rangoFetch<RangoSwapResponse>("/basic/swap", {
    method: "POST",
    body: JSON.stringify({
      ...request,
      slippage: request.slippage ?? DEFAULT_SLIPPAGE,
      referrerAddress: request.referrerAddress ?? RANGO_REFERRER_ADDRESS,
      referrerFee: request.referrerFee ?? RANGO_REFERRER_FEE
    })
  });
}

export async function getRangoStatus(requestId: string, txId: string): Promise<RangoStatusResponse> {
  return rangoFetch<RangoStatusResponse>(
    `/basic/status?requestId=${encodeURIComponent(requestId)}&txId=${encodeURIComponent(txId)}`
  );
}
