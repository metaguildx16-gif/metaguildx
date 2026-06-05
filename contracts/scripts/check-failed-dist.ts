import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0x19F72c5a287334086fD34D41ebe6bb534524D202");
  const failed = await core.getFailedUserIds();
  console.log("Failed userIds:", failed.toString());
  for (const uid of failed) {
    const fd = await core.failedDistribution(uid);
    console.log("User " + uid + " failed:", fd.toString());
    const u = await core.usersById(uid);
    console.log("User " + uid + " wallet:", u[1], "pkg:", u[3].toString(), "sponsor:", u[2].toString());
  }
  const router = await ethers.getContractAt("IncomeRouter", "0xe59Ad238162D9591BCC7659A10fe017004a4cA69");
  console.log("\nRouter coreContract:", await router.coreContract());
  console.log("Router incomeEngine:", await router.incomeEngineContract());
}
main().catch(console.error);
