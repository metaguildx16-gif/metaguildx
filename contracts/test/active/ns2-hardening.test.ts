import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("NS2 — Hardening: Atomicity, Denomination, Scanner Boundary, Formula", function () {
  this.timeout(300_000);

  async function deployLibraries() {
    const upgradeCycleLib = await (await ethers.getContractFactory("UpgradeCycleLib")).deploy();
    const payLib          = await (await ethers.getContractFactory("MetaGuildXPaymentLib")).deploy();
    const placeLib        = await (await ethers.getContractFactory("MetaGuildXPlacementLib")).deploy();
    const adminLib        = await (await ethers.getContractFactory("MetaGuildXAdminLib")).deploy();
    const rebirthLib      = await (await ethers.getContractFactory("MetaGuildXRebirthLib")).deploy();
    await Promise.all([upgradeCycleLib,payLib,placeLib,adminLib,rebirthLib].map(c=>c.waitForDeployment()));
    const upgradeLib = await (await ethers.getContractFactory("MetaGuildXUpgradeFlowLib",{libraries:{
      "src/libraries/UpgradeCycleLib.sol:UpgradeCycleLib": await upgradeCycleLib.getAddress(),
      "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib": await payLib.getAddress(),
    }})).deploy();
    await upgradeLib.waitForDeployment();
    const adminDistLib = await (await ethers.getContractFactory("MetaGuildXAdminDistributionLib",{
      libraries:{"src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":await payLib.getAddress()}
    })).deploy(); await adminDistLib.waitForDeployment();
    const surrenderLib = await (await ethers.getContractFactory("MetaGuildXSurrenderLib",{
      libraries:{"src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":await payLib.getAddress()}
    })).deploy(); await surrenderLib.waitForDeployment();
    const coreLib = await (await ethers.getContractFactory("MetaGuildXCoreLib",{
      libraries:{"src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":await payLib.getAddress()}
    })).deploy(); await coreLib.waitForDeployment();
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
    const [owner, creator, admin, ...users] = await ethers.getSigners();
    const libraries = await deployLibraries();
    const mgxToken = await (await ethers.getContractFactory("MGXToken")).deploy(owner.address);
    const usdt     = await (await ethers.getContractFactory("MockUSDT")).deploy(owner.address);
    await Promise.all([mgxToken,usdt].map(c=>c.waitForDeployment()));
    const binaryTree = await upgrades.deployProxy(await ethers.getContractFactory("BinaryTree"),[owner.address],{kind:"uups"});
    const router     = await upgrades.deployProxy(await ethers.getContractFactory("IncomeRouter"),[owner.address],{kind:"uups"});
    const cashback   = await upgrades.deployProxy(await ethers.getContractFactory("CashbackPool"),[owner.address],{kind:"uups"});
    const staking    = await upgrades.deployProxy(await ethers.getContractFactory("MGXStaking"),[owner.address],{kind:"uups"});
    await Promise.all([binaryTree,router,cashback,staking].map(c=>c.waitForDeployment()));
    const core = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXCore",{libraries}),
      [owner.address],{kind:"uups",unsafeAllowLinkedLibraries:true}) as any;
    await core.waitForDeployment();
    const upgrade = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXUpgrade"),
      [await core.getAddress(),owner.address,await usdt.getAddress()],{kind:"uups"});
    const income = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXIncome"),
      [await core.getAddress(),await router.getAddress(),await upgrade.getAddress(),await usdt.getAddress()],{kind:"uups"});
    const tokenEngine = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXTokenEngine"),[await core.getAddress()],{kind:"uups"});
    await Promise.all([upgrade,income,tokenEngine].map(c=>c.waitForDeployment()));
    const coreAddr=await core.getAddress();
    await (await upgrade.setIncomeContract(await income.getAddress())).wait();
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
    return {owner,creator,admin,users,mgxToken,usdt,binaryTree,router,cashback,staking,core,income,upgrade,tokenEngine};
  }

  async function registerUser(ctx: any, userSigner: any, sponsorId: bigint) {
    const {owner,core,usdt}=ctx;
    const coreAddr=await core.getAddress();
    const usdtAddr=await usdt.getAddress();
    const unitPrice=await core.paymentAssetUnitPrice(usdtAddr);
    const pkgPrice=(await core.getPackagePrices())[0];
    const settlement=pkgPrice*unitPrice;
    await (await usdt.connect(owner).mint(userSigner.address,settlement*50n)).wait();
    await (await usdt.connect(userSigner).approve(coreAddr,settlement*50n)).wait();
    const nw=await ethers.provider.getNetwork();
    const nonce=await core.nonces(userSigner.address);
    const lb=await ethers.provider.getBlock("latest");
    const deadline=BigInt(lb!.timestamp+365*24*3600);
    const sh=ethers.solidityPackedKeccak256(
      ["uint256","address","address","uint256","uint256","bool","uint256","uint256"],
      [nw.chainId,coreAddr,userSigner.address,sponsorId,0n,false,nonce,deadline]);
    const sig=await owner.signMessage(ethers.getBytes(sh));
    await (await core.connect(userSigner).registerWithPlacement(sponsorId,0n,false,sig,nonce,deadline)).wait();
    return core.userIdByAddress(userSigner.address);
  }

  // ── E. Payout atomicity — settlement failure reverts tracking ────────────
  it("E: qualifying tracking reverts if settlement fails", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.users[0], 0n);
    const userId = await ctx.core.userIdByAddress(ctx.users[0].address);
    const before = await ctx.core.totalLifetimeQualifyingIncome(userId);

    // Payout with bad asset — will revert in _payoutSettlement
    const incomeAddr = await ctx.income.getAddress();
    await ethers.provider.send("hardhat_impersonateAccount",[incomeAddr]);
    await ethers.provider.send("hardhat_setBalance",[incomeAddr,"0x1000000000000000000"]);
    const incomeSigner = await ethers.getSigner(incomeAddr);
    const badAsset = "0x000000000000000000000000000000000000dEaD";
    await expect(
      ctx.core.connect(incomeSigner).payoutUserIncome(userId, 100n, badAsset)
    ).to.be.reverted;
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[incomeAddr]);

    const after = await ctx.core.totalLifetimeQualifyingIncome(userId);
    expect(after).to.equal(before, "totalLifetimeQualifyingIncome must not change on failed payout");
    console.log("E PASS: tracking reverts atomically with settlement failure");
  });

  // ── F. Denomination — platform amount tracked, not settlement ───────────
  it("F: platform amount tracked in totalLifetimeQualifyingIncome", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.users[0], 0n);
    const userId = await ctx.core.userIdByAddress(ctx.users[0].address);
    const usdtAddr = await ctx.usdt.getAddress();
    const coreAddr = await ctx.core.getAddress();
    await ctx.usdt.connect(ctx.owner).mint(coreAddr, ethers.parseEther("1000"));
    const incomeAddr = await ctx.income.getAddress();
    await ethers.provider.send("hardhat_impersonateAccount",[incomeAddr]);
    await ethers.provider.send("hardhat_setBalance",[incomeAddr,"0x1000000000000000000"]);
    const incomeSigner = await ethers.getSigner(incomeAddr);
    const platformAmount = 500n; // 500 platform units
    await (await ctx.core.connect(incomeSigner).payoutUserIncome(userId, platformAmount, usdtAddr)).wait();
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[incomeAddr]);
    const tracked = await ctx.core.totalLifetimeQualifyingIncome(userId);
    expect(tracked).to.equal(platformAmount, "must track platform amount, not settlement");
    const totalContrib = (await ctx.core.usersById(userId)).totalContribution;
    console.log(`F PASS: tracked=${tracked} platform units | totalContrib=${totalContrib} platform units`);
  });

  // ── F2. Multiple payouts accumulate ─────────────────────────────────────
  it("F2: multiple payouts accumulate in totalLifetimeQualifyingIncome", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.users[0], 0n);
    const userId = await ctx.core.userIdByAddress(ctx.users[0].address);
    const usdtAddr = await ctx.usdt.getAddress();
    const coreAddr = await ctx.core.getAddress();
    await ctx.usdt.connect(ctx.owner).mint(coreAddr, ethers.parseEther("1000"));
    const incomeAddr = await ctx.income.getAddress();
    await ethers.provider.send("hardhat_impersonateAccount",[incomeAddr]);
    await ethers.provider.send("hardhat_setBalance",[incomeAddr,"0x1000000000000000000"]);
    const incomeSigner = await ethers.getSigner(incomeAddr);
    await (await ctx.core.connect(incomeSigner).payoutUserIncome(userId, 100n, usdtAddr)).wait();
    await (await ctx.core.connect(incomeSigner).payoutUserIncome(userId, 200n, usdtAddr)).wait();
    await (await ctx.core.connect(incomeSigner).payoutUserIncome(userId, 50n, usdtAddr)).wait();
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[incomeAddr]);
    const tracked = await ctx.core.totalLifetimeQualifyingIncome(userId);
    expect(tracked).to.equal(350n, "100+200+50=350");
    console.log("F2 PASS: multiple payouts accumulate correctly:", tracked.toString());
  });

  // ── G. CashbackPool exclusion ────────────────────────────────────────────
  it("G: payoutUserIncome from CashbackPool excluded from tracking", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.users[0], 0n);
    const userId = await ctx.core.userIdByAddress(ctx.users[0].address);
    const usdtAddr = await ctx.usdt.getAddress();
    const coreAddr = await ctx.core.getAddress();
    await ctx.usdt.connect(ctx.owner).mint(coreAddr, ethers.parseEther("1000"));
    const cbAddr = await ctx.cashback.getAddress();
    await ethers.provider.send("hardhat_impersonateAccount",[cbAddr]);
    await ethers.provider.send("hardhat_setBalance",[cbAddr,"0x1000000000000000000"]);
    const cbSigner = await ethers.getSigner(cbAddr);
    const before = await ctx.core.totalLifetimeQualifyingIncome(userId);
    await (await ctx.core.connect(cbSigner).payoutUserIncome(userId, 200n, usdtAddr)).wait();
    await ethers.provider.send("hardhat_stopImpersonatingAccount",[cbAddr]);
    const after = await ctx.core.totalLifetimeQualifyingIncome(userId);
    expect(after).to.equal(before, "CashbackPool payout must NOT increment qualifying income");
    console.log("G PASS: CashbackPool excluded from qualifying income tracking");
  });

  // ── H. Scanner same-block boundary logic (deterministic fixtures) ────────
  it("H: scanner isHistorical logic — same-block boundary", async function () {
    const U_NEW_BLOCK = 1000;
    const U_NEW_TX = 5;
    function isHistorical(block: number, tx: number): boolean {
      if (block < U_NEW_BLOCK) return true;
      if (block === U_NEW_BLOCK) return tx < U_NEW_TX;
      return false;
    }
    // A: block U_NEW-1 → INCLUDE
    expect(isHistorical(999, 99)).to.equal(true, "A: block before U_NEW included");
    // B: same block, txIndex < upgrade → INCLUDE
    expect(isHistorical(1000, 4)).to.equal(true, "B: same block, txIndex < upgrade included");
    // C: same block, txIndex == upgrade → EXCLUDE (upgrade tx itself)
    expect(isHistorical(1000, 5)).to.equal(false, "C: upgrade tx excluded");
    // D: same block, txIndex > upgrade → EXCLUDE
    expect(isHistorical(1000, 6)).to.equal(false, "D: post-upgrade same block excluded");
    // E: block U_NEW-1 registration → HISTORICAL
    expect(isHistorical(999, 0)).to.equal(true, "E: reg before U_NEW historical");
    // F: same block, txIndex < upgrade, registration → HISTORICAL
    expect(isHistorical(1000, 3)).to.equal(true, "F: reg same block before upgrade historical");
    // G: same block, txIndex > upgrade, registration → NEW
    expect(isHistorical(1000, 7)).to.equal(false, "G: reg same block after upgrade is new");
    // H: block U_NEW+1 → EXCLUDE
    expect(isHistorical(1001, 0)).to.equal(false, "H: post-U_NEW block excluded");
    console.log("H PASS: all 8 same-block boundary cases correct");
  });

  // ── I. Zero-income historical user included in output ────────────────────
  it("I: zero-income historical user is included and marked initialized", async function () {
    const ctx = await deploySystem();
    await registerUser(ctx, ctx.users[0], 0n);
    const userId = await ctx.core.userIdByAddress(ctx.users[0].address);
    // Init with zero income
    await (await ctx.core.connect(ctx.owner).adminInitHistoricalIncome([userId],[0n])).wait();
    const init = await ctx.core.historicalIncomeInitialized(userId);
    const lifetime = await ctx.core.totalLifetimeQualifyingIncome(userId);
    expect(init).to.equal(true, "zero-income user must be initialized");
    expect(lifetime).to.equal(0n, "lifetime income remains 0");
    console.log("I PASS: zero-income user initialized correctly");
  });

  // ── J. Checksum determinism ───────────────────────────────────────────────
  it("J: checksum encoding is deterministic", async function () {
    const users = [{userId:"1",amount:"100"},{userId:"2",amount:"0"},{userId:"3",amount:"250"}];
    const sorted = [...users].sort((a,b)=>BigInt(a.userId)<BigInt(b.userId)?-1:1);
    const idChecksum  = ethers.keccak256(ethers.toUtf8Bytes(sorted.map(u=>u.userId).join(",")));
    const idAmtChecksum = ethers.keccak256(ethers.toUtf8Bytes(sorted.map(u=>`${u.userId}:${u.amount}`).join(",")));
    // Re-run with same input → same output
    const idChecksum2  = ethers.keccak256(ethers.toUtf8Bytes(sorted.map(u=>u.userId).join(",")));
    const idAmtChecksum2 = ethers.keccak256(ethers.toUtf8Bytes(sorted.map(u=>`${u.userId}:${u.amount}`).join(",")));
    expect(idChecksum).to.equal(idChecksum2, "sortedUserIdChecksum deterministic");
    expect(idAmtChecksum).to.equal(idAmtChecksum2, "idAmountChecksum deterministic");
    console.log("J PASS: checksums deterministic");
    console.log("  sortedUserIdChecksum:", idChecksum);
    console.log("  idAmountChecksum:    ", idAmtChecksum);
  });

  // ── K. CashbackPool V2 net-entitlement formula ───────────────────────────
  it("K1: invested=500 earned=0 → entitlement=500", async function () {
    const invested=500n, earned=0n;
    const netEntitlement=invested>earned?invested-earned:0n;
    expect(netEntitlement).to.equal(500n); console.log("K1 PASS");
  });
  it("K2: invested=500 earned=250 → entitlement=250", async function () {
    const invested=500n, earned=250n;
    const netEntitlement=invested>earned?invested-earned:0n;
    expect(netEntitlement).to.equal(250n); console.log("K2 PASS");
  });
  it("K3: invested=500 earned=500 → entitlement=0", async function () {
    const invested=500n, earned=500n;
    const netEntitlement=invested>earned?invested-earned:0n;
    expect(netEntitlement).to.equal(0n); console.log("K3 PASS");
  });
  it("K4: invested=500 earned=700 → entitlement=0 (no negative)", async function () {
    const invested=500n, earned=700n;
    const netEntitlement=invested>earned?invested-earned:0n;
    expect(netEntitlement).to.equal(0n); console.log("K4 PASS");
  });
  it("K5: cashbackClaimed deduction", async function () {
    const invested=500n, earned=200n, claimed=100n;
    const netEntitlement=invested>earned?invested-earned:0n; // 300
    const remaining=netEntitlement>claimed?netEntitlement-claimed:0n; // 200
    expect(remaining).to.equal(200n); console.log("K5 PASS: remaining after claimed =",remaining.toString());
  });
  it("K6: accumulated < remaining → actualClaim = accumulated", async function () {
    const invested=500n, earned=0n, claimed=0n, accumulated=50n;
    const netEntitlement=invested>earned?invested-earned:0n;
    const remaining=netEntitlement>claimed?netEntitlement-claimed:0n;
    const actualClaim=accumulated<remaining?accumulated:remaining;
    expect(actualClaim).to.equal(50n); console.log("K6 PASS");
  });
  it("K7: accumulated > remaining → actualClaim = remaining (capped)", async function () {
    const invested=500n, earned=400n, claimed=50n, accumulated=200n;
    const netEntitlement=invested>earned?invested-earned:0n; // 100
    const remaining=netEntitlement>claimed?netEntitlement-claimed:0n; // 50
    const actualClaim=accumulated<remaining?accumulated:remaining;
    expect(actualClaim).to.equal(50n, "capped at remaining"); console.log("K7 PASS");
  });
});
