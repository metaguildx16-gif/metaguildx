import { ethers } from "hardhat";

const CORE_PROXY = "0x9490E2C603c5a6D3c0E66af8494E766470dA1E4B";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log("Verifying with:", owner.address);

  const core = await ethers.getContractAt("MetaGuildXCore", CORE_PROXY, owner);

  const parent12 = await core.getParent(12n);
  const parent17 = await core.getParent(17n);
  const eligible1 = await core.isLevelEligibleUser(1n);
  const eligible12 = await core.isLevelEligibleUser(12n);
  const eligible17 = await core.isLevelEligibleUser(17n);

  console.log("getParent(12):", parent12.toString());
  console.log("getParent(17):", parent17.toString());
  console.log("isLevelEligibleUser(1):", eligible1 ? "YES" : "NO");
  console.log("isLevelEligibleUser(12):", eligible12 ? "YES" : "NO");
  console.log("isLevelEligibleUser(17):", eligible17 ? "YES" : "NO");

  console.log("Level routing interpretation:");
  console.log("- User 12 ineligible:", eligible12 ? "NO" : "YES");
  console.log("- User 17 parent:", parent17.toString());
  console.log("- First eligible upline above 17 must be resolved by walking personal parents");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
