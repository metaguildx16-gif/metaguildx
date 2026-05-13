import { ethers } from "hardhat";

async function main() {
  const CORE = "0xe987521C9FDE4CD09a62E0369BaE59663F9B7625";
  const INCOME = "0xE54abA50Fa9A22F408C215B8D391B2810A4b46bE";
  const ROUTER = "0x6AD732D64727A749Df3959A6DA12066b4ab664Bb";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const router = await ethers.getContractAt("IncomeRouter", ROUTER);

  const currentBlock = await ethers.provider.getBlockNumber();
  const filter = core.filters.UserRegistered(14);
  const events = [];
  for (let start = Math.max(0, currentBlock - 50000); start <= currentBlock; start += 49000) {
    const end = Math.min(start + 48999, currentBlock);
    const chunk = await core.queryFilter(filter, start, end);
    events.push(...chunk);
  }

  if (events.length === 0) {
    console.log("UserRegistered(14) not found");
    return;
  }

  const regEvent = events[0];
  console.log("User#14 tx:", regEvent.transactionHash);

  const receipt = await ethers.provider.getTransactionReceipt(regEvent.transactionHash);

  console.log("\n=== ALL EVENTS IN ORDER ===");
  for (const log of receipt!.logs) {
    for (const [name, iface] of [
      ["CORE", core.interface],
      ["ROUTER", router.interface],
      ["INCOME", income.interface],
    ] as [string, any][]) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed) {
          console.log(
            `[${name}] ${parsed.name}:`,
            JSON.stringify(
              Object.fromEntries(
                parsed.fragment.inputs.map((inp: any, i: number) => [
                  inp.name || i,
                  typeof parsed.args[i] === "bigint" ? parsed.args[i].toString() : parsed.args[i],
                ])
              )
            )
          );
          break;
        }
      } catch {}
    }
  }

  const pkg1 = await core.getPackagePriceByLevel(1);
  const we5 = await income.walletEarnings(5, 1);
  const esc5 = await income.escrowBalances(5, 1);
  const reb5 = await income.rebirthEscrow(5);

  console.log("\n=== USER#5 STATE ===");
  console.log("walletEarnings[5][1]:", we5.toString(), "units");
  console.log("escrowBalances[5][1]:", esc5.toString(), "units");
  console.log("rebirthEscrow[5]    :", reb5.toString(), "units");
  console.log("xSlot               :", (we5 / pkg1).toString());
  console.log("pkg1 price          :", pkg1.toString());
}

main().catch(console.error);
