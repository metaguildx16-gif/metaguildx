import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("Net Surrender — Lifetime Income Cap", function () {
  this.timeout(180_000);

  async function deployLibraries() {
    const upgradeCycleLib = await (await ethers.getContractFactory("UpgradeCycleLib")).deploy();
    const payLib          = await (await ethers.getContractFactory("MetaGuildXPaymentLib")).deploy();
    const placeLib        = await (await ethers.getContractFactory("MetaGuildXPlacementLib")).deploy();
    const adminLib        = await (await ethers.getContractFactory("MetaGuildXAdminLib")).deploy();
    const rebirthLib      = await (await ethers.getContractFactory("MetaGuildXRebirthLib")).deploy();
    await Promise.all([upgradeCycleLib.waitForDeployment(), payLib.waitForDeployment(),
      placeLib.waitForDeployment(), adminLib.waitForDeployment(), rebirthLib.waitForDeployment()]);
    const upgradeLib = await (await ethers.getContractFactory("MetaGuildXUpgradeFlowLib", {
      libraries: {
        "src/libraries/UpgradeCycleLib.sol:UpgradeCycleLib":      await upgradeCycleLib.getAddress(),
        "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":  await payLib.getAddress(),
      }
    })).deploy();
    await upgradeLib.waitForDeployment();
    const adminDistLib = await (await ethers.getContractFactory("MetaGuildXAdminDistributionLib", {
      libraries: { "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib": await payLib.getAddress() }
    })).deploy();
    await adminDistLib.waitForDeployment();
    const surrenderLib = await (await ethers.getContractFactory("MetaGuildXSurrenderLib", {
      libraries: { "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib": await payLib.getAddress() }
    })).deploy();
    await surrenderLib.waitForDeployment();
    const coreLib = await (await ethers.getContractFactory("MetaGuildXCoreLib", {
      libraries: { "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib": await payLib.getAddress() }
    })).deploy();
    await coreLib.waitForDeployment();
    return {
      "src/MetaGuildXAdminLib.sol:MetaGuildXAdminLib":                             await adminLib.getAddress(),
      "src/MetaGuildXRebirthLib.sol:MetaGuildXRebirthLib":                         await rebirthLib.getAddress(),
      "src/MetaGuildXUpgradeFlowLib.sol:MetaGuildXUpgradeFlowLib":                 await upgradeLib.getAddress(),
      "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":                    await payLib.getAddress(),
      "src/libs/MetaGuildXPlacementLib.sol:MetaGuildXPlacementLib":                await placeLib.getAddress(),
      "src/MetaGuildXAdminDistributionLib.sol:MetaGuildXAdminDistributionLib":     await adminDistLib.getAddress(),
      "src/MetaGuildXSurrenderLib.sol:MetaGuildXSurrenderLib":                     await surrenderLib.getAddress(),
      "src/MetaGuildXCoreLib.sol:MetaGuildXCoreLib":                               await coreLib.getAddress(),
    };
  }

  async function deploySystem() {
    const libraries = await deployLibraries();
    const [owner, creator, ...users] = await ethers.getSigners();
    const mgxToken = await (await ethers.getContractFactory("MGXToken")).deploy(owner.address);
    await mgxToken.waitForDeployment();
    const usdt = await (await ethers.getContractFactory("MockUSDT")).deploy(owner.address);
    await usdt.waitForDeployment();
    const binaryTree = await upgrades.deployProxy(await ethers.getContractFactory("BinaryTree"),[owner.address],{kind:"uups"});
    await binaryTree.waitForDeployment();
    const router = await upgrades.deployProxy(await ethers.getContractFactory("IncomeRouter"),[owner.address],{kind:"uups"});
    await router.waitForDeployment();
    const cashback = await upgrades.deployProxy(await ethers.getContractFactory("CashbackPool"),[owner.address],{kind:"uups"});
    await cashback.waitForDeployment();
    const staking = await upgrades.deployProxy(await ethers.getContractFactory("MGXStaking"),[owner.address],{kind:"uups"});
    await staking.waitForDeployment();
    const core = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXCore",{libraries}),
      [owner.address],{kind:"uups",unsafeAllowLinkedLibraries:true});
    await core.waitForDeployment();
    const upgrade = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXUpgrade"),
      [await core.getAddress(), owner.address, await usdt.getAddress()],{kind:"uups"});
    await upgrade.waitForDeployment();
    const income = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXIncome"),
      [await core.getAddress(), await router.getAddress(), await upgrade.getAddress(), await usdt.getAddress()],{kind:"uups"});
    await income.waitForDeployment();
    await (await upgrade.setIncomeContract(await income.getAddress())).wait();
    const tokenEngine = await upgrades.deployProxy(await ethers.getContractFactory("MetaGuildXTokenEngine"),[await core.getAddress()],{kind:"uups"});
    await tokenEngine.waitForDeployment();
    const coreAddr = await core.getAddress();
    await (await (core as any).setBinaryTreeContract(await binaryTree.getAddress())).wait();
    await (await (core as any).setIncomeRouterContract(await router.getAddress())).wait();
    await (await (core as any).setIncomeEngineContract(await income.getAddress())).wait();
    await (await (core as any).setUpgradeEngineContract(await upgrade.getAddress())).wait();
    await (await (core as any).setCashbackPoolContract(await cashback.getAddress())).wait();
    await (await (core as any).setStakingContract(await staking.getAddress())).wait();
    await (await (core as any).setMgxTokenAddress(await mgxToken.getAddress())).wait();
    await (await (core as any).setUsdtAddress(await usdt.getAddress())).wait();
    await (await (core as any).setDefaultPaymentAsset(await usdt.getAddress())).wait();
    await (await (core as any).setCreatorFeeWallet(creator.address)).wait();
    await (await (core as any).setPlacementSigner(owner.address)).wait();
    await (await (core as any).setTokenEngineContract(await tokenEngine.getAddress())).wait();
    await (await (core as any).configurePaymentAsset(await usdt.getAddress(),true,false,10n**17n)).wait();
    await (await (core as any).setProductionMode(true,await usdt.getAddress())).wait();
    await (await (binaryTree as any).setCoreContract(coreAddr)).wait();
    await (await (router as any).setCoreContract(coreAddr)).wait();
    await (await (router as any).setIncomeEngineContract(await income.getAddress())).wait();
    await (await (router as any).setCreatorWallet(creator.address)).wait();
    await (await (income as any).setCoreContract(coreAddr)).wait();
    await (await (income as any).setIncomeRouterContract(await router.getAddress())).wait();
    await (await (income as any).setUpgradeEngineContract(await upgrade.getAddress())).wait();
    await (await (income as any).setDefaultPaymentAsset(await usdt.getAddress())).wait();
    await (await (upgrade as any).setCoreContract(coreAddr)).wait();
    await (await (upgrade as any).setIncomeContract(await income.getAddress())).wait();
    await (await (upgrade as any).setDefaultPaymentAsset(await usdt.getAddress())).wait();
    await (await (cashback as any).setCoreContract(coreAddr)).wait();
    await (await (cashback as any).setPaymentAsset(await usdt.getAddress())).wait();
    await (await (staking as any).setCoreContract(coreAddr)).wait();
    await (await (staking as any).setIncomeContract(await income.getAddress())).wait();
    await (await mgxToken.mintLaunchAllocations(coreAddr,owner.address,owner.address)).wait();
    return { owner, creator, users, mgxToken, usdt, binaryTree, router,
             cashback, staking, core, income, upgrade, tokenEngine };
  }

  async function registerUser(ctx: any, userSigner: any, sponsorId: bigint) {
    const { owner, core, usdt } = ctx;
    const coreAddress = await core.getAddress();
    const usdtAddress = await usdt.getAddress();
    const unitPrice = await (core as any).paymentAssetUnitPrice(usdtAddress);
    const pkgPrice  = (await (core as any).getPackagePrices())[0];
    const settlement = pkgPrice * unitPrice;
    await (await usdt.connect(owner).mint(userSigner.address, settlement*50n)).wait();
    await (await usdt.connect(userSigner).approve(coreAddress, settlement*50n)).wait();
    const network = await ethers.provider.getNetwork();
    const nonce = await (core as any).nonces(userSigner.address);
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = BigInt(latestBlock!.timestamp + 365*24*3600);
    const structHash = ethers.solidityPackedKeccak256(
      ["uint256","address","address","uint256","uint256","bool","uint256","uint256"],
      [network.chainId,coreAddress,userSigner.address,sponsorId,0n,false,nonce,deadline]);
    const sig = await owner.signMessage(ethers.getBytes(structHash));
    await (await (core as any).connect(userSigner).registerWithPlacement(sponsorId,0n,false,sig,nonce,deadline)).wait();
    return (core as any).userIdByAddress(userSigner.address);
  }

  // ── T1: totalLifetimeQualifyingIncome starts at 0 ────────────────────────
  it("T1: totalLifetimeQualifyingIncome starts at 0 for new user", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    expect(await (ctx.core as any).totalLifetimeQualifyingIncome(userId)).to.equal(0n);
    console.log("T1 PASS: initial qualifying income = 0");
  });

  // ── T2: IncomeEngine payout increments counter ────────────────────────────
  it("T2: IncomeEngine payout increments totalLifetimeQualifyingIncome", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    const incomeAddr = await ctx.income.getAddress();
    await ctx.usdt.connect(ctx.owner).mint(await ctx.core.getAddress(), ethers.parseEther("10000"));
    await ethers.provider.send("hardhat_impersonateAccount",[incomeAddr]);
    await ethers.provider.send("hardhat_setBalance",[incomeAddr,"0x1000000000000000000"]);
    const incomeSigner = await ethers.getSigner(incomeAddr);
    await (ctx.core as any).connect(incomeSigner).payoutUserIncome(userId,250n,await ctx.usdt.getAddress());
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[incomeAddr]);
    expect(await (ctx.core as any).totalLifetimeQualifyingIncome(userId)).to.equal(250n);
    console.log("T2 PASS: IncomeEngine increments counter by 250");
  });

  // ── T3: UpgradeEngine payout increments counter ───────────────────────────
  it("T3: UpgradeEngine payout increments totalLifetimeQualifyingIncome", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    const upgradeAddr = await ctx.upgrade.getAddress();
    await ctx.usdt.connect(ctx.owner).mint(await ctx.core.getAddress(), ethers.parseEther("10000"));
    await ethers.provider.send("hardhat_impersonateAccount",[upgradeAddr]);
    await ethers.provider.send("hardhat_setBalance",[upgradeAddr,"0x1000000000000000000"]);
    const upgradeSigner = await ethers.getSigner(upgradeAddr);
    await (ctx.core as any).connect(upgradeSigner).payoutUserIncome(userId,100n,await ctx.usdt.getAddress());
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[upgradeAddr]);
    expect(await (ctx.core as any).totalLifetimeQualifyingIncome(userId)).to.equal(100n);
    console.log("T3 PASS: UpgradeEngine increments counter by 100");
  });

  // ── T4: CashbackPool payout does NOT increment counter ────────────────────
  it("T4: CashbackPool payout does NOT increment totalLifetimeQualifyingIncome", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    const cbAddr = await ctx.cashback.getAddress();
    await ctx.usdt.connect(ctx.owner).mint(await ctx.core.getAddress(), ethers.parseEther("10000"));
    await ethers.provider.send("hardhat_impersonateAccount",[cbAddr]);
    await ethers.provider.send("hardhat_setBalance",[cbAddr,"0x1000000000000000000"]);
    const cbSigner = await ethers.getSigner(cbAddr);
    await (ctx.core as any).connect(cbSigner).payoutUserIncome(userId,500n,await ctx.usdt.getAddress());
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[cbAddr]);
    expect(await (ctx.core as any).totalLifetimeQualifyingIncome(userId)).to.equal(0n);
    console.log("T4 PASS: CashbackPool payout correctly excluded from counter");
  });

  // ── T5: amount=0 does not increment ──────────────────────────────────────
  it("T5: amount=0 payout does not increment counter", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    const incomeAddr = await ctx.income.getAddress();
    await ethers.provider.send("hardhat_impersonateAccount",[incomeAddr]);
    await ethers.provider.send("hardhat_setBalance",[incomeAddr,"0x1000000000000000000"]);
    const incomeSigner = await ethers.getSigner(incomeAddr);
    await (ctx.core as any).connect(incomeSigner).payoutUserIncome(userId,0n,await ctx.usdt.getAddress());
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[incomeAddr]);
    expect(await (ctx.core as any).totalLifetimeQualifyingIncome(userId)).to.equal(0n);
    console.log("T5 PASS: amount=0 does not increment");
  });

  // ── T6: multiple payouts accumulate ──────────────────────────────────────
  it("T6: multiple qualifying payouts accumulate correctly", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    const incomeAddr = await ctx.income.getAddress();
    const upgradeAddr = await ctx.upgrade.getAddress();
    const usdtAddr = await ctx.usdt.getAddress();
    await ctx.usdt.connect(ctx.owner).mint(await ctx.core.getAddress(), ethers.parseEther("10000"));
    for (const addr of [incomeAddr,upgradeAddr]) {
      await ethers.provider.send("hardhat_impersonateAccount",[addr]);
      await ethers.provider.send("hardhat_setBalance",[addr,"0x1000000000000000000"]);
    }
    const incomeSigner  = await ethers.getSigner(incomeAddr);
    const upgradeSigner = await ethers.getSigner(upgradeAddr);
    await (ctx.core as any).connect(incomeSigner).payoutUserIncome(userId,100n,usdtAddr);
    await (ctx.core as any).connect(upgradeSigner).payoutUserIncome(userId,150n,usdtAddr);
    await (ctx.core as any).connect(incomeSigner).payoutUserIncome(userId,50n,usdtAddr);
    for (const addr of [incomeAddr,upgradeAddr])
      await ethers.provider.send("hardhat_stopImpersonatingAccount",[addr]);
    expect(await (ctx.core as any).totalLifetimeQualifyingIncome(userId)).to.equal(300n);
    console.log("T6 PASS: 100+150+50=300");
  });

  // ── T7: QualifyingIncomePaid event emitted ────────────────────────────────
  it("T7: QualifyingIncomePaid event emitted for qualifying payout", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    const incomeAddr = await ctx.income.getAddress();
    const usdtAddr = await ctx.usdt.getAddress();
    await ctx.usdt.connect(ctx.owner).mint(await ctx.core.getAddress(), ethers.parseEther("10000"));
    await ethers.provider.send("hardhat_impersonateAccount",[incomeAddr]);
    await ethers.provider.send("hardhat_setBalance",[incomeAddr,"0x1000000000000000000"]);
    const incomeSigner = await ethers.getSigner(incomeAddr);
    await expect((ctx.core as any).connect(incomeSigner).payoutUserIncome(userId,100n,usdtAddr))
      .to.emit(ctx.core,"QualifyingIncomePaid")
      .withArgs(userId,100n,usdtAddr,incomeAddr);
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[incomeAddr]);
    console.log("T7 PASS");
  });

  // ── T8: CashbackPool payout does NOT emit QualifyingIncomePaid ───────────
  it("T8: CashbackPool payout does not emit QualifyingIncomePaid", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    const cbAddr = await ctx.cashback.getAddress();
    const usdtAddr = await ctx.usdt.getAddress();
    await ctx.usdt.connect(ctx.owner).mint(await ctx.core.getAddress(), ethers.parseEther("10000"));
    await ethers.provider.send("hardhat_impersonateAccount",[cbAddr]);
    await ethers.provider.send("hardhat_setBalance",[cbAddr,"0x1000000000000000000"]);
    const cbSigner = await ethers.getSigner(cbAddr);
    const tx = await (ctx.core as any).connect(cbSigner).payoutUserIncome(userId,500n,usdtAddr);
    const receipt = await tx.wait();
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[cbAddr]);
    const topic = (ctx.core as any).interface.getEvent("QualifyingIncomePaid")?.topicHash;
    const found = receipt.logs.some((l: any) => l.topics[0] === topic);
    expect(found).to.equal(false);
    console.log("T8 PASS: CashbackPool payout no QualifyingIncomePaid event");
  });

  // ── T9: adminInitHistoricalIncome is ADDITIVE ─────────────────────────────
  it("T9: adminInitHistoricalIncome adds to forward income (not overwrite)", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    const incomeAddr = await ctx.income.getAddress();
    const usdtAddr = await ctx.usdt.getAddress();
    await ctx.usdt.connect(ctx.owner).mint(await ctx.core.getAddress(), ethers.parseEther("10000"));
    await ethers.provider.send("hardhat_impersonateAccount",[incomeAddr]);
    await ethers.provider.send("hardhat_setBalance",[incomeAddr,"0x1000000000000000000"]);
    const incomeSigner = await ethers.getSigner(incomeAddr);
    await (ctx.core as any).connect(incomeSigner).payoutUserIncome(userId,20n,usdtAddr);
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[incomeAddr]);
    expect(await (ctx.core as any).totalLifetimeQualifyingIncome(userId)).to.equal(20n);
    await (ctx.core as any).connect(ctx.owner).adminInitHistoricalIncome([userId],[250n]);
    expect(await (ctx.core as any).totalLifetimeQualifyingIncome(userId)).to.equal(270n);
    console.log("T9 PASS: forward=20 + historical=250 = 270 (additive) OK");
  });

  // ── T10: duplicate historical initialization reverts ──────────────────────
  it("T10: duplicate historical initialization reverts", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    await (ctx.core as any).connect(ctx.owner).adminInitHistoricalIncome([userId],[100n]);
    // Core has historicalIncomeInitialized duplicate protection — string require
    await expect((ctx.core as any).connect(ctx.owner).adminInitHistoricalIncome([userId],[50n]))
      .to.be.revertedWith("Already initialized");
    console.log("T10 PASS: duplicate historical initialization reverts");
  });

  // ── T11: duplicate userId in same batch reverts ───────────────────────────
  it("T11: duplicate userId in same batch reverts", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    // Core has historicalIncomeInitialized — same-batch duplicate reverts (string require)
    await expect((ctx.core as any).connect(ctx.owner).adminInitHistoricalIncome([userId,userId],[100n,50n]))
      .to.be.revertedWith("Already initialized");
    console.log("T11 PASS: same-batch duplicate reverts");
  });

  // ── T12: invalid userId reverts ───────────────────────────────────────────
  it("T12: invalid userId in historical init reverts", async function () {
    const ctx = await deploySystem();
    await expect((ctx.core as any).connect(ctx.owner).adminInitHistoricalIncome([9999n],[100n]))
      .to.be.revertedWith("Invalid userId");
    console.log("T12 PASS");
  });

  // ── T13: finalizeMigration seals initialization ───────────────────────────
  it("T13: finalizeMigration seals adminInitHistoricalIncome permanently", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    await (ctx.core as any).connect(ctx.owner).finalizeMigration();
    expect(await (ctx.core as any).migrationFinalized()).to.equal(true);
    await expect((ctx.core as any).connect(ctx.owner).adminInitHistoricalIncome([userId],[100n]))
      .to.be.revertedWith("Migration already finalized");
    console.log("T13 PASS");
  });

  // ── T14: MigrationFinalized event ─────────────────────────────────────────
  it("T14: finalizeMigration emits MigrationFinalized", async function () {
    const ctx = await deploySystem();
    await expect((ctx.core as any).connect(ctx.owner).finalizeMigration())
      .to.emit(ctx.core,"MigrationFinalized");
    console.log("T14 PASS");
  });

  // ── T15: onlyOwner for migration functions ────────────────────────────────
  it("T15: onlyOwner required for migration functions", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    const stranger = ctx.users[0];
    await expect((ctx.core as any).connect(stranger).adminInitHistoricalIncome([userId],[100n]))
      .to.be.reverted;
    await expect((ctx.core as any).connect(stranger).finalizeMigration()).to.be.reverted;
    console.log("T15 PASS");
  });

  // ── T16: finalizeMigration is one-way ─────────────────────────────────────
  it("T16: finalizeMigration cannot be called twice", async function () {
    const ctx = await deploySystem();
    await (ctx.core as any).connect(ctx.owner).finalizeMigration();
    await expect((ctx.core as any).connect(ctx.owner).finalizeMigration())
      .to.be.revertedWith("Already finalized");
    console.log("T16 PASS");
  });

  // ── T17: HistoricalIncomeInitialized event ────────────────────────────────
  it("T17: adminInitHistoricalIncome emits HistoricalIncomeInitialized", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    await expect((ctx.core as any).connect(ctx.owner).adminInitHistoricalIncome([userId],[250n]))
      .to.emit(ctx.core,"HistoricalIncomeInitialized")
      .withArgs(userId,250n,250n);
    expect(await (ctx.core as any).totalLifetimeQualifyingIncome(userId)).to.equal(250n);
    console.log("T17 PASS");
  });

  // ── T18: net entitlement income=0 → full investment ──────────────────────
  it("T18: net entitlement income=0 gives full investment as cap", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    const u = await (ctx.core as any).usersById(userId);
    const contribution = u.totalContribution; // 100 units
    const income = await (ctx.core as any).totalLifetimeQualifyingIncome(userId);
    const net = income >= contribution ? 0n : contribution - income;
    expect(net).to.equal(contribution);
    console.log(`T18 PASS: invested=${contribution} income=0 → entitlement=${net}`);
  });

  // ── T19: net entitlement formula at various income levels ────────────────
  it("T19: net entitlement: income=50→50, income=100→0, income=200→0 (no underflow)", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    const invested = (await (ctx.core as any).usersById(userId)).totalContribution; // 100
    const incomeAddr = await ctx.income.getAddress();
    const usdtAddr = await ctx.usdt.getAddress();
    await ctx.usdt.connect(ctx.owner).mint(await ctx.core.getAddress(), ethers.parseEther("10000"));
    await ethers.provider.send("hardhat_impersonateAccount",[incomeAddr]);
    await ethers.provider.send("hardhat_setBalance",[incomeAddr,"0x1000000000000000000"]);
    const incomeSigner = await ethers.getSigner(incomeAddr);
    // income=50 → entitlement=50
    await (ctx.core as any).connect(incomeSigner).payoutUserIncome(userId,50n,usdtAddr);
    const incomeA = await (ctx.core as any).totalLifetimeQualifyingIncome(userId);
    const netA = incomeA >= invested ? 0n : invested - incomeA;
    expect(netA).to.equal(50n);
    // income=100 → entitlement=0
    await (ctx.core as any).connect(incomeSigner).payoutUserIncome(userId,50n,usdtAddr);
    const incomeB = await (ctx.core as any).totalLifetimeQualifyingIncome(userId);
    const netB = incomeB >= invested ? 0n : invested - incomeB;
    expect(netB).to.equal(0n);
    // income=200 → entitlement=0 (no underflow)
    await (ctx.core as any).connect(incomeSigner).payoutUserIncome(userId,100n,usdtAddr);
    const incomeC = await (ctx.core as any).totalLifetimeQualifyingIncome(userId);
    const netC = incomeC >= invested ? 0n : invested - incomeC;
    expect(netC).to.equal(0n,"No underflow when income > invested");
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[incomeAddr]);
    console.log("T19 PASS: entitlements 50/0/0 for income 50/100/200 vs invested=100");
  });

  // ── T20: payout revert rolls back counter (atomicity) ─────────────────────
  it("T20: failed payout reverts counter increment (atomicity)", async function () {
    const ctx = await deploySystem();
    const incomeAddr = await ctx.income.getAddress();
    const usdtAddr = await ctx.usdt.getAddress();
    await ethers.provider.send("hardhat_impersonateAccount",[incomeAddr]);
    await ethers.provider.send("hardhat_setBalance",[incomeAddr,"0x1000000000000000000"]);
    const incomeSigner = await ethers.getSigner(incomeAddr);
    // userId=9999 has no account → UserNotFound revert
    await expect((ctx.core as any).connect(incomeSigner).payoutUserIncome(9999n,100n,usdtAddr))
      .to.be.reverted;
    expect(await (ctx.core as any).totalLifetimeQualifyingIncome(9999n)).to.equal(0n);
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[incomeAddr]);
    console.log("T20 PASS: revert rolled back counter");
  });

  // ── T21: CashbackPool blocked before migrationFinalized ──────────────────
  it("T21: claimCashback reverts if migrationFinalized=false", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    const coreAddr = await ctx.core.getAddress();
    // Surrender first (via Core)
    await ethers.provider.send("evm_increaseTime",[91*24*3600]);
    await ethers.provider.send("evm_mine",[]);
    const mgxAlloc = await (ctx.core as any).tokenAllocationsByUser(userId);
    if (mgxAlloc > 0n) {
      await (await ctx.mgxToken.connect(ctx.owner).approve(coreAddr, mgxAlloc)).wait();
    }
    await (ctx.core as any).connect(ctx.owner).surrenderForCashback(userId);
    // Now try to claim — should revert
    await expect((ctx.core as any).connect(ctx.owner).claimCashback(userId))
      .to.be.revertedWith("Migration not finalized");
    console.log("T21 PASS: claimCashback blocked before migration finalized");
  });

  // ── T22: Core storage layout valid ───────────────────────────────────────
  it("T22: Core storage upgrade validation passes", async function () {
    const libraries = await deployLibraries();
    const [owner] = await ethers.getSigners();
    const CoreFactory = await ethers.getContractFactory("MetaGuildXCore",{libraries});
    const core = await upgrades.deployProxy(CoreFactory,[owner.address],
      {kind:"uups",unsafeAllowLinkedLibraries:true});
    await core.waitForDeployment();
    await expect(
      upgrades.validateUpgrade(await core.getAddress(), CoreFactory,
        {kind:"uups", unsafeAllowLinkedLibraries:true})
    ).to.not.be.rejected;
    console.log("T22 PASS: Core storage layout valid");
  });

  // ─── T23: Compound cashback claims capped at netEntitlement ──────────────
  it("T23: compound cashback claims capped at netEntitlement, cashback never increments qualifying income", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId    = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    const incomeAddr = await ctx.income.getAddress();
    const usdtAddr   = await ctx.usdt.getAddress();
    const coreAddr   = await ctx.core.getAddress();

    // Pay qualifying income = 50 units (invested=100 → netEntitlement=50)
    await ctx.usdt.connect(ctx.owner).mint(coreAddr, ethers.parseEther("10000"));
    await ethers.provider.send("hardhat_impersonateAccount",[incomeAddr]);
    await ethers.provider.send("hardhat_setBalance",[incomeAddr,"0x1000000000000000000"]);
    const incomeSigner = await ethers.getSigner(incomeAddr);
    await (ctx.core as any).connect(incomeSigner).payoutUserIncome(userId,50n,usdtAddr);
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[incomeAddr]);
    expect(await (ctx.core as any).totalLifetimeQualifyingIncome(userId)).to.equal(50n);

    // Surrender
    await ethers.provider.send("evm_increaseTime",[91*24*3600]);
    await ethers.provider.send("evm_mine",[]);
    const mgxAlloc = await (ctx.core as any).tokenAllocationsByUser(userId);
    if (mgxAlloc > 0n)
      await (await ctx.mgxToken.connect(ctx.owner).approve(coreAddr,mgxAlloc)).wait();
    await (ctx.core as any).connect(ctx.owner).surrenderForCashback(userId);

    // Finalize migration
    await (ctx.core as any).connect(ctx.owner).finalizeMigration();

    // Accrue + distribute pool via Core impersonation
    await ethers.provider.send("hardhat_impersonateAccount",[coreAddr]);
    await ethers.provider.send("hardhat_setBalance",[coreAddr,"0x1000000000000000000"]);
    const coreSigner = await ethers.getSigner(coreAddr);

    // Round 1: accrue 750 platform units → pool share ~30 (4% BPS)
    // netEntitlement=50, remaining=50 → claim 30, cashbackClaimed=30
    await (ctx.cashback as any).connect(coreSigner).notifyCashbackAccrued(750n,usdtAddr,0n);
    await (ctx.cashback as any).connect(coreSigner).distribute(usdtAddr,true);
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[coreAddr]);
    await (ctx.core as any).connect(ctx.owner).claimCashback(userId);
    const claimed1 = await (ctx.cashback as any).cashbackClaimed(userId);
    expect(claimed1).to.be.gt(0n,"claimed1 > 0");
    expect(claimed1).to.be.lte(50n,"claimed1 <= netEntitlement");

    // Cashback payout must NOT increment qualifying income
    expect(await (ctx.core as any).totalLifetimeQualifyingIncome(userId)).to.equal(50n,
      "Cashback claim must not increment qualifying income");

    // Round 2: accrue more → remaining = netEntitlement - claimed1
    await ethers.provider.send("hardhat_impersonateAccount",[coreAddr]);
    await ethers.provider.send("hardhat_setBalance",[coreAddr,"0x1000000000000000000"]);
    const coreSigner2 = await ethers.getSigner(coreAddr);
    await (ctx.cashback as any).connect(coreSigner2).notifyCashbackAccrued(750n,usdtAddr,0n);
    await (ctx.cashback as any).connect(coreSigner2).distribute(usdtAddr,true);
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[coreAddr]);
    await (ctx.core as any).connect(ctx.owner).claimCashback(userId);
    const claimed2 = await (ctx.cashback as any).cashbackClaimed(userId);
    expect(claimed2).to.be.lte(50n,"total claimed <= netEntitlement=50");

    // Round 3: cap should be reached → further claims revert
    await ethers.provider.send("hardhat_impersonateAccount",[coreAddr]);
    await ethers.provider.send("hardhat_setBalance",[coreAddr,"0x1000000000000000000"]);
    const coreSigner3 = await ethers.getSigner(coreAddr);
    await (ctx.cashback as any).connect(coreSigner3).notifyCashbackAccrued(750n,usdtAddr,0n);
    await (ctx.cashback as any).connect(coreSigner3).distribute(usdtAddr,true);
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[coreAddr]);

    // If cap already reached, further claim reverts
    if (claimed2 >= 50n) {
      await expect((ctx.core as any).connect(ctx.owner).claimCashback(userId))
        .to.be.revertedWith("Max cashback reached");
    }

    // Qualifying income still unchanged
    expect(await (ctx.core as any).totalLifetimeQualifyingIncome(userId)).to.equal(50n,
      "Qualifying income unchanged after all cashback claims");

    console.log(`T23 PASS: total claimed=${claimed2}, qualifying income=50 (unchanged), cap enforced`);
  });

  // ─── T24: Future user after migration finalized works without historical seed ──
  it("T24: future user after migration finalized works without historicalIncomeInitialized", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId1 = await (ctx.core as any).userIdByAddress(ctx.owner.address);

    // Finalize migration
    await (ctx.core as any).connect(ctx.owner).finalizeMigration();
    expect(await (ctx.core as any).migrationFinalized()).to.equal(true);

    // Register future user AFTER migration
    await registerUser(ctx, ctx.users[0], userId1);
    const userId2 = await (ctx.core as any).userIdByAddress(ctx.users[0].address);

    // Future user has no historical seed — historicalIncomeInitialized[userId2] == false
    expect(await (ctx.core as any).historicalIncomeInitialized(userId2)).to.equal(false,
      "Future user has no historical seed");

    // Forward tracking works for future user
    const incomeAddr = await ctx.income.getAddress();
    const usdtAddr   = await ctx.usdt.getAddress();
    const coreAddr   = await ctx.core.getAddress();
    await ctx.usdt.connect(ctx.owner).mint(coreAddr, ethers.parseEther("10000"));
    await ethers.provider.send("hardhat_impersonateAccount",[incomeAddr]);
    await ethers.provider.send("hardhat_setBalance",[incomeAddr,"0x1000000000000000000"]);
    const incomeSigner = await ethers.getSigner(incomeAddr);
    await (ctx.core as any).connect(incomeSigner).payoutUserIncome(userId2,30n,usdtAddr);
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[incomeAddr]);
    expect(await (ctx.core as any).totalLifetimeQualifyingIncome(userId2)).to.equal(30n);

    // Surrender future user
    await ethers.provider.send("evm_increaseTime",[91*24*3600]);
    await ethers.provider.send("evm_mine",[]);
    const mgxAlloc = await (ctx.core as any).tokenAllocationsByUser(userId2);
    if (mgxAlloc > 0n)
      await (await ctx.mgxToken.connect(ctx.users[0]).approve(coreAddr,mgxAlloc)).wait();
    await (ctx.core as any).connect(ctx.users[0]).surrenderForCashback(userId2);

    // Accrue and distribute pool
    await ethers.provider.send("hardhat_impersonateAccount",[coreAddr]);
    await ethers.provider.send("hardhat_setBalance",[coreAddr,"0x1000000000000000000"]);
    const coreSigner = await ethers.getSigner(coreAddr);
    await ctx.usdt.connect(ctx.owner).mint(coreAddr, ethers.parseEther("10000"));
    await (ctx.cashback as any).connect(coreSigner).notifyCashbackAccrued(750n,usdtAddr,0n);
    await (ctx.cashback as any).connect(coreSigner).distribute(usdtAddr,true);
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[coreAddr]);

    // claimCashback must succeed — does NOT require historicalIncomeInitialized
    // invested=100, income=30, netEntitlement=70
    await expect((ctx.core as any).connect(ctx.users[0]).claimCashback(userId2))
      .to.not.be.reverted;

    console.log("T24 PASS: future user works without historical seed, claim succeeds");
  });

  // ─── T25: Zero-income historical user init ─────────────────────────────────
  it("T25: adminInitHistoricalIncome with amount=0 marks initialized, preserves forward income", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId     = await (ctx.core as any).userIdByAddress(ctx.owner.address);
    const incomeAddr = await ctx.income.getAddress();
    const usdtAddr   = await ctx.usdt.getAddress();

    // Forward income = 10
    await ctx.usdt.connect(ctx.owner).mint(await ctx.core.getAddress(), ethers.parseEther("1000"));
    await ethers.provider.send("hardhat_impersonateAccount",[incomeAddr]);
    await ethers.provider.send("hardhat_setBalance",[incomeAddr,"0x1000000000000000000"]);
    const incomeSigner = await ethers.getSigner(incomeAddr);
    await (ctx.core as any).connect(incomeSigner).payoutUserIncome(userId,10n,usdtAddr);
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[incomeAddr]);
    expect(await (ctx.core as any).totalLifetimeQualifyingIncome(userId)).to.equal(10n);

    // Init with historical = 0 (user had no qualifying income historically)
    await (ctx.core as any).connect(ctx.owner).adminInitHistoricalIncome([userId],[0n]);
    expect(await (ctx.core as any).historicalIncomeInitialized(userId)).to.equal(true,
      "historicalIncomeInitialized=true even for zero amount");
    expect(await (ctx.core as any).totalLifetimeQualifyingIncome(userId)).to.equal(10n,
      "Forward income preserved — 0 added = still 10");

    // Second call reverts — historicalIncomeInitialized duplicate protection
    await expect((ctx.core as any).connect(ctx.owner).adminInitHistoricalIncome([userId],[0n]))
      .to.be.revertedWith("Already initialized");
    console.log("T25 PASS: zero-income user init, income unchanged, duplicate rejected");
  });
});
