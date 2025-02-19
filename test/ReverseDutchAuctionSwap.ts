import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MockERC20, ReverseDutchAuctionSwap } from "../typechain-types";

describe("ReverseDutchAuctionSwap", function () {
  let reverseDutchAuction: Contract;
  let mockToken: MockERC20;
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;
  let addrs: SignerWithAddress[];

  const tokenAmount = ethers.parseEther("100");
  const startPrice = ethers.parseEther("1");
  const endPrice = ethers.parseEther("0.1");
  const duration = 3600; // 1 hour

  beforeEach(async function () {
    // Get signers
    [owner, seller, buyer, ...addrs] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Mock Token", "MTK");
    await mockToken.deployed();

    // Mint tokens to seller
    await mockToken.mint(seller.address, tokenAmount);

    // Deploy ReverseDutchAuctionSwap
    const ReverseDutchAuctionSwap = await ethers.getContractFactory("ReverseDutchAuctionSwap");
    reverseDutchAuction = await ReverseDutchAuctionSwap.deploy();
    await reverseDutchAuction.deployed();

    // Approve auction contract to spend tokens
    await mockToken.connect(seller).approve(reverseDutchAuction.address, tokenAmount);
  });

  describe("createAuction", function () {
    it("Should create auction successfully", async function () {
      const tx = await reverseDutchAuction.connect(seller).createAuction(
        mockToken.address,
        tokenAmount,
        startPrice,
        endPrice,
        duration
      );

      const receipt = await tx.wait();
      const event = receipt.events?.find(e => e.event === 'AuctionCreated');
      expect(event).to.not.be.undefined;

      const auctionId = 0;
      const auction = await reverseDutchAuction.auctions(auctionId);
      
      expect(auction.seller).to.equal(seller.address);
      expect(auction.tokenAddress).to.equal(mockToken.address);
      expect(auction.tokenAmount).to.equal(tokenAmount);
      expect(auction.startPrice).to.equal(startPrice);
      expect(auction.endPrice).to.equal(endPrice);
      expect(auction.active).to.be.true;
      expect(auction.finalized).to.be.false;
    });

    it("Should revert with invalid token amount", async function () {
      await expect(
        reverseDutchAuction.connect(seller).createAuction(
          mockToken.address,
          0,
          startPrice,
          endPrice,
          duration
        )
      ).to.be.revertedWithCustomError(reverseDutchAuction, "InvalidTokenAmount");
    });
  });

  describe("getCurrentPrice", function () {
    let auctionId: number;

    beforeEach(async function () {
      const tx = await reverseDutchAuction.connect(seller).createAuction(
        mockToken.address,
        tokenAmount,
        startPrice,
        endPrice,
        duration
      );
      await tx.wait();
      auctionId = 0;
    });

    it("Should return correct price during auction", async function () {
      const initialPrice = await reverseDutchAuction.getCurrentPrice(auctionId);
      expect(initialPrice).to.be.lte(startPrice);
      expect(initialPrice).to.be.gte(endPrice);
    });
  });

  describe("executeSwap", function () {
    let auctionId: number;

    beforeEach(async function () {
      const tx = await reverseDutchAuction.connect(seller).createAuction(
        mockToken.address,
        tokenAmount,
        startPrice,
        endPrice,
        duration
      );
      await tx.wait();
      auctionId = 0;
    });

    it("Should execute swap successfully", async function () {
      const currentPrice = await reverseDutchAuction.getCurrentPrice(auctionId);
      
      await expect(
        reverseDutchAuction.connect(buyer).executeSwap(auctionId, {
          value: currentPrice
        })
      ).to.emit(reverseDutchAuction, "AuctionFinalized")
        .withArgs(auctionId, buyer.address, currentPrice);

      const auction = await reverseDutchAuction.auctions(auctionId);
      expect(auction.active).to.be.false;
      expect(auction.finalized).to.be.true;

      const buyerBalance = await mockToken.balanceOf(buyer.address);
      expect(buyerBalance).to.equal(tokenAmount);
    });

    it("Should revert with insufficient payment", async function () {
      const currentPrice = await reverseDutchAuction.getCurrentPrice(auctionId);
      
      await expect(
        reverseDutchAuction.connect(buyer).executeSwap(auctionId, {
          value: currentPrice.sub(1)
        })
      ).to.be.revertedWithCustomError(reverseDutchAuction, "InsufficientPayment");
    });
  });

  describe("cancelAuction", function () {
    let auctionId: number;

    beforeEach(async function () {
      const tx = await reverseDutchAuction.connect(seller).createAuction(
        mockToken.address,
        tokenAmount,
        startPrice,
        endPrice,
        duration
      );
      await tx.wait();
      auctionId = 0;
    });

    it("Should cancel auction successfully", async function () {
      await reverseDutchAuction.connect(seller).cancelAuction(auctionId);

      const auction = await reverseDutchAuction.auctions(auctionId);
      expect(auction.active).to.be.false;
      expect(auction.finalized).to.be.true;

      const sellerBalance = await mockToken.balanceOf(seller.address);
      expect(sellerBalance).to.equal(tokenAmount);
    });

    it("Should revert when non-seller tries to cancel", async function () {
      await expect(
        reverseDutchAuction.connect(buyer).cancelAuction(auctionId)
      ).to.be.revertedWithCustomError(reverseDutchAuction, "UnauthorizedCancellation");
    });
  });
});
