import { ethers } from "hardhat";

async function main() {
  const stk = await ethers.getContractAt("MGXStaking", "0xFf2E00A180D4f4Eb03D94a4a736a452025bDe226");
  const wallet = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";
  const positions = await stk.getStakePositions(wallet);
  const now = Math.floor(Date.now() / 1000);
  console.log("Now:", now);
  for(let i = 0; i < positions.length; i++) {
    const rewardDebt = Number(positions[i][1]);
    const ready = now >= rewardDebt + 86400;
    const remaining = rewardDebt + 86400 - now;
    console.log("Position", i+1, "rewardDebt:", rewardDebt, "ready:", ready, "remaining:", remaining, "sec");
  }
  const pending = await stk.pendingStakingReward(wallet);
  console.log("Pending:", ethers.formatEther(pending));
  const core = await ethers.getContractAt("MetaGuildXCore", "0x9B343ae746538218F37f0DA77bdae8dF352ea41c");
  try {
    await core.claimStakingReward.staticCall({ from: wallet });
    console.log("Claim: SUCCESS");
  } catch(e: any) {
    console.log("Claim REVERT:", e.message.slice(0, 120));
  }
}
main().catch(console.error);
