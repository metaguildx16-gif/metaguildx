// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MGXToken is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY = 511_750_000 ether;
    uint256 public constant COMMUNITY_ALLOCATION = 307_050_000 ether;
    uint256 public constant LIQUIDITY_ALLOCATION = 102_350_000 ether;
    uint256 public constant RESERVE_ALLOCATION = 102_350_000 ether;

    bool public launchMinted;

    constructor(address initialOwner) ERC20("MetaGuildX", "MGX") Ownable(initialOwner) {}

    function mintLaunchAllocations(
        address communityWallet,
        address liquidityWallet,
        address reserveWallet
    ) external onlyOwner {
        require(!launchMinted, "Launch allocation already minted");

        launchMinted = true;
        _mint(communityWallet, COMMUNITY_ALLOCATION);
        _mint(liquidityWallet, LIQUIDITY_ALLOCATION);
        _mint(reserveWallet, RESERVE_ALLOCATION);
    }
}
