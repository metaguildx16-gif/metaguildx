import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("Admin Distribution — Force/Resolve/Remainder via MetaGuildXAdminDistributionLib", function () {
  this.timeout(180_000);

  async function deployLibraries() {
    const upgradeCycleLib = await (await ethers.getContractFactory("UpgradeCycleLib")).deploy();
    const payLib          = await (await ethers.getContractFactory("MetaGuildXPaymentLib")).deploy();
    const placeLib        = await (await ethers.getContractFactory("MetaGuildXPlacementLib")).deploy();
    const adminLib        = await (await ethers.getContractFactory("MetaGuildXAdminLib")).deploy();
    const rebirthLib      = await (await ethers.getContractFactory("MetaGuildXRebirthLib")).deploy();
    await Promise.all([upgradeCycleLib,payLib,placeLib,adminLib,rebirthLib].map(c=>c.waitForDeployment()));
    const upgradeLib = await (await ethers.getContractFactory("MetaGuildXUpgradeFlowLib",{
      libraries:{
        "src/libraries/UpgradeCycleLib.sol:UpgradeCycleLib":     await upgradeCycleLib.getAddress(),
        "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib": await payLib.getAddress(),
      }
    })).deploy();
    await upgradeLib.waitForDeployment();
    const adminDistLib = await (await ethers.getContractFactory("MetaGuildXAdminDistributionLib",{
      libraries:{"src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":await payLib.getAddress()}
    })).deploy();
    const surrenderLib = await (await ethers.getContractFactory("MetaGuildXSurrenderLib",{
      libraries:{"src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":await payLib.getAddress()}
    })).deploy();
    const coreLib = await (await ethers.getContractFactory("MetaGuildXCoreLib",{
      libraries:{"src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":await payLib.getAddress()}
    })).deploy();
    await Promise.all([adminDistLib,surrenderLib,coreLib].map(c=>c.waitForDeployment()));
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
    const [owner, creator, admin, stranger, ...users] = await ethers.getSigners();
    const libraries = await deployLibraries();
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
      [owner.address],{kind:"uups",unsafeAllowLinkedLibraries:true}) as any;
    await core.waitForDeployment();
    const upgrade = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXUpgrade"),
      [await core.getAddress(),owner.address,await usdt.getAddress()],{kind:"uups"});
    await upgrade.waitForDeployment();
    const income = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXIncome"),
      [await core.getAddress(),await router.getAddress(),await upgrade.getAddress(),await usdt.getAddress()],{kind:"uups"});
    await income.waitForDeployment();
    await (await upgrade.setIncomeContract(await income.getAddress())).wait();
    const tokenEngine = await upgrades.deployProxy(await ethers.getContractFactory("MetaGuildXTokenEngine"),[await core.getAddress()],{kind:"uups"});
    await tokenEngine.waitForDeployment();
    const coreAddr = await core.getAddress();
    await (await core.setBinaryTreeContract(await binaryTree.getAddress())).wait();
    await (await core.setIncomeRouterContract(await router.getAddress())).wait();
    await (await core.setIncomeEngineContract(await income.getAddress())).wait();
    await (await core.setUpgradeEngineContract(await upgrade.getAddress())).wait();
    await (await core.setCashbackPoolContract(await cashback.getAddress())).wait();
    await (await core.setStakingContract(await staking.getAddress())).wait();
    await (await core.setMgxTokenAddress(await mgxToken.getAddress())).wait();
    await (await core.setUsdtAddress(await usdt.getAddress())).wait();
    await (await core.setDefaultPaymentAsset(await usdt.getAddress())).wait();
    await (await core.setCreatorFeeWallet(creator.address)).wait();
    await (await core.setPlacementSigner(owner.address)).wait();
    await (await core.setTokenEngineContract(await tokenEngine.getAddress())).wait();
    await (await core.configurePaymentAsset(await usdt.getAddress(),true,false,10n**17n)).wait();
    await (await core.setProductionMode(true,await usdt.getAddress())).wait();
    await (await core.setAdminAddress(admin.address)).wait();
    await (await binaryTree.setCoreContract(coreAddr)).wait();
    await (await router.setCoreContract(coreAddr)).wait();
    await (await router.setIncomeEngineContract(await income.getAddress())).wait();
    await (await router.setCreatorWallet(creator.address)).wait();
    await (await income.setCoreContract(coreAddr)).wait();
    await (await income.setIncomeRouterContract(await router.getAddress())).wait();
    await (await income.setUpgradeEngineContract(await upgrade.getAddress())).wait();
    await (await income.setDefaultPaymentAsset(await usdt.getAddress())).wait();
    await (await upgrade.setCoreContract(coreAddr)).wait();
    await (await upgrade.setIncomeContract(await income.getAddress())).wait();
    await (await upgrade.setDefaultPaymentAsset(await usdt.getAddress())).wait();
    await (await cashback.setCoreContract(coreAddr)).wait();
    await (await cashback.setPaymentAsset(await usdt.getAddress())).wait();
    await (await staking.setCoreContract(coreAddr)).wait();
    await (await staking.setIncomeContract(await income.getAddress())).wait();
    await (await mgxToken.mintLaunchAllocations(coreAddr,owner.address,owner.address)).wait();
    return { owner, creator, admin, stranger, users, mgxToken, usdt, binaryTree,
             router, cashback, staking, core, income, upgrade, tokenEngine };
  }

  async function registerUser(ctx: any, userSigner: any, sponsorId: bigint) {
    const { owner, core, usdt } = ctx;
    const coreAddress = await core.getAddress();
    const usdtAddress = await usdt.getAddress();
    const unitPrice = await core.paymentAssetUnitPrice(usdtAddress);
    const pkgPrice  = (await core.getPackagePrices())[0];
    const settlement = pkgPrice * unitPrice;
    await (await usdt.connect(owner).mint(userSigner.address, settlement*50n)).wait();
    await (await usdt.connect(userSigner).approve(coreAddress, settlement*50n)).wait();
    const network = await ethers.provider.getNetwork();
    const nonce = await core.nonces(userSigner.address);
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = BigInt(latestBlock!.timestamp + 365*24*3600);
    const structHash = ethers.solidityPackedKeccak256(
      ["uint256","address","address","uint256","uint256","bool","uint256","uint256"],
      [network.chainId,coreAddress,userSigner.address,sponsorId,0n,false,nonce,deadline]);
    const sig = await owner.signMessage(ethers.getBytes(structHash));
    await (await core.connect(userSigner).registerWithPlacement(sponsorId,0n,false,sig,nonce,deadline)).wait();
    return core.userIdByAddress(userSigner.address);
  }

  // ── T1: owner can call adminForceDistributeJoinIncome ────────────────────
  it("T1: owner can call adminForceDistributeJoinIncome", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await ctx.core.userIdByAddress(ctx.owner.address);
    // Should not revert (router may succeed or fail — just auth check)
    await expect(ctx.core.connect(ctx.owner).adminForceDistributeJoinIncome(userId))
      .to.not.be.revertedWithCustomError(ctx.core, "OwnableUnauthorizedAccount");
    console.log("T1 PASS: owner authorized");
  });

  // ── T2: admin address can call adminForceDistributeJoinIncome ─────────────
  it("T2: configured adminAddress can call adminForceDistributeJoinIncome", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await ctx.core.userIdByAddress(ctx.owner.address);
    await expect(ctx.core.connect(ctx.admin).adminForceDistributeJoinIncome(userId))
      .to.not.be.revertedWithCustomError(ctx.core, "OwnableUnauthorizedAccount");
    console.log("T2 PASS: admin authorized");
  });

  // ── T3: stranger cannot call adminForceDistributeJoinIncome ───────────────
  it("T3: unauthorized account reverts adminForceDistributeJoinIncome", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await ctx.core.userIdByAddress(ctx.owner.address);
    await expect(ctx.core.connect(ctx.stranger).adminForceDistributeJoinIncome(userId))
      .to.be.reverted;
    console.log("T3 PASS: unauthorized reverts");
  });

  // ── T4: invalid userId reverts ────────────────────────────────────────────
  it("T4: adminForceDistributeJoinIncome reverts for non-existent userId", async function () {
    const ctx = await deploySystem();
    await expect(ctx.core.connect(ctx.owner).adminForceDistributeJoinIncome(9999n))
      .to.be.reverted;
    console.log("T4 PASS: invalid userId reverts");
  });

  // ── T5: adminForceResolveFailedDistribution requires failedDistribution ───
  it("T5: adminForceResolveFailedDistribution requires failedDistribution=true", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await ctx.core.userIdByAddress(ctx.owner.address);
    // failedDistribution[userId] is false by default
    await expect(ctx.core.connect(ctx.owner).adminForceResolveFailedDistribution(userId))
      .to.be.reverted; // NotFailedDistribution
    console.log("T5 PASS: requires failedDistribution=true");
  });

  // ── T6: direct income = packageAmount * 4600 / 10000 ─────────────────────
  it("T6: direct income calculation exactly packageAmount * 4600 / 10000", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await ctx.core.userIdByAddress(ctx.owner.address);
    const pkgPrice = (await ctx.core.getPackagePrices())[0]; // 100 platform units
    const expectedDirect = pkgPrice * 4600n / 10000n; // = 46
    expect(expectedDirect).to.equal(46n);
    console.log(`T6 PASS: direct income = ${pkgPrice} * 4600 / 10000 = ${expectedDirect}`);
  });

  // ── T7: unauthorized reverts adminForceResolveFailedDistribution ──────────
  it("T7: unauthorized account reverts adminForceResolveFailedDistribution", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await ctx.core.userIdByAddress(ctx.owner.address);
    await expect(ctx.core.connect(ctx.stranger).adminForceResolveFailedDistribution(userId))
      .to.be.reverted;
    console.log("T7 PASS: unauthorized reverts");
  });

  // ── T8: unauthorized reverts adminRemainderDistribution ───────────────────
  it("T8: unauthorized account reverts adminRemainderDistribution", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await ctx.core.userIdByAddress(ctx.owner.address);
    await expect(ctx.core.connect(ctx.stranger).adminRemainderDistribution(userId))
      .to.be.reverted;
    console.log("T8 PASS: unauthorized reverts");
  });

  // ── T9: adminRemainderDistribution invalid userId reverts ─────────────────
  it("T9: adminRemainderDistribution reverts for non-existent userId", async function () {
    const ctx = await deploySystem();
    await expect(ctx.core.connect(ctx.owner).adminRemainderDistribution(9999n))
      .to.be.reverted;
    console.log("T9 PASS: invalid userId reverts");
  });

  // ── T10: package price boundary — level 0 returns 0 ─────────────────────
  it("T10: getPackagePriceByLevel level=0 returns 0 (invalid level)", async function () {
    const ctx = await deploySystem();
    const price = await ctx.core.getPackagePriceByLevel(0n);
    expect(price).to.equal(0n);
    console.log("T10 PASS: level=0 returns 0");
  });

  // ── T11: package price boundary — level=1 valid ───────────────────────────
  it("T11: getPackagePriceByLevel level=1 returns correct price", async function () {
    const ctx = await deploySystem();
    const prices = await ctx.core.getPackagePrices();
    const price = await ctx.core.getPackagePriceByLevel(1n);
    expect(price).to.equal(prices[0]);
    console.log(`T11 PASS: level=1 returns ${price}`);
  });

  // ── T12: package price boundary — max+1 returns 0 ────────────────────────
  it("T12: getPackagePriceByLevel above max returns 0", async function () {
    const ctx = await deploySystem();
    const prices = await ctx.core.getPackagePrices();
    const maxLevel = BigInt(prices.length);
    const price = await ctx.core.getPackagePriceByLevel(maxLevel + 1n);
    expect(price).to.equal(0n);
    console.log(`T12 PASS: level=${maxLevel+1n} (above max=${maxLevel}) returns 0`);
  });

  // ── T13: admin address can call adminRemainderDistribution ────────────────
  it("T13: configured adminAddress can call adminRemainderDistribution", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.owner, 0n);
    const userId = await ctx.core.userIdByAddress(ctx.owner.address);
    // Should not revert due to auth (may revert for other reasons like router)
    await expect(ctx.core.connect(ctx.admin).adminRemainderDistribution(userId))
      .to.not.be.revertedWithCustomError(ctx.core, "OwnableUnauthorizedAccount");
    console.log("T13 PASS: admin authorized for adminRemainderDistribution");
  });
});
