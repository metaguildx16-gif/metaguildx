import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0x19F72c5a287334086fD34D41ebe6bb534524D202");
  const failed = await core.getFailedUserIds();
  console.log("Failed userIds:", failed.toString());
  for (const uid of failed) {
    const fd = await core.failedDistribution(uid);
    if (!fd) { console.log("User " + uid + ": already cleared, skip"); continue; }
    console.log("Retrying User " + uid + "...");
    try {
      const tx = await core.adminRetryDistribution(uid, { gasLimit: 5000000 });
      const receipt = await tx.wait();
      console.log("Status:", receipt?.status);
      const events = receipt?.logs.map((log: any) => {
        try { return core.interface.parseLog(log)?.name; } catch { return null; }
      }).filter(Boolean);
      console.log("Events:", events?.join(", "));
    } catch(e: any) {
      console.log("Error:", e.message.slice(0, 150));
    }
  }
  const failedAfter = await core.getFailedUserIds();
  console.log("\nFailed after:", failedAfter.toString());
  for (const uid of failedAfter) {
    const fd = await core.failedDistribution(uid);
    console.log("User " + uid + " still active:", fd);
  }
}
main().catch(console.error);
