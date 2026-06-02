import { ethers } from "hardhat";
async function main() {
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", "0x4e699918bc27A9b98D1FFA1251f4CC3d212226Cd");
  const abi = upgrade.interface;
  const fns = [];
  for (const f of abi.fragments) {
    if (f.type === "function") fns.push(f.name);
  }
  console.log("MetaGuildXUpgrade functions:", fns.filter(f => f.toLowerCase().includes("rebirth")).join(", "));
  try {
    const r3 = await upgrade.getRebirthIds(3);
    console.log("User 3 rebirthIds length:", r3.length, "values:", r3.toString());
  } catch(e: any) { console.log("getRebirthIds error:", e.message); }
}
main().catch(console.error);
