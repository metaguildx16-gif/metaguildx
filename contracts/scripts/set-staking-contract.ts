import { ethers } from "hardhat";

async function main() {
const CORE = "0xcea26779d6C0d80525702a5a7362Aa4d08F9E1Ec";
const STAKING = "0x7fCf2a7B8E3Afae5BF19Dcf41a362B08cF7b5e83";

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);

  console.log("Before:", await core.stakingContract());

  const tx = await core.setStakingContract(STAKING);
  await tx.wait();

  console.log("After:", await core.stakingContract());
  console.log("Done âœ…");

  try {
    await core.stake.staticCall(
      ethers.parseUnits("1", 18),
      365n * 24n * 3600n,
      false
    );
    console.log("Stake static call: PASS âœ…");
  } catch (e: any) {
    console.log("Stake static call revert:", e.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
