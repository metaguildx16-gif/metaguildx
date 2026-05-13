// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library SystemViewLib {
    function unlockedLevelsFromReferralCount(uint256 referralCount, uint8 maxLevels) internal pure returns (uint8) {
        if (referralCount == 0) {
            return 0;
        }

        uint256 unlocked = referralCount * 2;
        return uint8(unlocked > maxLevels ? maxLevels : unlocked);
    }
}
