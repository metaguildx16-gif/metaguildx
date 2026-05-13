import { ethers } from "hardhat";

const CORE_ADDRESS = "0x9490E2C603c5a6D3c0E66af8494E766470dA1E4B";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log("Owner:", owner.address);

  const core = await ethers.getContractAt("MetaGuildXCore", CORE_ADDRESS, owner);
  const incomeAddress = await core.incomeEngineContract();
  const income = await ethers.getContractAt("MetaGuildXIncome", incomeAddress, owner);

  const asset = await core.defaultPaymentAsset();
  const token = new ethers.Contract(
    asset,
    [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ],
    owner
  );

  const user1 = await core.usersById(1n);
  const user2 = await core.usersById(2n);
  const decimals = Number(await token.decimals());

  console.log("=== BEFORE ===");
  const user1Before = await income.escrowBalances(1n, 1n);
  const user2Before = await income.escrowBalances(2n, 1n);
  const user1WalletBefore = await token.balanceOf(user1.account);
  const user2WalletBefore = await token.balanceOf(user2.account);
  const coreBalanceBefore = await token.balanceOf(CORE_ADDRESS);

  console.log("User 1 pkg1 escrow:", user1Before.toString());
  console.log("User 2 pkg1 escrow:", user2Before.toString());
  console.log("User 1 wallet before:", ethers.formatUnits(user1WalletBefore, decimals));
  console.log("User 2 wallet before:", ethers.formatUnits(user2WalletBefore, decimals));
  console.log("Core USDT balance before:", ethers.formatUnits(coreBalanceBefore, decimals));

  console.log("=== Releasing User 1 ===");
  const tx1 = await core.adminReleaseStrandedEscrow(1n);
  await tx1.wait();
  console.log("User 1 tx:", tx1.hash);

  console.log("=== Releasing User 2 ===");
  const tx2 = await core.adminReleaseStrandedEscrow(2n);
  await tx2.wait();
  console.log("User 2 tx:", tx2.hash);

  console.log("=== AFTER ===");
  const user1After = await income.escrowBalances(1n, 1n);
  const user2After = await income.escrowBalances(2n, 1n);
  const user1WalletAfter = await token.balanceOf(user1.account);
  const user2WalletAfter = await token.balanceOf(user2.account);
  const coreBalanceAfter = await token.balanceOf(CORE_ADDRESS);

  console.log("User 1 pkg1 escrow:", user1After.toString());
  console.log("User 2 pkg1 escrow:", user2After.toString());
  console.log("User 1 wallet after:", ethers.formatUnits(user1WalletAfter, decimals));
  console.log("User 2 wallet after:", ethers.formatUnits(user2WalletAfter, decimals));
  console.log("Core USDT balance after:", ethers.formatUnits(coreBalanceAfter, decimals));

  console.log("=== VERIFY ===");
  console.log(
    "User 1 escrow:",
    user1After.toString() === "0" ? "released successfully" : `still stuck: ${user1After.toString()}`
  );
  console.log(
    "User 2 escrow:",
    user2After.toString() === "0" ? "released successfully" : `still stuck: ${user2After.toString()}`
  );
  console.log(
    "User 1 wallet delta:",
    ethers.formatUnits(user1WalletAfter - user1WalletBefore, decimals)
  );
  console.log(
    "User 2 wallet delta:",
    ethers.formatUnits(user2WalletAfter - user2WalletBefore, decimals)
  );
  console.log(
    "Core balance delta:",
    ethers.formatUnits(coreBalanceAfter - coreBalanceBefore, decimals)
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
