import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const { ethers } = hre as any;
  const [deployer] = await ethers.getSigners();

  const SYSTEM_ADDRESS = process.env.SYSTEM_PROXY_ADDRESS;
  if (!SYSTEM_ADDRESS) {
    throw new Error("SYSTEM_PROXY_ADDRESS not set in .env");
  }

  const NEW_SIGNER_ADDRESS = process.env.PLACEMENT_SIGNER_ADDRESS;
  if (!NEW_SIGNER_ADDRESS) {
    throw new Error("PLACEMENT_SIGNER_ADDRESS not set in .env");
  }

  console.log("Deployer:", deployer.address);
  console.log("Setting placement signer to:", NEW_SIGNER_ADDRESS);

  const system = await ethers.getContractAt("MetaGuildXCore", SYSTEM_ADDRESS, deployer);

  const tx = await system.setPlacementSigner(NEW_SIGNER_ADDRESS);
  await tx.wait();

  console.log("Placement signer updated");
  console.log("TX hash:", tx.hash);

  const current = await system.placementSigner();
  console.log("Contract placementSigner now:", current);
  console.log("Match:", current.toLowerCase() === NEW_SIGNER_ADDRESS.toLowerCase());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
