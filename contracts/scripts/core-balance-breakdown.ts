import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", "0xF4975eB104932bDBcA491A9Cb985439eA03863e0");
  const latest = await ethers.provider.getBlockNumber();
  const filter = core.filters.UserRegistered();
  const events = await core.queryFilter(filter, 165971200, latest);
  let totalIn = 0n;
  for (const e of events) {
    const pkg = (e as any).args[2];
    const price = await core.getPackagePriceByLevel(pkg);
    totalIn += price;
  }
  console.log("Total registrations:", events.length);
  console.log("Total USDT in (calculated):", ethers.formatUnits(totalIn, 18));
  const bal = await usdt.balanceOf("0xF28019a3cC992619b652967B96B3813bA3830D91");
  console.log("Core USDT balance:", ethers.formatUnits(bal, 18));
  const cashback = await usdt.balanceOf(await core.cashbackPoolContract());
  console.log("Cashback pool USDT:", ethers.formatUnits(cashback, 18));
}
main().catch(console.error);
