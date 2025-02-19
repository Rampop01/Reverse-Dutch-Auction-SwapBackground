import { ethers } from "hardhat";

async function main() {
  const ReverseDutchAuctionSwap = await ethers.deployContract("ReverseDutchAuctionSwap");
  await ReverseDutchAuctionSwap.waitForDeployment();

  console.log(
    `Contract successfully deployed to: ${ReverseDutchAuctionSwap.target}`
  );
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});