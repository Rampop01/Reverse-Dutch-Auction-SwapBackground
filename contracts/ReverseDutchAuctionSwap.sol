// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ReverseDutchAuctionSwap {
    // Custom errors
    error InvalidTokenAmount();
    error InvalidPrices();
    error InvalidDuration();
    error TokenTransferFailed();
    error AuctionNotActive();
    error AuctionAlreadyFinalized();
    error AuctionEnded();
    error InsufficientPayment();
    error UnauthorizedCancellation();
    error InvalidAuctionId();

    struct Auction {
        address seller;
        address tokenAddress;
        uint256 tokenAmount;
        uint256 startPrice;
        uint256 endPrice;
        uint256 startTime;
        uint256 endTime;
        bool active;
        bool finalized;
    }

    mapping(uint256 => Auction) public auctions;
    uint256 public auctionCounter;

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        address tokenAddress,
        uint256 tokenAmount,
        uint256 startPrice,
        uint256 endPrice,
        uint256 startTime,
        uint256 endTime
    );
    event AuctionFinalized(
        uint256 indexed auctionId,
        address indexed buyer,
        uint256 finalPrice
    );

    function createAuction(
        address _tokenAddress,
        uint256 _tokenAmount,
        uint256 _startPrice,
        uint256 _endPrice,
        uint256 _duration
    ) external returns (uint256) {
        if (_tokenAmount == 0) revert InvalidTokenAmount();
        if (_startPrice <= _endPrice) revert InvalidPrices();
        if (_duration == 0) revert InvalidDuration();
        if (_tokenAddress == address(0)) revert InvalidTokenAmount();

        IERC20 token = IERC20(_tokenAddress);
        if (!token.transferFrom(msg.sender, address(this), _tokenAmount)) {
            revert TokenTransferFailed();
        }

        uint256 auctionId = auctionCounter++;
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + _duration;

        auctions[auctionId] = Auction({
            seller: msg.sender,
            tokenAddress: _tokenAddress,
            tokenAmount: _tokenAmount,
            startPrice: _startPrice,
            endPrice: _endPrice,
            startTime: startTime,
            endTime: endTime,
            active: true,
            finalized: false
        });

        emit AuctionCreated(
            auctionId,
            msg.sender,
            _tokenAddress,
            _tokenAmount,
            _startPrice,
            _endPrice,
            startTime,
            endTime
        );

        return auctionId;
    }

    function getCurrentPrice(uint256 _auctionId) public view returns (uint256) {
        if (_auctionId >= auctionCounter) revert InvalidAuctionId();
        Auction storage auction = auctions[_auctionId];
        if (!auction.active) revert AuctionNotActive();

        if (block.timestamp >= auction.endTime) {
            return auction.endPrice;
        }

        uint256 elapsed = block.timestamp - auction.startTime;
        uint256 duration = auction.endTime - auction.startTime;
        uint256 priceDiff = auction.startPrice - auction.endPrice;
        
        return auction.startPrice - (priceDiff * elapsed / duration);
    }

    function executeSwap(uint256 _auctionId) external payable {
        if (_auctionId >= auctionCounter) revert InvalidAuctionId();
        Auction storage auction = auctions[_auctionId];
        if (!auction.active) revert AuctionNotActive();
        if (auction.finalized) revert AuctionAlreadyFinalized();
        if (block.timestamp > auction.endTime) revert AuctionEnded();

        uint256 currentPrice = getCurrentPrice(_auctionId);
        if (msg.value < currentPrice) revert InsufficientPayment();

        auction.active = false;
        auction.finalized = true;

        // Transfer tokens to buyer
        if (!IERC20(auction.tokenAddress).transfer(msg.sender, auction.tokenAmount)) {
            revert TokenTransferFailed();
        }

        // Transfer ETH to seller
        uint256 excess = msg.value - currentPrice;
        if (excess > 0) {
            payable(msg.sender).transfer(excess);
        }
        payable(auction.seller).transfer(currentPrice);

        emit AuctionFinalized(_auctionId, msg.sender, currentPrice);
    }

    function cancelAuction(uint256 _auctionId) external {
        if (_auctionId >= auctionCounter) revert InvalidAuctionId();
        Auction storage auction = auctions[_auctionId];
        if (msg.sender != auction.seller) revert UnauthorizedCancellation();
        if (!auction.active) revert AuctionNotActive();
        if (auction.finalized) revert AuctionAlreadyFinalized();

        auction.active = false;
        auction.finalized = true;

        // Return tokens to seller
        if (!IERC20(auction.tokenAddress).transfer(auction.seller, auction.tokenAmount)) {
            revert TokenTransferFailed();
        }
    }
}
