import { ethers, run } from "hardhat";

async function main() {
  // Deploy mock ERC20 token first
  const MockToken = await ethers.getContractFactory("MockERC20");
  const mockToken = await MockToken.deploy("Mock Token", "MTK");
  const mockTokenDeployment = await mockToken.deploymentTransaction();
  if (mockTokenDeployment && mockTokenDeployment.contractAddress) {
    console.log("MockERC20 deployed to:", mockTokenDeployment.contractAddress);
  } else {
    console.error("Failed to deploy MockERC20");
    return;
  }

  // Deploy ReverseDutchAuctionSwap
  const ReverseDutchAuctionSwap = await ethers.getContractFactory("ReverseDutchAuctionSwap");
  const reverseDutchAuction = await ReverseDutchAuctionSwap.deploy();
  const reverseDutchAuctionDeployment = await reverseDutchAuction.deploymentTransaction();
  if (reverseDutchAuctionDeployment && reverseDutchAuctionDeployment.contractAddress) {
    console.log("ReverseDutchAuctionSwap deployed to:", reverseDutchAuctionDeployment.contractAddress);
  } else {
    console.error("Failed to deploy ReverseDutchAuctionSwap");
    return;
  }

  // Verify contract on Etherscan
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("Waiting for block confirmations...");
    const deployTx = reverseDutchAuctionDeployment;
    await deployTx.wait(6);
    await verify(reverseDutchAuctionDeployment.contractAddress, []);
  }
}

async function verify(contractAddress: string, args: any[]) {
  console.log("Verifying contract...");
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (e: any) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("Already verified!");
    } else {
      console.log(e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
