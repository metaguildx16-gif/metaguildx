import { ethers } from "hardhat";
import { Wallet, getBytes, solidityPackedKeccak256 } from "ethers";

const ROUTER = "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
const NEW_USDT = "0x4F493fA958BC923E6e1aF59F22B5A41406BB7719";
const SIGNER_KEY = "0xba3b31eaca1d095998ca88f4ef631fc6e5bfff7c34d8910b2ccbd983c2e8b650";
const CHAIN_ID = 5611n;
const REGISTER_ABI = [
  "function registerWithPlacement(uint256 sponsorId, uint256 placementParentId, bool isLeft, bytes calldata signature, uint256 nonce) external payable returns (uint256)"
];

async function findNextSlot(router: any, startId: number) {
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = await router.treeNodes(current);
    if (Number(node.leftChildId) === 0) {
      return { placementParentId: BigInt(current), isLeft: true };
    }
    if (Number(node.rightChildId) === 0) {
      return { placementParentId: BigInt(current), isLeft: false };
    }
    queue.push(Number(node.leftChildId));
    queue.push(Number(node.rightChildId));
  }
  throw new Error(`No placement slot found under sponsor ${startId}`);
}

async function printTree(router: any) {
  const nextUserId = Number(await router.nextUserId());
  const totalUsers = nextUserId - 1;
  console.log(`\n=== TREE AFTER REGISTRATION (${totalUsers} users) ===`);
  for (let i = 1; i <= totalUsers; i += 1) {
    const profile = await router.usersById(i);
    const node = await router.treeNodes(i);
    console.log(
      `User ${i}: sponsor=${profile.sponsorId} pkg=${profile.packageLevel} parent=${node.parentId} left=${node.leftChildId} right=${node.rightChildId}`
    );
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const router = await ethers.getContractAt("MetaGuildXSystem", ROUTER, deployer);
  const usdt = await ethers.getContractAt("MockUSDT", NEW_USDT, deployer);
  const placementSigner = new Wallet(SIGNER_KEY);
  const systemPaymentAsset = await router.defaultPaymentAsset();

  console.log("Deployer:", deployer.address);
  console.log("System default payment asset:", systemPaymentAsset);
  console.log("Script payment asset        :", NEW_USDT);

  if (systemPaymentAsset.toLowerCase() !== NEW_USDT.toLowerCase()) {
    console.log("Switching system payment asset to NEW_USDT...");
    await (await router.setUsdtTokenAddress(NEW_USDT)).wait();
    await (await router.configurePaymentAsset(NEW_USDT, true, false, ethers.parseUnits("0.1", 18))).wait();
    await (await router.setProductionMode(true, NEW_USDT)).wait();
    console.log("System payment asset synced ✅");
  }

  const requiredGasBudget = ethers.parseEther("0.01");
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer BNB:", ethers.formatEther(deployerBalance));
  if (deployerBalance < requiredGasBudget) {
    throw new Error(`Deployer needs at least 0.01 BNB to fund five users, has ${ethers.formatEther(deployerBalance)} BNB`);
  }

  const beforeUser1 = await router.usersById(1);
  const plans = [
    { label: "User 6", sponsorId: 1 },
    { label: "User 7", sponsorId: 1 },
    { label: "User 8", sponsorId: 2 },
    { label: "User 9", sponsorId: 2 },
    { label: "User 10", sponsorId: 3 }
  ] as const;

  const created: Array<{ label: string; address: string; privateKey: string; sponsorId: number; txHash: string }> = [];

  for (const plan of plans) {
    console.log(`\n=== ${plan.label} | sponsor=${plan.sponsorId} ===`);

    const newUser = Wallet.createRandom();
    const newUserSigner = new Wallet(newUser.privateKey, ethers.provider);
    const usdtAsOwner = usdt.connect(deployer);
    const usdtAsUser = usdt.connect(newUserSigner);

    console.log("Wallet:", newUser.address);

    await (await usdtAsOwner.mint(newUser.address, ethers.parseUnits("1000", 18))).wait();
    const fundTx = await deployer.sendTransaction({
      to: newUser.address,
      value: ethers.parseEther("0.002")
    });
    await fundTx.wait();
    await (await usdtAsUser.approve(ROUTER, ethers.parseUnits("10", 18))).wait();

    const { placementParentId, isLeft } = await findNextSlot(router, plan.sponsorId);
    const nonce = await router.nonces(newUser.address);
    const digest = solidityPackedKeccak256(
      ["uint256", "address", "address", "uint256", "uint256", "bool", "uint256"],
      [CHAIN_ID, ROUTER, newUser.address, BigInt(plan.sponsorId), placementParentId, isLeft, nonce]
    );
    const signature = await placementSigner.signMessage(getBytes(digest));

    const routerAsUser = new ethers.Contract(ROUTER, REGISTER_ABI, newUserSigner);
    const tx = await (routerAsUser as any).registerWithPlacement(
      BigInt(plan.sponsorId),
      placementParentId,
      isLeft,
      signature,
      nonce,
      { gasLimit: 3_000_000n }
    );
    const receipt = await tx.wait();

    console.log(`Placed under ${placementParentId.toString()} (${isLeft ? "left" : "right"})`);
    console.log(`TX: ${tx.hash}`);
    console.log(`Gas: ${receipt?.gasUsed.toString()}`);

    created.push({
      label: plan.label,
      address: newUser.address,
      privateKey: newUser.privateKey,
      sponsorId: plan.sponsorId,
      txHash: tx.hash
    });
  }

  await printTree(router);

  const user1 = await router.usersById(1);
  console.log("\n=== USER 1 STATUS ===");
  console.log("Direct referrals:", user1.directReferrals.toString());
  console.log("Total earnings  :", user1.totalEarnings.toString());
  console.log("Package level   :", user1.packageLevel.toString());
  console.log("Auto-upgrade triggered?", Number(user1.packageLevel) > Number(beforeUser1.packageLevel) ? "YES ✅" : "NO");

  console.log("\n=== NEW TEST WALLETS ===");
  for (const item of created) {
    console.log(`${item.label}: ${item.address} | pk=${item.privateKey} | sponsor=${item.sponsorId} | tx=${item.txHash}`);
  }
}

main().catch(console.error);
