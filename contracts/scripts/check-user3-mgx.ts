import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const addresses = JSON.parse(require("fs").readFileSync("deployed-addresses.json", "utf8"));
  
  const core = await ethers.getContractAt("MetaGuildXCore", addresses.Core);
  const mgx = await ethers.getContractAt("MGXToken", addresses.MGXToken);

  // User 3 info
  const user3 = await core.usersById(3);
  const user3Wallet = user3.account;
  console.log("User #3 wallet:", user3Wallet);

  // MGX balances
  const user3Balance = await mgx.balanceOf(user3Wallet);
  console.log("User #3 MGX balance:", ethers.formatEther(user3Balance));

  // Rebirth users 44 and 75
  const user44 = await core.usersById(44);
  const user75 = await core.usersById(75);
  console.log("\nUser #44 wallet:", user44.account);
  console.log("User #44 MGX:", ethers.formatEther(await mgx.balanceOf(user44.account)));
  console.log("\nUser #75 wallet:", user75.account);
  console.log("User #75 MGX:", ethers.formatEther(await mgx.balanceOf(user75.account)));

  // Token allocations
  const alloc3 = await core.tokenAllocationsByUser(3);
  const alloc44 = await core.tokenAllocationsByUser(44);
  const alloc75 = await core.tokenAllocationsByUser(75);
  console.log("\nToken allocations:");
  console.log("User #3:", ethers.formatEther(alloc3));
  console.log("User #44:", ethers.formatEther(alloc44));
  console.log("User #75:", ethers.formatEther(alloc75));
  console.log("Total allocated:", ethers.formatEther(alloc3 + alloc44 + alloc75));

  // Check if 44 and 75 are rebirth users under user 3
  const rebirthIds3 = await core.getRebirthIds ? 
    await core.getRebirthIds(3) : [];
  console.log("\nRebirth IDs under user #3:", rebirthIds3.map((x: bigint) => x.toString()));
}

main().catch(console.error);
