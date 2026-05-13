import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const provider = ethers.provider;

  const core = await ethers.getContractAt(
    [
      "event UserRegistered(uint256 indexed userId, uint256 indexed sponsorId, address indexed account, uint8 packageLevel, uint256 amount, uint256 placedUnderId, bool placedLeft)",
    ],
    CORE
  );

  console.log("Finding User 26 TX...");
  let user26Event: any = null;
  let from = 150510000;
  while (from <= 150520000) {
    const to = Math.min(from + 49000, 150520000);
    try {
      const events = await core.queryFilter(core.filters.UserRegistered(), from, to);
      const found = events.find((e) => (e as any).args.userId.toString() === "26");
      if (found) {
        user26Event = found;
        break;
      }
    } catch {}
    from = to + 1;
  }

  if (!user26Event) {
    console.log("Not found in range, trying wider...");
    from = 150500000;
    while (from <= 150530000) {
      const to = Math.min(from + 49000, 150530000);
      try {
        const events = await core.queryFilter(core.filters.UserRegistered(), from, to);
        const found = events.find((e) => (e as any).args.userId.toString() === "26");
        if (found) {
          user26Event = found;
          break;
        }
      } catch {}
      from = to + 1;
    }
  }

  if (!user26Event) {
    console.log("User 26 event NOT FOUND!");
    return;
  }

  console.log("Found! TX:", user26Event.transactionHash);
  console.log("Block:", user26Event.blockNumber);

  const tx = await provider.getTransaction(user26Event.transactionHash);

  const iface = new ethers.Interface([
    "function registerWithPlacement(uint256 sponsorId, uint256 placementParentId, bool isLeft, bytes signature, uint256 nonce)",
  ]);

  const decoded = iface.parseTransaction({ data: tx!.data });
  console.log("\n=== USER 26 REGISTRATION PARAMS ===");
  console.log("sponsorId:", decoded?.args.sponsorId.toString());
  console.log("placementParentId:", decoded?.args.placementParentId.toString());
  console.log("isLeft:", decoded?.args.isLeft);
  console.log("nonce:", decoded?.args.nonce.toString());
  console.log("from (account):", tx!.from);

  const coreView = await ethers.getContractAt(
    [
      "function incomeRouterContract() view returns (address)",
      "function incomeEngineContract() view returns (address)",
      "function binaryTreeContract() view returns (address)",
      "function cashbackPoolContract() view returns (address)",
    ],
    CORE
  );

  console.log("\n=== CURRENT CORE WIRING ===");
  console.log("router:", await coreView.incomeRouterContract());
  console.log("income:", await coreView.incomeEngineContract());
  console.log("tree:", await coreView.binaryTreeContract());
  console.log("cashback:", await coreView.cashbackPoolContract());

  const SIGNER_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
  const USDT = process.env.USDT_ADDRESS!;
  const [deployer] = await ethers.getSigners();

  const freshUser = ethers.Wallet.createRandom().connect(provider);
  const freshAddr = freshUser.address;
  const sponsorId = decoded?.args.sponsorId as bigint;
  const placementParentId = decoded?.args.placementParentId as bigint;
  const isLeft = decoded?.args.isLeft as boolean;

  console.log("\n=== REPLAY WITH SAME PARAMS ===");
  console.log("Fresh user:", freshAddr);
  console.log("sponsorId:", sponsorId.toString());
  console.log("placementParentId:", placementParentId.toString());
  console.log("isLeft:", isLeft);

  await (
    await deployer.sendTransaction({
      to: freshAddr,
      value: ethers.parseEther("0.01"),
    })
  ).wait();

  const usdt = await ethers.getContractAt(
    [
      "function mint(address,uint256) external",
      "function approve(address,uint256) external",
    ],
    USDT,
    deployer
  );

  await (await usdt.mint(freshAddr, ethers.parseUnits("50", 18))).wait();
  await (await usdt.connect(freshUser).approve(CORE, ethers.parseUnits("50", 18))).wait();

  const signerWallet = new ethers.Wallet(SIGNER_KEY);
  const nonce = 0n;
  const msgHash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256"],
    [5611n, CORE, freshAddr, sponsorId, nonce]
  );
  const sig = await signerWallet.signMessage(ethers.getBytes(msgHash));

  const coreUser = (
    await ethers.getContractAt(
      ["function registerWithPlacement(uint256,uint256,bool,bytes,uint256) external payable"],
      CORE
    )
  ).connect(freshUser);

  try {
    const tx2 = await coreUser.registerWithPlacement(
      sponsorId,
      placementParentId,
      isLeft,
      sig,
      nonce,
      { gasLimit: 5_000_000n }
    );
    const receipt = await tx2.wait();
    console.log("\nRegistration: SUCCESS ✅");
    console.log("gasUsed:", receipt?.gasUsed.toString());
    console.log("logs:", receipt?.logs.length);
    console.log("txHash:", receipt?.hash);
  } catch (err: any) {
    console.log("\nRegistration: REVERT ❌");
    console.log("reason:", err.reason ?? "none");
    console.log("gasUsed:", err.receipt?.gasUsed?.toString() ?? "unknown");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
