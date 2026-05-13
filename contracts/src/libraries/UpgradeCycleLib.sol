// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library UpgradeCycleLib {
    function calcUpgradeCost(uint256 currentPackagePrice) public pure returns (uint256) {
        return currentPackagePrice * 2;
    }

    function calcXSlot(uint256 totalIncome, uint256 packagePrice) public pure returns (uint256) {
        if (packagePrice == 0) {
            return 0;
        }
        return totalIncome / packagePrice;
    }

    function shouldFreeze(uint256 xSlot) public pure returns (bool) {
        return xSlot == 1 || xSlot == 2;
    }

    function shouldPayWallet(uint256 xSlot) public pure returns (bool) {
        return xSlot == 0 || xSlot == 3;
    }

    function isRebirthSlot(uint256 xSlot) public pure returns (bool) {
        return xSlot >= 4;
    }

    function isEscrowReady(uint256 escrow, uint256 packagePrice) public pure returns (bool) {
        return escrow >= calcUpgradeCost(packagePrice);
    }

    function calcDistribution(
        uint256 amount
    ) public pure returns (uint256 direct, uint256 levelEach, uint256 cashback, uint256 creator) {
        direct = (amount * 4600) / 10_000;
        levelEach = (amount * 400) / 10_000;
        cashback = (amount * 400) / 10_000;
        creator = (amount * 1000) / 10_000;
    }
}
