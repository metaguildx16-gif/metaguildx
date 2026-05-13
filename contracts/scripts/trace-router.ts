import { ethers } from "hardhat";

async function main() {
  const ROUTER = process.env.INCOME_ROUTER_ADDRESS!;
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;

  const router = await ethers.getContractAt([
    "function distributeJoinIncome(uint256 userId, uint256 sponsorId, uint256 placedUnderId, uint256 packageAmount, address paymentAsset) external"
  ], ROUTER);

  const core = await ethers.getContractAt([
    "function nextUserId() view returns (uint256)",
    "function incomeRouterContract() view returns (address)"
  ], CORE);

  const nextId = await core.nextUserId();
  console.log("Next userId would be:", nextId.toString());

  const routerAddr = await core.incomeRouterContract();
  console.log("Router address:", routerAddr);
  console.log("Router in env:", ROUTER);
  console.log("Match:", routerAddr.toLowerCase() === ROUTER.toLowerCase());

  const userId = nextId;
  const sponsorId = 4n;
  const placedUnderId = 19n;
  const packageAmount = 100n;
  const paymentAsset = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

  console.log("\nSimulating distributeJoinIncome:");
  console.log("userId:", userId.toString());
  console.log("sponsorId:", sponsorId.toString());
  console.log("placedUnderId:", placedUnderId.toString());
  console.log("packageAmount:", packageAmount.toString());
  console.log("paymentAsset:", paymentAsset);

  try {
    await router.distributeJoinIncome.staticCall(
      userId,
      sponsorId,
      placedUnderId,
      packageAmount,
      paymentAsset,
      { from: CORE }
    );
    console.log("distributeJoinIncome: PASS ✅");
  } catch (err: any) {
    console.log("distributeJoinIncome REVERT:");
    console.log("Reason:", err.reason ?? "none");
    console.log("Message:", err.message);
    console.log("Data:", err.data ?? "none");
  }

  const core2 = await ethers.getContractAt([
    "function isRebirthUser(uint256) view returns (bool)",
    "function usersById(uint256) view returns (tuple(uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered))"
  ], CORE);

  const isRebirth = await core2.isRebirthUser(sponsorId);
  console.log("\nisRebirthUser(4):", isRebirth);

  const u4 = await core2.usersById(sponsorId);
  console.log("User 4 rebirthCount:", u4.rebirthCount.toString());
  console.log("User 4 packageLevel:", u4.packageLevel.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
