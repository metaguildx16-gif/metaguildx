import { ethers } from "hardhat";

async function main() {
  const [d] = await ethers.getSigners();
  const confirmed = await ethers.provider
    .getTransactionCount(d.address, "latest");
  const pending = await ethers.provider
    .getTransactionCount(d.address, "pending");

  console.log("Confirmed:", confirmed);
  console.log("Pending:", pending);

  if (confirmed === pending) {
    console.log("Already clear ✅");
    return;
  }

  for (let nonce = confirmed; nonce < pending; nonce++) {
    console.log("Clearing nonce:", nonce);
    const tx = await d.sendTransaction({
      to: d.address,
      value: 0n,
      nonce: nonce,
      gasPrice: ethers.parseUnits("5", "gwei"),
      gasLimit: 21000n
    });
    console.log("TX sent:", tx.hash);
    await tx.wait();
    console.log("Nonce", nonce, "cleared ✅");
  }

  const newC = await ethers.provider
    .getTransactionCount(d.address, "latest");
  const newP = await ethers.provider
    .getTransactionCount(d.address, "pending");
  console.log("Final confirmed:", newC);
  console.log("Final pending:", newP);
  console.log("Clear:", newC === newP ? "YES ✅" : "NO ❌");
}

main().catch(console.error);
