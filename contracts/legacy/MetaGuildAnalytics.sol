// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMetaGuildXSystemView {
    function usersById(
        uint256 userId
    )
        external
        view
        returns (
            uint256 id,
            address account,
            uint256 sponsorId,
            uint8 packageLevel,
            uint256 totalContribution,
            uint256 totalEarnings,
            uint256 directReferrals,
            uint256 totalTeamBusiness,
            uint256 rebirthCount,
            uint256 xCount,
            uint256 joinedAt,
            bool surrendered
        );

    function incomesByUser(
        uint256 userId
    )
        external
        view
        returns (
            uint256 directIncome,
            uint256 levelIncome,
            uint256 spilloverIncome,
            uint256 crossLineIncome,
            uint256 cashbackIncome,
            uint256 stakingIncome,
            uint256 totalWithdrawn
        );

    function internalWalletBalances(uint256 userId) external view returns (uint256);

    function treeNodes(
        uint256 userId
    ) external view returns (uint256 nodeUserId, uint256 parentId, uint256 leftChildId, uint256 rightChildId, uint8 depth);
}

contract MetaGuildAnalytics {
    IMetaGuildXSystemView public immutable core;
    uint8 public constant MAX_LEVELS = 10;

    constructor(address coreAddress) {
        require(coreAddress != address(0), "Invalid core");
        core = IMetaGuildXSystemView(coreAddress);
    }

    function getTreeBranchStats(
        uint256 userId
    )
        external
        view
        returns (
            uint256 leftDirectChildId,
            uint256 rightDirectChildId,
            uint256 leftBranchNodes,
            uint256 rightBranchNodes,
            uint256 leftBranchBusiness,
            uint256 rightBranchBusiness
        )
    {
        (uint256 id, , , , , , , , , , , ) = core.usersById(userId);
        require(id != 0, "User not found");

        (, , leftDirectChildId, rightDirectChildId, ) = core.treeNodes(userId);
        leftBranchNodes = _subtreeSize(leftDirectChildId);
        rightBranchNodes = _subtreeSize(rightDirectChildId);
        leftBranchBusiness = _subtreeBusiness(leftDirectChildId);
        rightBranchBusiness = _subtreeBusiness(rightDirectChildId);
    }

    function getLevelSummary(
        uint256 userId
    )
        external
        view
        returns (
            uint8 unlockedLevels,
            uint256 directReferrals,
            uint8 currentPackageLevel,
            bool[] memory unlockedStatus
        )
    {
        uint256 id;
        uint8 packageLevel;
        uint256 referrals;
        (id, , , packageLevel, , , referrals, , , , , ) = core.usersById(userId);
        require(id != 0, "User not found");

        directReferrals = referrals;
        currentPackageLevel = packageLevel;
        unlockedLevels = referrals >= 5 ? 10 : uint8(referrals * 2);
        unlockedStatus = new bool[](MAX_LEVELS);

        for (uint8 i = 0; i < MAX_LEVELS; i++) {
            unlockedStatus[i] = i < unlockedLevels;
        }
    }

    function getUserFinancialSnapshot(
        uint256 userId
    )
        external
        view
        returns (
            uint256 internalWalletBalance,
            uint256 totalContribution,
            uint256 totalEarnings,
            uint256 totalTeamBusiness,
            uint256 directIncome,
            uint256 levelIncome,
            uint256 spilloverIncome,
            uint256 crossLineIncome,
            uint256 cashbackIncome,
            uint256 stakingIncome
        )
    {
        uint256 id;
        uint256 contribution;
        uint256 earnings;
        uint256 teamBusiness;
        uint256 totalWithdrawnIgnored;
        (id, , , , contribution, earnings, , teamBusiness, , , , ) = core.usersById(userId);
        require(id != 0, "User not found");

        (
            directIncome,
            levelIncome,
            spilloverIncome,
            crossLineIncome,
            cashbackIncome,
            stakingIncome,
            totalWithdrawnIgnored
        ) = core.incomesByUser(userId);
        totalWithdrawnIgnored;
        internalWalletBalance = core.internalWalletBalances(userId);
        totalContribution = contribution;
        totalEarnings = earnings;
        totalTeamBusiness = teamBusiness;
    }

    function _subtreeSize(uint256 nodeId) internal view returns (uint256) {
        if (nodeId == 0) {
            return 0;
        }

        (, , uint256 leftChildId, uint256 rightChildId, ) = core.treeNodes(nodeId);
        return 1 + _subtreeSize(leftChildId) + _subtreeSize(rightChildId);
    }

    function _subtreeBusiness(uint256 nodeId) internal view returns (uint256) {
        if (nodeId == 0) {
            return 0;
        }

        (, , , , uint256 contribution, , , , , , , ) = core.usersById(nodeId);
        (, , uint256 leftChildId, uint256 rightChildId, ) = core.treeNodes(nodeId);
        return contribution + _subtreeBusiness(leftChildId) + _subtreeBusiness(rightChildId);
    }
}
