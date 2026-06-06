import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Transferring from:", deployer.address);

  const GNOSIS_SAFE = "0x6D01d1E9771193467B5fae47Ce8463d7060098eA";

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

  const ownerAbi = [
    "function owner() view returns (address)",
    "function transferOwnership(address) external"
  ];

  console.log("\nTransferring ownership to Gnosis Safe:", GNOSIS_SAFE);

  for (const [name, addr] of contracts) {
    try {
      const c = await ethers.getContractAt(ownerAbi, addr, deployer);
      const owner = await c.owner();
      if (owner.toLowerCase() === GNOSIS_SAFE.toLowerCase()) {
        console.log(`${name}: already Gnosis Safe ?`);
        continue;
      }
      console.log(`${name}: transferring...`);
      const tx = await c.transferOwnership(GNOSIS_SAFE);
      await tx.wait();
      console.log(`${name}: ? done`);
    } catch (e: any) {
      console.log(`${name}: ? failed — ${e.message}`);
    }
  }

  console.log("\nVerifying...");
  for (const [name, addr] of contracts) {
    const c = await ethers.getContractAt(ownerAbi, addr);
    const owner = await c.owner();
    console.log(`${name}: ${owner.toLowerCase() === GNOSIS_SAFE.toLowerCase() ? "? Gnosis Safe" : "? " + owner}`);
  }
}

main().catch(console.error);
