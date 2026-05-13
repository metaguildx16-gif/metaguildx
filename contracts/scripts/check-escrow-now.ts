import { ethers } from "hardhat";

async function main() {
  const INCOME = process.env.INCOME_ENGINE_ADDRESS!;
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;

  const income = await ethers.getContractAt([
    "function rebirthEscrow(uint256) view returns (uint256)",
    "function getEscrow(uint256) view returns (uint256)"
  ], INCOME);

  const core = await ethers.getContractAt([
    "function nextUserId() view returns (uint256)"
  ], CORE);

  const usdt = await ethers.getContractAt([
    "function balanceOf(address) view returns (uint256)"
  ], process.env.USDT_ADDRESS!);

  const nextId = await core.nextUserId();
  console.log("Total users:", Number(nextId) - 1);

  console.log("\n=== REBIRTH ESCROW ===");
  let total = 0n;
  for (let i = 1; i < Number(nextId); i++) {
    const r = await income.rebirthEscrow(BigInt(i));
    if (r > 0n) {
      console.log(`User ${i}: $${Number(r) / 10}`);
      total += r;
    }
  }
  console.log("Total rebirthEscrow:", `$${Number(total) / 10}`);

  const coreBal = await usdt.balanceOf(CORE);
  console.log("\nCore USDT balance:", ethers.formatUnits(coreBal, 18));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
