import { ethers } from "hardhat";

async function main() {
  const mgx = await ethers.getContractAt("MGXToken", "0x94CC4C342E96A4CB4618331e88309906F5ad3815");
  const SAFE = "0x6D01d1E9771193467B5fae47Ce8463d7060098eA";
  const AMOUNT = ethers.parseEther("1000000");
  
  console.log("Transferring 1M MGX to Safe...");
  const tx = await mgx.transfer(SAFE, AMOUNT);
  await tx.wait();
  console.log("Transfer done ✅ TX:", tx.hash);
  
  const bal = await mgx.balanceOf(SAFE);
  console.log("Safe MGX Balance:", ethers.formatEther(bal));
}

main().catch(console.error);
