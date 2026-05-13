// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMetaGuildXTokenEngine {
    function allocateTokens(
        uint256 userId,
        uint256 packageAmount
    ) external returns (uint256 tokenAmount, uint8 boxId);

    function getTokenAllocation(uint256 userId) external view returns (uint256);
    function getActiveBox(uint256 userId) external view returns (uint8);
    function totalTokenDistributed() external view returns (uint256);
}
