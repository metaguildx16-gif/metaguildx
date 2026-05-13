import { ethers } from "hardhat";

async function main() {
  const provider = new ethers.JsonRpcProvider(
    "https://opbnb-testnet-rpc.bnbchain.org"
  );

  const txHashes = [
    "0x5965ecfa6cc3838a08cf25374eef2f8ab1f3ebcabd6fb61c7d9f67d442e39281",
    "0x486e6bdce5c9be42dc6c7b508623c87084623adf3168a73e8cca75edc5cb310b",
  ];

  for (const hash of txHashes) {
    console.log("\n=== TX:", hash, "===");
    const tx = await provider.getTransaction(hash);
    const receipt = await provider.getTransactionReceipt(hash);
    console.log("  to:", tx?.to);
    console.log("  from:", tx?.from);
    console.log("  data (first 10 chars):", tx?.data.slice(0, 10));
    console.log("  status:", receipt?.status === 1 ? "SUCCESS" : "FAILED");
    console.log("  logs count:", receipt?.logs.length);
    for (const log of receipt?.logs ?? []) {
      console.log("  log address:", log.address);
      console.log("  log topics[0]:", log.topics[0]);
      console.log("  log data:", log.data.slice(0, 66));
      console.log("  ---");
    }
  }
}

main().catch(console.error);
