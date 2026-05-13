import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();

const CORE = "0xcea26779d6C0d80525702a5a7362Aa4d08F9E1Ec";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const usdt = new ethers.Contract(
    USDT,
    [
      "function approve(address,uint256) returns (bool)",
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
      "function mint(address,uint256)",
      "function decimals() view returns (uint8)"
    ],
    deployer
  );

  const decimals = await usdt.decimals();
  const packagePrices = (await core.getPackagePrices()) as bigint[];
  const unitPrice = (await core.paymentAssetUnitPrice(USDT)) as bigint;
  const packagePrice = packagePrices[0];
  const settlementAmount = packagePrice * unitPrice;

  const user2Wallet = ethers.Wallet.createRandom().connect(ethers.provider);
  console.log("User2 wallet:", user2Wallet.address);

  const gasTx = await deployer.sendTransaction({
    to: user2Wallet.address,
    value: ethers.parseEther("0.002")
  });
  await gasTx.wait();
  console.log("Gas funded âœ…");

  const mintTx = await usdt.mint(user2Wallet.address, settlementAmount * 5n);
  await mintTx.wait();
  console.log("USDT minted to user2 âœ…");

  const user2Usdt = usdt.connect(user2Wallet);
  const approveTx = await user2Usdt.approve(CORE, settlementAmount * 5n);
  await approveTx.wait();
  console.log("USDT approved âœ…");

  const rootId = (await core.rootUserId()) as bigint;
  console.log("Root ID:", rootId.toString());

  const onchainPlacementSigner = (await core.placementSigner()) as string;
  const SIGNER_KEY =
    process.env.LOCAL_PLACEMENT_SIGNER_KEY
    ?? process.env.DEPLOYER_PRIVATE_KEY!;
  if (!SIGNER_KEY) {
    throw new Error("Missing LOCAL_PLACEMENT_SIGNER_KEY or DEPLOYER_PRIVATE_KEY");
  }
  const signerWallet = new ethers.Wallet(SIGNER_KEY);
  console.log("Signer:", signerWallet.address);
  console.log(
    "Matches on-chain:",
    signerWallet.address.toLowerCase() ===
      "0x8abc4ff35207a7ea76743d29ce7f3b3adda0538e"
      ? "âœ… YES"
      : "âŒ NO - key mismatch!"
  );
  if (
    signerWallet.address.toLowerCase() !==
    "0x8abc4ff35207a7ea76743d29ce7f3b3adda0538e"
  ) {
    throw new Error("Signer mismatch! Address: " + signerWallet.address);
  }
  if (signerWallet.address.toLowerCase() !== onchainPlacementSigner.toLowerCase()) {
    throw new Error(`Signer mismatch. Expected ${onchainPlacementSigner} got ${signerWallet.address}`);
  }

  const nonce = (await core.nonces(user2Wallet.address)) as bigint;
  const msgHash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256"],
    [5611n, CORE, user2Wallet.address, rootId, nonce]
  );
  const sig = await signerWallet.signMessage(ethers.getBytes(msgHash));

  const rootWallet = (await core.usersById(rootId)).account as string;
  const rootBalBefore = (await usdt.balanceOf(rootWallet)) as bigint;
  console.log("Root USDT before:", ethers.formatUnits(rootBalBefore, decimals));

  console.log("=== PRE-REGISTRATION CHECK ===");
  const u2Bal = (await usdt.balanceOf(user2Wallet.address)) as bigint;
  console.log("User2 USDT balance:", ethers.formatUnits(u2Bal, decimals));

  const allowance = (await usdt.allowance(
    user2Wallet.address,
    await core.getAddress()
  )) as bigint;
  console.log("USDT allowance to core:", ethers.formatUnits(allowance, decimals));

  const prices = (await core.getPackagePrices()) as bigint[];
  console.log(
    "Package prices:",
    prices.map((p) => ethers.formatUnits(p, 0))
  );

  const defAsset = (await core.defaultPaymentAsset()) as string;
  const coreUsdtAddress = (await core.usdtAddress()) as string;
  console.log("Script USDT address:", USDT);
  console.log("Default payment asset:", defAsset);
  console.log("Core USDT address:", coreUsdtAddress);
  console.log("Approved spender:", await core.getAddress());
  console.log(
    "Payment asset match:",
    USDT.toLowerCase() === defAsset.toLowerCase() &&
    USDT.toLowerCase() === coreUsdtAddress.toLowerCase()
      ? "YES"
      : "NO"
  );

  const rootUser = await core.usersById(1n);
  console.log("Root user exists:", rootUser.id !== 0n);
  console.log("Root user wallet:", rootUser.account);

  console.log("User2 nonce:", nonce.toString());

  const prodMode = await core.productionMode();
  console.log("Production mode:", prodMode);

  const onChainSigner = await core.placementSigner();
  console.log("On-chain signer:", onChainSigner);

  console.log("Signing with:", signerWallet.address);
  console.log("Signed fields: chainId, contractAddress, account, sponsorId, nonce");
  console.log("sponsorId:", rootId.toString());
  console.log("nonce:", nonce.toString());
  console.log("chainId:", 5611);
  console.log("contractAddress:", await core.getAddress());
  console.log("account:", user2Wallet.address);
  console.log("Signature:", sig);

  try {
    await core.connect(user2Wallet).registerWithPlacement.staticCall(
      rootId,
      rootId,
      true,
      sig,
      nonce
    );
    console.log("Static call: PASS âœ…");
  } catch (err) {
    const error = err as { message?: string; data?: unknown };
    console.log("Static call REVERT reason:");
    console.log(error.message ?? "Unknown error");
    console.log(error.data ?? "no data");
    process.exit(1);
  }

  console.log("Registering User 2...");
  const tx = await core.connect(user2Wallet).registerWithPlacement(
    rootId,
    rootId,
    true,
    sig,
    nonce
  );
  await tx.wait();
  console.log("User 2 registered! TX:", tx.hash);

  const rootBalAfter = (await usdt.balanceOf(rootWallet)) as bigint;
  const incomeReceived = rootBalAfter - rootBalBefore;
  console.log("Root USDT after:", ethers.formatUnits(rootBalAfter, decimals));
  console.log("Root income received:", ethers.formatUnits(incomeReceived, decimals), "USDT");

  const user2Id = (await core.userIdByAddress(user2Wallet.address)) as bigint;
  console.log("User2 ID:", user2Id.toString());

  console.log("\nâ”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”");
  console.log("INCOME CHECK");
  console.log("â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”");
  console.log("Root got 46% direct income :", incomeReceived > 0n ? "âœ… YES" : "âŒ NO");
  const expected46 = (settlementAmount * 4600n) / 10000n;
  console.log("Expected 46% =", ethers.formatUnits(expected46, decimals), "USDT");
  console.log("Actual received =", ethers.formatUnits(incomeReceived, decimals), "USDT");
  console.log("Match:", incomeReceived === expected46 ? "âœ…" : "âŒ");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
