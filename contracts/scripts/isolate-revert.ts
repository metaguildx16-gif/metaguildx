import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const USDT = process.env.USDT_ADDRESS!;
  const ROUTER = process.env.INCOME_ROUTER_ADDRESS!;
  const INCOME = process.env.INCOME_ENGINE_ADDRESS!;

  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;

  const freshUser = ethers.Wallet.createRandom().connect(provider);
  const freshAddr = freshUser.address;
  console.log("Fresh user:", freshAddr);

  await (
    await deployer.sendTransaction({
      to: freshAddr,
      value: ethers.parseEther("0.01"),
    })
  ).wait();

  const usdt = await ethers.getContractAt(
    [
      "function mint(address,uint256) external",
      "function approve(address,uint256) external returns (bool)",
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
    ],
    USDT,
    deployer
  );

  await (await usdt.mint(freshAddr, ethers.parseUnits("50", 18))).wait();
  await (
    await usdt.connect(freshUser).approve(CORE, ethers.parseUnits("50", 18))
  ).wait();

  console.log("\n=== STEP 1: USDT Transfer Test ===");
  try {
    await (
      await usdt
        .connect(freshUser)
        .approve(deployer.address, ethers.parseUnits("10", 18))
    ).wait();
    console.log("USDT approve: ✅");
  } catch (e: any) {
    console.log("USDT approve FAIL:", e.reason ?? e.message);
  }

  console.log("\n=== STEP 2: Router Check ===");
  const router = await ethers.getContractAt(
    [
      "function coreContract() view returns (address)",
      "function incomeEngineContract() view returns (address)",
      "function creatorWallet() view returns (address)",
      "function creatorFeeBps() view returns (uint256)",
    ],
    ROUTER
  );

  const routerCore = await router.coreContract();
  const routerIncome = await router.incomeEngineContract();
  const creatorWallet = await router.creatorWallet();
  const creatorBps = await router.creatorFeeBps();

  console.log("Router coreContract:", routerCore);
  console.log("Router income:", routerIncome);
  console.log("Creator wallet:", creatorWallet);
  console.log("Creator BPS:", creatorBps.toString());
  console.log("Router core = CORE:", routerCore.toLowerCase() === CORE.toLowerCase());

  console.log("\n=== STEP 3: Income Engine Check ===");
  const income = await ethers.getContractAt(
    [
      "function coreContract() view returns (address)",
      "function upgradeEngineContract() view returns (address)",
      "function defaultPaymentAsset() view returns (address)",
    ],
    INCOME
  );

  const incomeCore = await income.coreContract();
  const incomeUpgrade = await income.upgradeEngineContract();
  console.log("Income coreContract:", incomeCore);
  console.log("Income upgradeEngine:", incomeUpgrade);
  console.log("Income core = CORE:", incomeCore.toLowerCase() === CORE.toLowerCase());

  console.log("\n=== STEP 4: Creator + Cashback Check ===");
  const usdtView = await ethers.getContractAt(
    ["function balanceOf(address) view returns (uint256)"],
    USDT
  );

  const creatorBal = await usdtView.balanceOf(creatorWallet);
  const cashbackBal = await usdtView.balanceOf(process.env.CASHBACK_POOL_ADDRESS!);
  const routerBal = await usdtView.balanceOf(ROUTER);
  const coreBal = await usdtView.balanceOf(CORE);

  console.log("Creator USDT:", ethers.formatUnits(creatorBal, 18));
  console.log("Cashback USDT:", ethers.formatUnits(cashbackBal, 18));
  console.log("Router USDT:", ethers.formatUnits(routerBal, 18));
  console.log("Core USDT:", ethers.formatUnits(coreBal, 18));

  console.log("\n=== STEP 5: Income Distribution Math ===");
  const pkg1Price = 100n;
  const directBps = 4600n;
  const levelBps = 4000n;
  const cashbackBps = 400n;
  const creatorBps2 = 1000n;
  const BPS_BASE = 10000n;

  const direct = (pkg1Price * directBps) / BPS_BASE;
  const level = (pkg1Price * levelBps) / BPS_BASE;
  const cashback = (pkg1Price * cashbackBps) / BPS_BASE;
  const creator = (pkg1Price * creatorBps2) / BPS_BASE;

  console.log("Direct income:", direct.toString(), "units");
  console.log("Level income:", level.toString(), "units");
  console.log("Cashback:", cashback.toString(), "units");
  console.log("Creator:", creator.toString(), "units");
  console.log("Total:", (direct + level + cashback + creator).toString());

  const unitPrice = 100000000000000000n;
  console.log("\nSettlement amounts (USDT 18dec):");
  console.log("Direct:", ethers.formatUnits(direct * unitPrice, 18), "USDT");
  console.log("Level:", ethers.formatUnits(level * unitPrice, 18), "USDT");
  console.log("Cashback:", ethers.formatUnits(cashback * unitPrice, 18), "USDT");
  console.log("Creator:", ethers.formatUnits(creator * unitPrice, 18), "USDT");
  console.log("Total:", ethers.formatUnits(pkg1Price * unitPrice, 18), "USDT");

  console.log("\n=== STEP 6: Core→Router Transfer Check ===");
  console.log("Core USDT balance:", ethers.formatUnits(coreBal, 18), "USDT");
  console.log(
    "Need for registration:",
    ethers.formatUnits(pkg1Price * unitPrice, 18),
    "USDT"
  );
  console.log("Core has enough:", coreBal >= pkg1Price * unitPrice);

  console.log("\n=== STEP 7: Cashback Pool Check ===");
  const cashbackPool = await ethers.getContractAt(
    [
      "function coreContract() view returns (address)",
      "function addCashback(address,uint256) external",
    ],
    process.env.CASHBACK_POOL_ADDRESS!
  );

  const cashbackCore = await cashbackPool.coreContract();
  console.log("Cashback coreContract:", cashbackCore);
  console.log("Cashback core = CORE:", cashbackCore.toLowerCase() === CORE.toLowerCase());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
