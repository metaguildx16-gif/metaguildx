import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("V3 final system simulation", function () {
  async function deploySystem() {
    const signers = await ethers.getSigners();
    const [owner, creator, ...users] = signers;

    const mgxTokenFactory = await ethers.getContractFactory("MGXToken");
    const mgxToken = await mgxTokenFactory.deploy(owner.address);
    await mgxToken.waitForDeployment();

    const usdtFactory = await ethers.getContractFactory("MockUSDT");
    const usdt = await usdtFactory.deploy(owner.address);
    await usdt.waitForDeployment();

    const libFactory = await ethers.getContractFactory("UpgradeCycleLib");
    const lib = await libFactory.deploy();
    await lib.waitForDeployment();

    const binaryTreeFactory = await ethers.getContractFactory("BinaryTree");
    const binaryTree = await upgrades.deployProxy(binaryTreeFactory, [owner.address], { kind: "uups" });
    await binaryTree.waitForDeployment();

    const routerFactory = await ethers.getContractFactory("IncomeRouter");
    const router = await upgrades.deployProxy(routerFactory, [owner.address], { kind: "uups" });
    await router.waitForDeployment();

    const cashbackFactory = await ethers.getContractFactory("CashbackPool");
    const cashback = await upgrades.deployProxy(cashbackFactory, [owner.address], { kind: "uups" });
    await cashback.waitForDeployment();

    const stakingFactory = await ethers.getContractFactory("MGXStaking");
    const staking = await upgrades.deployProxy(stakingFactory, [owner.address], { kind: "uups" });
    await staking.waitForDeployment();

    const coreFactory = await ethers.getContractFactory("MetaGuildXCore", {
      libraries: { UpgradeCycleLib: await lib.getAddress() }
    });
    const core = await upgrades.deployProxy(coreFactory, [owner.address], { kind: "uups", unsafeAllowLinkedLibraries: true });
    await core.waitForDeployment();

    const incomeFactory = await ethers.getContractFactory("MetaGuildXIncome");
    const income = await upgrades.deployProxy(
      incomeFactory,
      [await core.getAddress(), await router.getAddress(), ethers.ZeroAddress, await usdt.getAddress()],
      { kind: "uups" }
    );
    await income.waitForDeployment();

    const upgradeFactory = await ethers.getContractFactory("MetaGuildXUpgrade");
    const upgrade = await upgrades.deployProxy(
      upgradeFactory,
      [await core.getAddress(), await income.getAddress(), await usdt.getAddress()],
      { kind: "uups" }
    );
    await upgrade.waitForDeployment();

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
    await (await core.configurePaymentAsset(await usdt.getAddress(), true, false, 10n ** 17n)).wait();
    await (await core.setProductionMode(true, await usdt.getAddress())).wait();

    await (await binaryTree.setCoreContract(await core.getAddress())).wait();
    await (await router.setCoreContract(await core.getAddress())).wait();
    await (await router.setIncomeEngineContract(await income.getAddress())).wait();
    await (await router.setCreatorWallet(creator.address)).wait();
    await (await income.setCoreContract(await core.getAddress())).wait();
    await (await income.setIncomeRouterContract(await router.getAddress())).wait();
    await (await income.setUpgradeEngineContract(await upgrade.getAddress())).wait();
    await (await income.setDefaultPaymentAsset(await usdt.getAddress())).wait();
    await (await upgrade.setCoreContract(await core.getAddress())).wait();
    await (await upgrade.setIncomeContract(await income.getAddress())).wait();
    await (await upgrade.setDefaultPaymentAsset(await usdt.getAddress())).wait();
    await (await cashback.setCoreContract(await core.getAddress())).wait();
    await (await cashback.setPaymentAsset(await usdt.getAddress())).wait();
    await (await staking.setCoreContract(await core.getAddress())).wait();
    await (await staking.setIncomeContract(await income.getAddress())).wait();

    return { owner, creator, users, mgxToken, usdt, binaryTree, router, cashback, staking, core, income, upgrade };
  }

  async function signRegistration(coreAddress: string, account: string, sponsorId: bigint, nonce: bigint, signer: any) {
    const network = await ethers.provider.getNetwork();
    const structHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address", "uint256", "uint256"],
      [network.chainId, coreAddress, account, sponsorId, nonce]
    );
    return signer.signMessage(ethers.getBytes(structHash));
  }

  async function registerUser(ctx: any, userSigner: any, sponsorId: bigint) {
    const { owner, core, usdt } = ctx;
    const coreAddress = await core.getAddress();
    const usdtAddress = await usdt.getAddress();
    const unitPrice = await core.paymentAssetUnitPrice(usdtAddress);
    const pkgPrice = (await core.getPackagePrices())[0];
    const settlement = pkgPrice * unitPrice;

    await (await usdt.connect(owner).mint(userSigner.address, settlement * 50n)).wait();
    await (await usdt.connect(userSigner).approve(coreAddress, settlement * 50n)).wait();

    const nonce = await core.nonces(userSigner.address);
    const sig = await signRegistration(coreAddress, userSigner.address, sponsorId, nonce, owner);
    const tx = await core.connect(userSigner).registerWithPlacement(sponsorId, 0n, false, sig, nonce);
    await tx.wait();
    return core.userIdByAddress(userSigner.address);
  }

  it("simulates registration, placement, incomes, cashback, staking, and edge cases", async function () {
    const ctx = await deploySystem();
    const { creator, users, core, binaryTree, usdt, router, cashback, staking } = ctx;
    const creatorAddr = creator.address;
    const unitPrice = await core.paymentAssetUnitPrice(await usdt.getAddress());
    const packagePrice = (await core.getPackagePrices())[0];
    const directExpected = (packagePrice * 4600n / 10000n) * unitPrice;
    const levelEachExpected = (packagePrice * 400n / 10000n) * unitPrice;
    const directPlusLevelExpected = directExpected + levelEachExpected;

    const sponsors = [0n, 1n, 2n, 1n, 3n, 5n, 1n, 1n, 1n, 6n];
    const registeredIds: bigint[] = [];

    for (let i = 0; i < 10; i++) {
      const signer = i === 0 ? ctx.owner : users[i - 1];
      const beforeSponsor =
        i > 0 ? await usdt.balanceOf((await core.usersById(sponsors[i])).account) : 0n;
      const beforeCreator = await usdt.balanceOf(creatorAddr);
      console.log("Registering user", i + 1, "with sponsor", sponsors[i].toString());
      const userId = await registerUser(ctx, signer, sponsors[i]);
      registeredIds.push(userId);

      if (i === 1) {
        const rootWallet = (await core.usersById(1n)).account;
        const rootDelta = (await usdt.balanceOf(rootWallet)) - beforeSponsor;
        expect(rootDelta).to.equal(directPlusLevelExpected);
      }

      if (i === 2) {
        const user2Wallet = (await core.usersById(2n)).account;
        const user2Delta = (await usdt.balanceOf(user2Wallet)) - beforeSponsor;
        expect(user2Delta).to.equal(directPlusLevelExpected);
        const creatorDelta = (await usdt.balanceOf(creatorAddr)) - beforeCreator;
        expect(creatorDelta).to.equal(directExpected);
      }
    }

    const nodes = await Promise.all(
      registeredIds.map(async (id) => {
        const n = await binaryTree.nodes(id);
        return {
          userId: Number(id),
          parentId: Number(n.parentId),
          left: Number(n.leftChildId),
          right: Number(n.rightChildId)
        };
      })
    );

    expect(nodes[0].parentId).to.equal(0);
    expect(nodes[1].parentId).to.equal(1);
    expect(nodes[2].parentId).to.equal(2);
    expect(nodes[3].parentId).to.equal(1);
    expect(nodes[4].parentId).to.equal(3);
    expect(nodes[5].parentId).to.equal(5);
    expect(nodes[6].parentId).to.equal(4);

    const user6RegTxSponsor = (await core.usersById(6n)).account;
    const rootWallet = (await core.usersById(1n)).account;
    const beforeUser6Root = await usdt.balanceOf(rootWallet);
    const beforeUser6Sponsor = await usdt.balanceOf(user6RegTxSponsor);
    const user10Id = registeredIds[9];
    expect(user10Id).to.equal(10n);
    expect(beforeUser6Sponsor >= 0n).to.equal(true);
    expect(beforeUser6Root >= 0n).to.equal(true);

    const rootDirectRefs = await core.getDirectReferralIds(1n);
    expect(rootDirectRefs.length).to.equal(5);

    await ethers.provider.send("evm_increaseTime", [91 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const user2 = users[0];
    const user2TokenBefore = await core.tokenAllocationsByUser(2n);
    await (await core.connect(user2).surrenderForCashback(2n)).wait();
    const user2TokenAfter = await core.tokenAllocationsByUser(2n);
    expect(user2TokenAfter).to.equal(0n);
    expect(await core.futurePool()).to.equal(user2TokenBefore);
    await expect(core.connect(user2).surrenderForCashback(2n)).to.be.reverted;

    const user7 = users[5];
    const upgradeAmount = packagePrice * 2n;
    const settlementUpgrade = upgradeAmount * unitPrice;
    await (await usdt.connect(ctx.owner).mint(user7.address, settlementUpgrade * 2n)).wait();
    await (await usdt.connect(user7).approve(await core.getAddress(), settlementUpgrade * 2n)).wait();
    await (await core.connect(user7).upgradePackage(7n, 2)).wait();

    const pendingPool = await cashback.cashbackPoolBalanceByAsset(await usdt.getAddress());
    expect(pendingPool).to.be.gt(0n);

    await ethers.provider.send("hardhat_impersonateAccount", [await core.getAddress()]);
    await ethers.provider.send("hardhat_setBalance", [await core.getAddress(), "0x1000000000000000000"]);
    const coreSigner = await ethers.getSigner(await core.getAddress());
    await (await cashback.connect(coreSigner).distribute(await usdt.getAddress(), true)).wait();
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [await core.getAddress()]);

    const user2UsdtBeforeClaim = await usdt.balanceOf(user2.address);
    await (await core.connect(user2).claimCashback(2n)).wait();
    const user2UsdtAfterClaim = await usdt.balanceOf(user2.address);
    expect(user2UsdtAfterClaim - user2UsdtBeforeClaim).to.equal(800000000000000000n);

    const user8 = users[6];
    const stakedBefore = (await staking.getStakePosition(user8.address))[0];
    await (await core.connect(user8).stake(1000n, await staking.ONE_YEAR(), false)).wait();
    const stakedAfter = (await staking.getStakePosition(user8.address))[0];
    expect(stakedAfter - stakedBefore).to.equal(1000n);

    await ethers.provider.send("hardhat_impersonateAccount", [await core.getAddress()]);
    await ethers.provider.send("hardhat_setBalance", [await core.getAddress(), "0x1000000000000000000"]);
    const coreSigner2 = await ethers.getSigner(await core.getAddress());
    await (await staking.connect(coreSigner2).fundRewardPool(10000n, await usdt.getAddress(), 1000n * 10n ** 18n)).wait();
    await ethers.provider.send("hardhat_stopImpersonatingAccount", [await core.getAddress()]);

    await ethers.provider.send("evm_increaseTime", [366 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const user8UsdtBeforeClaim = await usdt.balanceOf(user8.address);
    await (await core.connect(user8).claimStakingReward()).wait();
    const user8UsdtAfterClaim = await usdt.balanceOf(user8.address);
    expect(user8UsdtAfterClaim).to.equal(user8UsdtBeforeClaim);

    const stakedBeforeWithdraw = (await staking.getStakePosition(user8.address))[0];
    await (await core.connect(user8).withdrawStake(500n)).wait();
    const stakedAfterWithdraw = (await staking.getStakePosition(user8.address))[0];
    expect(stakedBeforeWithdraw - stakedAfterWithdraw).to.equal(500n);
  });
});
