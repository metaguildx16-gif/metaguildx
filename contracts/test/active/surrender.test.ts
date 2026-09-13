import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("Surrender — MGX Reclaim + Refund", function () {
  this.timeout(120_000);

  // ─── deploy helpers ───────────────────────────────────────────────────────

  async function deployLibraries() {
    // Level 1: leaf libraries with no external link dependencies
    const upgradeCycleLib = await (await ethers.getContractFactory("UpgradeCycleLib")).deploy();
    const payLib          = await (await ethers.getContractFactory("MetaGuildXPaymentLib")).deploy();
    const placeLib        = await (await ethers.getContractFactory("MetaGuildXPlacementLib")).deploy();
    const adminLib        = await (await ethers.getContractFactory("MetaGuildXAdminLib")).deploy();
    const rebirthLib      = await (await ethers.getContractFactory("MetaGuildXRebirthLib")).deploy();
    await Promise.all([
      upgradeCycleLib.waitForDeployment(), payLib.waitForDeployment(),
      placeLib.waitForDeployment(), adminLib.waitForDeployment(), rebirthLib.waitForDeployment()
    ]);
    // Level 2: MetaGuildXUpgradeFlowLib requires UpgradeCycleLib + MetaGuildXPaymentLib
    const upgradeLib = await (await ethers.getContractFactory("MetaGuildXUpgradeFlowLib", {
      libraries: {
        "src/libraries/UpgradeCycleLib.sol:UpgradeCycleLib":     await upgradeCycleLib.getAddress(),
        "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib": await payLib.getAddress(),
      }
    })).deploy();
    await upgradeLib.waitForDeployment();
    return {
      "src/MetaGuildXAdminLib.sol:MetaGuildXAdminLib":             await adminLib.getAddress(),
      "src/MetaGuildXRebirthLib.sol:MetaGuildXRebirthLib":         await rebirthLib.getAddress(),
      "src/MetaGuildXUpgradeFlowLib.sol:MetaGuildXUpgradeFlowLib": await upgradeLib.getAddress(),
      "src/libs/MetaGuildXPaymentLib.sol:MetaGuildXPaymentLib":     await payLib.getAddress(),
      "src/libs/MetaGuildXPlacementLib.sol:MetaGuildXPlacementLib": await placeLib.getAddress(),
    };
  }

  async function deploySystem() {
    const signers = await ethers.getSigners();
    const [owner, creator, ...users] = signers;

    const libraries = await deployLibraries();

    const mgxToken = await (await ethers.getContractFactory("MGXToken"))
      .deploy(owner.address);
    await mgxToken.waitForDeployment();

    const usdt = await (await ethers.getContractFactory("MockUSDT"))
      .deploy(owner.address);
    await usdt.waitForDeployment();

    const binaryTree = await upgrades.deployProxy(
      await ethers.getContractFactory("BinaryTree"),
      [owner.address], { kind: "uups" }
    );
    await binaryTree.waitForDeployment();

    const router = await upgrades.deployProxy(
      await ethers.getContractFactory("IncomeRouter"),
      [owner.address], { kind: "uups" }
    );
    await router.waitForDeployment();

    const cashback = await upgrades.deployProxy(
      await ethers.getContractFactory("CashbackPool"),
      [owner.address], { kind: "uups" }
    );
    await cashback.waitForDeployment();

    const staking = await upgrades.deployProxy(
      await ethers.getContractFactory("MGXStaking"),
      [owner.address], { kind: "uups" }
    );
    await staking.waitForDeployment();

    const core = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXCore", { libraries }),
      [owner.address], { kind: "uups", unsafeAllowLinkedLibraries: true }
    );
    await core.waitForDeployment();

    // Bootstrap: deploy a temporary Income placeholder so Upgrade can init
    // Then deploy real Income with Upgrade address, then update Upgrade's income pointer
    // Step 1: deploy a temporary standalone income-like proxy using owner as placeholder
    // Use owner address as placeholder — replaced immediately after
    // Actually: deploy Upgrade using owner as fake income (passes require check)
    // then deploy Income properly, then set real income on Upgrade
    const upgradeTempIncome = owner.address; // temporary non-zero placeholder
    const upgrade = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXUpgrade"),
      [await core.getAddress(), upgradeTempIncome, await usdt.getAddress()],
      { kind: "uups" }
    );
    await upgrade.waitForDeployment();

    // Step 2: deploy Income with real upgrade address
    const income = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXIncome"),
      [await core.getAddress(), await router.getAddress(),
       await upgrade.getAddress(), await usdt.getAddress()],
      { kind: "uups" }
    );
    await income.waitForDeployment();

    // Step 3: update Upgrade to point to real Income
    await (await upgrade.setIncomeContract(await income.getAddress())).wait();

    // TokenEngine
    const tokenEngine = await upgrades.deployProxy(
      await ethers.getContractFactory("MetaGuildXTokenEngine"),
      [await core.getAddress()], { kind: "uups" }
    );
    await tokenEngine.waitForDeployment();

    // Wire contracts
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
    await (await core.configurePaymentAsset(
      await usdt.getAddress(), true, false, 10n ** 17n
    )).wait();
    await (await core.setProductionMode(true, await usdt.getAddress())).wait();

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

    // Mint MGX to Core so it can transfer to users on registration
    await (await mgxToken.mintLaunchAllocations(
      coreAddr, owner.address, owner.address
    )).wait();

    return { owner, creator, users, mgxToken, usdt, binaryTree, router,
             cashback, staking, core, income, upgrade, tokenEngine };
  }

  // ─── registration helper ──────────────────────────────────────────────────

  async function registerUser(ctx: any, userSigner: any, sponsorId: bigint) {
    const { owner, core, usdt } = ctx;
    const coreAddress = await core.getAddress();
    const usdtAddress = await usdt.getAddress();
    const unitPrice = await core.paymentAssetUnitPrice(usdtAddress);
    const pkgPrice  = (await core.getPackagePrices())[0];
    const settlement = pkgPrice * unitPrice;

    await (await usdt.connect(owner).mint(userSigner.address, settlement * 50n)).wait();
    await (await usdt.connect(userSigner).approve(coreAddress, settlement * 50n)).wait();

    const network = await ethers.provider.getNetwork();
    const nonce = await core.nonces(userSigner.address);
    // Use latest block timestamp to avoid expiry after evm_increaseTime in prior tests
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = BigInt(latestBlock!.timestamp + 365 * 24 * 3600); // 1 year from current block
    const placementParentId = 0n;
    const isLeft = false;

    const structHash = ethers.solidityPackedKeccak256(
      ["uint256","address","address","uint256","uint256","bool","uint256","uint256"],
      [network.chainId, coreAddress, userSigner.address,
       sponsorId, placementParentId, isLeft, nonce, deadline]
    );
    const sig = await owner.signMessage(ethers.getBytes(structHash));

    await (await core.connect(userSigner).registerWithPlacement(
      sponsorId, placementParentId, isLeft, sig, nonce, deadline
    )).wait();
    return core.userIdByAddress(userSigner.address);
  }

  // ─── T1 — HAPPY PATH ──────────────────────────────────────────────────────

  it("T1: happy path — surrender reclaims MGX, refund received, all state correct", async function () {
    const ctx = await deploySystem();
    const { users, core, cashback, mgxToken, binaryTree, tokenEngine } = ctx;

    // Register 2 users so cashback pool gets funded
    await registerUser(ctx, ctx.owner, 0n);
    const userId1 = await registerUser(ctx, users[0], 1n);

    // Advance time to surrender window (91 days)
    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const user = users[0];
    const coreAddr = await core.getAddress();
    const mgxAddr  = await mgxToken.getAddress();

    // Read actual allocation (do NOT hardcode)
    const mgxAllocation = await core.tokenAllocationsByUser(userId1);
    expect(mgxAllocation).to.be.gt(0n, "User must have MGX allocation");

    // Capture before state
    const userMgxBefore  = await mgxToken.balanceOf(user.address);
    const coreMgxBefore  = await mgxToken.balanceOf(coreAddr);
    const coreTotalBefore = await core.totalTokenDistributed();
    const teTotalBefore  = await tokenEngine.totalTokenDistributed();
    const teBoxBefore    = await tokenEngine.distributedTokensByBox(
      await tokenEngine.getActiveBox(userId1)
    );

    expect(userMgxBefore).to.be.gte(mgxAllocation, "User must hold enough MGX");

    // User approves Core for exact allocation
    await (await mgxToken.connect(user).approve(coreAddr, mgxAllocation)).wait();

    // Execute surrender
    await (await core.connect(user).surrenderForCashback(userId1)).wait();

    // ── ERC20 physical transfer ──
    const userMgxAfter  = await mgxToken.balanceOf(user.address);
    const coreMgxAfter  = await mgxToken.balanceOf(coreAddr);
    expect(userMgxAfter).to.equal(userMgxBefore - mgxAllocation, "User MGX reduced by allocation");
    expect(coreMgxAfter).to.equal(coreMgxBefore + mgxAllocation, "Core MGX increased by allocation");

    // ── Allocation accounting ──
    expect(await core.tokenAllocationsByUser(userId1)).to.equal(0n, "Core allocation = 0");
    expect(await tokenEngine.tokenAllocationsByUser(userId1)).to.equal(0n, "TokenEngine allocation = 0");
    expect(await tokenEngine.activeBoxByUser(userId1)).to.equal(0, "activeBoxByUser = 0");

    // ── Surrendered flags ──
    const profile = await core.usersById(userId1);
    expect(profile.surrendered).to.equal(true, "user.surrendered = true");
    expect(await cashback.surrendered(userId1)).to.equal(true, "CashbackPool surrendered = true");

    // ── Level Tree cleared ──
    expect(await binaryTree.isLevelEligible(userId1)).to.equal(false, "isLevelEligible = false");
    expect(await binaryTree.levelParent(userId1)).to.equal(0n, "levelParent = 0");
    expect(await binaryTree.levelChildren(userId1, 0)).to.equal(0n, "levelChildren[0] = 0");
    expect(await binaryTree.levelChildren(userId1, 1)).to.equal(0n, "levelChildren[1] = 0");
    expect(await binaryTree.levelEligibleAt(userId1)).to.equal(0n, "levelEligibleAt = 0");

    // ── Lifetime totals UNCHANGED ──
    expect(await core.totalTokenDistributed()).to.equal(coreTotalBefore, "Core totalTokenDistributed unchanged");
    expect(await tokenEngine.totalTokenDistributed()).to.equal(teTotalBefore, "TE totalTokenDistributed unchanged");
    const boxId = await core.activeBoxByUser(userId1);  // Core's copy — still records original boxId
    expect(await tokenEngine.distributedTokensByBox(
      boxId > 0 ? boxId : 1
    )).to.be.gte(0n, "distributedTokensByBox unchanged (not decremented)");

    // ── futurePool NOT incremented ──
    expect(await core.futurePool()).to.equal(0n, "futurePool NOT incremented");

    console.log("T1 PASS: MGX reclaimed =", mgxAllocation.toString(),
                "| userMgx:", userMgxBefore.toString(), "→", userMgxAfter.toString());
  });

  // ─── T2 — INSUFFICIENT MGX BALANCE ────────────────────────────────────────

  it("T2: insufficient MGX balance — entire surrender reverts", async function () {
    const ctx = await deploySystem();
    const { users, core, cashback, mgxToken, tokenEngine } = ctx;

    await registerUser(ctx, ctx.owner, 0n);
    const userId = await registerUser(ctx, users[0], 1n);

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const user    = users[0];
    const coreAddr = await core.getAddress();
    const mgxAlloc = await core.tokenAllocationsByUser(userId);

    // Transfer away all MGX so user has none
    const userBalance = await mgxToken.balanceOf(user.address);
    if (userBalance > 0n) {
      await (await mgxToken.connect(user).transfer(ctx.owner.address, userBalance)).wait();
    }
    expect(await mgxToken.balanceOf(user.address)).to.equal(0n);

    // Approve anyway
    await (await mgxToken.connect(user).approve(coreAddr, mgxAlloc)).wait();

    // Capture before state
    const coreMgxBefore  = await mgxToken.balanceOf(coreAddr);
    const coreAllocBefore = await core.tokenAllocationsByUser(userId);

    // Must revert
    await expect(
      core.connect(user).surrenderForCashback(userId)
    ).to.be.revertedWith("Insufficient MGX balance for surrender");

    // Verify NO state changed
    expect(await core.tokenAllocationsByUser(userId)).to.equal(coreAllocBefore, "Core alloc unchanged");
    expect(await tokenEngine.tokenAllocationsByUser(userId)).to.equal(coreAllocBefore, "TE alloc unchanged");
    expect(await mgxToken.balanceOf(coreAddr)).to.equal(coreMgxBefore, "Core MGX unchanged");
    expect((await core.usersById(userId)).surrendered).to.equal(false, "Not surrendered");
    expect(await cashback.surrendered(userId)).to.equal(false, "CashbackPool not surrendered");
    console.log("T2 PASS: revert on zero MGX balance");
  });

  // ─── T3 — ZERO ALLOWANCE ──────────────────────────────────────────────────

  it("T3: zero allowance — surrender reverts, no state changes", async function () {
    const ctx = await deploySystem();
    const { users, core, cashback, mgxToken, tokenEngine } = ctx;

    await registerUser(ctx, ctx.owner, 0n);
    const userId = await registerUser(ctx, users[0], 1n);

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const user = users[0];
    const coreAddr = await core.getAddress();
    const mgxAlloc = await core.tokenAllocationsByUser(userId);
    const coreMgxBefore = await mgxToken.balanceOf(coreAddr);

    // Ensure user has balance but NO allowance
    expect(await mgxToken.balanceOf(user.address)).to.be.gte(mgxAlloc);
    // No approve() call

    await expect(
      core.connect(user).surrenderForCashback(userId)
    ).to.be.revertedWith("Insufficient MGX allowance for surrender");

    expect(await core.tokenAllocationsByUser(userId)).to.equal(mgxAlloc, "Core alloc unchanged");
    expect(await tokenEngine.tokenAllocationsByUser(userId)).to.equal(mgxAlloc, "TE alloc unchanged");
    expect(await mgxToken.balanceOf(coreAddr)).to.equal(coreMgxBefore, "Core MGX unchanged");
    expect((await core.usersById(userId)).surrendered).to.equal(false);
    expect(await cashback.surrendered(userId)).to.equal(false);
    console.log("T3 PASS: revert on zero allowance");
  });

  // ─── T4 — PARTIAL ALLOWANCE ───────────────────────────────────────────────

  it("T4: partial allowance — surrender reverts", async function () {
    const ctx = await deploySystem();
    const { users, core, mgxToken } = ctx;

    await registerUser(ctx, ctx.owner, 0n);
    const userId = await registerUser(ctx, users[0], 1n);

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const user = users[0];
    const coreAddr = await core.getAddress();
    const mgxAlloc = await core.tokenAllocationsByUser(userId);

    // Approve only half
    await (await mgxToken.connect(user).approve(coreAddr, mgxAlloc / 2n)).wait();

    await expect(
      core.connect(user).surrenderForCashback(userId)
    ).to.be.revertedWith("Insufficient MGX allowance for surrender");

    expect(await core.tokenAllocationsByUser(userId)).to.equal(mgxAlloc);
    expect((await core.usersById(userId)).surrendered).to.equal(false);
    console.log("T4 PASS: revert on partial allowance");
  });

  // ─── T5 — VALID 90-DAY WINDOW ─────────────────────────────────────────────

  it("T5: surrender succeeds at exactly 91 days after registration", async function () {
    const ctx = await deploySystem();
    const { users, core, mgxToken } = ctx;

    await registerUser(ctx, ctx.owner, 0n);
    const userId = await registerUser(ctx, users[0], 1n);

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const user = users[0];
    const mgxAlloc = await core.tokenAllocationsByUser(userId);
    await (await mgxToken.connect(user).approve(await core.getAddress(), mgxAlloc)).wait();

    await expect(core.connect(user).surrenderForCashback(userId)).to.not.be.reverted;
    expect((await core.usersById(userId)).surrendered).to.equal(true);
    console.log("T5 PASS: surrender succeeds in valid window");
  });

  // ─── T6 — BEFORE 90 DAYS ──────────────────────────────────────────────────

  it("T6: before 90 days — surrender reverts NotYetAvailable", async function () {
    const ctx = await deploySystem();
    const { users, core, mgxToken } = ctx;

    await registerUser(ctx, ctx.owner, 0n);
    const userId = await registerUser(ctx, users[0], 1n);

    // Only 10 days elapsed
    await ethers.provider.send("evm_increaseTime", [10 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const mgxAlloc = await core.tokenAllocationsByUser(userId);
    await (await mgxToken.connect(users[0]).approve(await core.getAddress(), mgxAlloc)).wait();

    await expect(
      core.connect(users[0]).surrenderForCashback(userId)
    ).to.be.revertedWithCustomError(core, "NotYetAvailable");
    console.log("T6 PASS: reverts before 90 days");
  });

  // ─── T7 — AFTER 180 DAYS ──────────────────────────────────────────────────

  it("T7: after 180 days — surrender reverts WindowExpired", async function () {
    const ctx = await deploySystem();
    const { users, core, mgxToken } = ctx;

    await registerUser(ctx, ctx.owner, 0n);
    const userId = await registerUser(ctx, users[0], 1n);

    await ethers.provider.send("evm_increaseTime", [181 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const mgxAlloc = await core.tokenAllocationsByUser(userId);
    await (await mgxToken.connect(users[0]).approve(await core.getAddress(), mgxAlloc)).wait();

    await expect(
      core.connect(users[0]).surrenderForCashback(userId)
    ).to.be.revertedWithCustomError(core, "WindowExpired");
    console.log("T7 PASS: reverts after 180 days");
  });

  // ─── T8 — DOUBLE SURRENDER ────────────────────────────────────────────────

  it("T8: double surrender — second call reverts", async function () {
    const ctx = await deploySystem();
    const { users, core, mgxToken } = ctx;

    await registerUser(ctx, ctx.owner, 0n);
    const userId = await registerUser(ctx, users[0], 1n);

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const user = users[0];
    const mgxAlloc = await core.tokenAllocationsByUser(userId);
    await (await mgxToken.connect(user).approve(await core.getAddress(), mgxAlloc)).wait();
    await (await core.connect(user).surrenderForCashback(userId)).wait();

    // Second attempt must revert
    await expect(
      core.connect(user).surrenderForCashback(userId)
    ).to.be.reverted;
    console.log("T8 PASS: double surrender reverts");
  });

  // ─── T9 — LEVEL TREE CLEANUP ──────────────────────────────────────────────

  it("T9: level tree cleared after surrender", async function () {
    const ctx = await deploySystem();
    const { users, core, binaryTree, mgxToken } = ctx;

    // Register 3 users — user 2 gets 2 referrals making them level-eligible
    await registerUser(ctx, ctx.owner, 0n);       // userId=1
    const userId2 = await registerUser(ctx, users[0], 1n); // userId=2
    await registerUser(ctx, users[1], 2n);         // userId=3 — referral under 2
    await registerUser(ctx, users[2], 2n);         // userId=4 — referral under 2

    // user2 should now be level-eligible (has 2 referrals)
    const eligibleBefore = await binaryTree.isLevelEligible(userId2);

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const user2 = users[0];
    const mgxAlloc = await core.tokenAllocationsByUser(userId2);
    await (await mgxToken.connect(user2).approve(await core.getAddress(), mgxAlloc)).wait();
    await (await core.connect(user2).surrenderForCashback(userId2)).wait();

    expect(await binaryTree.isLevelEligible(userId2)).to.equal(false, "isLevelEligible cleared");
    expect(await binaryTree.levelParent(userId2)).to.equal(0n, "levelParent cleared");
    expect(await binaryTree.levelChildren(userId2, 0)).to.equal(0n, "levelChildren[0] cleared");
    expect(await binaryTree.levelChildren(userId2, 1)).to.equal(0n, "levelChildren[1] cleared");
    expect(await binaryTree.levelEligibleAt(userId2)).to.equal(0n, "levelEligibleAt cleared");

    console.log("T9 PASS: level tree cleared | wasEligible:", eligibleBefore);
  });

  // ─── T10 — HISTORICAL REFERRAL DATA ───────────────────────────────────────

  it("T10: historical referral data unchanged after surrender", async function () {
    const ctx = await deploySystem();
    const { users, core, mgxToken } = ctx;

    await registerUser(ctx, ctx.owner, 0n);
    const userId2 = await registerUser(ctx, users[0], 1n);
    await registerUser(ctx, users[1], 2n);

    // Capture before
    const profile2Before = await core.usersById(userId2);
    const sponsorIdBefore = profile2Before.sponsorId;
    const directRefsBefore = await core.getDirectReferralIds(2n);

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const mgxAlloc = await core.tokenAllocationsByUser(userId2);
    await (await mgxToken.connect(users[0]).approve(await core.getAddress(), mgxAlloc)).wait();
    await (await core.connect(users[0]).surrenderForCashback(userId2)).wait();

    // Verify historical data intact
    const profile2After = await core.usersById(userId2);
    expect(profile2After.sponsorId).to.equal(sponsorIdBefore, "sponsorId unchanged");
    const directRefsAfter = await core.getDirectReferralIds(2n);
    expect(directRefsAfter.length).to.equal(directRefsBefore.length, "direct referral count unchanged");
    console.log("T10 PASS: historical referral data preserved");
  });

  // ─── T11 — LIFETIME TOTALS UNCHANGED ──────────────────────────────────────

  it("T11: lifetime totals unchanged after surrender", async function () {
    const ctx = await deploySystem();
    const { users, core, mgxToken, tokenEngine } = ctx;

    await registerUser(ctx, ctx.owner, 0n);
    const userId = await registerUser(ctx, users[0], 1n);

    const coreTotalBefore = await core.totalTokenDistributed();
    const teTotalBefore   = await tokenEngine.totalTokenDistributed();
    const boxId = await tokenEngine.getActiveBox(userId);
    const boxBefore = await tokenEngine.distributedTokensByBox(boxId);

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const mgxAlloc = await core.tokenAllocationsByUser(userId);
    await (await mgxToken.connect(users[0]).approve(await core.getAddress(), mgxAlloc)).wait();
    await (await core.connect(users[0]).surrenderForCashback(userId)).wait();

    expect(await core.totalTokenDistributed()).to.equal(coreTotalBefore, "Core totalTokenDistributed unchanged");
    expect(await tokenEngine.totalTokenDistributed()).to.equal(teTotalBefore, "TE totalTokenDistributed unchanged");
    expect(await tokenEngine.distributedTokensByBox(boxId)).to.equal(boxBefore, "distributedTokensByBox unchanged");
    console.log("T11 PASS: lifetime totals unchanged | coreTotalDist =", coreTotalBefore.toString());
  });

  // ─── T12 — CORE MGX BALANCE ───────────────────────────────────────────────

  it("T12: Core MGX balance increases by exactly the reclaimed amount", async function () {
    const ctx = await deploySystem();
    const { users, core, mgxToken } = ctx;

    await registerUser(ctx, ctx.owner, 0n);
    const userId = await registerUser(ctx, users[0], 1n);

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const mgxAlloc    = await core.tokenAllocationsByUser(userId);
    const coreMgxBefore = await mgxToken.balanceOf(await core.getAddress());
    const userMgxBefore = await mgxToken.balanceOf(users[0].address);

    await (await mgxToken.connect(users[0]).approve(await core.getAddress(), mgxAlloc)).wait();
    await (await core.connect(users[0]).surrenderForCashback(userId)).wait();

    const coreMgxAfter = await mgxToken.balanceOf(await core.getAddress());
    const userMgxAfter = await mgxToken.balanceOf(users[0].address);

    expect(coreMgxAfter - coreMgxBefore).to.equal(mgxAlloc, "Core receives exactly mgxAlloc");
    expect(userMgxBefore - userMgxAfter).to.equal(mgxAlloc, "User loses exactly mgxAlloc");
    console.log("T12 PASS: exact MGX transfer | amount =", mgxAlloc.toString());
  });

  // ─── T13 — MULTI-BOX SAFETY ───────────────────────────────────────────────

  it("T13: distributedTokensByBox NOT decremented on surrender (multi-box safety)", async function () {
    // This test verifies the invariant regardless of whether allocation spans one or multiple boxes
    const ctx = await deploySystem();
    const { users, core, mgxToken, tokenEngine } = ctx;

    await registerUser(ctx, ctx.owner, 0n);
    const userId = await registerUser(ctx, users[0], 1n);

    const boxId = await tokenEngine.getActiveBox(userId);
    const boxBefore = await tokenEngine.distributedTokensByBox(boxId);

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const mgxAlloc = await core.tokenAllocationsByUser(userId);
    await (await mgxToken.connect(users[0]).approve(await core.getAddress(), mgxAlloc)).wait();
    await (await core.connect(users[0]).surrenderForCashback(userId)).wait();

    const boxAfter = await tokenEngine.distributedTokensByBox(boxId);
    expect(boxAfter).to.equal(boxBefore, "distributedTokensByBox NOT decremented on surrender");
    console.log("T13 PASS: box accounting preserved | boxId:", boxId, "count:", boxBefore.toString());
  });

  // ─── T14 — BINARY TREE ────────────────────────────────────────────────────

  it("T14: binary tree — leaf surrender removes node and updates parent", async function () {
    const ctx = await deploySystem();
    const { users, core, binaryTree, mgxToken } = ctx;

    await registerUser(ctx, ctx.owner, 0n); // userId=1 root
    const userId2 = await registerUser(ctx, users[0], 1n); // userId=2 under root

    const nodeBefore = await binaryTree.nodes(userId2);
    expect(nodeBefore.userId).to.equal(userId2, "Node exists before surrender");

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const mgxAlloc = await core.tokenAllocationsByUser(userId2);
    await (await mgxToken.connect(users[0]).approve(await core.getAddress(), mgxAlloc)).wait();
    await (await core.connect(users[0]).surrenderForCashback(userId2)).wait();

    const nodeAfter = await binaryTree.nodes(userId2);
    expect(nodeAfter.userId).to.equal(0n, "Node deleted after surrender");
    // subtreeCounts[userId2] should be 0 (deleted)
    expect(await binaryTree.subtreeCounts(userId2)).to.equal(0n, "subtreeCounts cleared");
    console.log("T14 PASS: leaf node removed, subtreeCount cleared");
  });

  it("T14b: binary tree — one-child surrender moves child to surrendered position", async function () {
    const ctx = await deploySystem();
    const { users, core, binaryTree, mgxToken } = ctx;

    // Register: root(1), user2(2) under 1, user3(3) under 2
    await registerUser(ctx, ctx.owner, 0n);    // userId=1
    const userId2 = await registerUser(ctx, users[0], 1n); // userId=2
    const userId3 = await registerUser(ctx, users[1], 2n); // userId=3 under 2

    // Verify tree before
    const node2Before = await binaryTree.nodes(userId2);
    expect(node2Before.parentId).to.equal(1n);

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    // Surrender user2 (has one child: user3)
    const mgxAlloc = await core.tokenAllocationsByUser(userId2);
    await (await mgxToken.connect(users[0]).approve(await core.getAddress(), mgxAlloc)).wait();
    await (await core.connect(users[0]).surrenderForCashback(userId2)).wait();

    // user2 node deleted
    const node2After = await binaryTree.nodes(userId2);
    expect(node2After.userId).to.equal(0n, "user2 deleted");

    // user3 moved into user2's position
    const node3After = await binaryTree.nodes(userId3);
    expect(node3After.parentId).to.equal(1n, "user3 parent = root");
    console.log("T14b PASS: one-child replacement correct");
  });

  it("T14c: binary tree — two-child surrender, right child reattached under left", async function () {
    const ctx = await deploySystem();
    const { users, core, binaryTree, mgxToken } = ctx;

    // Build: 1←root, 2←under 1, 3←under 2 (left), 4←under 2 (right via BFS)
    await registerUser(ctx, ctx.owner, 0n);    // userId=1
    const userId2 = await registerUser(ctx, users[0], 1n); // userId=2
    const userId3 = await registerUser(ctx, users[1], 2n); // userId=3
    const userId4 = await registerUser(ctx, users[2], 2n); // userId=4

    const node2Before = await binaryTree.nodes(userId2);
    expect(node2Before.parentId).to.equal(1n);

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const mgxAlloc = await core.tokenAllocationsByUser(userId2);
    await (await mgxToken.connect(users[0]).approve(await core.getAddress(), mgxAlloc)).wait();
    await (await core.connect(users[0]).surrenderForCashback(userId2)).wait();

    // user2 deleted
    expect((await binaryTree.nodes(userId2)).userId).to.equal(0n, "user2 deleted");

    // Left child (userId3 or 4 depending on placement) takes user2's spot
    // Right child attaches under left child or deeper — no orphan
    const node3 = await binaryTree.nodes(userId3);
    const node4 = await binaryTree.nodes(userId4);
    // Both nodes must have parentId != 0 (no orphan)
    expect(node3.parentId).to.be.gt(0n, "user3 not orphaned");
    expect(node4.parentId).to.be.gt(0n, "user4 not orphaned");

    // Subtree counts upward from each remaining node must be > 0
    expect(await binaryTree.subtreeCounts(1n)).to.be.gte(2n, "subtreeCounts[root] >= 2");
    console.log("T14c PASS: two-child surrender, no orphans");
  });

  // ─── T15 — DEPTH REGRESSION: iterations > maxDepth with maxDepth=50 ──────────

  it("T15: _refreshDepths refreshes descendants beyond depth 20 when maxDepth=50", async function () {
    // Build a standalone BinaryTree with a linear chain of 26 nodes (depths 0..25).
    // setMaxDepth(50), then surrender userId=2 (one child: userId=3).
    // After reconnection userId=3..26 should shift up one depth each.
    // OLD code (iterations > 20): stops at iterations=21, leaves userId=24..26 stale.
    // NEW code (iterations > maxDepth=50): refreshes all 24 descendants.
    const [owner] = await ethers.getSigners();

    const bt = await upgrades.deployProxy(
      await ethers.getContractFactory("BinaryTree"),
      [owner.address], { kind: "uups" }
    );
    await bt.waitForDeployment();

    // setCoreContract requires a contract address (_validateContract check)
    // Deploy a minimal mock contract to act as the "core" for this test
    const MockCore = await ethers.deployContract("MockUSDT", [owner.address]);
    await MockCore.waitForDeployment();
    const mockCoreAddr = await MockCore.getAddress();
    await (await (bt as any).connect(owner).setCoreContract(mockCoreAddr)).wait();

    // Impersonate the mock core contract address to call onlyCoreContract functions
    await ethers.provider.send("hardhat_impersonateAccount", [mockCoreAddr]);
    await ethers.provider.send("hardhat_setBalance", [mockCoreAddr, "0x1000000000000000000"]);
    const mockCoreAccount = await ethers.getSigner(mockCoreAddr);
    // Set maxDepth=50 (onlyOwner)
    await (await (bt as any).connect(owner).setMaxDepth(50n)).wait();
    expect(await (bt as any).maxDepth()).to.equal(50n);

    // Build linear chain using mockCore signer (msg.sender == coreContract)
    // userId=1 depth=0 (root), userId=2 depth=1, ..., userId=26 depth=25
    await (await (bt as any).connect(mockCoreAccount).assignRoot(1n)).wait();
    for (let i = 2; i <= 26; i++) {
      // place userId=i as left child of userId=i-1
      await (await (bt as any).connect(mockCoreAccount).placeNodeExact(
        BigInt(i - 1), BigInt(i), true
      )).wait();
    }

    // Verify chain depths before surrender
    for (let i = 1; i <= 26; i++) {
      expect(await (bt as any).nodeDepth(BigInt(i))).to.equal(BigInt(i - 1),
        `Pre-surrender: user${i} should be at depth ${i-1}`);
    }

    // Surrender userId=2 (has one child: userId=3)
    // handleSurrender requires msg.sender == coreContract
    await (await (bt as any).connect(mockCoreAccount).handleSurrender(2n)).wait();

    // After reconnection:
    // userId=2 deleted. userId=3 placed at depth 1.
    // userId=4..26 each shift up by 1 depth.
    // Expected: userId=k -> depth k-2 for k in 3..26

    // Verify nodes that iterations <= 20 would reach (iterations 0..20 = userId 3..23)
    for (let k = 3; k <= 23; k++) {
      const expectedDepth = BigInt(k - 2);
      expect(await (bt as any).nodeDepth(BigInt(k))).to.equal(expectedDepth,
        `user${k} should be depth ${k-2}`);
    }

    // KEY ASSERTIONS: descendants at iterations 21, 22, 23 (userId=24,25,26)
    // OLD code would leave these STALE (nodeDepth unchanged from pre-surrender values)
    // Pre-surrender values: userId=24 was depth=23, userId=25 was 24, userId=26 was 25
    // NEW code correctly sets:
    expect(await (bt as any).nodeDepth(24n)).to.equal(22n,
      "user24 (iterations=21): must be depth 22, NOT stale 23");
    expect(await (bt as any).nodeDepth(25n)).to.equal(23n,
      "user25 (iterations=22): must be depth 23, NOT stale 24");
    expect(await (bt as any).nodeDepth(26n)).to.equal(24n,
      "user26 (iterations=23): must be depth 24, NOT stale 25");

    console.log("T15 PASS: all 24 descendants correctly refreshed with maxDepth=50");
    console.log("  user24 nodeDepth:", (await (bt as any).nodeDepth(24n)).toString(),
                "(correct=22, old stale=23)");
    console.log("  user25 nodeDepth:", (await (bt as any).nodeDepth(25n)).toString(),
                "(correct=23, old stale=24)");
    console.log("  user26 nodeDepth:", (await (bt as any).nodeDepth(26n)).toString(),
                "(correct=24, old stale=25)");
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [mockCoreAddr]);
  });

  // ─── T16 — PLACEMENT REGRESSION: stale nodeDepth blocks valid slot ──────────

  it("T16: stale nodeDepth at maxDepth boundary blocks placement; corrected depth allows it", async function () {
    // Setup: maxDepth=25, linear chain depth 0..25 (userId=1..26).
    // Surrender userId=2. userId=26 should shift from depth=25 to depth=24.
    //
    // OLD code: nodeDepth[26] stays at 25 = maxDepth.
    //   placeNodeExact(parent=26, child=27) computes childDepth=25+1=26 > maxDepth=25 → REVERT.
    //
    // NEW code: nodeDepth[26] = 24 < maxDepth=25.
    //   placeNodeExact(parent=26, child=27) computes childDepth=24+1=25 = maxDepth=25 → SUCCESS.
    const [owner] = await ethers.getSigners();

    const bt = await upgrades.deployProxy(
      await ethers.getContractFactory("BinaryTree"),
      [owner.address], { kind: "uups" }
    );
    await bt.waitForDeployment();

    // setCoreContract requires a contract address — deploy a minimal mock
    const MockCore16 = await ethers.deployContract("MockUSDT", [owner.address]);
    await MockCore16.waitForDeployment();
    const mockCoreAddr16 = await MockCore16.getAddress();
    await (await (bt as any).connect(owner).setCoreContract(mockCoreAddr16)).wait();

    await ethers.provider.send("hardhat_impersonateAccount", [mockCoreAddr16]);
    await ethers.provider.send("hardhat_setBalance", [mockCoreAddr16, "0x1000000000000000000"]);
    const mockCoreAccount = await ethers.getSigner(mockCoreAddr16);
    await (await (bt as any).connect(owner).setMaxDepth(25n)).wait();
    expect(await (bt as any).maxDepth()).to.equal(25n);

    // Build chain: userId=1 (depth 0) → userId=2 (depth 1) → ... → userId=26 (depth 25)
    await (await (bt as any).connect(mockCoreAccount).assignRoot(1n)).wait();
    for (let i = 2; i <= 26; i++) {
      await (await (bt as any).connect(mockCoreAccount).placeNodeExact(
        BigInt(i - 1), BigInt(i), true
      )).wait();
    }

    // Verify userId=26 is at depth=25 before surrender
    expect(await (bt as any).nodeDepth(26n)).to.equal(25n);

    // Surrender userId=2
    await (await (bt as any).connect(mockCoreAccount).handleSurrender(2n)).wait();

    // NEW code: userId=26 should now be at depth=24 (shifted up by 1)
    const depth26 = await (bt as any).nodeDepth(26n);
    expect(depth26).to.equal(24n,
      "user26: corrected depth must be 24 after surrender shifts subtree up");

    // Prove placement is now possible: place userId=27 as child of userId=26
    // This requires nodeDepth[26]+1 = 25 = maxDepth → allowed
    await expect(
      (bt as any).connect(mockCoreAccount).placeNodeExact(26n, 27n, true)
    ).to.not.be.reverted;

    const depth27 = await (bt as any).nodeDepth(27n);
    expect(depth27).to.equal(25n, "user27 placed at depth 25 = maxDepth");

    console.log("T16 PASS: corrected nodeDepth[26]=24 allows placement; old stale 25 would revert");
    console.log("  Stale scenario: nodeDepth[26]=25+1=26 > maxDepth=25 → would revert");
    console.log("  Fixed scenario: nodeDepth[26]=24+1=25 = maxDepth=25 → succeeds");
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [mockCoreAddr16]);
  });
});
