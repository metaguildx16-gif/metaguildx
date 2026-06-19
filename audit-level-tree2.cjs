const { ethers } = require("ethers");
const RPC = "https://opbnb-mainnet-rpc.bnbchain.org";
const BTREE = "0x2d06a29321DBee7F22cd2E51c62EC03Af0399087";
const abi = [
  "function isLevelEligible(uint256) view returns (bool)",
  "function getLevelChildren(uint256) view returns (uint256 left, uint256 right)",
  "function getLevelParent(uint256) view returns (uint256)",
  "function levelEligibleAt(uint256) view returns (uint256)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const tree = new ethers.Contract(BTREE, abi, provider);

  console.log("=== LEVEL TREE STRUCTURE ===");
  // All eligible users tree map
  for (let i = 1; i <= 50; i++) {
    try {
      const elig = await tree.isLevelEligible(i);
      if (!elig) continue;
      const lc = await tree.getLevelChildren(i);
      const lp = await tree.getLevelParent(i);
      const at = await tree.levelEligibleAt(i);
      const left = Number(lc.left);
      const right = Number(lc.right);
      console.log(`U${i} [pos=${at}] parent=${lp} → L=${left==0?"❌":left} R=${right==0?"❌":right}`);
    } catch(e) {}
  }
}
main().catch(console.error);
