// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library MGXTypes {
    struct IncomeLedger {
        uint256 directIncome;
        uint256 levelIncome;
        uint256 spilloverIncome;
        uint256 crossLineIncome;
        uint256 cashbackIncome;
        uint256 stakingIncome;
        uint256 totalWithdrawn;
    }

    struct UserProfile {
        uint256 id;
        address account;
        uint256 sponsorId;
        uint8 packageLevel;
        uint8 originalPackageLevel;
        uint256 totalContribution;
        uint256 totalEarnings;
        uint256 directReferrals;
        uint256 totalTeamBusiness;
        uint256 rebirthCount;
        uint256 xCount;
        uint256 joinedAt;
        bool surrendered;
    }

    struct TreeNode {
        uint256 userId;
        uint256 parentId;
        uint256 leftChildId;
        uint256 rightChildId;
        uint8 depth;
    }

    struct StakePosition {
        uint256 amount;
        uint256 rewardDebt;
        uint256 accruedReward;
        uint256 lockStartedAt;
        uint256 lockDuration;
        bool autoCompound;
    }
}
