import { ethers } from "hardhat";

async function main() {
  const CORE = "0xe987521C9FDE4CD09a62E0369BaE59663F9B7625";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const ROUTER = "0x6AD732D64727A749Df3959A6DA12066b4ab664Bb";
  const CREATOR = "0xbFF19De173697D07B904a4c7b79e4A524B456991";
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const user2Signer = signers[1]
    ?? new ethers.Wallet(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
      ethers.provider
    );

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const coreAsUser2 = await ethers.getContractAt("MetaGuildXCore", CORE, user2Signer);
  const usdt = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    USDT
  );
  const usdtAsUser2 = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    USDT,
    user2Signer
  );
  const router = await ethers.getContractAt("IncomeRouter", ROUTER);
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  const creatorBefore = await usdt.balanceOf(CREATOR);
  const routerBefore = await usdt.balanceOf(ROUTER);
  const coreBefore = await usdt.balanceOf(CORE);
  console.log("=== PRE ===");
  console.log("Deployer:", deployer.address);
  console.log("User#2 wallet:", user2Signer.address);
  console.log("Creator:", ethers.formatUnits(creatorBefore, 18), "USDT");
  console.log("Router :", ethers.formatUnits(routerBefore, 18), "USDT");
  console.log("Core   :", ethers.formatUnits(coreBefore, 18), "USDT");

  const nextId = Number(await core.nextUserId());
  console.log("\nRegistering User #" + nextId);

  const pkg1 = await core.getPackagePriceByLevel(1);
  const unitPrice = await (core as any).paymentAssetUnitPrice(USDT);
  const settlementAmt = pkg1 * unitPrice;
  console.log("pkg1:", pkg1.toString(), "units");
  console.log("settlementAmt:", ethers.formatUnits(settlementAmt, 18), "USDT");

  console.log("Funding User#2 gas: 0.002 BNB");
  await (await deployer.sendTransaction({
    to: user2Signer.address,
    value: ethers.parseEther("0.002")
  })).wait();

  const user2BalBefore = await usdt.balanceOf(user2Signer.address);
  if (user2BalBefore < settlementAmt) {
    const topUp = settlementAmt * 2n;
    console.log("Funding User#2:", ethers.formatUnits(topUp, 18), "USDT");
    await (await usdt.transfer(user2Signer.address, topUp)).wait();
  }

  const nonce = Number(await (core as any).nonces(user2Signer.address));
  let sig: string;
  try {
    const resp = await fetch("http://localhost:3001/sign-placement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account: user2Signer.address,
        sponsorId: 1,
        nonce,
        chainId: 5611,
        contractAddress: CORE
      }),
    });
    const data = (await resp.json()) as { signature?: string; error?: string };
    if (!data.signature) throw new Error(data.error ?? "no sig");
    sig = data.signature;
    console.log("Signature from signer service ✅");
  } catch (e: any) {
    console.log("Signer service error:", e.message?.slice(0, 100));
    const msgHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "address", "uint256", "uint256"],
      [BigInt(chainId), CORE, user2Signer.address, 1n, BigInt(nonce)]
    );
    sig = await deployer.signMessage(ethers.getBytes(msgHash));
    console.log("Signature from local fallback ✅");
  }

  const approveTx = await usdtAsUser2.approve(CORE, settlementAmt * 2n);
  console.log("Approve tx hash:", approveTx.hash);
  const approveReceipt = await approveTx.wait(2);
  console.log("Approve confirmed, block:", approveReceipt!.blockNumber);

  let allowance = 0n;
  for (let i = 0; i < 10; i++) {
    allowance = await usdtAsUser2.allowance(user2Signer.address, CORE);
    console.log(`Allowance check ${i + 1}: ${ethers.formatUnits(allowance, 18)} USDT`);
    if (allowance >= settlementAmt) break;
    await new Promise((r) => setTimeout(r, 3000));
  }

  if (allowance < settlementAmt) {
    console.log("❌ Allowance never confirmed — USDT approve failed");
    console.log("USDT contract:", USDT);
    console.log("Spender (CORE):", CORE);
    console.log("User2 address:", user2Signer.address);
    return;
  }
  console.log("Allowance confirmed ✅");

  const user2Bal = await usdt.balanceOf(user2Signer.address);
  const user2Allowance = await usdt.allowance(user2Signer.address, CORE);
  console.log("User#2 USDT balance  :", ethers.formatUnits(user2Bal, 18));
  console.log("User#2 allowance→Core:", ethers.formatUnits(user2Allowance, 18));
  console.log("Need                 : 10.0 USDT");
  console.log("Balance OK  :", user2Bal >= ethers.parseUnits("10", 18) ? "✅" : "❌");
  console.log("Allowance OK:", user2Allowance >= ethers.parseUnits("10", 18) ? "✅" : "❌");

  const tx = await coreAsUser2.registerWithPlacement(1, 0, true, sig, nonce);
  const receipt = await tx.wait();
  console.log("\nTx:", receipt!.hash);
  console.log("Status:", receipt!.status === 1 ? "SUCCESS ✅" : "FAILED ❌");

  const creatorAfter = await usdt.balanceOf(CREATOR);
  const routerAfter = await usdt.balanceOf(ROUTER);
  const coreAfter = await usdt.balanceOf(CORE);
  console.log("\n=== POST ===");
  console.log("Creator:", ethers.formatUnits(creatorAfter, 18), "USDT");
  console.log("Router :", ethers.formatUnits(routerAfter, 18), "USDT");
  console.log("Core   :", ethers.formatUnits(coreAfter, 18), "USDT");
  console.log("Creator received:", ethers.formatUnits(creatorAfter - creatorBefore, 18), "USDT");

  const failed = await core.getFailedUserIds();
  console.log("\nfailedUserIds:", failed.length === 0 ? "none ✅" : failed.toString());

  console.log("\n=== KEY EVENTS ===");
  for (const log of receipt!.logs) {
    try {
      const parsed = core.interface.parseLog(log);
      if (parsed) console.log("[CORE]", parsed.name);
    } catch {}
    try {
      const parsed = router.interface.parseLog(log);
      if (parsed) console.log("[ROUTER]", parsed.name);
    } catch {}
  }
}

main().catch(console.error);
