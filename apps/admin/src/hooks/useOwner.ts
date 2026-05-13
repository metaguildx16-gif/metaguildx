import { Contract, JsonRpcProvider } from "ethers";
import { useEffect, useState } from "react";
import { ABIS, CONTRACTS, NETWORK } from "../config/contracts";

const ZERO = "0x0000000000000000000000000000000000000000";

export function useOwner(walletAddress: string | null) {
  const [isOwner, setIsOwner] = useState(false);
  const [ownerAddress, setOwnerAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      setLoading(true);
      setError(null);
      try {
        if (
          String(CONTRACTS.MetaGuildXCore).toLowerCase() ===
          ZERO
        ) {
          throw new Error("MetaGuildXCore address is not configured");
        }

        const provider = new JsonRpcProvider(NETWORK.rpc, NETWORK.chainId);
        const core = new Contract(
          CONTRACTS.MetaGuildXCore,
          ABIS.MetaGuildXCore,
          provider
        );
        const owner = String(await core.owner());
        setOwnerAddress(owner);
        setIsOwner(
          Boolean(walletAddress) &&
            owner.toLowerCase() === (walletAddress ?? "").toLowerCase()
        );
      } catch (ownerError) {
        setIsOwner(false);
        setOwnerAddress("");
        setError(
          ownerError instanceof Error
            ? ownerError.message
            : "Owner check failed"
        );
      } finally {
        setLoading(false);
      }
    };

    void check();
  }, [walletAddress]);

  return { isOwner, ownerAddress, loading, error };
}
