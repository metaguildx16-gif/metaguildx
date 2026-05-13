import { ethers } from "hardhat";
import fs from "node:fs";
import path from "node:path";

async function signPlacement(
  signer: Awaited<ReturnType<typeof ethers.getSigners>>[number],
  systemAddress: string,
  account: string,
  sponsorId: bigint,
  placementParentId: bigint,
  isLeft: boolean,
  nonce: bigint
) {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const structHash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256", "bool", "uint256"],
    [chainId, systemAddress, account, sponsorId, placementParentId, isLeft, nonce]
  );
  return signer.signMessage(ethers.getBytes(structHash));
}

async function main() {
  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments", "localhost.json"), "utf8")
  ) as {
    deployment: { address: string };
    contracts: {
      mgxToken: { address: string };
      binaryTree?: { proxy: string };
      incomeRouter: { proxy: string };
      upgradeManager: { proxy: string };
      cashbackPool: { proxy: string };
    };
  };

  const [deployer, user1, user2, user3] = await ethers.getSigners();
  const proxyAddress = deployment.deployment.address;

  const FUND_AMOUNT = ethers.parseUnits("100", 18);

  const system = await ethers.getContractAt("MetaGuildXSystem", proxyAddress);
  const upgraded = await ethers.getContractAt("MetaGuildXSystemV2", proxyAddress);
  const binaryTree = deployment.contracts.binaryTree
    ? await ethers.getContractAt("BinaryTree", deployment.contracts.binaryTree.proxy)
    : null;
  const upgradeManager = await ethers.getContractAt("UpgradeManager", deployment.contracts.upgradeManager.proxy);
  const cashbackPool = await ethers.getContractAt("CashbackPool", deployment.contracts.cashbackPool.proxy);
  const usdtFactory = await ethers.getContractFactory("MockUSDT");
  const usdt = await usdtFactory.deploy(deployer.address);
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();

  await (await system.setUsdtTokenAddress(usdtAddress)).wait();
  await (await system.configurePaymentAsset(usdtAddress, true, false, 10n ** 17n)).wait();
  await (await system.setProductionMode(true, usdtAddress)).wait();

  console.log("Funding test users with USDT...");
  await (await usdt.connect(deployer).mint(user1.address, FUND_AMOUNT)).wait();
  await (await usdt.connect(deployer).mint(user2.address, FUND_AMOUNT)).wait();
  await (await usdt.connect(deployer).mint(user3.address, FUND_AMOUNT)).wait();
  console.log("USDT funding: DONE");

  console.log("Approving MetaGuildXSystem...");
  await (await usdt.connect(user1).approve(proxyAddress, FUND_AMOUNT)).wait();
  await (await usdt.connect(user2).approve(proxyAddress, FUND_AMOUNT)).wait();
  await (await usdt.connect(user3).approve(proxyAddress, FUND_AMOUNT)).wait();
  console.log("Approve: DONE");

  const creatorBalanceBefore = await usdt.balanceOf(deployer.address);

  const postUpgrade = {
    owner: await system.owner(),
    nextUserId: (await system.nextUserId()).toString(),
    version: (await upgraded.version()).toString()
  };

  console.log("\n--- Test 1: Registration ---");
  const sig1 = await signPlacement(deployer, proxyAddress, user1.address, 0n, 0n, false, 0n);
  await (await system.connect(user1).registerWithPlacement(0, 0, false, sig1, 0)).wait();
  const user1Id = await system.userIdByAddress(user1.address);
  const user1Node = await system.treeNodes(user1Id);
  console.log("User1 registered:", user1Id > 0n);

  console.log("\n--- Test 2: Second user placement ---");
  const sig2 = await signPlacement(deployer, proxyAddress, user2.address, 1n, 1n, true, 0n);
  const tx2 = await system.connect(user2).registerWithPlacement(1, 1, true, sig2, 0);
  const receipt2 = await tx2.wait();
  const user2Id = await system.userIdByAddress(user2.address);
  const user2Node = await system.treeNodes(user2Id);
  const binaryTreeNode = binaryTree ? await binaryTree.nodes(user2Id) : null;
  const binaryTreeSyncFailed = await system.queryFilter(system.filters.BinaryTreeSyncFailed());
  console.log("BinaryTree node mirrored:", binaryTreeNode?.userId?.toString() ?? "N/A");

  console.log("\n--- Test 3: Income tracking ---");
  const user1Ledger = await system.incomesByUser(user1Id);
  const totalIncomeTracked = await upgradeManager.totalIncomeReceived(user1Id);
  const upgradeTrackFailed = await system.queryFilter(system.filters.UpgradeTrackFailed());
  console.log("Direct income:", user1Ledger.directIncome.toString());
  console.log("UpgradeManager tracked:", totalIncomeTracked.toString());

  console.log("\n--- Test 4: Cashback ---");
  const cashbackPoolBalance = await cashbackPool.cashbackPoolBalanceByAsset(usdtAddress);
  console.log("CashbackPool balance:", cashbackPoolBalance.toString());

  console.log("\n--- Test 5: Creator fee ---");
  const creatorBalanceAfter = await usdt.balanceOf(deployer.address);
  const creatorFeeReceived = creatorBalanceAfter - creatorBalanceBefore;
  console.log("Creator wallet USDT gained:", ethers.formatUnits(creatorFeeReceived, 18));

  const tests = [
    {
      name: "Registration",
      result: user1Id === 1n && user1Node.userId === 1n ? "PASS" : "FAIL",
      error: user1Id === 1n ? null : `Unexpected user1 id ${user1Id}`
    },
    {
      name: "BinaryTree",
      result:
        binaryTree !== null &&
        user2Id === 2n &&
        user2Node.parentId === 1n &&
        binaryTreeNode !== null &&
        binaryTreeNode.userId === 2n &&
        binaryTreeSyncFailed.length === 0
          ? "PASS"
          : "FAIL",
      error:
        binaryTree === null
          ? "BinaryTree proxy missing from deployment record"
          : `parent=${user2Node.parentId} mirrored=${binaryTreeNode?.userId ?? 0} syncFailed=${binaryTreeSyncFailed.length}`
    },
    {
      name: "Income tracking",
      result:
        user1Ledger.directIncome === 46n &&
        totalIncomeTracked === 50n &&
        upgradeTrackFailed.length === 0
          ? "PASS"
          : "FAIL",
      error:
        upgradeTrackFailed.length === 0
          ? null
          : `direct=${user1Ledger.directIncome} tracked=${totalIncomeTracked} failures=${upgradeTrackFailed.length}`
    },
    {
      name: "Cashback 4%",
      result: cashbackPoolBalance === 8n ? "PASS" : "FAIL",
      error: cashbackPoolBalance === 8n ? null : `Expected 8, got ${cashbackPoolBalance}`
    },
    {
      name: "Creator fee 10%",
      result: creatorFeeReceived === ethers.parseUnits("2", 18) ? "PASS" : "FAIL",
      error:
        creatorFeeReceived === ethers.parseUnits("2", 18)
          ? null
          : `Expected 2 USDT, got ${ethers.formatUnits(creatorFeeReceived, 18)} USDT`
    }
  ];

  const passed = tests.filter((test) => test.result === "PASS").length;

  console.log("\n=== SMOKE TEST RESULTS ===");
  for (const test of tests) {
    console.log(`${test.name}: ${test.result}${test.error ? ` (${test.error})` : ""}`);
  }
  console.log(`Total: ${passed}/5`);
  console.log(`Deploy ready: ${passed === 5 ? "YES" : "NOT YET"}`);

  console.log(
    JSON.stringify(
      {
        postUpgrade,
        receipt2Hash: receipt2?.hash ?? null,
        directIncome: user1Ledger.directIncome.toString(),
        totalIncomeTracked: totalIncomeTracked.toString(),
        cashbackPoolBalance: cashbackPoolBalance.toString(),
        creatorFeeReceived: creatorFeeReceived.toString(),
        usdtToken: usdtAddress,
        upgradeTrackFailed: upgradeTrackFailed.length,
        tests
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
