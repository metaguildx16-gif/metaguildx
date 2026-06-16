const { ethers } = require("ethers");

const RPC = "https://opbnb-mainnet-rpc.bnbchain.org";
const CORE = "0xE3cD200609E223c96987c9FEa41C6014e8625c2F";
const PK = process.env.DEPLOYER_PK;

const ABI = [
  "function nextUserId() view returns (uint256)",
  "function failedDistribution(uint256) view returns (bool)",
  "function adminRetryDistribution(uint256) external"
];

async function run() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const core = new ethers.Contract(CORE, ABI, wallet);

  const nextId = await core.nextUserId();
  const total = Number(nextId) - 1;
  console.log(`[${new Date().toISOString()}] Checking ${total} users...`);

  for (let i = 1; i <= total; i++) {
    const failed = await core.failedDistribution(i);
    if (failed) {
      console.log(`User ${i} failed — retrying...`);
      try {
        const tx = await core.adminRetryDistribution(i, { gasLimit: 8000000n });
        await tx.wait();
        console.log(`User ${i} retry OK: ${tx.hash}`);
      } catch(e) {
        console.error(`User ${i} retry failed:`, e.message);
      }
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  console.log("Check complete.");
}

run().catch(console.error);
