import { ethers } from "hardhat";

async function main() {
  const wallet = ethers.Wallet.createRandom();
  console.log("New Signer Address    :", wallet.address);
  console.log("New Signer Private Key:", wallet.privateKey);
  console.log("");
  console.log("Add to contracts/.env:");
  console.log(`PLACEMENT_SIGNER_ADDRESS=${wallet.address}`);
  console.log(`PLACEMENT_SIGNER_KEY=${wallet.privateKey}`);
  console.log("");
  console.log("Add to apps/web/.env:");
  console.log(`VITE_LOCAL_PLACEMENT_SIGNER_KEY=${wallet.privateKey}`);
}

main().catch(console.error);
