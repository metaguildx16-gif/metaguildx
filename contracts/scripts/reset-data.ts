import { ethers } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";

const SYSTEM = "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
const UNIT_PRICE = ethers.parseUnits("0.1", 18);

function upsertEnvValue(filePath: string, key: string, value: string) {
  const line = `${key}=${value}`;
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const matcher = new RegExp(`^${key}=.*$`, "m");
  const next = matcher.test(existing)
    ? existing.replace(matcher, line)
    : `${existing.trimEnd()}${existing.trimEnd() ? "\n" : ""}${line}\n`;

  fs.writeFileSync(filePath, next);
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying fresh MockUSDT...");
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const newUsdt = await MockUSDT.deploy(deployer.address);
  await newUsdt.waitForDeployment();
  const newUsdtAddress = await newUsdt.getAddress();
  console.log("New MockUSDT:", newUsdtAddress);

  await (await newUsdt.mint(deployer.address, ethers.parseUnits("10000", 18))).wait();
  console.log("Minted 10000 USDT to deployer ✅");

  const system = await ethers.getContractAt("MetaGuildXSystemV2", SYSTEM);
  await (await system.adminResetForTesting(newUsdtAddress)).wait();
  console.log("System counters reset ✅");

  await (await system.setUsdtTokenAddress(newUsdtAddress)).wait();
  await (await system.configurePaymentAsset(newUsdtAddress, true, false, UNIT_PRICE)).wait();
  await (await system.setProductionMode(true, newUsdtAddress)).wait();
  console.log("Payment asset updated ✅");

  const contractsEnvPath = path.resolve(__dirname, "..", ".env");
  upsertEnvValue(contractsEnvPath, "MOCK_USDT_ADDRESS", newUsdtAddress);
  upsertEnvValue(contractsEnvPath, "USDT_ADDRESS", newUsdtAddress);

  const webEnvPath = path.resolve(__dirname, "..", "..", "apps", "web", ".env");
  upsertEnvValue(webEnvPath, "VITE_USDT_ADDRESS", newUsdtAddress);

  const webLocalEnvPath = path.resolve(__dirname, "..", "..", "apps", "web", ".env.local");
  upsertEnvValue(webLocalEnvPath, "VITE_USDT_ADDRESS", newUsdtAddress);
  upsertEnvValue(webLocalEnvPath, "VITE_TESTNET_USDT_ADDRESS", newUsdtAddress);

  console.log("\n=== RESET COMPLETE ===");
  console.log("System (same)  :", SYSTEM);
  console.log("New MockUSDT   :", newUsdtAddress);
  console.log("nextUserId     : 1 (reset)");
  console.log("Ready for fresh testing ✅");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
