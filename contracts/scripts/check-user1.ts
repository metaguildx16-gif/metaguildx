const { ethers } = require("hardhat");
async function main() {
  const incAbi = [
    "function getTotalEscrow(uint256) view returns (uint256)",
    "function escrowBalances(uint256,uint256) view returns (uint256)",
    "function incomesByUser(uint256) view returns (uint256 direct, uint256 level, uint256 spillover, uint256 crossline)"
  ];
  const inc = new ethers.Contract("0xd34701b11cc1476C90C7b80aE84F7EFCFeaf8C5b", incAbi, ethers.provider);
  
  for(let i = 1n; i <= 5n; i++) {
    const e = await inc.escrowBalances(1n, i);
    console.log("Pkg" + i + " escrow:", ethers.formatUnits(e, 18));
  }
  const total = await inc.getTotalEscrow(1n);
  console.log("Total escrow:", ethers.formatUnits(total, 18));
  
  const incomes = await inc.incomesByUser(1n);
  console.log("Direct:", ethers.formatUnits(incomes.direct, 18));
  console.log("Level:", ethers.formatUnits(incomes.level, 18));
}
main().catch(console.error);