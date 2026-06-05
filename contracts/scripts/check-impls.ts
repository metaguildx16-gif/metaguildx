import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const UPGRADE_PROXY = "0x2a9Ed16e119da2CDB241Ac672bB5ece059730D50";
  const INCOME_PROXY  = "0x72433Cd3d2e41ed2B230510496835803aD245a48";

  const upgradeImpl = await upgrades.erc1967.getImplementationAddress(UPGRADE_PROXY);
  const incomeImpl  = await upgrades.erc1967.getImplementationAddress(INCOME_PROXY);

  console.log("Upgrade impl on-chain:", upgradeImpl);
  console.log("Income impl on-chain: ", incomeImpl);

  // Expected from our deploy:
  console.log("\nExpected Upgrade: 0x92388d1ce7Dcd4f95c1635d087E3eACA0712eDF8");
  console.log("Expected Income:  0x5AF774662F01a3aD8b57749dBb17570F74794323");

  const upgradeMatch = upgradeImpl.toLowerCase() === "0x92388d1ce7Dcd4f95c1635d087E3eACA0712eDF8".toLowerCase();
  const incomeMatch  = incomeImpl.toLowerCase()  === "0x5AF774662F01a3aD8b57749dBb17570F74794323".toLowerCase();

  console.log("\nUpgrade impl match:", upgradeMatch ? "YES" : "NO - OLD IMPL!");
  console.log("Income impl match: ", incomeMatch  ? "YES" : "NO - OLD IMPL!");
}

main().catch((e) => { console.error(e); process.exit(1); });
