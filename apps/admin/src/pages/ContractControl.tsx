import { BrowserProvider, Contract, JsonRpcProvider, isAddress, type Eip1193Provider } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { ABIS, CONTRACTS, NETWORK } from "../config/contracts";
import { ToastStack, type ToastMessage } from "../components/Toast";
import { useOwner } from "../hooks/useOwner";
import { sendTransaction } from "../utils/txHelper";
import { shortAddress } from "../utils/packageUtils";

type SettingsState = {
  creatorWallet: string;
  placementSigner: string;
  defaultPaymentAsset: string;
  usdtAddress: string;
  binaryTreeContract: string;
  incomeRouterContract: string;
  incomeEngineContract: string;
  upgradeEngineContract: string;
  cashbackPoolContract: string;
  stakingContract: string;
  owner: string;
  productionMode: boolean;
};

type StrandedEscrowState = {
  currentPackage: number;
  amounts: Record<number, bigint>;
  total: bigint;
};

const ZERO = "0x0000000000000000000000000000000000000000";
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

function getEthereum() {
  return window.ethereum as
    | (Eip1193Provider & {
        on?: (event: string, listener: (args: unknown) => void) => void;
        removeListener?: (event: string, listener: (args: unknown) => void) => void;
      })
    | undefined;
}

function copyValue(value: string) {
  return navigator.clipboard.writeText(value);
}

function formatPlatformUsdt(amount: bigint) {
  return (Number(amount) / 10).toFixed(1);
}

export function ContractControl() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [creatorWalletInput, setCreatorWalletInput] = useState("");
  const [placementSignerInput, setPlacementSignerInput] = useState("");
  const [usdtInput, setUsdtInput] = useState("");
  const [binaryTreeInput, setBinaryTreeInput] = useState("");
  const [incomeRouterInput, setIncomeRouterInput] = useState<string>("");
  const [incomeEngineInput, setIncomeEngineInput] = useState<string>("");
  const [upgradeEngineInput, setUpgradeEngineInput] = useState<string>("");
  const [cashbackPoolInput, setCashbackPoolInput] = useState<string>("");
  const [stakingInput, setStakingInput] = useState<string>("");
  const [newOwnerInput, setNewOwnerInput] = useState("");
  const [implementationInput, setImplementationInput] = useState("");
  const [sweepRecipientInput, setSweepRecipientInput] = useState("");
  const [escrowUserId, setEscrowUserId] = useState("");
  const [escrowAmount, setEscrowAmount] = useState("");
  const [escrowLoading, setEscrowLoading] = useState(false);
  const [addEscrowLoading, setAddEscrowLoading] = useState(false);
  const [prodModeLoading, setProdModeLoading] = useState(false);
  const [prodPaymentAsset, setProdPaymentAsset] = useState<string>("");
  const [creatorWalletBalance, setCreatorWalletBalance] = useState<number | null>(null);
  const [creatorRecent, setCreatorRecent] = useState<Array<{ amount: number; txHash: string; timestamp: number }>>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [strandedUserId, setStrandedUserId] = useState("");
  const [strandedEscrow, setStrandedEscrow] = useState<StrandedEscrowState | null>(null);
  const [strandedLoading, setStrandedLoading] = useState(false);
  const [strandedReleaseLoading, setStrandedReleaseLoading] = useState(false);
  const [strandedTxHash, setStrandedTxHash] = useState("");
  const [strandedError, setStrandedError] = useState("");
  const [rebirthEscrowUserId, setRebirthEscrowUserId] = useState("");
  const [rebirthEscrowAmount, setRebirthEscrowAmount] = useState("");
  const [rebirthEscrowBalance, setRebirthEscrowBalance] = useState<bigint | null>(null);
  const [rebirthEscrowLoading, setRebirthEscrowLoading] = useState(false);
  const [rebirthEscrowReleaseLoading, setRebirthEscrowReleaseLoading] = useState(false);
  const [rebirthEscrowTxHash, setRebirthEscrowTxHash] = useState("");
  const [rebirthEscrowError, setRebirthEscrowError] = useState("");

  const { isOwner, ownerAddress, loading: ownerLoading, error: ownerError } = useOwner(walletAddress);

  const addToast = (message: string, type: ToastMessage["type"]) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  };

  const dismissToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) {
      return;
    }

    const syncWallet = async () => {
      const accounts = (await ethereum.request({ method: "eth_accounts" })) as string[];
      setWalletAddress(accounts[0] ?? null);
    };

    void syncWallet();
    const handleAccountsChanged = (accounts: unknown) => {
      setWalletAddress(((accounts as string[]) ?? [])[0] ?? null);
    };

    ethereum.on?.("accountsChanged", handleAccountsChanged);
    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const provider = new JsonRpcProvider(NETWORK.rpc, NETWORK.chainId);
      const core = new Contract(CONTRACTS.MetaGuildXCore, ABIS.MetaGuildXCore, provider);

      const [creatorWallet, placementSigner, defaultPaymentAsset, usdtAddress, productionMode, owner, binaryTreeContract, incomeRouterContract, incomeEngineContract, upgradeEngineContract, cashbackPoolContract, stakingContract] = await Promise.all([
        core.creatorFeeWallet(),
        core.placementSigner(),
        core.defaultPaymentAsset(),
        core.usdtAddress(),
        core.productionMode(),
        core.owner(),
        core.binaryTreeContract(),
        core.incomeRouterContract(),
        core.incomeEngineContract(),
        core.upgradeEngineContract(),
        core.cashbackPoolContract(),
        core.stakingContract()
      ]);

      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(NETWORK.startBlock, currentBlock - 4_999);
      const registrations = await core.queryFilter(core.filters.UserRegistered(), fromBlock, currentBlock);

      const currentSettings: SettingsState = {
        creatorWallet: String(creatorWallet),
        placementSigner: String(placementSigner),
        defaultPaymentAsset: String(defaultPaymentAsset),
        usdtAddress: String(usdtAddress),
        binaryTreeContract: String(binaryTreeContract),
        incomeRouterContract: String(incomeRouterContract),
        incomeEngineContract: String(incomeEngineContract),
        upgradeEngineContract: String(upgradeEngineContract),
        cashbackPoolContract: String(cashbackPoolContract),
        stakingContract: String(stakingContract),
        owner: String(owner),
        productionMode: Boolean(productionMode)
      };

      setSettings(currentSettings);
      setCreatorWalletInput(String(creatorWallet));
      setPlacementSignerInput(String(placementSigner));
      setUsdtInput(String(usdtAddress));
      setBinaryTreeInput(String(binaryTreeContract));
      setIncomeRouterInput(String(incomeRouterContract));
      setIncomeEngineInput(String(incomeEngineContract));
      setUpgradeEngineInput(String(upgradeEngineContract));
      setCashbackPoolInput(String(cashbackPoolContract));
      setStakingInput(String(stakingContract));
      setNewOwnerInput(String(owner));
      setSweepRecipientInput(String(owner));

      const recentCreator = await Promise.all(
        (registrations as Array<{ args?: { amount?: bigint }; transactionHash: string; blockNumber: number }>)
          .slice(-5)
          .map(async (log) => {
            const block = await provider.getBlock(log.blockNumber);
            const amount = Number(log.args?.amount ?? 0n) / 10 / 10;
            return {
              amount,
              txHash: log.transactionHash,
              timestamp: block?.timestamp ?? 0
            };
          })
      );
      setCreatorRecent(recentCreator);

      if (String(creatorWallet) !== ZERO && String(defaultPaymentAsset) !== ZERO) {
        const usdt = new Contract(String(defaultPaymentAsset), ERC20_ABI, provider);
        const balance = await usdt.balanceOf(String(creatorWallet));
        setCreatorWalletBalance(Number(balance) / 1e18);
      } else {
        setCreatorWalletBalance(null);
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to load settings", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const signerContract = async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      throw new Error("MetaMask not found");
    }
    const provider = new BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    return new Contract(CONTRACTS.MetaGuildXCore, ABIS.MetaGuildXCore, signer);
  };

  const incomeContract = async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      throw new Error("MetaMask not found");
    }
    const provider = new BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    return new Contract(CONTRACTS.MetaGuildXIncome, ABIS.MetaGuildXIncome, signer);
  };

  const readContracts = async () => {
    const provider = new JsonRpcProvider(NETWORK.rpc, NETWORK.chainId);
    return {
      core: new Contract(CONTRACTS.MetaGuildXCore, ABIS.MetaGuildXCore, provider),
      income: new Contract(CONTRACTS.MetaGuildXIncome, ABIS.MetaGuildXIncome, provider)
    };
  };

  const execute = async (
    key: string,
    action: () => Promise<{ wait: () => Promise<unknown> }>,
    successMessage: string
  ) => {
    if (!isOwner) {
      addToast("Unauthorized: Admin wallet required", "error");
      return;
    }
    setBusy(key);
    addToast("Confirm in MetaMask...", "info");
    await sendTransaction(
      action,
      (message) => {
        addToast(message, "success");
        void loadSettings();
      },
      (message) => addToast(message, "error"),
      successMessage
    );
    setBusy(null);
  };

  const accessMessage = useMemo(() => {
    if (ownerLoading) {
      return "Checking owner access...";
    }
    if (ownerError) {
      return ownerError;
    }
    if (!walletAddress) {
      return "Connect the owner wallet to continue.";
    }
    return null;
  }, [ownerError, ownerLoading, walletAddress]);

  const handleAdminReleaseEscrow = async () => {
    if (!isOwner) {
      addToast("Unauthorized: Admin wallet required", "error");
      return;
    }
    if (!escrowUserId || !escrowAmount) {
      return;
    }

    setEscrowLoading(true);
    try {
      const income = await incomeContract();
      const amountRaw = BigInt(Math.floor(parseFloat(escrowAmount)));
      const tx = await income.adminReleaseEscrow(parseInt(escrowUserId, 10), amountRaw);
      await tx.wait();
      addToast(`Escrow released for User ${escrowUserId} successfully`, "success");
      setEscrowUserId("");
      setEscrowAmount("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to release escrow";
      addToast(message, "error");
    } finally {
      setEscrowLoading(false);
    }
  };

  const handleAdminAddEscrow = async () => {
    if (!isOwner) {
      addToast("Unauthorized: Admin wallet required", "error");
      return;
    }
    if (!escrowUserId || !escrowAmount) {
      return;
    }

    setAddEscrowLoading(true);
    try {
      const income = await incomeContract();
      const amountRaw = BigInt(Math.floor(parseFloat(escrowAmount)));
      const tx = await income.adminAddEscrow(parseInt(escrowUserId, 10), amountRaw);
      await tx.wait();
      addToast(`Escrow added for User ${escrowUserId} successfully`, "success");
      setEscrowUserId("");
      setEscrowAmount("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add escrow";
      addToast(message, "error");
    } finally {
      setAddEscrowLoading(false);
    }
  };

  const checkStrandedEscrow = async () => {
    if (!strandedUserId) {
      setStrandedError("Enter a user ID first");
      return;
    }

    setStrandedLoading(true);
    setStrandedError("");
    setStrandedTxHash("");

    try {
      const userId = parseInt(strandedUserId, 10);
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new Error("Enter a valid user ID");
      }

      const { core, income } = await readContracts();
      const currentPackage = Number(await core.getUserPackageLevel(userId));
      const amounts: Record<number, bigint> = {};
      let total = 0n;

      for (let pkg = 1; pkg < currentPackage; pkg += 1) {
        const amount = (await income.escrowBalances(userId, pkg)) as bigint;
        if (amount > 0n) {
          amounts[pkg] = amount;
          total += amount;
        }
      }

      setStrandedEscrow({ currentPackage, amounts, total });
    } catch (error) {
      setStrandedEscrow(null);
      setStrandedError(error instanceof Error ? error.message : "Failed to check stranded escrow");
    } finally {
      setStrandedLoading(false);
    }
  };

  const handleReleaseStrandedEscrow = async () => {
    if (!isOwner) {
      setStrandedError("Unauthorized: Admin wallet required");
      return;
    }
    if (!strandedUserId) {
      setStrandedError("Enter a user ID first");
      return;
    }
    if (!strandedEscrow || strandedEscrow.total === 0n) {
      setStrandedError("No stranded escrow found for this user");
      return;
    }

    const confirmed = window.confirm(
      `Release ${formatPlatformUsdt(strandedEscrow.total)} USDT stranded escrow for User ${strandedUserId}?`
    );
    if (!confirmed) {
      return;
    }

    setStrandedReleaseLoading(true);
    setStrandedError("");
    setStrandedTxHash("");

    try {
      const contract = await signerContract();
      const tx = await contract.adminReleaseStrandedEscrow(parseInt(strandedUserId, 10));
      await tx.wait();
      setStrandedTxHash(tx.hash);
      addToast(`Stranded escrow released for User ${strandedUserId}`, "success");
      await checkStrandedEscrow();
    } catch (error) {
      setStrandedError(error instanceof Error ? error.message : "Failed to release stranded escrow");
    } finally {
      setStrandedReleaseLoading(false);
    }
  };

  const checkRebirthEscrow = async () => {
    if (!rebirthEscrowUserId) {
      setRebirthEscrowError("Enter a user ID first");
      return;
    }

    setRebirthEscrowLoading(true);
    setRebirthEscrowError("");
    setRebirthEscrowTxHash("");

    try {
      const userId = parseInt(rebirthEscrowUserId, 10);
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new Error("Enter a valid user ID");
      }

      const { income } = await readContracts();
      const balance = (await income.getRebirthEscrow(userId)) as bigint;
      setRebirthEscrowBalance(balance);
    } catch (error) {
      setRebirthEscrowBalance(null);
      setRebirthEscrowError(error instanceof Error ? error.message : "Failed to check rebirth escrow");
    } finally {
      setRebirthEscrowLoading(false);
    }
  };

  const releaseRebirthEscrow = async () => {
    if (!isOwner) {
      setRebirthEscrowError("Unauthorized: Admin wallet required");
      return;
    }
    if (!rebirthEscrowUserId || !rebirthEscrowAmount) {
      setRebirthEscrowError("Enter both user ID and amount");
      return;
    }

    setRebirthEscrowReleaseLoading(true);
    setRebirthEscrowError("");
    setRebirthEscrowTxHash("");

    try {
      const userId = parseInt(rebirthEscrowUserId, 10);
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new Error("Enter a valid user ID");
      }

      const amount = BigInt(Math.floor(parseFloat(rebirthEscrowAmount) * 10));
      if (amount <= 0n) {
        throw new Error("Enter an amount greater than 0");
      }

      const income = await incomeContract();
      const tx = await income.adminReleaseRebirthEscrow(userId, amount);
      await tx.wait();
      setRebirthEscrowTxHash(tx.hash);
      addToast(`Rebirth escrow released for User ${rebirthEscrowUserId}`, "success");
      await checkRebirthEscrow();
      setRebirthEscrowAmount("");
    } catch (error) {
      setRebirthEscrowError(error instanceof Error ? error.message : "Failed to release rebirth escrow");
    } finally {
      setRebirthEscrowReleaseLoading(false);
    }
  };

  const handleSetProductionMode = async (enable: boolean) => {
    if (!isOwner) {
      addToast("Unauthorized: Admin wallet required", "error");
      return;
    }
    setProdModeLoading(true);
    try {
      const contract = await signerContract();
      const asset = enable
        ? prodPaymentAsset || "0xF4975eB104932bDBcA491A9Cb985439eA03863e0"
        : "0x0000000000000000000000000000000000000000";
      const tx = await contract.setProductionMode(enable, asset);
      await tx.wait();
      addToast(enable ? "Production mode enabled" : "Production mode disabled", "success");
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update production mode";
      addToast(message, "error");
    } finally {
      setProdModeLoading(false);
    }
  };

  const handleSetIncomeRouter = async () => {
    if (!isOwner) {
      addToast("Unauthorized: Admin wallet required", "error");
      return;
    }
    if (!incomeRouterInput) {
      return;
    }
    try {
      const contract = await signerContract();
      const tx = await contract.setIncomeRouterContract(incomeRouterInput);
      await tx.wait();
      addToast("Income Router updated", "success");
      setIncomeRouterInput("");
      void loadSettings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed";
      addToast(message, "error");
    }
  };

  const handleSetIncomeEngine = async () => {
    if (!isOwner) {
      addToast("Unauthorized: Admin wallet required", "error");
      return;
    }
    if (!incomeEngineInput) {
      return;
    }
    try {
      const contract = await signerContract();
      const tx = await contract.setIncomeEngineContract(incomeEngineInput);
      await tx.wait();
      addToast("Income Engine updated", "success");
      setIncomeEngineInput("");
      void loadSettings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed";
      addToast(message, "error");
    }
  };

  const handleSetUpgradeEngine = async () => {
    if (!isOwner) {
      addToast("Unauthorized: Admin wallet required", "error");
      return;
    }
    if (!upgradeEngineInput) {
      return;
    }
    try {
      const contract = await signerContract();
      const tx = await contract.setUpgradeEngineContract(upgradeEngineInput);
      await tx.wait();
      addToast("Upgrade Engine updated", "success");
      setUpgradeEngineInput("");
      void loadSettings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed";
      addToast(message, "error");
    }
  };

  const handleSetCashbackPool = async () => {
    if (!isOwner) {
      addToast("Unauthorized: Admin wallet required", "error");
      return;
    }
    if (!cashbackPoolInput) {
      return;
    }
    try {
      const contract = await signerContract();
      const tx = await contract.setCashbackPoolContract(cashbackPoolInput);
      await tx.wait();
      addToast("Cashback Pool updated", "success");
      setCashbackPoolInput("");
      void loadSettings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed";
      addToast(message, "error");
    }
  };

  const handleSetStaking = async () => {
    if (!isOwner) {
      addToast("Unauthorized: Admin wallet required", "error");
      return;
    }
    if (!stakingInput) {
      return;
    }
    try {
      const contract = await signerContract();
      const tx = await contract.setStakingContract(stakingInput);
      await tx.wait();
      addToast("Staking Contract updated", "success");
      setStakingInput("");
      void loadSettings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed";
      addToast(message, "error");
    }
  };

  const releaseAllRebirthEscrow = async () => {
    if (!isOwner) {
      setRebirthEscrowError("Unauthorized: Admin wallet required");
      return;
    }
    if (!rebirthEscrowUserId || !rebirthEscrowBalance || rebirthEscrowBalance <= 0n) {
      setRebirthEscrowError("No rebirth escrow found for this user");
      return;
    }

    setRebirthEscrowReleaseLoading(true);
    setRebirthEscrowError("");
    setRebirthEscrowTxHash("");

    try {
      const userId = parseInt(rebirthEscrowUserId, 10);
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new Error("Enter a valid user ID");
      }

      const income = await incomeContract();
      const tx = await income.adminReleaseRebirthEscrow(userId, rebirthEscrowBalance);
      await tx.wait();
      setRebirthEscrowTxHash(tx.hash);
      addToast(`All rebirth escrow released for User ${rebirthEscrowUserId}`, "success");
      await checkRebirthEscrow();
    } catch (error) {
      setRebirthEscrowError(error instanceof Error ? error.message : "Failed to release rebirth escrow");
    } finally {
      setRebirthEscrowReleaseLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {!isOwner ? (
        <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-8">
          <h2 className="text-2xl font-semibold text-white">Access Restricted</h2>
          <p className="mt-4 text-sm leading-7 text-gray-400">This page requires the owner wallet.</p>
          <div className="mt-6 space-y-3 rounded-3xl border border-gray-800 bg-gray-950/70 p-5 text-sm text-gray-300">
            <div>Connected: {walletAddress ? shortAddress(walletAddress) : "No wallet connected"}</div>
            <div>Required: Owner wallet only</div>
            {ownerAddress ? <div>Owner: {ownerAddress}</div> : null}
            {accessMessage ? <div className="text-amber-200">{accessMessage}</div> : null}
          </div>
        </section>
      ) : null}

      <section className={!isOwner ? "pointer-events-none opacity-40" : ""}>
        <div className="space-y-6">
          <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Current Contract Settings</h2>
                <p className="mt-2 text-sm text-gray-400">Live readable settings and current contract addresses.</p>
              </div>
              <button type="button" onClick={() => void loadSettings()} className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-200">
                Refresh
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["Creator Wallet", settings?.creatorWallet ?? "-"],
                ["Placement Signer", settings?.placementSigner ?? "-"],
                ["USDT Token Address", settings?.usdtAddress ?? "-"],
                ["Default Payment Asset", settings?.defaultPaymentAsset ?? "-"],
                ["BinaryTree Contract", settings?.binaryTreeContract ?? "-"],
                ["Income Router", settings?.incomeRouterContract ?? "-"],
                ["Income Engine", settings?.incomeEngineContract ?? "-"],
                ["Upgrade Engine", settings?.upgradeEngineContract ?? "-"],
                ["Cashback Pool", settings?.cashbackPoolContract ?? "-"],
                ["Staking Contract", settings?.stakingContract ?? "-"],
                ["Contract Owner", settings?.owner ?? "-"],
                ["System Status", settings ? (settings.productionMode ? "Active" : "Inactive") : "-"]
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-4 text-sm text-gray-300">
                  <div className="text-gray-400">{label}</div>
                  <div className="mt-2 break-all font-mono text-xs text-white">{value}</div>
                  {String(value).startsWith("0x") ? (
                    <button type="button" onClick={() => void copyValue(String(value))} className="mt-3 rounded-full border border-gray-700 px-3 py-1 text-xs">
                      Copy
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6 xl:col-span-2">
              <h3 className="text-lg font-semibold text-white">Production Mode</h3>
              <p className="mt-2 text-sm text-gray-300">
                Current status:
                <span
                  className={`ml-2 font-semibold ${
                    settings?.productionMode ? "text-green-400" : "text-yellow-400"
                  }`}
                >
                  {settings?.productionMode ? "● Active (Live)" : "● Inactive (Testing)"}
                </span>
              </p>

              {!settings?.productionMode ? (
                <div className="mt-4">
                  <label className="mb-1 block text-xs text-gray-400">Payment Asset Address (USDT)</label>
                  <input
                    type="text"
                    placeholder="0x... USDT contract address"
                    value={prodPaymentAsset}
                    onChange={(event) => setProdPaymentAsset(event.target.value)}
                    className="w-full rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
                  />
                </div>
              ) : null}

              <div className="mt-4 flex gap-3">
                {!settings?.productionMode ? (
                  <button
                    type="button"
                    onClick={() => void handleSetProductionMode(true)}
                    disabled={prodModeLoading || !isOwner}
                    className="rounded-full bg-green-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {prodModeLoading ? "Enabling..." : "Enable Production"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSetProductionMode(false)}
                    disabled={prodModeLoading || !isOwner}
                    className="rounded-full bg-red-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {prodModeLoading ? "Disabling..." : "Disable Production"}
                  </button>
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
              <h3 className="text-lg font-semibold text-white">Update Creator Wallet</h3>
              <p className="mt-2 text-sm text-gray-400">Current: {settings?.creatorWallet ?? "-"}</p>
              <input value={creatorWalletInput} onChange={(event) => setCreatorWalletInput(event.target.value)} placeholder="0x..." className="mt-5 w-full rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none" />
              <button type="button" disabled={!isOwner || !isAddress(creatorWalletInput) || busy === "creator"} onClick={() => void execute("creator", async () => {
                const contract = await signerContract();
                return contract.setCreatorFeeWallet(creatorWalletInput);
              }, "Creator wallet updated")} className="mt-4 w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
                {busy === "creator" ? "Updating..." : "Update Creator Wallet"}
              </button>
            </article>

            <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
              <h3 className="text-lg font-semibold text-white">Update Placement Signer</h3>
              <p className="mt-2 text-sm text-gray-400">Current: {settings?.placementSigner ?? "-"}</p>
              <input value={placementSignerInput} onChange={(event) => setPlacementSignerInput(event.target.value)} placeholder="0x..." className="mt-5 w-full rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none" />
              <button type="button" disabled={!isOwner || !isAddress(placementSignerInput) || busy === "signer"} onClick={() => void execute("signer", async () => {
                const contract = await signerContract();
                return contract.setPlacementSigner(placementSignerInput);
              }, "Placement signer updated")} className="mt-4 w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
                {busy === "signer" ? "Updating..." : "Update Signer"}
              </button>
            </article>

            <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
              <h3 className="text-lg font-semibold text-white">Update USDT Address</h3>
              <p className="mt-2 text-sm text-gray-400">Current effective asset: {settings?.defaultPaymentAsset ?? "-"}</p>
              <input value={usdtInput} onChange={(event) => setUsdtInput(event.target.value)} placeholder="0x..." className="mt-5 w-full rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none" />
              <button type="button" disabled={!isOwner || !isAddress(usdtInput) || busy === "usdt"} onClick={() => void execute("usdt", async () => {
                const contract = await signerContract();
                return contract.setUsdtAddress(usdtInput);
              }, "USDT address updated")} className="mt-4 w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
                {busy === "usdt" ? "Updating..." : "Update USDT Address"}
              </button>
            </article>

            <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
              <h3 className="text-lg font-semibold text-white">Update BinaryTree Contract</h3>
              <p className="mt-2 text-sm text-gray-400">Current: {settings?.binaryTreeContract ?? "-"}</p>
              <input value={binaryTreeInput} onChange={(event) => setBinaryTreeInput(event.target.value)} placeholder="0x..." className="mt-5 w-full rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none" />
              <button type="button" disabled={!isOwner || !isAddress(binaryTreeInput) || busy === "tree"} onClick={() => void execute("tree", async () => {
                const contract = await signerContract();
                return contract.setBinaryTreeContract(binaryTreeInput);
              }, "BinaryTree contract updated")} className="mt-4 w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
                {busy === "tree" ? "Updating..." : "Update BinaryTree"}
              </button>
            </article>

            <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6 xl:col-span-2">
              <h3 className="text-lg font-semibold text-white">System Contract Addresses</h3>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Income Router Contract</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="0x... Income Router address"
                      value={incomeRouterInput}
                      onChange={(event) => setIncomeRouterInput(event.target.value)}
                      className="flex-1 rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSetIncomeRouter()}
                      disabled={!isOwner || !incomeRouterInput}
                      className="rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Update
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-gray-400">Income Engine Contract</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="0x... Income Engine address"
                      value={incomeEngineInput}
                      onChange={(event) => setIncomeEngineInput(event.target.value)}
                      className="flex-1 rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSetIncomeEngine()}
                      disabled={!isOwner || !incomeEngineInput}
                      className="rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Update
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-gray-400">Upgrade Engine Contract</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="0x... Upgrade Engine address"
                      value={upgradeEngineInput}
                      onChange={(event) => setUpgradeEngineInput(event.target.value)}
                      className="flex-1 rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSetUpgradeEngine()}
                      disabled={!isOwner || !upgradeEngineInput}
                      className="rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Update
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-gray-400">Cashback Pool Contract</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="0x... Cashback Pool address"
                      value={cashbackPoolInput}
                      onChange={(event) => setCashbackPoolInput(event.target.value)}
                      className="flex-1 rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSetCashbackPool()}
                      disabled={!isOwner || !cashbackPoolInput}
                      className="rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Update
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-gray-400">Staking Contract</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="0x... Staking address"
                      value={stakingInput}
                      onChange={(event) => setStakingInput(event.target.value)}
                      className="flex-1 rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSetStaking()}
                      disabled={!isOwner || !stakingInput}
                      className="rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Update
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <section className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6">
            <h3 className="text-lg font-semibold text-white">Creator Income</h3>
            <p className="mt-2 text-sm text-gray-300">
              Current creator wallet balance: <span className="font-semibold text-amber-200">{creatorWalletBalance === null ? "Not available" : `${creatorWalletBalance.toFixed(2)} USDT`}</span>
            </p>
            <div className="mt-5 space-y-3">
              {creatorRecent.map((item) => (
                <div key={item.txHash} className="rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-3 text-sm text-gray-300">
                  Estimated creator share {item.amount.toFixed(1)} USDT on {new Date(item.timestamp * 1000).toLocaleString()}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-yellow-500/30 bg-yellow-500/5 p-6">
            <h3 className="text-lg font-semibold text-yellow-300">Emergency Escrow Release</h3>
            <p className="mt-2 text-sm text-gray-300">
              Release frozen escrow to a user wallet. Use only when escrow is stuck.
            </p>
            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <input
                type="number"
                placeholder="User ID"
                value={escrowUserId}
                onChange={(event) => setEscrowUserId(event.target.value)}
                className="w-full rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none md:w-40"
              />
              <input
                type="number"
                placeholder="Amount (raw units)"
                value={escrowAmount}
                onChange={(event) => setEscrowAmount(event.target.value)}
                className="w-full rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
              />
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleAdminReleaseEscrow()}
                disabled={escrowLoading || !escrowUserId || !escrowAmount || !isOwner}
                className="rounded-full bg-yellow-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {escrowLoading ? "Releasing..." : "Release Escrow"}
              </button>
              <button
                type="button"
                onClick={() => void handleAdminAddEscrow()}
                disabled={addEscrowLoading || !escrowUserId || !escrowAmount || !isOwner}
                className="rounded-full bg-green-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {addEscrowLoading ? "Adding..." : "Re-add to Escrow"}
              </button>
            </div>
          </section>

          {isOwner ? (
            <section className="rounded-3xl border border-cyan-500/30 bg-cyan-500/5 p-6">
              <h3 className="text-lg font-semibold text-cyan-200">Stranded Escrow Management</h3>
              <p className="mt-2 text-sm text-gray-300">
                Check older package buckets below a user&apos;s current package and release them back to the user wallet.
              </p>

              <div className="mt-5 flex flex-col gap-3 md:flex-row">
                <input
                  type="number"
                  placeholder="User ID"
                  value={strandedUserId}
                  onChange={(event) => {
                    setStrandedUserId(event.target.value);
                    setStrandedError("");
                    setStrandedTxHash("");
                  }}
                  className="w-full rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none md:w-40"
                />
                <button
                  type="button"
                  onClick={() => void checkStrandedEscrow()}
                  disabled={strandedLoading || !strandedUserId}
                  className="rounded-full bg-cyan-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {strandedLoading ? "Checking..." : "Check"}
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-gray-800 bg-gray-950/60 p-5 text-sm text-gray-300">
                <div>Current package: {strandedEscrow?.currentPackage ?? "-"}</div>
                <div className="mt-4 space-y-2">
                  {strandedEscrow && Object.keys(strandedEscrow.amounts).length > 0 ? (
                    Object.entries(strandedEscrow.amounts).map(([pkg, amount]) => (
                      <div key={pkg} className="flex items-center justify-between gap-4 rounded-2xl border border-gray-800 bg-gray-900/70 px-4 py-3">
                        <span>Package {pkg} Escrow</span>
                        <span className="font-semibold text-white">{formatPlatformUsdt(amount)} USDT</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400">No stranded escrow buckets loaded yet.</div>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between gap-4 border-t border-gray-800 pt-4">
                  <span className="text-gray-400">Total Stranded</span>
                  <span className="text-base font-semibold text-cyan-100">
                    {strandedEscrow ? `${formatPlatformUsdt(strandedEscrow.total)} USDT` : "0.0 USDT"}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => void handleReleaseStrandedEscrow()}
                  disabled={!isOwner || strandedReleaseLoading || !strandedEscrow || strandedEscrow.total === 0n}
                  className="rounded-full bg-cyan-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {strandedReleaseLoading ? "Releasing..." : "Release All Stranded to Wallet"}
                </button>
                {strandedTxHash ? (
                  <span className="text-xs text-green-300">Released successfully: {shortAddress(strandedTxHash)}</span>
                ) : null}
              </div>

              {strandedError ? <p className="mt-3 text-sm text-red-300">{strandedError}</p> : null}
            </section>
          ) : null}

          {isOwner ? (
            <section className="rounded-3xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-6">
              <h3 className="text-lg font-semibold text-fuchsia-200">Rebirth Escrow Management</h3>
              <p className="mt-2 text-sm text-gray-300">
                Check and release stuck rebirth escrow directly to the user wallet.
              </p>

              <div className="mt-5 flex flex-col gap-3 md:flex-row">
                <input
                  type="number"
                  placeholder="User ID"
                  value={rebirthEscrowUserId}
                  onChange={(event) => {
                    setRebirthEscrowUserId(event.target.value);
                    setRebirthEscrowError("");
                    setRebirthEscrowTxHash("");
                  }}
                  className="w-full rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none md:w-40"
                />
                <button
                  type="button"
                  onClick={() => void checkRebirthEscrow()}
                  disabled={rebirthEscrowLoading || !rebirthEscrowUserId}
                  className="rounded-full bg-fuchsia-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {rebirthEscrowLoading ? "Checking..." : "Check"}
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-gray-800 bg-gray-950/60 p-5 text-sm text-gray-300">
                <div className="flex items-center justify-between gap-4">
                  <span>Rebirth Escrow</span>
                  <span className="text-base font-semibold text-fuchsia-100">
                    {rebirthEscrowBalance !== null ? `${(Number(rebirthEscrowBalance) / 10).toFixed(2)} USDT` : "0.00 USDT"}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <input
                  type="number"
                  placeholder="Amount (USDT)"
                  value={rebirthEscrowAmount}
                  onChange={(event) => setRebirthEscrowAmount(event.target.value)}
                  className="w-full rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => void releaseRebirthEscrow()}
                  disabled={!isOwner || rebirthEscrowReleaseLoading || !rebirthEscrowUserId || !rebirthEscrowAmount}
                  className="rounded-full bg-fuchsia-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {rebirthEscrowReleaseLoading ? "Releasing..." : "Release to Wallet"}
                </button>
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => void releaseAllRebirthEscrow()}
                  disabled={!isOwner || rebirthEscrowReleaseLoading || !rebirthEscrowUserId || !rebirthEscrowBalance || rebirthEscrowBalance <= 0n}
                  className="rounded-full bg-fuchsia-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {rebirthEscrowReleaseLoading ? "Releasing..." : "Release All to Wallet"}
                </button>
              </div>

              <div className="mt-4">
                {rebirthEscrowTxHash ? (
                  <span className="text-xs text-green-300">Released successfully: {shortAddress(rebirthEscrowTxHash)}</span>
                ) : null}
                {rebirthEscrowError ? <p className="mt-2 text-sm text-red-300">{rebirthEscrowError}</p> : null}
              </div>
            </section>
          ) : null}

          <section className="rounded-3xl border border-red-500/30 bg-red-500/5 p-6">
            <h3 className="text-lg font-semibold text-white">Danger Zone</h3>
            <div className="mt-6 grid gap-6 xl:grid-cols-3">
              <div className="rounded-2xl border border-red-500/20 bg-gray-950/60 p-5">
                <h4 className="text-base font-semibold text-white">Emergency Sweep</h4>
                <input value={sweepRecipientInput} onChange={(event) => setSweepRecipientInput(event.target.value)} placeholder="Recipient 0x..." className="mt-4 w-full rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none" />
                <button type="button" disabled={!isOwner || !isAddress(sweepRecipientInput) || busy === "sweep"} onClick={() => {
                  const confirmText = window.prompt("This sweeps the router USDT balance. Type SWEEP to continue.");
                  if (confirmText !== "SWEEP") {
                    addToast("Emergency sweep cancelled", "warning");
                    return;
                  }
                  void execute("sweep", async () => {
                    const ethereum = getEthereum();
                    if (!ethereum) {
                      throw new Error("MetaMask not found");
                    }
                    const provider = new BrowserProvider(ethereum);
                    const signer = await provider.getSigner();
                    const router = new Contract(CONTRACTS.IncomeRouter, ABIS.IncomeRouter, signer);
                    return router.emergencySweep(CONTRACTS.USDT, sweepRecipientInput);
                  }, "Emergency sweep submitted");
                }} className="mt-4 w-full rounded-full bg-red-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
                  {busy === "sweep" ? "Sweeping..." : "Emergency Sweep"}
                </button>
              </div>

              <div className="rounded-2xl border border-red-500/20 bg-gray-950/60 p-5">
                <h4 className="text-base font-semibold text-white">Transfer Ownership</h4>
                <input value={newOwnerInput} onChange={(event) => setNewOwnerInput(event.target.value)} placeholder="0x..." className="mt-4 w-full rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none" />
                <button type="button" disabled={!isOwner || !isAddress(newOwnerInput) || busy === "owner"} onClick={() => {
                  const confirmText = window.prompt("Are you sure? Type CONFIRM to proceed.");
                  if (confirmText !== "CONFIRM") {
                    addToast("Ownership transfer cancelled", "warning");
                    return;
                  }
                  void execute("owner", async () => {
                    const contract = await signerContract();
                    return contract.transferOwnership(newOwnerInput);
                  }, "Ownership transferred");
                }} className="mt-4 w-full rounded-full bg-red-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
                  {busy === "owner" ? "Transferring..." : "Transfer Ownership"}
                </button>
              </div>

              <div className="rounded-2xl border border-red-500/20 bg-gray-950/60 p-5">
                <h4 className="text-base font-semibold text-white">Upgrade Implementation</h4>
                <input value={implementationInput} onChange={(event) => setImplementationInput(event.target.value)} placeholder="0x..." className="mt-4 w-full rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none" />
                <button type="button" disabled={!isOwner || !isAddress(implementationInput) || busy === "upgrade"} onClick={() => {
                  const confirmText = window.prompt("This upgrades contract logic. Type UPGRADE to proceed.");
                  if (confirmText !== "UPGRADE") {
                    addToast("Upgrade cancelled", "warning");
                    return;
                  }
                  void execute("upgrade", async () => {
                    const contract = await signerContract();
                    return contract.upgradeToAndCall(implementationInput, "0x");
                  }, "Upgrade transaction submitted successfully");
                }} className="mt-4 w-full rounded-full bg-red-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
                  {busy === "upgrade" ? "Upgrading..." : "Upgrade Implementation"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
