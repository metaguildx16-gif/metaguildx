import { ethers } from "hardhat";

async function main() {
  const CORE = "0x03810a53e98f74AC17531569e84D0feA4C4Ec616";
  const INCOME = "0x7356f01125250e673e9501036e0527D1A63060A9";
  const ROUTER = "0xa118BaCFF75B37b6dE3D84C5f1d675Dcc634196f";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const router = await ethers.getContractAt("IncomeRouter", ROUTER);

  const pkg1 = await core.getPackagePriceByLevel(1);
  const nextId = await core.nextUserId();
  console.log("pkg1 price:", pkg1.toString(), "units");
  console.log("nextUserId:", nextId.toString());

  for (let i = 1; i <= 5; i++) {
    try {
      const we = await income.walletEarnings(i, 1);
      const esc = await income.escrowBalances(i, 1);
      const xSlot = we / pkg1;
      console.log(`\nUser #${i}:`);
      console.log("  walletEarnings:", we.toString());
      console.log("  escrowBalances:", esc.toString());
      console.log("  xSlot         :", xSlot.toString());
    } catch {}
  }

  console.log("\n=== USER#5 REGISTRATION EVENTS ===");
  const filter = core.filters.UserRegistered(5);
  const currentBlock = await ethers.provider.getBlockNumber();
  const fromBlock = Math.max(currentBlock - 49000, 0);
  const events = await core.queryFilter(filter, fromBlock, currentBlock);
  if (events.length === 0) {
    console.log("UserRegistered(5) not found");
    return;
  }

  const receipt = await ethers.provider.getTransactionReceipt(events[0].transactionHash);
  console.log("Tx:", events[0].transactionHash);

  for (const log of receipt!.logs) {
    for (const [name, iface] of [
      ["CORE", core.interface],
      ["INCOME", income.interface],
      ["ROUTER", router.interface],
    ] as const) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed) {
          console.log(
            `[${name}] ${parsed.name}:`,
            JSON.stringify(
              Object.fromEntries(
                parsed.fragment.inputs.map((inp, i) => [
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
}

main().catch(console.error);
