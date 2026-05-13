// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPlacementBinaryTree {
    function assignRoot(uint256 userId) external;
    function placeNodeExact(uint256 parentId, uint256 userId, bool isLeft) external;
    function placeUserForced(uint256 userId, uint256 parentId, bool forceLeft) external;
    function findNextSlotUnderSponsor(uint256 sponsorId) external view returns (uint256 parentId, bool isLeft);
    function getChildren(uint256 userId) external view returns (uint256 left, uint256 right);
    function adminResetLevelTree(uint256 maxUserId) external;
    function adminInsertLevelUser(uint256 userId, uint256 sponsorId) external;
}

library MetaGuildXPlacementLib {
    function findWeakLeg(
        address binaryTreeContract,
        uint256 uplineId,
        uint256 maxSubtreeDepth
    ) external view returns (bool isLeft) {
        if (binaryTreeContract == address(0)) {
            return true;
        }

        (uint256 leftChildId, uint256 rightChildId) = IPlacementBinaryTree(binaryTreeContract).getChildren(uplineId);
        uint256 leftCount = _getSubtreeCount(binaryTreeContract, leftChildId, 0, maxSubtreeDepth);
        uint256 rightCount = _getSubtreeCount(binaryTreeContract, rightChildId, 0, maxSubtreeDepth);
        return leftCount <= rightCount;
    }

    function placeInForcedSlot(
        address binaryTreeContract,
        uint256 userId,
        uint256 parentId,
        bool forceLeft
    ) external returns (uint256 placedUnderId, bool placedLeft) {
        if (binaryTreeContract == address(0)) {
            return (0, forceLeft);
        }

        IPlacementBinaryTree(binaryTreeContract).placeUserForced(userId, parentId, forceLeft);
        return (parentId, forceLeft);
    }

    function placeInSpecifiedSlot(
        address binaryTreeContract,
        uint256 rootUserId,
        uint256 userId,
        uint256 sponsorId
    ) external returns (uint256 placedUnderId, bool actualPlacedLeft) {
        if (rootUserId == 0) {
            require(sponsorId == 0, "Root sponsor must be zero");
            require(binaryTreeContract != address(0), "Tree not set");
            IPlacementBinaryTree(binaryTreeContract).assignRoot(userId);
            return (0, false);
        }

        require(binaryTreeContract != address(0), "Tree not set");
        (uint256 placementParentId, bool placedLeft) =
            IPlacementBinaryTree(binaryTreeContract).findNextSlotUnderSponsor(sponsorId);
        IPlacementBinaryTree(binaryTreeContract).placeNodeExact(placementParentId, userId, placedLeft);
        return (placementParentId, placedLeft);
    }

    function rebuildLevelTree(
        address binaryTreeContract,
        uint256[] calldata userIds,
        uint256[] calldata sponsorIds,
        uint256 maxUserId
    ) external {
        IPlacementBinaryTree tree = IPlacementBinaryTree(binaryTreeContract);
        tree.adminResetLevelTree(maxUserId);

        for (uint256 i = 0; i < userIds.length; i++) {
            tree.adminInsertLevelUser(userIds[i], sponsorIds[i]);
        }
    }

    function _getSubtreeCount(
        address binaryTreeContract,
        uint256 nodeId,
        uint256 depth,
        uint256 maxSubtreeDepth
    ) private view returns (uint256) {
        if (nodeId == 0 || depth >= maxSubtreeDepth || binaryTreeContract == address(0)) {
            return 0;
        }

        (uint256 leftChildId, uint256 rightChildId) = IPlacementBinaryTree(binaryTreeContract).getChildren(nodeId);
        return 1
            + _getSubtreeCount(binaryTreeContract, leftChildId, depth + 1, maxSubtreeDepth)
            + _getSubtreeCount(binaryTreeContract, rightChildId, depth + 1, maxSubtreeDepth);
    }
}
