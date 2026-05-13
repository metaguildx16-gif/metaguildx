import { ethers } from "hardhat";

async function main() {
  const factory = await ethers.getContractFactory("IncomeRouter");
  const iface = factory.interface;
  const events = Object.keys(
    iface.fragments
      .filter((f: any) => f.type === "event")
      .reduce((acc: any, f: any) => {
        acc[f.name] = true;
        return acc;
      }, {})
  );
  console.log("All IncomeRouter events:");
  events.forEach((e) => console.log(" -", e));
  console.log("\nDebugRouter1 present:", events.includes("DebugRouter1") ? "✅ YES" : "❌ NO");
}

main().catch(console.error);
