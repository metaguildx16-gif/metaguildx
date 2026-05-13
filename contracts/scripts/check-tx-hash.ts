import { ethers } from "hardhat";

async function main() {
  const provider = ethers.provider;

  const txHashes = [
    "0xb7211765a0d15e220204046f0b7df2341e4539402640838dc766a10d3d7e56f1",
    "0x1826a8646ad378a47aab3d74cedb68a6defe7d21f12982992a5ab5434c380f85",
    "0x426bda30bd429790b756d803913d4151201506c898bf1b88d2fa619f1f9c1b67"
  ];

  console.log("=== RECENT FAILED TXs ===");
  for (const hash of txHashes) {
    const receipt = await provider.getTransactionReceipt(hash);
    console.log("\nTX:", hash.substring(0, 20) + "...");
    console.log("status:", receipt?.status === 1 ? "SUCCESS" : "FAILED");
    console.log("gasUsed:", receipt?.gasUsed.toString());
    console.log("logs:", receipt?.logs.length);
    console.log("block:", receipt?.blockNumber);
  }

  const core = await ethers.getContractAt(
    ["function nextUserId() view returns (uint256)"],
    process.env.SYSTEM_PROXY_ADDRESS!
  );

  console.log("\ncurrent nextUserId:", (await core.nextUserId()).toString());

  console.log("\n=== LIVE REGISTRATION TEST ===");
  const SIGNER_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
  const USDT = process.env.USDT_ADDRESS!;
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const [deployer] = await ethers.getSigners();

  const fresh = ethers.Wallet.createRandom().connect(provider);

  await (
    await deployer.sendTransaction({
      to: fresh.address,
      value: ethers.parseEther("0.01")
    })
  ).wait();

  const usdt = await ethers.getContractAt(
    [
      "function mint(address,uint256) external",
      "function approve(address,uint256) external"
    ],
    USDT,
    deployer
  );

  await (await usdt.mint(fresh.address, ethers.parseUnits("50", 18))).wait();
  await (await usdt.connect(fresh).approve(CORE, ethers.parseUnits("50", 18))).wait();

  const signerWallet = new ethers.Wallet(SIGNER_KEY);
  const nonce = 0n;
  const sponsorId = 2n;

  const msgHash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256"],
    [5611n, CORE, fresh.address, sponsorId, nonce]
  );
  const sig = await signerWallet.signMessage(ethers.getBytes(msgHash));

  const coreUser = (
    await ethers.getContractAt(
      [
        "function registerWithPlacement(uint256,uint256,bool,bytes,uint256) external payable"
      ],
      CORE
    )
  ).connect(fresh);

  try {
    const tx = await coreUser.registerWithPlacement(sponsorId, 0n, false, sig, nonce, {
      gasLimit: 5_000_000n
    });
    const receipt = await tx.wait();
    console.log("SUCCESS ✅");
    console.log("gasUsed:", receipt?.gasUsed.toString());
    console.log("logs:", receipt?.logs.length);
    console.log("txHash:", receipt?.hash);

    const newNextId = await core.nextUserId();
    console.log("new nextUserId:", newNextId.toString());
  } catch (err: any) {
    console.log("REVERT ❌");
    console.log("reason:", err.reason ?? "none");
    console.log("gasUsed:", err.receipt?.gasUsed?.toString());
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
