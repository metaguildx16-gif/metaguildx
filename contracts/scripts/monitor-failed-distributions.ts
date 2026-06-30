import { ethers } from "hardhat";

async function main() {
  const CORE_PROXY = "0xE3cD200609E223c96987c9FEa41C6014e8625c2F";
  const core = await ethers.getContractAt("MetaGuildXCore", CORE_PROXY);

  const timestamp = new Date().toISOString();
  const failedIds = await core.getFailedUserIds();

  if (failedIds.length === 0) {
    console.log(`[${timestamp}] ✅ No failed distributions. All clear.`);
    return;
  }

  const stillFailed: { userId: string; packageLevel: string }[] = [];
  for (const uid of failedIds) {
    const isFailed = await core.failedDistribution(uid);
    if (isFailed) {
      let pkgLevel = "unknown";
      try {
        const lvl = await core.failedDistributionPackageLevel(uid);
        pkgLevel = lvl.toString();
      } catch {}
      stillFailed.push({ userId: uid.toString(), packageLevel: pkgLevel });
    }
  }

  if (stillFailed.length === 0) {
    console.log(`[${timestamp}] ✅ ${failedIds.length} historical entries, all already cleared.`);
    return;
  }

  console.log(`[${timestamp}] 🚨 ALERT: ${stillFailed.length} ACTIVE FAILED DISTRIBUTION(S) FOUND!`);
  for (const entry of stillFailed) {
    console.log(`  - User ${entry.userId} (failed at package level ${entry.packageLevel})`);
  }

  const usdt = await ethers.getContractAt(
    ["function balanceOf(address) view returns (uint256)"],
    "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3"
  );
  const coreBal = await usdt.balanceOf(CORE_PROXY);
  console.log(`  Core USDT balance: ${ethers.formatUnits(coreBal, 18)}`);
  console.log(`  >>> Action needed: review and run adminRetryDistribution() or adminRemainderDistribution() via admin panel/Gnosis Safe <<<`);
}

main().catch((e) => {
  console.error("Monitor script error:", e.message);
  process.exitCode = 1;
});
