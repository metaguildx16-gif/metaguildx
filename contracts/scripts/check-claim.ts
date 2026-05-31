import { ethers } from "hardhat";
async function main() {
  const stk = await ethers.getContractAt("MGXStaking", "0xe8A0Ae5ad1fd066Deb21c53A9652D89a778ec943");
  const mgx = await ethers.getContractAt("MGXToken", "0x72206e4c4e51C7fe704bd1F6E8aB6b622ad5feD5");
  const wallet = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";
  
  // MGX wallet balance (claimed amount here)
  const walletBal = await mgx.balanceOf(wallet);
  console.log("Wallet MGX balance:", ethers.formatEther(walletBal));
  
  // Reward pool after claim
  const rp = await stk.rewardPool();
  console.log("Reward pool:", ethers.formatEther(rp));
  
  // Pending reward after claim (should be 0)
  const pending = await stk.pendingStakingReward(wallet);
  console.log("Pending reward:", ethers.formatEther(pending));
  
  // rewardDebt updated?
  const positions = await stk.getStakePositions(wallet);
  const now = Math.floor(Date.now() / 1000);
  for(let i = 0; i < positions.length; i++) {
    const rewardDebt = Number(positions[i][1]);
    const nextCycle = rewardDebt + 28800;
    const remaining = nextCycle - now;
    console.log("Pos", i+1, "rewardDebt:", rewardDebt, "nextIn:", Math.floor(remaining/3600)+"h", Math.floor((remaining%3600)/60)+"m");
  }
  
  // Check Claimed event
  const filter = stk.filters.Claimed(wallet);
  const events = await stk.queryFilter(filter, 165389939);
  console.log("Claimed events:", events.length);
  for(const e of events) {
    console.log("  amount:", ethers.formatEther(e.args[1]), "MGX tx:", e.transactionHash);
  }
}
main().catch(console.error);
