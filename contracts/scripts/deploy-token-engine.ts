import { ethers, upgrades } from "hardhat";

async function main() {
  const CORE = "0xBD66787F1eBe0A135e64240F1822C9082d7a20eF";
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const TokenEngine = await ethers.getContractFactory("MetaGuildXTokenEngine");
  const tokenEngine = await upgrades.deployProxy(
    TokenEngine,
    [CORE],
    { kind: "uups" }
  );
  await tokenEngine.waitForDeployment();
  const tokenEngineAddress = await tokenEngine.getAddress();
  console.log("TokenEngine deployed:", tokenEngineAddress);

  const core = await ethers.getContractAt("MetaGuildXCore", CORE, deployer);
  const tx = await core.setTokenEngineContract(tokenEngineAddress);
  await tx.wait();
  console.log("TokenEngine wired to Core ✅");
  console.log("Wire TX:", tx.hash);
}

main().catch(console.error);
