import { ethers } from "hardhat";

const ROUTER_PROXY = "0xd496eC1Cf0E66a7beECe21b8Bd908F335aBbDfe8";
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

function decodeImplementation(raw: string) {
  return ethers.getAddress(`0x${raw.slice(-40)}`);
}

async function main() {
  const [owner] = await ethers.getSigners();
  console.log("Upgrading with:", owner.address);

  const beforeRaw = await ethers.provider.getStorage(ROUTER_PROXY, IMPL_SLOT);
  const before = decodeImplementation(beforeRaw);
  console.log("Before:", before);

  const IncomeRouter = await ethers.getContractFactory("IncomeRouter", owner);
  const newImpl = await IncomeRouter.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log("New impl deployed:", newImplAddress);

  const proxy = await ethers.getContractAt("IncomeRouter", ROUTER_PROXY, owner);
  const tx = await proxy.upgradeToAndCall(newImplAddress, "0x");
  await tx.wait();
  console.log("Proxy upgraded, tx:", tx.hash);

  const afterRaw = await ethers.provider.getStorage(ROUTER_PROXY, IMPL_SLOT);
  const after = decodeImplementation(afterRaw);
  console.log("After:", after);
  console.log("Changed:", before.toLowerCase() !== after.toLowerCase() ? "YES" : "NO");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
