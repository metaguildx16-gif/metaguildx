import { ethers } from "hardhat";
import path from "node:path";
import fs from "node:fs";

async function signPlacement(
  system: Awaited<ReturnType<typeof ethers.getContractAt>>,
  signer: Awaited<ReturnType<typeof ethers.getSigners>>[number],
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

async function findPlacementSlot(system: Awaited<ReturnType<typeof ethers.getContractAt>>, sponsorId: number) {
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

async function ensureRegistration(
  system: Awaited<ReturnType<typeof ethers.getContractAt>>,
  placementSigner: Awaited<ReturnType<typeof ethers.getSigners>>[number],
  signer: Awaited<ReturnType<typeof ethers.getSigners>>[number],
  sponsorId: number
) {
  const existingUserId = await system.userIdByAddress(signer.address);
  if (existingUserId !== 0n) {
    return Number(existingUserId);
  }

  const nonce = Number(await system.nonces(signer.address));
  const { placementParentId, isLeft } = await findPlacementSlot(system, sponsorId);
  const signature = await signPlacement(system, placementSigner, signer.address, sponsorId, placementParentId, isLeft, nonce);
  await (await system.connect(signer).registerWithPlacement(sponsorId, placementParentId, isLeft, signature, nonce)).wait();

  return Number(await system.userIdByAddress(signer.address));
}

async function ensurePackageLevel(
  system: Awaited<ReturnType<typeof ethers.getContractAt>>,
  signer: Awaited<ReturnType<typeof ethers.getSigners>>[number],
  userId: number,
  targetLevel: number
) {
  const profile = await system.usersById(userId);
  for (let level = Number(profile.packageLevel) + 1; level <= targetLevel; level += 1) {
    await (await system.connect(signer).upgradePackage(userId, level)).wait();
  }
}

async function getStakingModule(system: Awaited<ReturnType<typeof ethers.getContractAt>>) {
  const stakingAddress = await system.stakingContract();
  return ethers.getContractAt("MGXStaking", stakingAddress);
}

async function getCashbackModule(system: Awaited<ReturnType<typeof ethers.getContractAt>>) {
  const cashbackAddress = await system.cashbackContract();
  return ethers.getContractAt("CashbackPool", cashbackAddress);
}

async function ensureFunding(system: Awaited<ReturnType<typeof ethers.getContractAt>>, amount: number) {
  const staking = await getStakingModule(system);
  const currentPool = await staking.rewardPool();
  if (currentPool >= BigInt(amount)) {
    return;
  }

  await (await system.fundStakingRewardPool(amount - Number(currentPool))).wait();
}

async function ensureStake(
  system: Awaited<ReturnType<typeof ethers.getContractAt>>,
  signer: Awaited<ReturnType<typeof ethers.getSigners>>[number],
  amount: number,
  duration: number,
  autoCompound: boolean
) {
  const staking = await getStakingModule(system);
  const position = await staking.getStakePosition(signer.address);
  if (position.amount > 0n) {
    return;
  }

  await (await system.connect(signer).stake(amount, duration, autoCompound)).wait();
}

async function main() {
  const workspaceRoot = path.resolve(__dirname, "..", "..");
  const deploymentPath = path.join(workspaceRoot, "contracts", "deployments", "localhost.json");

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Localhost deployment not found: ${deploymentPath}`);
  }

  const deploymentFile = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as {
    deployment: { address: string };
  };

  const system = await ethers.getContractAt("MetaGuildXSystem", deploymentFile.deployment.address);
  const [owner, alice, bob, carol, dave, erin] = await ethers.getSigners();
  const placementSigner = owner;

  const aliceUserId = await ensureRegistration(system, placementSigner, alice, 0);
  const bobUserId = await ensureRegistration(system, placementSigner, bob, aliceUserId);
  const carolUserId = await ensureRegistration(system, placementSigner, carol, aliceUserId);
  const daveUserId = await ensureRegistration(system, placementSigner, dave, bobUserId);
  const erinUserId = await ensureRegistration(system, placementSigner, erin, bobUserId);

  await ensurePackageLevel(system, alice, aliceUserId, 6);
  await ensurePackageLevel(system, bob, bobUserId, 3);
  await ensurePackageLevel(system, carol, carolUserId, 4);
  await ensurePackageLevel(system, dave, daveUserId, 2);
  await ensurePackageLevel(system, erin, erinUserId, 5);

  await ensureFunding(system.connect(owner), 250000);
  await ensureStake(system, alice, 5000, 365 * 24 * 60 * 60, true);
  await ensureStake(system, bob, 2400, 730 * 24 * 60 * 60, false);
  await ensureStake(system, carol, 3200, 1095 * 24 * 60 * 60, true);

  const staking = await getStakingModule(system);
  const cashback = await getCashbackModule(system);
  const bobPosition = await staking.getStakePosition(bob.address);
  if (bobPosition.rewardDebt === 0n || bobPosition.accruedReward === 0n) {
    await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);
  }

  if ((await system.pendingStakingReward(bob.address)) > 0n) {
    await (await system.connect(bob).claimStakingReward()).wait();
  }
  if ((await system.pendingStakingReward(carol.address)) > 0n) {
    await (await system.connect(carol).compoundStakingReward()).wait();
  }

  const bobProfile = await system.usersById(bobUserId);
  if (Number(bobProfile.packageLevel) < 4) {
    await (await system.connect(bob).upgradePackage(bobUserId, 4)).wait();
  }

  const summary = {
    contract: deploymentFile.deployment.address,
    seededUsers: [
      { label: "Owner / Placement Signer", address: owner.address },
      { label: "Alice", address: alice.address },
      { label: "Bob", address: bob.address },
      { label: "Carol", address: carol.address },
      { label: "Dave", address: dave.address },
      { label: "Erin", address: erin.address }
    ],
    stakingRewardPool: (await staking.rewardPool()).toString(),
    totalStaked: (await staking.totalStaked()).toString(),
    cashbackPoolBalance: (await cashback.cashbackPoolBalance()).toString(),
    rootUserId: (await system.rootUserId()).toString()
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
