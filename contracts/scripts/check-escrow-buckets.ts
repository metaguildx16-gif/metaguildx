import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const INCOME = process.env.INCOME_ENGINE_ADDRESS!;

  const core = await ethers.getContractAt(
    [
      "function usersById(uint256) view returns (tuple(uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint256 directReferrals, uint256 joinedAt, bool surrendered, uint256 rebirthCount, uint256 totalEarnings))",
      "function nextUserId() view returns (uint256)"
    ],
    CORE
  );

  const income = await ethers.getContractAt(
    [
      "function getEscrow(uint256 userId) view returns (uint256)",
      "function escrowBalances(uint256 userId, uint256 pkgLevel) view returns (uint256)",
      "function getTotalIncome(uint256 userId) view returns (uint256)"
    ],
    INCOME
  );

  const nextId = await core.nextUserId();
  const total = Number(nextId) - 1;
  console.log("Total users:", total);

  for (let i = 1; i <= total; i++) {
    const u = await core.usersById(BigInt(i));
    const pkgLevel = Number(u.packageLevel);
    const visibleEscrow = await income.getEscrow(BigInt(i));
    const totalIncome = await income.getTotalIncome(BigInt(i));

    console.log(`\nUser ${i}:`);
    console.log(`  wallet: ${u.account}`);
    console.log(`  packageLevel: ${pkgLevel}`);
    console.log(`  visible escrow (getEscrow): ${visibleEscrow}`);
    console.log(`  totalIncome: ${totalIncome}`);

    for (let p = 1; p <= 10; p++) {
      try {
        const bucketEscrow = await income.escrowBalances(
          BigInt(i), BigInt(p)
        );
        if (bucketEscrow > 0n) {
          console.log(`  pkg${p} bucket escrow: ${bucketEscrow}`);
        }
      } catch {}
    }
  }
}

main().catch(console.error);
