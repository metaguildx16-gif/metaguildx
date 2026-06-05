import { ethers } from "hardhat";
async function main() {
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const contracts: [string, string][] = [
    ["Core",        "0x19F72c5a287334086fD34D41ebe6bb534524D202"],
    ["Income",      "0x72433Cd3d2e41ed2B230510496835803aD245a48"],
    ["Router",      "0xe59Ad238162D9591BCC7659A10fe017004a4cA69"],
    ["Upgrade",     "0x2a9Ed16e119da2CDB241Ac672bB5ece059730D50"],
    ["Staking",     "0xEd70b05b28bfbc4885111260F4d3eEE127B043c9"],
    ["TokenEngine", "0x68F028Cb932114AE700FD0dc263f2e9d8FcFE351"],
  ];
  for (const [name, proxy] of contracts) {
    const impl = await ethers.provider.getStorage(proxy, implSlot);
    console.log(name + ":", "0x" + impl.slice(26));
  }
}
main().catch(console.error);
