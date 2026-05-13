import { ethers, upgrades } from "hardhat";

async function main() {
const PROXY = "0xcEca88482b8e14D7F19A99A0E371f0b49cDEA597";
  const [signer] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("MGXStaking");

  const upgraded = await upgrades.upgradeProxy(PROXY, Factory, {
    unsafeSkipStorageLayoutCheck: false,
    redeployImplementation: "always"
  });

  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967.getImplementationAddress(PROXY);
  console.log("New impl:", newImpl);

  const staking = await ethers.getContractAt("MGXStaking", PROXY);

  try {
    const count = await staking.getPositionCount(signer.address);
    console.log("getPositionCount works:", count.toString(), "âœ…");
  } catch (e: any) {
    console.log("getPositionCount FAILED:", e.message);
  }

  try {
    const positions = await staking.getStakePositions(signer.address);
    console.log("getStakePositions works:", positions.length, "positions âœ…");
  } catch (e: any) {
    console.log("getStakePositions FAILED:", e.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
