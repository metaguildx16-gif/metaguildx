import { ethers } from "hardhat";

async function main() {
  const CORE = "0xbBD9e768298E7b636A7a762478F19671954FF0C0";
  const INCOME = "0x7307Fee5C8163a1eb9a5F050D26AAe6e09a44769";
  const ROUTER = "0xc5c0E574Cc2090802e2Ba9Cd52adA24223915c64";
  const UPGRADE = "0x200301d8AdBF3C1AF85b35bf081A4A01eFE30322";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const router = await ethers.getContractAt("IncomeRouter", ROUTER);
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", UPGRADE);

  const currentBlock = await ethers.provider.getBlockNumber();
  const filter = core.filters.UserRegistered(15);
  const events = [];
  for (let start = Math.max(0, currentBlock - 50000); start <= currentBlock; start += 49000) {
    const end = Math.min(start + 48999, currentBlock);
    const chunk = await core.queryFilter(filter, start, end);
    events.push(...chunk);
  }

  if (events.length === 0) {
    console.log("UserRegistered(15) not found");
    return;
  }

  const tx = events[0].transactionHash;
  console.log("User#15 tx:", tx);

  const receipt = await ethers.provider.getTransactionReceipt(tx);

  console.log("\n=== ALL EVENTS IN ORDER ===");
  for (const log of receipt!.logs) {
    for (const [name, iface] of [
      ["CORE", core.interface],
      ["ROUTER", router.interface],
      ["INCOME", income.interface],
      ["UPGRADE", upgrade.interface],
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
  const te5 = await income.totalEarnings(5, 1);
  const reb5 = await income.rebirthEscrow(5);
  const xSlot = te5 / pkg1;

  console.log("\n=== USER#5 STATE AFTER ===");
  console.log("totalEarnings[5][1]:", te5.toString(), "units");
  console.log("xSlot              :", xSlot.toString());
  console.log("rebirthEscrow[5]   :", reb5.toString());
  console.log("Expected           : rebirthEscrow > 0");
  console.log("Result             :", reb5 > 0n ? "✅ REBIRTH ESCROW" : "❌ MISSING");
}

main().catch(console.error);
