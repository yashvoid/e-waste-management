import { ethers } from "hardhat";

async function main() {
  const TraceabilityLedger = await ethers.getContractFactory("TraceabilityLedger");
  const ledger = await TraceabilityLedger.deploy();
  await ledger.waitForDeployment();

  console.log("TraceabilityLedger deployed to:", await ledger.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
