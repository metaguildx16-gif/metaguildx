import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const CORE_IMPL = "0x760882C7210F62C12E9272080080AF7c2bA1461A";
  const provider = ethers.provider;
  const code = await provider.getCode(CORE_IMPL);
  const raw = code.slice(2); // remove 0x

  // From linkReferences: extract addresses at byte positions
  const libs = [
    { name: "UpgradeCycleLib",       start: 2881 },
    { name: "MetaGuildXPaymentLib",  start: 17590 },
    { name: "MetaGuildXPlacementLib",start: 7644 },
  ];

  for (const lib of libs) {
    const byteStart = lib.start * 2; // hex chars
    const addr = "0x" + raw.slice(byteStart, byteStart + 40);
    console.log(`${lib.name}: ${addr}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
