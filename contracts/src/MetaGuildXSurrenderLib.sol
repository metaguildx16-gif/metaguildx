// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./libraries/MGXTypes.sol";
import "./libs/MetaGuildXPaymentLib.sol";

interface IMetaGuildXTokenEngineSurrender {
    function reclaimTokenAllocation(uint256 userId) external;
}

interface IMetaGuildXBinaryTreeSurrender {
    function handleSurrender(uint256 userId) external;
}

interface ICashbackPoolSurrender {
    function surrenderForCashback(address caller, uint256 userId) external;
}

library MetaGuildXSurrenderLib {

    error NotOwnerOfUser();
    error NotYetAvailable();
    error WindowExpired();
    error MgxNotConfigured();
    error InsufficientMgxBalance();
    error InsufficientMgxAllowance();

    function surrenderForCashback(
        mapping(uint256 => MGXTypes.UserProfile) storage usersById,
        mapping(uint256 => uint256) storage tokenAllocationsByUser,
        address mgxTokenAddress,
        address tokenEngineContract,
        address binaryTreeContract,
        address cashbackPoolContract,
        address caller,
        uint256 userId
    ) external {
        MGXTypes.UserProfile storage user = usersById[userId];
        if (user.account != caller) revert NotOwnerOfUser();

        uint256 joinedAt = user.joinedAt;
        uint256 currentTime = block.timestamp;

        if (currentTime < joinedAt + 90 days) revert NotYetAvailable();
        if (currentTime > joinedAt + 180 days) revert WindowExpired();

        uint256 mgx = tokenAllocationsByUser[userId];
        if (mgx > 0) {
            // Preserve exact original check order and error messages
            if (mgxTokenAddress == address(0)) revert MgxNotConfigured();
            if (IERC20(mgxTokenAddress).balanceOf(user.account) < mgx)
                revert InsufficientMgxBalance();
            // address(this) = Core proxy via DELEGATECALL
            if (IERC20(mgxTokenAddress).allowance(user.account, address(this)) < mgx)
                revert InsufficientMgxAllowance();
            // Transfer MGX from user wallet back to Core before any state mutation.
            // Uses MetaGuildXPaymentLib.safeTransferFromExact — identical to Core._safeTransferFromExact
            MetaGuildXPaymentLib.safeTransferFromExact(
                mgxTokenAddress, user.account, address(this), mgx, "MGX_RECLAIM_FAILED"
            );
            // Zero Core allocation accounting only after successful transfer.
            tokenAllocationsByUser[userId] = 0;
            // Sync TokenEngine allocation
            IMetaGuildXTokenEngineSurrender(tokenEngineContract).reclaimTokenAllocation(userId);
        }

        if (binaryTreeContract != address(0)) {
            IMetaGuildXBinaryTreeSurrender(binaryTreeContract).handleSurrender(userId);
        }
        user.surrendered = true;
        ICashbackPoolSurrender(cashbackPoolContract).surrenderForCashback(caller, userId);
    }
}
