// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/StorageSlot.sol";

abstract contract MetaGuildReentrancyGuardUpgradeable is Initializable {
    using StorageSlot for bytes32;

    bytes32 private constant REENTRANCY_GUARD_STORAGE =
        0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    error ReentrancyGuardReentrantCall();

    function __MetaGuildReentrancyGuard_init() internal onlyInitializing {
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        if (_reentrancyGuardStorageSlot().getUint256Slot().value == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        _reentrancyGuardStorageSlot().getUint256Slot().value = ENTERED;
    }

    function _nonReentrantAfter() private {
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    function _reentrancyGuardStorageSlot() internal pure virtual returns (bytes32) {
        return REENTRANCY_GUARD_STORAGE;
    }
}
