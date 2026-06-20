import { Contract, JsonRpcProvider } from "ethers";
import { useEffect, useState } from "react";
import { ABIS, CONTRACTS, NETWORK } from "../config/contracts";

const ZERO = "0x0000000000000000000000000000000000000000";
const DEPLOYER_EOA = "0xb1f4d1b91ee4159491652230a2d82edbb9107ace";
const GNOSIS_SAFE = "0x6d01d1e9771193467b5fae47ce8463d7060098ea";

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
        if (!walletAddress) {
          setIsOwner(false);
          setOwnerAddress("");
          setLoading(false);
          return;
        }

        if (
          String(CONTRACTS.MetaGuildXCore).toLowerCase() ===
          ZERO
        ) {
          throw new Error("MetaGuildXCore address is not configured");
        }

        const provider = new JsonRpcProvider(NETWORK.rpc, NETWORK.chainId, { batchMaxCount: 1, staticNetwork: true });
        const core = new Contract(
          CONTRACTS.MetaGuildXCore,
          ABIS.MetaGuildXCore,
          provider
        );
        const owner = String(await core.owner());
        const wallet = walletAddress.toLowerCase();
        setOwnerAddress(owner);
        setIsOwner(
          owner.toLowerCase() === wallet || wallet === DEPLOYER_EOA || wallet === GNOSIS_SAFE
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
