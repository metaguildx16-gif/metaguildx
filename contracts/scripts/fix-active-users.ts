import { ethers } from "hardhat";

async function main() {
  const core = await ethers.getContractAt(
    "MetaGuildXCore",
  "0xcea26779d6C0d80525702a5a7362Aa4d08F9E1Ec"
  );

  const targetUserId = 1n;
  const before = await core.activeUsers(targetUserId);
  console.log("activeUsers(1) before:", before);

  if (!before) {
    const tx = await core.setActiveUser(targetUserId, true);
    console.log("setActiveUser tx:", tx.hash);
    await tx.wait();
  } else {
    console.log("User 1 already active. No update needed.");
  }

  const after = await core.activeUsers(targetUserId);
  console.log("activeUsers(1) after:", after);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
