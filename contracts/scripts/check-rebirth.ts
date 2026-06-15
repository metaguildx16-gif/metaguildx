import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const addresses = JSON.parse(require("fs").readFileSync("deployed-addresses.json", "utf8"));
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", addresses.Upgrade);
  const core = await ethers.getContractAt("MetaGuildXCore", addresses.Core);
  const mgx = await ethers.getContractAt("MGXToken", addresses.MGXToken);
  const staking = await ethers.getContractAt("MGXStaking", addresses.MGXStaking);

  console.log("=== User #3 Rebirth Check ===");
  const rebirthIds = await upgrade.getRebirthIds(3);
  console.log("Rebirth IDs:", rebirthIds.map((x: bigint) => x.toString()));

  const wallet = (await core.usersById(3)).account;
  console.log("\nWallet:", wallet);
  console.log("MGX balance:", ethers.formatEther(await mgx.balanceOf(wallet)));

  // Staking info
  const totalStaked = await staking.totalStaked();
  console.log("Total staked:", ethers.formatEther(totalStaked));

  // Check each user's allocation vs balance
  for (const uid of [3, 44, 75]) {
    const alloc = await core.tokenAllocationsByUser(uid);
    console.log(`\nUser #${uid} allocation: ${ethers.formatEther(alloc)} MGX`);
  }
}
main().catch(console.error);
