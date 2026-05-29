import { ethers } from "hardhat";
async function main() {
  const [deployer] = await ethers.getSigners();
  const tx = await deployer.sendTransaction({
    to: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    value: ethers.parseEther("0.1")
  });
  await tx.wait();
  console.log("BNB sent ✅ TX:", tx.hash);
}
main().catch(console.error);
