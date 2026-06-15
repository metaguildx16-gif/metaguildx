const { ethers } = require("hardhat");
async function main() {
  const routerAbi = [
    "event DirectIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint256 amount, uint8 cyclePkgLevel)",
    "event LevelIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint8 level, uint256 amount, uint8 cyclePkgLevel)"
  ];
  const router = new ethers.Contract("0xc2bEE78E63381b27C893DB7F85DB8f00cB84a9FC", routerAbi, ethers.provider);
  const latest = await ethers.provider.getBlockNumber();
  const from = 151879381;
  const chunkSize = 49000;
  for(let start = from; start <= latest; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, latest);
    const d = await router.queryFilter(router.filters.DirectIncomeRecorded(null, 1n), start, end);
    const l = await router.queryFilter(router.filters.LevelIncomeRecorded(null, 1n), start, end);
    for(const e of d) console.log("Direct | cyclePkg:", e.args.cyclePkgLevel.toString(), "amount:", e.args.amount.toString());
    for(const e of l) console.log("Level  | cyclePkg:", e.args.cyclePkgLevel.toString(), "amount:", e.args.amount.toString());
  }
}
main().catch(console.error);