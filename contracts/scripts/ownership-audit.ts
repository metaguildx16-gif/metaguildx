import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config();
async function main() {
  const GNOSIS_SAFE = "0x6D01d1E9771193467B5fae47Ce8463d7060098eA";
  const DEPLOYER    = "0xb1F4D1b91eE4159491652230A2d82EDBB9107ACe";
  const deployedPath = path.resolve(__dirname, "../deployed-addresses.json");
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const contracts: [string, string][] = [
    ["Core",         deployed.Core],
    ["Income",       deployed.Income],
    ["Router",       deployed.Router],
    ["BinaryTree",   deployed.BinaryTree],
    ["Upgrade",      deployed.Upgrade],
    ["CashbackPool", deployed.CashbackPool],
    ["MGXStaking",   deployed.MGXStaking],
    ["TokenEngine",  deployed.TokenEngine],
  ];

  const ownerAbi = ["function owner() view returns (address)"];

  console.log("=== OWNERSHIP AUDIT ===\n");
  let allSafe = true;

  for (const [name, addr] of contracts) {
    try {
      const c = await ethers.getContractAt(ownerAbi, addr);
      const owner = await c.owner();
      const isGnosis = owner.toLowerCase() === GNOSIS_SAFE.toLowerCase();
      const isDeployer = owner.toLowerCase() === DEPLOYER.toLowerCase();
      const status = isGnosis ? "? Gnosis Safe" : isDeployer ? "? DEPLOYER EOA" : `?? UNKNOWN: ${owner}`;
      console.log(`${name}: ${status}`);
      if (!isGnosis) allSafe = false;
    } catch {
      console.log(`${name}: ?? owner() call failed`);
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(allSafe ? "? All contracts owned by Gnosis Safe" : "? Some contracts NOT owned by Gnosis Safe!");
  console.log("Gnosis Safe:", GNOSIS_SAFE);
}

main().catch(console.error);