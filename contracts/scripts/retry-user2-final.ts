import { ethers } from "hardhat";

async function main() {
  const CORE = "0xe987521C9FDE4CD09a62E0369BaE59663F9B7625";
  const ROUTER = "0x6AD732D64727A749Df3959A6DA12066b4ab664Bb";
  const INCOME = "0xE54abA50Fa9A22F408C215B8D391B2810A4b46bE";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const CREATOR = "0xbFF19De173697D07B904a4c7b79e4A524B456991";
  const USER1 = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const router = await ethers.getContractAt("IncomeRouter", ROUTER);
  const usdt = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    USDT
  );

  const creatorBefore = await usdt.balanceOf(CREATOR);
  const user1Before = await usdt.balanceOf(USER1);
  const coreBefore = await usdt.balanceOf(CORE);
  console.log("=== PRE RETRY ===");
  console.log("Creator:", ethers.formatUnits(creatorBefore, 18), "USDT");
  console.log("User#1 :", ethers.formatUnits(user1Before, 18), "USDT");
  console.log("Core   :", ethers.formatUnits(coreBefore, 18), "USDT");

  console.log("\nCalling adminRetryDistribution(2)...");
  const tx = await core.adminRetryDistribution(2);
  const receipt = await tx.wait();
  console.log("Tx:", receipt!.hash);
  console.log("Status:", receipt!.status === 1 ? "SUCCESS" : "FAILED");

  const creatorAfter = await usdt.balanceOf(CREATOR);
  const user1After = await usdt.balanceOf(USER1);
  const coreAfter = await usdt.balanceOf(CORE);
  console.log("\n=== POST RETRY ===");
  console.log("Creator:", ethers.formatUnits(creatorAfter, 18), "USDT");
  console.log("User#1 :", ethers.formatUnits(user1After, 18), "USDT");
  console.log("Core   :", ethers.formatUnits(coreAfter, 18), "USDT");
  console.log("Creator received:", ethers.formatUnits(creatorAfter - creatorBefore, 18), "USDT");
  console.log("User#1 received :", ethers.formatUnits(user1After - user1Before, 18), "USDT");

  const failed = await core.failedDistribution(2);
  const failedIds = await core.getFailedUserIds();
  console.log("\nfailedDistribution[2]:", failed);
  console.log("failedUserIds:", failedIds.toString() || "none ✅");

  console.log("\n=== ALL EVENTS ===");
  for (const log of receipt!.logs) {
    for (const [name, iface] of [
      ["CORE", core.interface],
      ["ROUTER", router.interface],
      ["INCOME", income.interface],
    ] as [string, any][]) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed) {
          if (parsed.name === "DistributionFailedReason") {
            const reasonBytes = parsed.args[1];
            console.log("[CORE] DistributionFailedReason - raw:", reasonBytes);
            try {
              const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                ["string"],
                ethers.dataSlice(reasonBytes, 4)
              );
              console.log(">>> REVERT REASON:", decoded[0]);
            } catch {
              console.log(">>> RAW (hex):", reasonBytes);
            }
          } else {
            console.log(`[${name}] ${parsed.name}`);
          }
          break;
        }
      } catch {}
    }
  }
}

main().catch(console.error);
