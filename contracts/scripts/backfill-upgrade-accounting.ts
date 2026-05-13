import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const INCOME = process.env.INCOME_ENGINE_ADDRESS!;
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;

  const income = await ethers.getContractAt(
    "MetaGuildXIncome",
    INCOME
  );
  const core = await ethers.getContractAt(
    "MetaGuildXCore",
    CORE
  );

  const nextId = await core.nextUserId();
  console.log("Total users:", nextId.toString());

  // Check each user for package-bucket mismatch
  for (let userId = 1n; userId < nextId; userId++) {
    const user = await core.usersById(userId);
    const currentPkg = user[3];

    if (currentPkg <= 1n) continue;

    // Check each package transition up to the user's current package.
    for (let pkg = 1n; pkg < currentPkg; pkg++) {
      const pkgEarnings = await income.totalEarnings(
        userId,
        pkg
      );
      const pkgPrice = await core.getPackagePriceByLevel(
        pkg
      );
      const upgradeCost = pkgPrice * 2n;

      // pkgPrice * 3 = xSlot 0 + 1 + 2
      const expectedMax = pkgPrice * 3n;

      if (pkgEarnings > expectedMax) {
        const excess = pkgEarnings - expectedMax;
        console.log(`User${userId} Pkg${pkg}: excess ${excess} units`);
        console.log(`  Need to move to Pkg${pkg + 1n}`);
        console.log(`  Upgrade cost reference: ${upgradeCost} units`);
      }
    }
  }

  console.log("\nBackfill check complete");
  console.log("Manual admin correction needed");
}

main().catch(console.error);
