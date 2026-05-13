import { ethers, upgrades } from "hardhat";
import fs from "node:fs";
import path from "node:path";

async function main() {
const proxy = "0x7fCf2a7B8E3Afae5BF19Dcf41a362B08cF7b5e83";
  const impl = await upgrades.erc1967.getImplementationAddress(proxy);
  const provider = ethers.provider;
  const liveCode = await provider.getCode(impl);
  const liveBytes = liveCode === "0x" ? 0 : (liveCode.length - 2) / 2;

  const artifactPath = path.resolve(__dirname, "../artifacts/src/MGXStaking.sol/MGXStaking.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as { deployedBytecode: string };
  const localBytes = artifact.deployedBytecode === "0x" ? 0 : (artifact.deployedBytecode.length - 2) / 2;

  console.log("MGXStaking proxy:", proxy);
  console.log("MGXStaking impl:", impl);
  console.log("Live impl bytes:", liveBytes);
  console.log("Local compiled bytes:", localBytes);

  const staking = await ethers.getContractAt("MGXStaking", proxy);
  console.log("coreContract:", await staking.coreContract());
  console.log("incomeContract:", await staking.incomeContract());
  console.log("rewardPool:", (await staking.rewardPool()).toString());
  console.log("totalStaked:", (await staking.totalStaked()).toString());

  const [signer] = await ethers.getSigners();
  const core = await ethers.getContractAt("MetaGuildXCore", "0xcea26779d6C0d80525702a5a7362Aa4d08F9E1Ec", signer);
  const userWallet = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";
  const userId = await core.userIdByAddress(userWallet);
  console.log("User1 ID:", userId.toString());
  console.log("User1 active:", await core.activeUsers(userId));
  console.log("Core stakingContract:", await core.stakingContract());
  console.log("Core defaultPaymentAsset:", await core.defaultPaymentAsset());

  try {
    await core.stake.staticCall(ethers.parseUnits("1", 18), 365n * 24n * 3600n, false);
    console.log("Core stake static call: PASS âœ…");
  } catch (error: any) {
    console.log("Core stake static call REVERT:");
    console.log(error.message);
    console.log(error.data ?? "no data");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
