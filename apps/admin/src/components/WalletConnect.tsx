import { BrowserProvider, type Eip1193Provider } from "ethers";
import { useEffect, useState } from "react";
import { NETWORK } from "../config/contracts";

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

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function toHexChainId(chainId: number) {
  return `0x${chainId.toString(16).toUpperCase()}`;
}

export function WalletConnect() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCorrectNetwork = chainId === NETWORK.chainId;
  const canSwitchNetwork = Boolean(walletAddress) && chainId !== null && !isCorrectNetwork;

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

  const switchNetwork = async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      setError("MetaMask not found");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: toHexChainId(NETWORK.chainId) }]
      });
    } catch (switchError) {
      const error = switchError as { code?: number };
      if (error.code === 4902) {
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: toHexChainId(NETWORK.chainId),
              chainName: NETWORK.name,
              rpcUrls: [NETWORK.rpc],
              nativeCurrency: {
                name: "tBNB",
                symbol: "tBNB",
                decimals: 18
              },
              blockExplorerUrls: [NETWORK.explorer]
            }]
          });
        } catch {
          setError("Network add failed");
        }
      } else {
        setError("Network switch failed");
      }
    } finally {
      try {
        const value = await ethereum.request({ method: "eth_chainId" });
        setChainId(parseChainId(String(value)));
      } catch {
        setChainId(null);
      }
      setBusy(false);
    }
  };

  const connectWallet = async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      setError("MetaMask not found");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const provider = new BrowserProvider(
        window.ethereum as Eip1193Provider
      );
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      setWalletAddress(address);
      setChainId(Number(network.chainId));
    } catch {
      setError("Wallet connection failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {walletAddress ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span>{shortenAddress(walletAddress)}</span>
          </div>
          {canSwitchNetwork ? (
            <button
              type="button"
              onClick={switchNetwork}
              disabled={busy}
              className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Switching..." : "Switch to opBNB"}
            </button>
          ) : (
            <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100">
              {NETWORK.name}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={connectWallet}
          disabled={busy}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Connecting..." : "Connect Wallet"}
        </button>
      )}

      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
