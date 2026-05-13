import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

const PLATFORM_SCALE = 10n;
const TOKEN_PRICE_PER_PLATFORM_UNIT = 10n ** 17n;

function usd(amount: number) {
  return BigInt(Math.round(amount * Number(PLATFORM_SCALE)));
}

async function deploySystem() {
  const [owner] = await ethers.getSigners();
  const upgradeCycleLibFactory = await ethers.getContractFactory("UpgradeCycleLib");
  const upgradeCycleLib = await upgradeCycleLibFactory.deploy();
  await upgradeCycleLib.waitForDeployment();

  const systemFactory = await ethers.getContractFactory("MetaGuildXSystem", {
    libraries: {
      UpgradeCycleLib: await upgradeCycleLib.getAddress(),
    },
  });
  const system = await upgrades.deployProxy(systemFactory, [owner.address], {
    kind: "uups",
    initializer: "initialize",
    unsafeAllowLinkedLibraries: true,
  });
  await system.waitForDeployment();

  const stakingFactory = await ethers.getContractFactory("MGXStaking");
  const staking = await upgrades.deployProxy(stakingFactory, [owner.address], {
    kind: "uups",
    initializer: "initialize"
  });
  await staking.waitForDeployment();

  const cashbackFactory = await ethers.getContractFactory("CashbackPool");
  const cashback = await upgrades.deployProxy(cashbackFactory, [owner.address], {
    kind: "uups",
    initializer: "initialize"
  });
  await cashback.waitForDeployment();

  const incomeFactory = await ethers.getContractFactory("IncomeRouter");
  const income = await upgrades.deployProxy(incomeFactory, [owner.address], {
    kind: "uups",
    initializer: "initialize"
  });
  await income.waitForDeployment();

  const upgradeFactory = await ethers.getContractFactory("UpgradeManager");
  const upgradeManager = await upgrades.deployProxy(upgradeFactory, [owner.address], {
    kind: "uups",
    initializer: "initialize"
  });
  await upgradeManager.waitForDeployment();

  await system.setStakingContract(await staking.getAddress());
  await system.setCashbackContract(await cashback.getAddress());
  await system.setIncomeContract(await income.getAddress());
  await system.setUpgradeManagerContract(await upgradeManager.getAddress());
  await system.setPlacementSigner(owner.address);
  await staking.setCoreContract(await system.getAddress());
  await cashback.setCoreContract(await system.getAddress());
  await income.setCoreContract(await system.getAddress());
  await upgradeManager.setCoreContract(await system.getAddress());

  return system;
}

async function signPlacement(
  system: any,
  signer: any,
  account: string,
  sponsorId: number,
  placementParentId: number,
  isLeft: boolean,
  nonce: number
) {
  const network = await ethers.provider.getNetwork();
  const packed = ethers.solidityPacked(
    ["uint256", "address", "address", "uint256", "uint256", "bool", "uint256"],
    [network.chainId, await system.getAddress(), account, sponsorId, placementParentId, isLeft, nonce]
  );
  const hash = ethers.keccak256(packed);
  return signer.signMessage(ethers.getBytes(hash));
}

async function signReentryPlacement(
  system: any,
  signer: any,
  account: string,
  userId: number,
  sponsorId: number,
  placementParentId: number,
  isLeft: boolean,
  nonce: number
) {
  const network = await ethers.provider.getNetwork();
  const packed = ethers.solidityPacked(
    ["uint256", "address", "address", "uint256", "uint256", "uint256", "bool", "uint256"],
    [network.chainId, await system.getAddress(), account, userId, sponsorId, placementParentId, isLeft, nonce]
  );
  const hash = ethers.keccak256(packed);
  return signer.signMessage(ethers.getBytes(hash));
}

async function findPlacementSlot(system: any, sponsorId: number) {
  const nextUserId = Number(await system.nextUserId());
  if (nextUserId === 1) {
    return { placementParentId: 0, isLeft: false };
  }

  const rootUserId = Number(await system.rootUserId());
  const startId = sponsorId === 0 ? rootUserId : sponsorId;
  if (startId === 0) {
    throw new Error("Root placement is not available");
  }

  let currentLevel = [startId];
  while (currentLevel.length > 0) {
    for (const currentId of currentLevel) {
      const node = await system.treeNodes(currentId);
      if (Number(node.leftChildId) === 0) {
        return { placementParentId: currentId, isLeft: true };
      }
    }

    for (const currentId of currentLevel) {
      const node = await system.treeNodes(currentId);
      if (Number(node.rightChildId) === 0) {
        return { placementParentId: currentId, isLeft: false };
      }
    }

    const nextLevel: number[] = [];
    for (const currentId of currentLevel) {
      const node = await system.treeNodes(currentId);
      const leftChildId = Number(node.leftChildId);
      const rightChildId = Number(node.rightChildId);
      if (leftChildId !== 0) {
        nextLevel.push(leftChildId);
      }
      if (rightChildId !== 0) {
        nextLevel.push(rightChildId);
      }
    }
    currentLevel = nextLevel;
  }

  throw new Error("No placement slot available");
}

async function registerWithSignedPlacement(system: any, signer: any, sponsorId: number) {
  const [placementSigner] = await ethers.getSigners();
  const nonce = Number(await system.nonces(signer.address));
  const { placementParentId, isLeft } = await findPlacementSlot(system, sponsorId);
  const signature = await signPlacement(system, placementSigner, signer.address, sponsorId, placementParentId, isLeft, nonce);
  await system.connect(signer).registerWithPlacement(sponsorId, placementParentId, isLeft, signature, nonce);
}

async function executeReentryWithSignedPlacement(
  system: any,
  signer: any,
  userId: number,
  sponsorId: number,
  paymentAsset: string
) {
  const [placementSigner] = await ethers.getSigners();
  const nonce = Number((await system.usersById(userId)).rebirthCount);
  const { placementParentId, isLeft } = await findPlacementSlot(system, sponsorId);
  const signature = await signReentryPlacement(
    system,
    placementSigner,
    signer.address,
    userId,
    sponsorId,
    placementParentId,
    isLeft,
    nonce
  );
  await system.connect(signer).executeReentryWithPlacement(userId, paymentAsset, placementParentId, isLeft, signature);
}

async function deployPaymentToken() {
  const [owner] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("MGXToken");
  const token = await factory.deploy(owner.address);
  await token.waitForDeployment();
  await token.mintLaunchAllocations(owner.address, owner.address, owner.address);
  return token;
}

async function deployAnalytics(system: any) {
  const factory = await ethers.getContractFactory("MetaGuildAnalytics");
  const analytics = await factory.deploy(await system.getAddress());
  await analytics.waitForDeployment();
  return analytics;
}

async function getStakingModule(system: any) {
  const stakingAddress = await system.stakingContract();
  return ethers.getContractAt("MGXStaking", stakingAddress);
}

async function upgradeToLevel(system: any, signer: any, userId: number, targetLevel: number) {
  const profile = await system.usersById(userId);
  for (let level = Number(profile.packageLevel) + 1; level <= targetLevel; level += 1) {
    await system.connect(signer).upgradePackage(userId, level);
  }
}

describe("MetaGuildXSystem UUPS", function () {
  it("initializes through a UUPS proxy", async function () {
    const [owner] = await ethers.getSigners();
    const system = await deploySystem();

    expect(await system.owner()).to.equal(owner.address);
    expect(await system.nextUserId()).to.equal(1n);
    expect(await system.currentBoxId()).to.equal(1n);

    const packagePrices = await system.getPackagePrices();
    expect(packagePrices.map((value: bigint) => Number(value))).to.deep.equal([100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600, 51200]);
  });

  it("registers users, distributes direct income, and tracks binary placement", async function () {
    const [, alice, bob, carol] = await ethers.getSigners();
    const system = await deploySystem();

    await registerWithSignedPlacement(system, alice, 0);
    await registerWithSignedPlacement(system, bob, 1);
    await system.connect(bob).upgradePackage(2, 2);
    await registerWithSignedPlacement(system, carol, 1);

    const aliceProfile = await system.usersById(1);
    const bobProfile = await system.usersById(2);
    const carolNode = await system.treeNodes(3);

    expect(aliceProfile.directReferrals).to.equal(2n);
    expect(bobProfile.sponsorId).to.equal(1n);
    expect(await system.internalWalletBalances(1)).to.equal(usd(9.6));
    expect(carolNode.parentId).to.equal(1n);
  });

  it("supports staking reward accrual and claiming through the internal wallet", async function () {
    const [owner, alice] = await ethers.getSigners();
    const system = await deploySystem();

    await registerWithSignedPlacement(system, alice, 0);
    await system.connect(owner).fundStakingRewardPool(10000);
    await system.connect(alice).stake(1000, 365 * 24 * 60 * 60, false);

    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const pending = await system.pendingStakingReward(alice.address);
    expect(pending).to.be.greaterThan(0n);

    await system.connect(alice).claimStakingReward();
    expect(await system.internalWalletBalances(1)).to.be.greaterThan(0n);
  });

  it("keeps next-only package upgrades on the signed-placement path", async function () {
    const [, alice, bob] = await ethers.getSigners();
    const system = await deploySystem();

    await registerWithSignedPlacement(system, alice, 0);
    await registerWithSignedPlacement(system, bob, 1);

    await expect(system.connect(bob).upgradePackage(2, 3)).to.be.revertedWith("Upgrade only to next level");

    await system.connect(bob).upgradePackage(2, 2);
    const bobProfile = await system.usersById(2);
    expect(bobProfile.packageLevel).to.equal(2n);
  });

  it("tracks current running box status and assigns users into the active box", async function () {
    const [, alice, bob, carol, dave, erin] = await ethers.getSigners();
    const system = await deploySystem();

    await registerWithSignedPlacement(system, alice, 0);
    const aliceUserId = Number(await system.userIdByAddress(alice.address));
    await upgradeToLevel(system, alice, aliceUserId, 10);

    await registerWithSignedPlacement(system, bob, aliceUserId);
    const bobUserId = Number(await system.userIdByAddress(bob.address));
    await upgradeToLevel(system, bob, bobUserId, 10);

    await registerWithSignedPlacement(system, carol, aliceUserId);
    const carolUserId = Number(await system.userIdByAddress(carol.address));
    await upgradeToLevel(system, carol, carolUserId, 10);

    await registerWithSignedPlacement(system, dave, bobUserId);
    const daveUserId = Number(await system.userIdByAddress(dave.address));
    await upgradeToLevel(system, dave, daveUserId, 10);

    await registerWithSignedPlacement(system, erin, bobUserId);
    const erinUserId = Number(await system.userIdByAddress(erin.address));
    await upgradeToLevel(system, erin, erinUserId, 10);

    const currentBoxStatus = await system.getCurrentBoxStatus();
    expect(currentBoxStatus.boxId).to.equal(1n);
    expect(currentBoxStatus.distributed).to.be.greaterThan(0n);
    expect(currentBoxStatus.remaining).to.be.greaterThan(0n);

    const lastUserBox = await system.activeBoxByUser(erinUserId);
    expect(lastUserBox).to.equal(currentBoxStatus.boxId);
  });

  it("enforces cashback surrender window between 3 and 6 months", async function () {
    const [, alice] = await ethers.getSigners();
    const system = await deploySystem();

    await registerWithSignedPlacement(system, alice, 0);

    await expect(system.connect(alice).surrenderForCashback(1)).to.be.revertedWith("Surrender locked");

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    await system.connect(alice).surrenderForCashback(1);
    expect((await system.usersById(1)).surrendered).to.equal(true);
  });

  it("blocks cashback surrender after the 6 month expiry", async function () {
    const [, alice] = await ethers.getSigners();
    const system = await deploySystem();

    await registerWithSignedPlacement(system, alice, 0);

    await ethers.provider.send("evm_increaseTime", [181 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    await expect(system.connect(alice).surrenderForCashback(1)).to.be.revertedWith("Surrender expired");
  });

  it("allows internal wallet withdrawals and tracks withdrawn totals", async function () {
    const [, alice, bob] = await ethers.getSigners();
    const system = await deploySystem();

    await registerWithSignedPlacement(system, alice, 0);
    await registerWithSignedPlacement(system, bob, 1);

    expect(await system.internalWalletBalances(1)).to.equal(usd(4.6));

    await system.connect(alice).withdrawInternalWallet(1, usd(3));

    expect(await system.internalWalletBalances(1)).to.equal(usd(1.6));
    const ledger = await system.incomesByUser(1);
    expect(ledger.totalWithdrawn).to.equal(usd(3));
  });

  it("enforces stake lock before withdraw and credits net amount after unlock", async function () {
      const [owner, alice] = await ethers.getSigners();
      const system = await deploySystem();
      const staking = await getStakingModule(system);

    await registerWithSignedPlacement(system, alice, 0);
    await system.connect(owner).fundStakingRewardPool(10000);
    await system.connect(alice).stake(1000, 365 * 24 * 60 * 60, false);

    await expect(system.connect(alice).withdrawStake(100)).to.be.revertedWith("Stake locked");

    await ethers.provider.send("evm_increaseTime", [366 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    await system.connect(alice).withdrawStake(400);

    const position = await staking.getStakePosition(alice.address);
    expect(position.amount).to.equal(400n);
    expect(await system.internalWalletBalances(1)).to.be.greaterThan(300n);
  });

  it("creates a funded reactivation ID with explicit placement and credits cross-line income", async function () {
    const [owner, alice, bob, carol, dave, erin, frank] = await ethers.getSigners();
    const system = await deploySystem();
    const token = await deployPaymentToken();
    const tokenAddress = await token.getAddress();

    for (const signer of [alice, bob, carol, dave, erin, frank]) {
      await token.transfer(signer.address, 5000n * 10n ** 18n);
      await token.connect(signer).approve(await system.getAddress(), 5000n * 10n ** 18n);
    }
    await system.configurePaymentAsset(tokenAddress, true, false, TOKEN_PRICE_PER_PLATFORM_UNIT);
    await system.setProductionMode(true, tokenAddress);

    await registerWithSignedPlacement(system, alice, 0);
    await registerWithSignedPlacement(system, bob, 1);
    await registerWithSignedPlacement(system, carol, 2);
    await registerWithSignedPlacement(system, dave, 2);
    await registerWithSignedPlacement(system, erin, 2);
    await registerWithSignedPlacement(system, frank, 2);

    await upgradeToLevel(system, bob, 2, 5);
    await executeReentryWithSignedPlacement(system, bob, 2, 1, tokenAddress);

    const bobProfile = await system.usersById(2);
    expect(bobProfile.rebirthCount).to.equal(1n);

    const rebirthIds = await system.getRebirthIds(2);
    expect(rebirthIds.length).to.equal(1);

    const incomeLedger = await system.incomesByUser(1);
    expect(incomeLedger.crossLineIncome).to.equal(usd(10));
  });

  it("registers with signed placement and rejects invalid placement signatures", async function () {
    const [owner, alice, bob, carol] = await ethers.getSigners();
    const system = await deploySystem();

    const rootSignature = await signPlacement(system, owner, alice.address, 0, 0, false, 0);
    await system.connect(alice).registerWithPlacement(0, 0, false, rootSignature, 0);

    const bobSignature = await signPlacement(system, owner, bob.address, 1, 1, true, 0);
    await system.connect(bob).registerWithPlacement(1, 1, true, bobSignature, 0);

    const bobNode = await system.treeNodes(2);
    expect(bobNode.parentId).to.equal(1n);
    expect(bobNode.leftChildId).to.equal(0n);

    const badSignature = await signPlacement(system, alice, carol.address, 1, 1, false, 0);
    await expect(system.connect(carol).registerWithPlacement(1, 1, false, badSignature, 0)).to.be.revertedWith(
      "Invalid placement signature"
    );
  });

  it("prevents signed placement replay by enforcing account nonces", async function () {
    const [owner, alice] = await ethers.getSigners();
    const system = await deploySystem();

    const signature = await signPlacement(system, owner, alice.address, 0, 0, false, 0);
    await system.connect(alice).registerWithPlacement(0, 0, false, signature, 0);
    await expect(system.connect(alice).registerWithPlacement(0, 0, false, signature, 0)).to.be.revertedWith("Already registered");
    expect(await system.nonces(alice.address)).to.equal(1n);
  });

  it("rejects invalid nonces and occupied placement slots for signed placement", async function () {
    const [owner, alice, bob, carol] = await ethers.getSigners();
    const system = await deploySystem();

    const rootSignature = await signPlacement(system, owner, alice.address, 0, 0, false, 0);
    await system.connect(alice).registerWithPlacement(0, 0, false, rootSignature, 0);

    const invalidNonceSignature = await signPlacement(system, owner, bob.address, 1, 1, true, 1);
    await expect(system.connect(bob).registerWithPlacement(1, 1, true, invalidNonceSignature, 1)).to.be.revertedWith(
      "Invalid nonce"
    );

    const bobSignature = await signPlacement(system, owner, bob.address, 1, 1, true, 0);
    await system.connect(bob).registerWithPlacement(1, 1, true, bobSignature, 0);

    const occupiedSlotSignature = await signPlacement(system, owner, carol.address, 1, 1, true, 0);
    await expect(system.connect(carol).registerWithPlacement(1, 1, true, occupiedSlotSignature, 0)).to.be.revertedWith(
      "Placement slot occupied"
    );
  });

  it("disables implicit auto-placement for reentry", async function () {
    const [owner, alice, bob, carol, dave, erin, frank] = await ethers.getSigners();
    const system = await deploySystem();
    const token = await deployPaymentToken();
    const tokenAddress = await token.getAddress();

    for (const signer of [alice, bob, carol, dave, erin, frank]) {
      await token.transfer(signer.address, 5000n * 10n ** 18n);
      await token.connect(signer).approve(await system.getAddress(), 5000n * 10n ** 18n);
    }
    await system.configurePaymentAsset(tokenAddress, true, false, TOKEN_PRICE_PER_PLATFORM_UNIT);
    await system.setProductionMode(true, tokenAddress);

    await registerWithSignedPlacement(system, alice, 0);
    await registerWithSignedPlacement(system, bob, 1);
    await registerWithSignedPlacement(system, carol, 2);
    await registerWithSignedPlacement(system, dave, 2);
    await registerWithSignedPlacement(system, erin, 2);
    await registerWithSignedPlacement(system, frank, 2);

    await upgradeToLevel(system, bob, 2, 5);
  });

  it("routes signed registration through income, staking, and cashback modules", async function () {
    const [owner, alice, bob] = await ethers.getSigners();
    const system = await deploySystem();
    const staking = await getStakingModule(system);

    await registerWithSignedPlacement(system, alice, 0);
    await registerWithSignedPlacement(system, bob, 1);
    expect(await system.internalWalletBalances(1)).to.equal(usd(4.6));

    await system.connect(owner).fundStakingRewardPool(10000);
    await system.connect(alice).stake(1000, 365 * 24 * 60 * 60, false);
    await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    expect(await staking.pendingStakingReward(alice.address)).to.be.greaterThan(0n);

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
    await system.connect(alice).surrenderForCashback(1);
    await system.connect(owner).distributeCashback();
    expect(await system.pendingCashback(1)).to.be.greaterThan(0n);
  });

  it("withdraws only the requested asset through withdrawAsset", async function () {
    const [owner, alice, bob] = await ethers.getSigners();
    const system = await deploySystem();
    const token = await deployPaymentToken();
    const tokenAddress = await token.getAddress();

    await token.transfer(alice.address, 1000n * 10n ** 18n);
    await token.transfer(bob.address, 1000n * 10n ** 18n);
    await system.configurePaymentAsset(tokenAddress, true, false, TOKEN_PRICE_PER_PLATFORM_UNIT);
    await system.setProductionMode(true, tokenAddress);

    await token.connect(alice).approve(await system.getAddress(), 1000n * 10n ** 18n);
    await token.connect(bob).approve(await system.getAddress(), 1000n * 10n ** 18n);
    await registerWithSignedPlacement(system, alice, 0);
    await registerWithSignedPlacement(system, bob, 1);

    const before = await token.balanceOf(alice.address);
    await system.connect(alice).withdrawAsset(1, tokenAddress, usd(4.6));
    const after = await token.balanceOf(alice.address);

    expect(after - before).to.equal(usd(4.6) * TOKEN_PRICE_PER_PLATFORM_UNIT);
    expect(await system.userPlatformBalancesByAsset(1, tokenAddress)).to.equal(0n);
    expect(await system.userAssetBalances(1, tokenAddress)).to.equal(0n);
  });

  it("fails funded re-entry when the user does not have enough backed balance", async function () {
    const [, alice, bob] = await ethers.getSigners();
    const system = await deploySystem();
    const token = await deployPaymentToken();
    const tokenAddress = await token.getAddress();

    await token.transfer(alice.address, 5000n * 10n ** 18n);
    await token.transfer(bob.address, 5000n * 10n ** 18n);
    await token.connect(alice).approve(await system.getAddress(), 5000n * 10n ** 18n);
    await token.connect(bob).approve(await system.getAddress(), 5000n * 10n ** 18n);

    await system.configurePaymentAsset(tokenAddress, true, false, TOKEN_PRICE_PER_PLATFORM_UNIT);
    await system.setProductionMode(true, tokenAddress);

    await registerWithSignedPlacement(system, alice, 0);
    await registerWithSignedPlacement(system, bob, 1);
    await upgradeToLevel(system, bob, 2, 5);

    const [placementSigner] = await ethers.getSigners();
    const nonce = Number((await system.usersById(2)).rebirthCount);
    const { placementParentId, isLeft } = await findPlacementSlot(system, 1);
    const signature = await signReentryPlacement(system, placementSigner, bob.address, 2, 1, placementParentId, isLeft, nonce);
    await expect(
      system.connect(bob).executeReentryWithPlacement(2, tokenAddress, placementParentId, isLeft, signature)
    ).to.be.revertedWith("Insufficient balance");
  });

  it("returns on-chain referral, level, and branch analytics", async function () {
    const [, alice, bob, carol, dave, erin] = await ethers.getSigners();
    const system = await deploySystem();
    const analytics = await deployAnalytics(system);

    await registerWithSignedPlacement(system, alice, 0);
    await upgradeToLevel(system, alice, 1, 6);
    await registerWithSignedPlacement(system, bob, 1);
    await upgradeToLevel(system, bob, 2, 3);
    await registerWithSignedPlacement(system, carol, 1);
    await upgradeToLevel(system, carol, 3, 4);
    await registerWithSignedPlacement(system, dave, 2);
    await upgradeToLevel(system, dave, 4, 2);
    await registerWithSignedPlacement(system, erin, 2);
    await upgradeToLevel(system, erin, 5, 5);

    const directReferralIds = await system.getDirectReferralIds(1);
    expect(directReferralIds.map((value: bigint) => Number(value))).to.deep.equal([2, 3]);

    const levelSummary = await analytics.getLevelSummary(1);
    expect(levelSummary[0]).to.equal(4n);
    expect(levelSummary[1]).to.equal(2n);
    expect(levelSummary[2]).to.equal(6n);
    expect(levelSummary[3]).to.deep.equal([true, true, true, true, false, false, false, false, false, false]);

    const branchStats = await analytics.getTreeBranchStats(1);
    expect(branchStats[0]).to.equal(3n);
    expect(branchStats[1]).to.equal(2n);
    expect(branchStats[2]).to.equal(1n);
    expect(branchStats[3]).to.equal(3n);
    expect(branchStats[4]).to.equal(80n);
    expect(branchStats[5]).to.equal(220n);

    const financialSnapshot = await analytics.getUserFinancialSnapshot(1);
    expect(financialSnapshot[0]).to.equal(usd(14.2));
    expect(financialSnapshot[1]).to.equal(usd(320));
    expect(financialSnapshot[2]).to.equal(usd(14.2));
    expect(financialSnapshot[3]).to.equal(usd(320));
    expect(financialSnapshot[4]).to.equal(usd(9.2));
  });

  it("upgrades from V1 to V2 through UUPS while preserving state", async function () {
    const [, alice, bob] = await ethers.getSigners();
    const system = await deploySystem();

    await registerWithSignedPlacement(system, alice, 0);
    await registerWithSignedPlacement(system, bob, 1);

    const upgradeCycleLibFactory = await ethers.getContractFactory("UpgradeCycleLib");
    const upgradeCycleLib = await upgradeCycleLibFactory.deploy();
    await upgradeCycleLib.waitForDeployment();

    const v2Factory = await ethers.getContractFactory("MetaGuildXSystemV2", {
      libraries: {
        UpgradeCycleLib: await upgradeCycleLib.getAddress(),
      },
    });
    const upgraded = await upgrades.upgradeProxy(await system.getAddress(), v2Factory, {
      unsafeAllowLinkedLibraries: true,
    });
    await upgraded.waitForDeployment();

    expect(await upgraded.version()).to.equal("V2");
    expect((await upgraded.usersById(1)).account).to.equal(alice.address);
    expect(await upgraded.internalWalletBalances(1)).to.equal(usd(4.6));
    expect(await upgraded.nextUserId()).to.equal(3n);
  });

  it("supports production-mode token payments and real wallet withdrawal", async function () {
    const [owner, alice, bob] = await ethers.getSigners();
    const system = await deploySystem();
    const token = await deployPaymentToken();
    const tokenAddress = await token.getAddress();

    await token.transfer(alice.address, 1000n * 10n ** 18n);
    await token.transfer(bob.address, 1000n * 10n ** 18n);

    await system.configurePaymentAsset(tokenAddress, true, false, TOKEN_PRICE_PER_PLATFORM_UNIT);
    await system.setProductionMode(true, tokenAddress);

    await token.connect(alice).approve(await system.getAddress(), 1000n * 10n ** 18n);
    await token.connect(bob).approve(await system.getAddress(), 1000n * 10n ** 18n);

    await registerWithSignedPlacement(system, alice, 0);
    await registerWithSignedPlacement(system, bob, 1);

    const before = await token.balanceOf(alice.address);
    await system.connect(alice).withdrawInternalWallet(1, usd(4.6));
    const after = await token.balanceOf(alice.address);

    expect(after - before).to.equal(usd(4.6) * TOKEN_PRICE_PER_PLATFORM_UNIT);
  });

  it("pays the 10% creator share to the configured creator wallet in production mode", async function () {
    const [owner, alice, bob] = await ethers.getSigners();
    const system = await deploySystem();
    const token = await deployPaymentToken();
    const tokenAddress = await token.getAddress();

    await token.transfer(alice.address, 1000n * 10n ** 18n);
    await token.transfer(bob.address, 1000n * 10n ** 18n);
    await system.configurePaymentAsset(tokenAddress, true, false, TOKEN_PRICE_PER_PLATFORM_UNIT);
    await system.setProductionMode(true, tokenAddress);

    await token.connect(alice).approve(await system.getAddress(), 1000n * 10n ** 18n);
    await token.connect(bob).approve(await system.getAddress(), 1000n * 10n ** 18n);

    const ownerBefore = await token.balanceOf(owner.address);
    await registerWithSignedPlacement(system, alice, 0);
    await registerWithSignedPlacement(system, bob, 1);
    await system.connect(bob).upgradePackage(2, 2);
    const ownerAfter = await token.balanceOf(owner.address);

    expect(ownerAfter - ownerBefore).to.equal((usd(10) + usd(10)) * TOKEN_PRICE_PER_PLATFORM_UNIT / 10n);
  });

  it("routes multi-level income through IncomeRouter and keeps platform plus asset balances aligned", async function () {
    const [owner, alice, bob, carol, dave, erin] = await ethers.getSigners();
    const system = await deploySystem();
    const token = await deployPaymentToken();
    const tokenAddress = await token.getAddress();

    for (const signer of [alice, bob, carol, dave, erin]) {
      await token.transfer(signer.address, 5000n * 10n ** 18n);
      await token.connect(signer).approve(await system.getAddress(), 5000n * 10n ** 18n);
    }

    await system.configurePaymentAsset(tokenAddress, true, false, TOKEN_PRICE_PER_PLATFORM_UNIT);
    await system.setProductionMode(true, tokenAddress);

    await registerWithSignedPlacement(system, alice, 0);
    await registerWithSignedPlacement(system, bob, 1);
    await registerWithSignedPlacement(system, carol, 2);
    await registerWithSignedPlacement(system, erin, 1);
    await registerWithSignedPlacement(system, dave, 3);

    for (const level of [2, 3, 4, 5]) {
      await system.connect(alice).upgradePackage(1, level);
      await system.connect(bob).upgradePackage(2, level);
    }

    const daveUserId = await system.userIdByAddress(dave.address);
    await system.connect(dave).upgradePackage(daveUserId, 2);
    await system.connect(dave).upgradePackage(daveUserId, 3);
    await system.connect(dave).upgradePackage(daveUserId, 4);
    await system.connect(dave).upgradePackage(daveUserId, 5);

    const bobLedger = await system.incomesByUser(2);
    const aliceLedger = await system.incomesByUser(1);

    expect(bobLedger.levelIncome).to.be.greaterThan(0n);
    expect(aliceLedger.levelIncome).to.be.greaterThan(0n);
    expect(await system.internalWalletBalances(2)).to.equal(await system.userPlatformBalancesByAsset(2, tokenAddress));
    expect(await system.internalWalletBalances(1)).to.equal(await system.userPlatformBalancesByAsset(1, tokenAddress));
    expect(await system.userAssetBalances(2, tokenAddress)).to.equal((await system.userPlatformBalancesByAsset(2, tokenAddress)) * TOKEN_PRICE_PER_PLATFORM_UNIT);
    expect(await system.userAssetBalances(1, tokenAddress)).to.equal((await system.userPlatformBalancesByAsset(1, tokenAddress)) * TOKEN_PRICE_PER_PLATFORM_UNIT);
  });

  it("keeps staking rewards and stake withdrawals asset-backed in production mode", async function () {
      const [owner, alice] = await ethers.getSigners();
      const system = await deploySystem();
      const staking = await getStakingModule(system);
      const token = await deployPaymentToken();
    const tokenAddress = await token.getAddress();

    await token.transfer(alice.address, 5000n * 10n ** 18n);
    await system.configurePaymentAsset(tokenAddress, true, false, TOKEN_PRICE_PER_PLATFORM_UNIT);
    await system.setProductionMode(true, tokenAddress);

    await token.connect(alice).approve(await system.getAddress(), 5000n * 10n ** 18n);
    await registerWithSignedPlacement(system, alice, 0);

    await token.approve(await system.getAddress(), 5000n * 10n ** 18n);
    await system.fundStakingRewardPool(1000);
    await system.connect(alice).stake(1000, 365 * 24 * 60 * 60, false);

    await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    await system.connect(alice).claimStakingReward();
    expect(await system.userPlatformBalancesByAsset(1, tokenAddress)).to.be.greaterThan(0n);
    expect(await system.userAssetBalances(1, tokenAddress)).to.be.greaterThan(0n);

    await ethers.provider.send("evm_increaseTime", [366 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    await system.connect(alice).withdrawStake(400);
    expect(await system.userPlatformBalancesByAsset(1, tokenAddress)).to.be.greaterThan(300n);
    expect(await system.userAssetBalances(1, tokenAddress)).to.be.greaterThan(300n * TOKEN_PRICE_PER_PLATFORM_UNIT);
  });

  it("uses claim-based cashback distribution without looping through users", async function () {
    const [owner, alice, bob, carol] = await ethers.getSigners();
    const system = await deploySystem();

    await registerWithSignedPlacement(system, alice, 0);
    await registerWithSignedPlacement(system, bob, 1);
    await registerWithSignedPlacement(system, carol, 1);

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    await system.connect(alice).surrenderForCashback(1);
    await system.connect(owner).distributeCashback();

    const pending = await system.pendingCashback(1);
    expect(pending).to.equal(usd(1.2));

    await system.connect(alice).claimCashback(1);
    expect(await system.internalWalletBalances(1)).to.equal(usd(10.4));
  });

  it("auto upgrades from earned income and auto compounds on accrual", async function () {
    const signers = await ethers.getSigners();
    const [, alice] = signers;
    const system = await deploySystem();
    const staking = await getStakingModule(system);

    await registerWithSignedPlacement(system, alice, 0);

    for (let i = 2; i <= 11; i += 1) {
      await registerWithSignedPlacement(system, signers[i], 1);
    }

    expect((await system.usersById(1)).packageLevel).to.equal(2n);

    await system.fundStakingRewardPool(10000);
    await system.connect(alice).stake(1000, 365 * 24 * 60 * 60, true);

    await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    await system.connect(alice).stake(100, 365 * 24 * 60 * 60, true);

    const position = await staking.getStakePosition(alice.address);
    expect(position.amount).to.be.greaterThan(880n);
    expect(position.accruedReward).to.equal(0n);
  });

  it("wires the modular system end to end for production-style flows", async function () {
    const [owner, alice, bob, carol, dave, erin] = await ethers.getSigners();
    const system = await deploySystem();
    const staking = await getStakingModule(system);
    const token = await deployPaymentToken();
    const tokenAddress = await token.getAddress();

    expect(await system.incomeContract()).to.not.equal(ethers.ZeroAddress);
    expect(await system.stakingContract()).to.not.equal(ethers.ZeroAddress);
    expect(await system.cashbackContract()).to.not.equal(ethers.ZeroAddress);
    expect(await system.upgradeManagerContract()).to.not.equal(ethers.ZeroAddress);

    for (const signer of [alice, bob, carol, dave, erin]) {
      await token.transfer(signer.address, 20000n * 10n ** 18n);
      await token.connect(signer).approve(await system.getAddress(), 20000n * 10n ** 18n);
    }
    await token.approve(await system.getAddress(), 50000n * 10n ** 18n);

    await system.configurePaymentAsset(tokenAddress, true, false, TOKEN_PRICE_PER_PLATFORM_UNIT);
    await system.setProductionMode(true, tokenAddress);

    await registerWithSignedPlacement(system, alice, 0);
    await registerWithSignedPlacement(system, bob, 1);
    await registerWithSignedPlacement(system, carol, 2);
    await registerWithSignedPlacement(system, dave, 1);
    await registerWithSignedPlacement(system, erin, 2);

    await system.connect(alice).upgradePackage(1, 2);
    await system.connect(alice).upgradePackage(1, 3);
    await system.connect(bob).upgradePackage(2, 2);
    await system.connect(bob).upgradePackage(2, 3);
    await system.connect(bob).upgradePackage(2, 4);

    const carolUserId = await system.userIdByAddress(carol.address);
    await system.connect(carol).upgradePackage(carolUserId, 2);
    await system.connect(carol).upgradePackage(carolUserId, 3);
    await system.connect(carol).upgradePackage(carolUserId, 4);
    await system.connect(carol).upgradePackage(carolUserId, 5);

    await system.fundStakingRewardPool(5000);
    await system.connect(alice).stake(1000, 365 * 24 * 60 * 60, false);

    await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    await system.connect(alice).claimStakingReward();

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    await system.connect(alice).surrenderForCashback(1);
    await system.distributeCashback();
    await system.connect(alice).claimCashback(1);

    const beforeWithdraw = await token.balanceOf(alice.address);
    await system.connect(alice).withdrawAsset(1, tokenAddress, usd(4.6));
    const afterWithdraw = await token.balanceOf(alice.address);

    expect(afterWithdraw - beforeWithdraw).to.be.greaterThanOrEqual(usd(4.6) * TOKEN_PRICE_PER_PLATFORM_UNIT);
    expect(await system.internalWalletBalances(1)).to.equal(await system.userPlatformBalancesByAsset(1, tokenAddress));
    expect(await system.userAssetBalances(1, tokenAddress)).to.be.greaterThanOrEqual(
      (await system.userPlatformBalancesByAsset(1, tokenAddress)) * TOKEN_PRICE_PER_PLATFORM_UNIT
    );

    const alicePosition = await staking.getStakePosition(alice.address);
    expect(alicePosition.amount).to.be.greaterThan(0n);
    expect((await system.incomesByUser(2)).levelIncome).to.be.greaterThan(0n);
    expect((await system.incomesByUser(2)).directIncome).to.be.greaterThan(0n);
  });
});
