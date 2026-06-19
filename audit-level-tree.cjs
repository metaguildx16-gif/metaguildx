const { ethers } = require("ethers");

const RPC = "https://opbnb-mainnet-rpc.bnbchain.org";
const BTREE = "0x2d06a29321DBee7F22cd2E51c62EC03Af0399087";

const abi = [
  "function isLevelEligible(uint256) view returns (bool)",
  "function getLevelChildren(uint256) view returns (uint256 left, uint256 right)",
  "function levelChildren(uint256,uint256) view returns (uint256)",
  "function levelEligibilityCounter() view returns (uint256)",
  "function levelEligibleAt(uint256) view returns (uint256)",
  "function getLevelParent(uint256) view returns (uint256)",
  "function subtreeCounts(uint256) view returns (uint256)",
  "function nodes(uint256) view returns (uint256 userId, uint256 parentId, uint256 leftChildId, uint256 rightChildId, uint8 depth)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const tree = new ethers.Contract(BTREE, abi, provider);

  const counter = await tree.levelEligibilityCounter();
  console.log("levelEligibilityCounter:", counter.toString());

  for (let i = 1; i <= 30; i++) {
    try {
      const elig = await tree.isLevelEligible(i);
      const lc = await tree.getLevelChildren(i);
      console.log(`User ${i}: eligible=${elig} levelLeft=${lc.left} levelRight=${lc.right}`);
    } catch(e) {
      console.log(`User ${i}: ERROR ${e.message.slice(0,50)}`);
    }
  }

  // User 28 detail
  const n28 = await tree.nodes(28);
  console.log("\nUser 28 nodes:", n28.userId, n28.parentId, n28.leftChildId, n28.rightChildId);
  const lp28 = await tree.getLevelParent(28);
  console.log("User 28 levelParent:", lp28.toString());
}

main().catch(console.error);
