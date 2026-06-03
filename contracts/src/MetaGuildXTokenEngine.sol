// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IMetaGuildXTokenEngine.sol";

error OnlyCore();
error NoTokensAvailable();

contract MetaGuildXTokenEngine is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    IMetaGuildXTokenEngine
{
    address public coreContract;

    mapping(uint256 => uint8) public activeBoxByUser;
    mapping(uint256 => uint256) public tokenAllocationsByUser;
    mapping(uint8 => uint256) public distributedTokensByBox;
    uint256 public override totalTokenDistributed;
    uint8 public currentBoxId;
    uint256 public totalCommunityTokenAllocation;

    uint256[] private boxPrices;
    uint256[] private boxReleaseBps;

    event TokensAllocated(uint256 indexed userId, uint256 amount, uint256 boxId);

    modifier onlyCore() {
        if (msg.sender != coreContract) revert OnlyCore();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _core) public initializer {
        __Ownable_init(msg.sender);

        require(_core != address(0), "Zero address");
        require(_core.code.length > 0, "Core not contract");
        coreContract = _core;
        currentBoxId = 1;
        totalCommunityTokenAllocation = 307_050_000 ether;

        boxPrices.push(100);
        boxPrices.push(125);
        boxPrices.push(150);
        boxPrices.push(175);
        boxPrices.push(200);
        boxPrices.push(225);
        boxPrices.push(250);
        boxPrices.push(275);
        boxPrices.push(300);
        boxPrices.push(325);

        boxReleaseBps.push(2_000);
        boxReleaseBps.push(1_500);
        boxReleaseBps.push(1_200);
        boxReleaseBps.push(1_000);
        boxReleaseBps.push(800);
        boxReleaseBps.push(800);
        boxReleaseBps.push(700);
        boxReleaseBps.push(700);
        boxReleaseBps.push(700);
        boxReleaseBps.push(600);
    }

    function setCoreContract(address _core) external onlyOwner {
        require(_core != address(0), "Zero address");
        require(_core.code.length > 0, "Core not contract");
        coreContract = _core;
    }

    function allocateTokens(
        uint256 userId,
        uint256 packageAmount
    ) external onlyCore returns (uint256 tokenAmount, uint8 boxId) {
        if (tokenAllocationsByUser[userId] > 0) return (0, activeBoxByUser[userId]);
        (tokenAmount, boxId) = _allocateTokensForCurrentBox(userId, packageAmount);
        emit TokensAllocated(userId, tokenAmount, activeBoxByUser[userId]);
    }

    function getTokenAllocation(uint256 userId) external view returns (uint256) {
        return tokenAllocationsByUser[userId];
    }

    function getActiveBox(uint256 userId) external view returns (uint8) {
        return activeBoxByUser[userId];
    }

    function _allocateTokensForCurrentBox(
        uint256 userId,
        uint256 packageUsdAmount
    ) internal returns (uint256 allocatedTokens, uint8 appliedBoxId) {
        uint256 remainingUsdCents = (packageUsdAmount * 100) / 10;
        uint8 workingBoxId = currentBoxId;
        appliedBoxId = workingBoxId;

        while (remainingUsdCents > 0 && workingBoxId <= boxPrices.length) {
            uint256 priceCents = boxPrices[workingBoxId - 1];
            uint256 releaseCap = (totalCommunityTokenAllocation * boxReleaseBps[workingBoxId - 1]) / 10_000;
            uint256 alreadyDistributed = distributedTokensByBox[workingBoxId];
            uint256 remainingCap = releaseCap > alreadyDistributed ? releaseCap - alreadyDistributed : 0;

            if (remainingCap == 0) {
                if (workingBoxId < boxPrices.length) {
                    workingBoxId += 1;
                    currentBoxId = workingBoxId;
                    continue;
                }
                break;
            }

            uint256 requestedTokens = (remainingUsdCents * 1 ether) / priceCents;
            uint256 boxTokens = requestedTokens > remainingCap ? remainingCap : requestedTokens;
            uint256 consumedUsdCents = (boxTokens * priceCents) / 1 ether;

            allocatedTokens += boxTokens;
            distributedTokensByBox[workingBoxId] += boxTokens;

            if (consumedUsdCents >= remainingUsdCents) {
                remainingUsdCents = 0;
            } else {
                remainingUsdCents -= consumedUsdCents;
            }

            if (distributedTokensByBox[workingBoxId] >= releaseCap && workingBoxId < boxPrices.length) {
                workingBoxId += 1;
                currentBoxId = workingBoxId;
            }
        }

        if (allocatedTokens == 0) revert NoTokensAvailable();

        activeBoxByUser[userId] = appliedBoxId;
        tokenAllocationsByUser[userId] += allocatedTokens;
        totalTokenDistributed += allocatedTokens;
        return (allocatedTokens, appliedBoxId);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    uint256[50] private __gap;
}
