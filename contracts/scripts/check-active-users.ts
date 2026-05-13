import { ethers } from "hardhat";

async function main() {
  const core = await ethers.getContractAt(
    "MetaGuildXCore",
  "0xcea26779d6C0d80525702a5a7362Aa4d08F9E1Ec"
  );

  const user1Wallet = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";
  const userId1 = await core.userIdByAddress(user1Wallet);
  console.log("User1 ID:", userId1.toString());

  const active1 = await core.activeUsers(1n);
  console.log("activeUsers(1):", active1);

  const active2 = await core.activeUsers(2n);
  console.log("activeUsers(2):", active2);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
