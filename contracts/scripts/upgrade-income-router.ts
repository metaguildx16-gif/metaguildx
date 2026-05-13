import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

dotenv.config();

async function main() {
  const PROXY = process.env.INCOME_ROUTER_PROXY ?? process.env.INCOME_ROUTER_ADDRESS!;
  const [deployer] = await ethers.getSigners();

  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "src",
    "IncomeRouter.sol",
    "IncomeRouter.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const localBytes = artifact.deployedBytecode.startsWith("0x")
    ? (artifact.deployedBytecode.length - 2) / 2
    : artifact.deployedBytecode.length / 2;

  const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY);
  const liveCode = await ethers.provider.getCode(currentImpl);
  const liveBytes = liveCode.startsWith("0x") ? (liveCode.length - 2) / 2 : liveCode.length / 2;

  console.log("Upgrading IncomeRouter...");
  console.log("Proxy:", PROXY);
  console.log("Signer:", deployer.address);
  console.log("Current impl:", currentImpl);
  console.log("Live impl bytes:", liveBytes);
  console.log("Local compiled bytes:", localBytes);

  const Factory = await ethers.getContractFactory("IncomeRouter");
  const upgraded = await upgrades.upgradeProxy(PROXY, Factory, {
    redeployImplementation: "always"
  });
  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967.getImplementationAddress(PROXY);
  const newCode = await ethers.provider.getCode(newImpl);
  const newBytes = newCode.startsWith("0x") ? (newCode.length - 2) / 2 : newCode.length / 2;

  console.log("IncomeRouter new impl:", newImpl);
  console.log("New impl bytes:", newBytes);

  const router = await ethers.getContractAt("IncomeRouter", PROXY);
  console.log("creatorWallet:", await router.creatorWallet());
  console.log("coreContract:", await router.coreContract());
  console.log("incomeEngineContract:", await router.incomeEngineContract());
  console.log("IncomeRouter upgrade complete ✅");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
