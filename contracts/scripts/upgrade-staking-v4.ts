import { ethers, upgrades } from "hardhat";

async function main() {
  const STAKING =
    "0x064729f189AA5e0CE6e7Ab1C36DE6245e9ccDb53";

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const Factory = await ethers.getContractFactory(
    "MGXStaking"
  );

  try {
    await upgrades.forceImport(STAKING, Factory, {
      kind: "uups"
    });
    console.log("Imported ✅");
  } catch (e) {
    console.log("Already imported, continuing...");
  }

  await upgrades.upgradeProxy(STAKING, Factory, {
    kind: "uups",
    unsafeAllowLinkedLibraries: true,
    redeployImplementation: "always"
  });
  console.log("Upgraded ✅");

  const staking = await ethers.getContractAt(
    "MGXStaking", STAKING
  );

  const positions = await staking.getStakePositions(
    deployer.address
  );
  console.log("V2 positions:", positions.length);

  const pending = await staking.pendingStakingReward(
    deployer.address
  );
  console.log("Pending:", ethers.formatEther(pending));

  const SLOT =
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const raw = await ethers.provider.getStorage(
    STAKING, SLOT
  );
  console.log("New impl:", "0x" + raw.slice(26));
}

main().catch(console.error);
