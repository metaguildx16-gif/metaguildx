import { ethers } from "hardhat";

const ADDRESSES = {
  mgxToken: "0x35c9Ce942Bc02986f7eC7c97b2B929991A49fe5b",
  binaryTree: "0x59f18c8A55e441EE86f92b76e506bac8D08E7365",
  incomeRouter: "0xd496eC1Cf0E66a7beECe21b8Bd908F335aBbDfe8",
  cashbackPool: "0x3DFb28bbAF1ef2C43cE4FcAb8f6A0e4D30B831CA",
  mgxStaking: "0xFbC873Ce780384D3c9f3F306b9904CF33c3307c3",
  core: "0x9490E2C603c5a6D3c0E66af8494E766470dA1E4B",
  income: "0xcD4a223ac91E551BF0e278dF1bE9eb29901A4FeB",
  upgrade: "0x8CF75a78641a0e390C0101a1541Bed82E3214A9A",
  usdt: "0xF4975eB104932bDBcA491A9Cb985439eA03863e0",
} as const;

async function main() {
  const [baseSigner] = await ethers.getSigners();
  const signer = new ethers.NonceManager(baseSigner);
  const creatorWallet = process.env.CREATOR_WALLET || baseSigner.address;
  const placementSigner = process.env.PLACEMENT_SIGNER_ADDRESS || baseSigner.address;
  const unitPrice = 10n ** 17n;

  console.log("Completing MetaGuildX v3 wiring...");
  console.log("Signer:", await signer.getAddress());

  console.log("MGXToken:", ADDRESSES.mgxToken);

  const coreContract = await ethers.getContractAt("MetaGuildXCore", ADDRESSES.core, signer);
  const binaryTreeContract = await ethers.getContractAt("BinaryTree", ADDRESSES.binaryTree, signer);
  const incomeRouterContract = await ethers.getContractAt("IncomeRouter", ADDRESSES.incomeRouter, signer);
  const incomeContract = await ethers.getContractAt("MetaGuildXIncome", ADDRESSES.income, signer);
  const upgradeContract = await ethers.getContractAt("MetaGuildXUpgrade", ADDRESSES.upgrade, signer);
  const cashbackPoolContract = await ethers.getContractAt("CashbackPool", ADDRESSES.cashbackPool, signer);
  const stakingContract = await ethers.getContractAt("MGXStaking", ADDRESSES.mgxStaking, signer);

  const steps: Array<{ label: string; run: () => Promise<void> }> = [
    {
      label: "core.setStakingContract",
      run: async () => {
        const tx = await coreContract.setStakingContract(ADDRESSES.mgxStaking);
        await tx.wait();
      },
    },
    {
      label: "core.setMgxTokenAddress",
      run: async () => {
        const tx = await coreContract.setMgxTokenAddress(ADDRESSES.mgxToken);
        await tx.wait();
      },
    },
    {
      label: "core.setUsdtAddress",
      run: async () => {
        const tx = await coreContract.setUsdtAddress(ADDRESSES.usdt);
        await tx.wait();
      },
    },
    {
      label: "core.setDefaultPaymentAsset",
      run: async () => {
        const tx = await coreContract.setDefaultPaymentAsset(ADDRESSES.usdt);
        await tx.wait();
      },
    },
    {
      label: "core.setCreatorFeeWallet",
      run: async () => {
        const tx = await coreContract.setCreatorFeeWallet(creatorWallet);
        await tx.wait();
      },
    },
    {
      label: "core.setPlacementSigner",
      run: async () => {
        const tx = await coreContract.setPlacementSigner(placementSigner);
        await tx.wait();
      },
    },
    {
      label: "core.configurePaymentAsset",
      run: async () => {
        const tx = await coreContract.configurePaymentAsset(ADDRESSES.usdt, true, false, unitPrice);
        await tx.wait();
      },
    },
    {
      label: "core.setProductionMode",
      run: async () => {
        const tx = await coreContract.setProductionMode(true, ADDRESSES.usdt);
        await tx.wait();
      },
    },
    {
      label: "binaryTree.setCoreContract",
      run: async () => {
        const tx = await binaryTreeContract.setCoreContract(ADDRESSES.core);
        await tx.wait();
      },
    },
    {
      label: "incomeRouter.setCoreContract",
      run: async () => {
        const tx = await incomeRouterContract.setCoreContract(ADDRESSES.core);
        await tx.wait();
      },
    },
    {
      label: "incomeRouter.setIncomeEngineContract",
      run: async () => {
        const tx = await incomeRouterContract.setIncomeEngineContract(ADDRESSES.income);
        await tx.wait();
      },
    },
    {
      label: "incomeRouter.setCreatorWallet",
      run: async () => {
        const tx = await incomeRouterContract.setCreatorWallet(creatorWallet);
        await tx.wait();
      },
    },
    {
      label: "income.setCoreContract",
      run: async () => {
        const tx = await incomeContract.setCoreContract(ADDRESSES.core);
        await tx.wait();
      },
    },
    {
      label: "income.setIncomeRouterContract",
      run: async () => {
        const tx = await incomeContract.setIncomeRouterContract(ADDRESSES.incomeRouter);
        await tx.wait();
      },
    },
    {
      label: "income.setUpgradeEngineContract",
      run: async () => {
        const tx = await incomeContract.setUpgradeEngineContract(ADDRESSES.upgrade);
        await tx.wait();
      },
    },
    {
      label: "income.setDefaultPaymentAsset",
      run: async () => {
        const tx = await incomeContract.setDefaultPaymentAsset(ADDRESSES.usdt);
        await tx.wait();
      },
    },
    {
      label: "upgrade.setCoreContract",
      run: async () => {
        const tx = await upgradeContract.setCoreContract(ADDRESSES.core);
        await tx.wait();
      },
    },
    {
      label: "upgrade.setIncomeContract",
      run: async () => {
        const tx = await upgradeContract.setIncomeContract(ADDRESSES.income);
        await tx.wait();
      },
    },
    {
      label: "upgrade.setDefaultPaymentAsset",
      run: async () => {
        const tx = await upgradeContract.setDefaultPaymentAsset(ADDRESSES.usdt);
        await tx.wait();
      },
    },
    {
      label: "cashbackPool.setCoreContract",
      run: async () => {
        const tx = await cashbackPoolContract.setCoreContract(ADDRESSES.core);
        await tx.wait();
      },
    },
    {
      label: "cashbackPool.setPaymentAsset",
      run: async () => {
        const tx = await cashbackPoolContract.setPaymentAsset(ADDRESSES.usdt);
        await tx.wait();
      },
    },
    {
      label: "staking.setCoreContract",
      run: async () => {
        const tx = await stakingContract.setCoreContract(ADDRESSES.core);
        await tx.wait();
      },
    },
    {
      label: "staking.setIncomeContract",
      run: async () => {
        const tx = await stakingContract.setIncomeContract(ADDRESSES.incomeRouter);
        await tx.wait();
      },
    },
  ];

  const results: Array<{ label: string; status: "SUCCESS" | "FAILED"; error?: string }> = [];

  for (const step of steps) {
    try {
      console.log(`RUN  ${step.label}`);
      await step.run();
      results.push({ label: step.label, status: "SUCCESS" });
      console.log(`PASS ${step.label}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ label: step.label, status: "FAILED", error: message });
      console.log(`FAIL ${step.label}`);
      console.log(message);
    }
  }

  console.log("");
  console.log("WIRING RESULTS");
  for (const result of results) {
    console.log(`${result.status} ${result.label}${result.error ? ` :: ${result.error}` : ""}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
