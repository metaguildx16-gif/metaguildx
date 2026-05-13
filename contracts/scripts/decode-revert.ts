import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const USDT = process.env.USDT_ADDRESS!;
  const SIGNER_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

  const provider = ethers.provider;

  const failedTxHash =
    "0x1826a8646ad378a47aab3d74cedb68a6defe7d21f12982992a5ab5434c380f85";

  const tx = await provider.getTransaction(failedTxHash);
  if (!tx) {
    console.log("TX not found");
    return;
  }

  console.log("TX from:", tx.from);
  console.log("TX to:", tx.to);
  console.log("TX data:", tx.data.substring(0, 10), "...");

  try {
    const result = await provider.call({
      from: tx.from,
      to: tx.to!,
      data: tx.data,
    }, (tx.blockNumber ?? 1) - 1);
    console.log("Replay result:", result);
  } catch (err: any) {
    console.log("Replay revert:");
    console.log("reason:", err.reason ?? "none");
    console.log("data:", err.data ?? "none");
    console.log("message:", String(err.message).substring(0, 300));

    if (err.data && err.data.length > 10) {
      const errorData = err.data;
      console.log("\nRaw error data:", errorData);

      const selector = errorData.substring(0, 10);
      console.log("Error selector:", selector);

      if (selector === "0x08c379a0") {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ["string"],
          "0x" + errorData.substring(10)
        );
        console.log("Decoded error:", decoded[0]);
      }

      if (selector === "0x4e487b71") {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
          ["uint256"],
          "0x" + errorData.substring(10)
        );
        console.log("Panic code:", decoded[0].toString());
        const panicCodes: Record<string, string> = {
          "1": "assert failed",
          "17": "arithmetic overflow",
          "18": "division by zero",
          "32": "array out of bounds",
          "33": "invalid enum",
          "34": "storage decode",
          "49": "empty array pop",
          "50": "array index OOB",
          "65": "too much memory",
          "81": "zero initialized function",
        };
        console.log("Panic meaning:", panicCodes[decoded[0].toString()] ?? "unknown");
      }
    }
  }

  console.log("\n=== FRESH STATIC CALL ===");

  const signerWallet = new ethers.Wallet(SIGNER_KEY);
  const freshUser = ethers.Wallet.createRandom().connect(provider);
  const freshAddr = freshUser.address;

  const core = await ethers.getContractAt(
    [
      "function nonces(address) view returns (uint256)",
      "function registerWithPlacement(uint256,uint256,bool,bytes,uint256) external payable",
      "function getPackagePrices() view returns (uint256[] memory)",
    ],
    CORE
  );

  const prices = await core.getPackagePrices();
  console.log("Package prices:", prices.map((p: bigint) => p.toString()));

  const nonce = await core.nonces(freshAddr);
  const msgHash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256"],
    [5611n, CORE, freshAddr, 4n, nonce]
  );
  const sig = await signerWallet.signMessage(ethers.getBytes(msgHash));

  const [deployer] = await ethers.getSigners();
  await (
    await deployer.sendTransaction({
      to: freshAddr,
      value: ethers.parseEther("0.01"),
    })
  ).wait();

  const usdt = await ethers.getContractAt(
    [
      "function mint(address,uint256) external",
      "function approve(address,uint256) external returns (bool)",
    ],
    USDT,
    deployer
  );

  await (await usdt.mint(freshAddr, ethers.parseUnits("50", 18))).wait();

  const usdtUser = usdt.connect(freshUser);
  await (await usdtUser.approve(CORE, ethers.parseUnits("50", 18))).wait();

  const coreUser = core.connect(freshUser);
  try {
    await coreUser.registerWithPlacement.staticCall(4n, 4n, false, sig, nonce);
    console.log("Static call: PASS ✅");
  } catch (err: any) {
    console.log("Static call REVERT:");
    console.log("reason:", err.reason ?? "none");
    console.log("data:", err.data ?? "none");

    if (err.data && err.data !== "none" && err.data.length > 10) {
      const selector = err.data.substring(0, 10);
      if (selector === "0x08c379a0") {
        try {
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
            ["string"],
            "0x" + err.data.substring(10)
          );
          console.log("Error string:", decoded[0]);
        } catch {}
      }
    }

    console.log("Full message:", String(err.message).substring(0, 500));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
