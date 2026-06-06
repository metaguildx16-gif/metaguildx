import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const GNOSIS_SAFE = "0x6D01d1E9771193467B5fae47Ce8463d7060098eA";
  const DEPLOYER    = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";

  const contracts: [string, string][] = [
    ["Core",         "0x19F72c5a287334086fD34D41ebe6bb534524D202"],
    ["Income",       "0x72433Cd3d2e41ed2B230510496835803aD245a48"],
    ["Router",       "0xe59Ad238162D9591BCC7659A10fe017004a4cA69"],
    ["BinaryTree",   "0xf2aC2f87DFabf67EDAdCfFF8dbb9A1aAEB93c923"],
    ["Upgrade",      "0x2a9Ed16e119da2CDB241Ac672bB5ece059730D50"],
    ["CashbackPool", "0xfA98cee4B1bFBf609A55Bc3e5B4ef511D3Df0423"],
    ["MGXStaking",   "0xEd70b05b28bfbc4885111260F4d3eEE127B043c9"],
    ["TokenEngine",  "0x68F028Cb932114AE700FD0dc263f2e9d8FcFE351"],
  ];

  const ownerAbi = ["function owner() view returns (address)"];

  console.log("=== OWNERSHIP AUDIT ===\n");
  let allSafe = true;

  for (const [name, addr] of contracts) {
    try {
      const c = await ethers.getContractAt(ownerAbi, addr);
      const owner = await c.owner();
      const isGnosis = owner.toLowerCase() === GNOSIS_SAFE.toLowerCase();
      const isDeployer = owner.toLowerCase() === DEPLOYER.toLowerCase();
      const status = isGnosis ? "? Gnosis Safe" : isDeployer ? "? DEPLOYER EOA" : `?? UNKNOWN: ${owner}`;
      console.log(`${name}: ${status}`);
      if (!isGnosis) allSafe = false;
    } catch {
      console.log(`${name}: ?? owner() call failed`);
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(allSafe ? "? All contracts owned by Gnosis Safe" : "? Some contracts NOT owned by Gnosis Safe!");
  console.log("Gnosis Safe:", GNOSIS_SAFE);
}

main().catch(console.error);
