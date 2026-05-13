import * as hre from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";

dotenv.config();

const { ethers } = hre as any;
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

type SystemContract = Awaited<ReturnType<typeof ethers.getContractAt>>;
type LocalSigner = Awaited<ReturnType<typeof ethers.getSigners>>[number];
type SignerLike = LocalSigner | InstanceType<typeof ethers.Wallet>;

function readEnvValue(filePath: string, key: string) {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const currentKey = trimmed.slice(0, separator).trim();
    if (currentKey !== key) {
      continue;
    }

    return trimmed.slice(separator + 1).trim();
  }

  return undefined;
}

function getPlacementSignerPrivateKey() {
  if (process.env.LOCAL_PLACEMENT_SIGNER_KEY) {
    return process.env.LOCAL_PLACEMENT_SIGNER_KEY;
  }
  if (process.env.PLACEMENT_SIGNER_PRIVATE_KEY) {
    return process.env.PLACEMENT_SIGNER_PRIVATE_KEY;
  }

  const webEnvPath = path.resolve(__dirname, "..", "..", "apps", "web", ".env.local");
  return (
    readEnvValue(webEnvPath, "LOCAL_PLACEMENT_SIGNER_KEY") ||
    readEnvValue(webEnvPath, "PLACEMENT_SIGNER_PRIVATE_KEY")
  );
}

async function signPlacement(
  system: SystemContract,
  signer: SignerLike,
  account: string,
  sponsorId: bigint,
  placementParentId: bigint,
  isLeft: boolean,
  nonce: bigint
) {
  const network = await ethers.provider.getNetwork();
  const packed = ethers.solidityPacked(
    ["uint256", "address", "address", "uint256", "uint256", "bool", "uint256"],
    [
      network.chainId,
      await system.getAddress(),
      account,
      sponsorId,
      placementParentId,
      isLeft,
      nonce
    ]
  );
  const hash = ethers.keccak256(packed);
  return signer.signMessage(ethers.getBytes(hash));
}

async function findPlacementSlot(system: SystemContract, sponsorId: bigint) {
  const nextUserId = await system.nextUserId();
  if (nextUserId === ONE) {
    return { placementParentId: ZERO, isLeft: false };
  }

  const rootUserId = await system.rootUserId();
  const startId = sponsorId === ZERO ? rootUserId : sponsorId;
  if (startId === ZERO) {
    throw new Error("Root placement is not available.");
  }

  let currentLevel = [startId];
  while (currentLevel.length > 0) {
    for (const currentId of currentLevel) {
      const node = await system.treeNodes(currentId);
      if (node.leftChildId === ZERO) {
        return { placementParentId: currentId, isLeft: true };
      }
    }

    for (const currentId of currentLevel) {
      const node = await system.treeNodes(currentId);
      if (node.rightChildId === ZERO) {
        return { placementParentId: currentId, isLeft: false };
      }
    }

    const nextLevel: bigint[] = [];
    for (const currentId of currentLevel) {
      const node = await system.treeNodes(currentId);
      if (node.leftChildId !== ZERO) {
        nextLevel.push(node.leftChildId);
      }
      if (node.rightChildId !== ZERO) {
        nextLevel.push(node.rightChildId);
      }
    }

    currentLevel = nextLevel;
  }

  throw new Error("No placement slot available.");
}

async function registerUnderSponsor(
  system: SystemContract,
  placementSigner: SignerLike,
  userSigner: SignerLike,
  sponsorId: bigint
) {
  const existingUserId = await system.userIdByAddress(userSigner.address);
  if (existingUserId !== ZERO) {
    throw new Error(
      `Wallet ${userSigner.address} is already registered as userId ${existingUserId.toString()}. Use a fresh signer.`
    );
  }

  const nonce = await system.nonces(userSigner.address);
  const { placementParentId, isLeft } = await findPlacementSlot(system, sponsorId);
  const signature = await signPlacement(
    system,
    placementSigner,
    userSigner.address,
    sponsorId,
    placementParentId,
    isLeft,
    nonce
  );

  console.log("Placement parent:", placementParentId.toString());
  console.log("Placement side  :", isLeft ? "left" : "right");
  console.log("Nonce           :", nonce.toString());

  const tx = await system
    .connect(userSigner)
    .registerWithPlacement(sponsorId, placementParentId, isLeft, signature, nonce);
  console.log("TX hash         :", tx.hash);
  await tx.wait();

  const newUserId = await system.userIdByAddress(userSigner.address);
  if (newUserId === ZERO) {
    throw new Error(`Registration completed but no userId was found for ${userSigner.address}.`);
  }

  return newUserId;
}

async function checkUser(system: SystemContract, userId: bigint, label: string) {
  const data = await system.usersById(userId);
  const inner = await system.internalWalletBalances(userId);
  const escrow = await system.autoUpgradeEscrowByUser(userId);
  const total = await system.getTotalIncome(userId);

  console.log(`\n-- ${label} --`);
  console.log("Package Level :", data.packageLevel.toString());
  console.log("Total Income  :", total.toString(), "platform units");
  console.log("Inner Wallet  :", inner.toString(), "platform units");
  console.log("Escrow        :", escrow.toString(), "platform units");

  return {
    packageLevel: BigInt(data.packageLevel),
    innerWallet: BigInt(inner),
    escrow: BigInt(escrow),
    totalIncome: BigInt(total)
  };
}

async function fundAndApprove(
  usdt: any,
  systemAddress: string,
  deployer: LocalSigner,
  user: SignerLike,
  amount: bigint,
  nativeAmount: bigint
) {
  const nativeBalance = await ethers.provider.getBalance(user.address);
  if (nativeBalance < nativeAmount) {
    const gasTx = await deployer.sendTransaction({
      to: user.address,
      value: nativeAmount - nativeBalance
    });
    await gasTx.wait();
  }

  const before = await usdt.balanceOf(user.address);
  if (before < amount) {
    console.log(`Funding ${user.address}...`);
    const fundTx = await usdt.connect(deployer).transfer(user.address, amount - before);
    await fundTx.wait();
  }

  const approveTx = await usdt.connect(user).approve(systemAddress, amount);
  await approveTx.wait();
}

async function main() {
  const systemAddress = process.env.SYSTEM_PROXY_ADDRESS || process.env.SYSTEM_PROXY;
  const usdtAddress = process.env.TESTNET_USDT_ADDRESS || process.env.USDT_ADDRESS;
  const placementSignerAddress = process.env.PLACEMENT_SIGNER_ADDRESS?.toLowerCase();

  if (!systemAddress) {
    throw new Error("SYSTEM_PROXY_ADDRESS or SYSTEM_PROXY is required in .env.");
  }
  if (!usdtAddress) {
    throw new Error("TESTNET_USDT_ADDRESS or USDT_ADDRESS is required in .env.");
  }
  if (!placementSignerAddress) {
    throw new Error("PLACEMENT_SIGNER_ADDRESS is required in .env.");
  }

  const signers = await ethers.getSigners();
  if (signers.length < 1) {
    throw new Error("Need at least one configured deployer signer on this network.");
  }

  const [deployer] = signers;
  let placementSigner: SignerLike | undefined = signers.find(
    (signer) => signer.address.toLowerCase() === placementSignerAddress
  );

  if (!placementSigner) {
    const placementSignerKey = getPlacementSignerPrivateKey();
    if (!placementSignerKey) {
      throw new Error(
        `Configured placement signer ${placementSignerAddress} is not available from ethers.getSigners(), and no LOCAL_PLACEMENT_SIGNER_KEY / PLACEMENT_SIGNER_PRIVATE_KEY was found.`
      );
    }

    placementSigner = new ethers.Wallet(placementSignerKey, ethers.provider);
  }

  if (placementSigner.address.toLowerCase() !== placementSignerAddress) {
    throw new Error(
      `Placement signer key/address mismatch. Expected ${placementSignerAddress}, got ${placementSigner.address.toLowerCase()}.`
    );
  }

  const system = await ethers.getContractAt("MetaGuildXSystem", systemAddress);
  const usdt = new ethers.Contract(
    usdtAddress,
    [
      "function transfer(address,uint256) returns (bool)",
      "function approve(address,uint256) returns (bool)",
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ],
    deployer
  );

  const decimals = Number(await usdt.decimals());
  const fundAmount = ethers.parseUnits("20", decimals);
  const nativeFundAmount = ethers.parseEther("0.01");
  const user1Id = ONE;
  const user1Data = await system.usersById(user1Id);
  const user3 = ethers.Wallet.createRandom().connect(ethers.provider);
  const user4 = ethers.Wallet.createRandom().connect(ethers.provider);
  const user5 = ethers.Wallet.createRandom().connect(ethers.provider);

  if (user1Data.account === ethers.ZeroAddress) {
    throw new Error("User1 does not exist on-chain. Register the root user before running this test.");
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("CYCLE GATE TEST");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("System          :", systemAddress);
  console.log("USDT            :", usdtAddress);
  console.log("USDT decimals   :", decimals);
  console.log("Placement signer:", placementSigner.address);
  console.log("Fresh wallet 1  :", user3.address);
  console.log("Fresh wallet 2  :", user4.address);
  console.log("Fresh wallet 3  :", user5.address);
  console.log("\nUser1 wallet    :", user1Data.account);
  console.log("User1 package   :", user1Data.packageLevel.toString());

  console.log("\nPreparing User3...");
  await fundAndApprove(usdt, systemAddress, deployer, user3, fundAmount, nativeFundAmount);
  console.log("Registering User3 under User1...");
  const user3Id = await registerUnderSponsor(system, placementSigner, user3, user1Id);
  console.log("User3 registered as userId", user3Id.toString(), "✅");
  const check1 = await checkUser(system, user1Id, "After User3 joins (2X zone)");

  console.log("\nPreparing User4...");
  await fundAndApprove(usdt, systemAddress, deployer, user4, fundAmount, nativeFundAmount);
  console.log("Registering User4 under User1...");
  const user4Id = await registerUnderSponsor(system, placementSigner, user4, user1Id);
  console.log("User4 registered as userId", user4Id.toString(), "✅");
  const check2 = await checkUser(system, user1Id, "After User4 joins (3X -> auto upgrade)");

  console.log("\nPreparing User5...");
  await fundAndApprove(usdt, systemAddress, deployer, user5, fundAmount, nativeFundAmount);
  console.log("Registering User5 under User1...");
  const user5Id = await registerUnderSponsor(system, placementSigner, user5, user1Id);
  console.log("User5 registered as userId", user5Id.toString(), "✅");
  const check3 = await checkUser(system, user1Id, "After User5 joins (4X zone)");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("CYCLE GATE RESULTS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("After 2X: Escrow > 0    :", check1.escrow > ZERO ? "✅" : "❌");
  console.log(
    "After 3X: Package = 2   :",
    check2.packageLevel === TWO ? "✅" : `❌ (still ${check2.packageLevel.toString()})`
  );
  console.log(
    "After 3X: Escrow = 0    :",
    check2.escrow === ZERO ? "✅ (consumed)" : `❌ (${check2.escrow.toString()})`
  );
  console.log("After 4X: InnerWallet>0 :", check3.innerWallet > ZERO ? "✅" : "❌");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
