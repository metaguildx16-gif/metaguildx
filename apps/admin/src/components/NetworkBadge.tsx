import { useEffect, useMemo, useState } from "react";
import { NETWORK } from "../config/contracts";

type NetworkBadgeProps = {
  compact?: boolean;
};

type EthereumLike = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

function getEthereum() {
  return window.ethereum as EthereumLike | undefined;
}

function parseChainId(raw: string | number): number {
  const s = String(raw);
  if (s.startsWith("0x") || s.startsWith("0X")) {
    return Number.parseInt(s, 16);
  }
  return Number.parseInt(s, 10);
}

export function NetworkBadge({ compact = false }: NetworkBadgeProps) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) {
      return;
    }

    const handleAccountsChanged = (...args: unknown[]) => {
      const [accounts] = args as [string[]];
      setWalletAddress(accounts[0] ?? null);
    };

    const handleChainChanged = (...args: unknown[]) => {
      const [nextChainId] = args as [string];
      setChainId(parseChainId(nextChainId));
    };

    void ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const next = (accounts as string[])[0];
        setWalletAddress(next ?? null);
      })
      .catch(() => {
        setWalletAddress(null);
      });

    void ethereum
      .request({ method: "eth_chainId" })
      .then((value) => {
        setChainId(parseChainId(String(value)));
      })
      .catch(() => {
        setChainId(null);
      });

    ethereum.on?.("accountsChanged", handleAccountsChanged);
    ethereum.on?.("chainChanged", handleChainChanged);
    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  const state = useMemo(() => {
    if (!walletAddress || chainId !== NETWORK.chainId) {
      return null;
    }

    return {
      label: NETWORK.name,
      tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
    };
  }, [chainId, walletAddress]);

  if (!state) {
    return null;
  }

  return (
    <div
      className={[
        "rounded-full border px-3 py-2 text-sm font-medium",
        state.tone,
        compact ? "text-xs" : ""
      ].join(" ")}
    >
      {state.label}
    </div>
  );
}
