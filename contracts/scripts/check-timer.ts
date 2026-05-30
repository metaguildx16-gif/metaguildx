import { ethers } from "hardhat";
async function main() {
  const stk = await ethers.getContractAt("MGXStaking", "0xa24c3Be2fce7293490543B72d01c2f7D1059b289");
  const wallet = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";
  const positions = await stk.getStakePositions(wallet);
  const now = Math.floor(Date.now() / 1000);
  console.log("Now:", now);
  for(let i = 0; i < positions.length; i++) {
    const rewardDebt = Number(positions[i][1]);
    const elapsed = now - rewardDebt;
    const cycleSeconds = 8 * 3600;
    const elapsedCycles = Math.floor(elapsed / cycleSeconds);
    const nextWindow = rewardDebt + (elapsedCycles + 1) * cycleSeconds;
    const remaining = nextWindow - now;
    console.log("Position", i+1, "rewardDebt:", rewardDebt, "elapsed:", elapsed, "sec, elapsedCycles:", elapsedCycles, "nextIn:", remaining, "sec =", Math.floor(remaining/3600), "h", Math.floor((remaining%3600)/60), "m");
  }
}
main().catch(console.error);
