// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./libraries/MGXTypes.sol";

interface IMetaGuildXCoreSponsorView {
    function getUserSponsorId(uint256 userId) external view returns (uint256);
}

contract BinaryTree is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    mapping(uint256 => MGXTypes.TreeNode) public nodes;
    mapping(uint256 => uint256) public nodeDepth;
    uint256 public rootUserId;
    uint256 public maxDepth;
    address public coreContract;
    mapping(uint256 => uint256) public subtreeCounts;
    mapping(uint256 => bool) public isLevelEligible;
    mapping(uint256 => uint256) public levelParent;
    mapping(uint256 => uint256[2]) public levelChildren;
    uint256 public levelRootId;
    uint256 public levelEligibilityCounter;
    mapping(uint256 => uint256) public levelEligibleAt;

    event RootAssigned(uint256 indexed userId);
    event NodePlaced(uint256 indexed userId, uint256 indexed parentId, bool isLeft, uint256 depth);
    event CoreContractSet(address indexed coreContractAddress);
    event MaxDepthSet(uint256 maxDepthValue);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        maxDepth = 20;
    }

    function setCoreContract(address coreContractAddress) external onlyOwner {
        _validateContract(coreContractAddress);
        coreContract = coreContractAddress;
        emit CoreContractSet(coreContractAddress);
    }

    function setMaxDepth(uint256 maxDepthValue) external onlyOwner {
        require(maxDepthValue > 0, "Invalid max depth");
        maxDepth = maxDepthValue;
        emit MaxDepthSet(maxDepthValue);
    }

    function assignRoot(uint256 userId) external {
        require(msg.sender == coreContract, "Only core contract");
        require(rootUserId == 0, "Root already assigned");

        rootUserId = userId;
        nodes[userId] = MGXTypes.TreeNode({
            userId: userId,
            parentId: 0,
            leftChildId: 0,
            rightChildId: 0,
            depth: 0
        });
        nodeDepth[userId] = 0;
        subtreeCounts[userId] = 1;

        emit RootAssigned(userId);
    }

    function placeNodeExact(uint256 parentId, uint256 userId, bool isLeft) external {
        require(msg.sender == coreContract, "Only core contract");
        require(rootUserId != 0, "Root not assigned");
        require(parentId != 0, "Parent not found");
        require(nodes[userId].userId == 0, "Node already exists");

        MGXTypes.TreeNode storage parentNode = nodes[parentId];
        require(parentNode.userId != 0, "Parent not found");

        uint256 depthValue = nodeDepth[parentId] + 1;
        require(depthValue <= maxDepth, "Max tree depth reached");
        uint8 depth = uint8(depthValue);

        if (isLeft) {
            require(parentNode.leftChildId == 0, "Placement slot occupied");
            parentNode.leftChildId = userId;
        } else {
            require(parentNode.rightChildId == 0, "Placement slot occupied");
            parentNode.rightChildId = userId;
        }

        nodes[userId] = MGXTypes.TreeNode({
            userId: userId,
            parentId: parentId,
            leftChildId: 0,
            rightChildId: 0,
            depth: depth
        });
        nodeDepth[userId] = depthValue;
        subtreeCounts[userId] = 1;
        _refreshCountsUpward(parentId);

        emit NodePlaced(userId, parentId, isLeft, depth);
    }

    function placeUserForced(uint256 userId, uint256 parentId, bool forceLeft) external {
        require(msg.sender == coreContract, "Only core contract");
        require(rootUserId != 0, "Root not assigned");
        require(parentId != 0, "Parent not found");
        require(nodes[userId].userId == 0, "Node already exists");

        MGXTypes.TreeNode storage parentNode = nodes[parentId];
        require(parentNode.userId != 0, "Parent not found");

        uint256 depthValue = nodeDepth[parentId] + 1;
        require(depthValue <= maxDepth, "Max tree depth reached");
        uint8 depth = uint8(depthValue);

        if (forceLeft) {
            require(parentNode.leftChildId == 0, "Left slot taken");
            parentNode.leftChildId = userId;
        } else {
            require(parentNode.rightChildId == 0, "Right slot taken");
            parentNode.rightChildId = userId;
        }

        nodes[userId] = MGXTypes.TreeNode({
            userId: userId,
            parentId: parentId,
            leftChildId: 0,
            rightChildId: 0,
            depth: depth
        });
        nodeDepth[userId] = depthValue;
        subtreeCounts[userId] = 1;
        _refreshCountsUpward(parentId);

        emit NodePlaced(userId, parentId, forceLeft, depth);
    }

    function placeNode(uint256 referrerId, uint256 userId) external {
        require(msg.sender == coreContract, "Only core contract");
        require(rootUserId != 0, "Root not assigned");
        require(nodes[userId].userId == 0, "Node already exists");

        uint256 startNodeId = referrerId == 0 ? rootUserId : referrerId;
        if (startNodeId != rootUserId) {
            startNodeId = rootUserId;
        }
        require(nodes[startNodeId].userId != 0, "Parent not found");

        (uint256 parentId, bool isLeft) = findNextAvailableSlot(startNodeId);
        MGXTypes.TreeNode storage parentNode = nodes[parentId];
        uint256 depthValue = nodeDepth[parentId] + 1;
        require(depthValue <= maxDepth, "Max tree depth reached");
        uint8 depth = uint8(depthValue);

        if (isLeft) {
            require(parentNode.leftChildId == 0, "Left occupied");
            parentNode.leftChildId = userId;
        } else {
            require(parentNode.rightChildId == 0, "Right occupied");
            parentNode.rightChildId = userId;
        }

        nodes[userId] = MGXTypes.TreeNode({
            userId: userId,
            parentId: parentId,
            leftChildId: 0,
            rightChildId: 0,
            depth: depth
        });
        nodeDepth[userId] = depthValue;
        subtreeCounts[userId] = 1;
        _refreshCountsUpward(parentId);

        emit NodePlaced(userId, parentId, isLeft, depth);
    }

    function getParent(uint256 userId) external view returns (uint256) {
        return nodes[userId].parentId;
    }

    function getChildren(uint256 userId) external view returns (uint256 left, uint256 right) {
        MGXTypes.TreeNode storage node = nodes[userId];
        return (node.leftChildId, node.rightChildId);
    }

    function getLevelParent(uint256 userId) external view returns (uint256) {
        return levelParent[userId];
    }

    function getLevelChildren(uint256 userId) external view returns (uint256 left, uint256 right) {
        uint256[2] storage children = levelChildren[userId];
        return (children[0], children[1]);
    }

    function refreshLevelEligibility(uint256 userId, uint256 referralCount, uint256 sponsorId) external {
        require(msg.sender == coreContract, "Only core contract");
        _updateEligibility(userId, referralCount, sponsorId);
    }

    function handleSurrender(uint256 userId) external {
        require(msg.sender == coreContract, "Only core contract");
        _handleSurrenderPlacement(userId);
    }

    function removeNode(uint256 userId) external {
        require(msg.sender == coreContract, "Only core contract");

        MGXTypes.TreeNode storage node = nodes[userId];
        uint256 parentId = node.parentId;

        if (parentId != 0) {
            if (nodes[parentId].leftChildId == userId) {
                nodes[parentId].leftChildId = 0;
            } else if (nodes[parentId].rightChildId == userId) {
                nodes[parentId].rightChildId = 0;
            }
        } else if (rootUserId == userId) {
            rootUserId = 0;
        }

        delete nodes[userId];
        delete nodeDepth[userId];
        delete subtreeCounts[userId];
        _refreshCountsUpward(parentId);
    }

    function _handleSurrenderPlacement(uint256 userId) internal {
        MGXTypes.TreeNode storage node = nodes[userId];
        uint256 parentId = node.parentId;
        uint256 leftChild = node.leftChildId;
        uint256 rightChild = node.rightChildId;

        if (leftChild == 0 && rightChild == 0) {
            _detachFromParent(parentId, userId);
            if (parentId == 0 && rootUserId == userId) {
                rootUserId = 0;
            }
            delete nodes[userId];
            delete nodeDepth[userId];
            delete subtreeCounts[userId];
            _refreshCountsUpward(parentId);
            return;
        }

        if (leftChild == 0 || rightChild == 0) {
            uint256 singleReplacement = leftChild != 0 ? leftChild : rightChild;
            _replaceNode(parentId, userId, singleReplacement);
            delete nodes[userId];
            delete nodeDepth[userId];
            delete subtreeCounts[userId];
            _validateNode(singleReplacement);
            _refreshDepths(singleReplacement, parentId == 0 ? 0 : nodeDepth[parentId] + 1, 0);
            _refreshCountsUpward(singleReplacement);
            return;
        }

        uint256 leftReplacement = leftChild;
        _replaceNode(parentId, userId, leftReplacement);
        nodes[rightChild].parentId = 0;
        _attachAsChild(leftReplacement, rightChild);
        delete nodes[userId];
        delete nodeDepth[userId];
        delete subtreeCounts[userId];
        _validateNode(leftReplacement);
        _refreshDepths(leftReplacement, parentId == 0 ? 0 : nodeDepth[parentId] + 1, 0);
        _refreshCountsUpward(leftReplacement);
    }

    function _replaceNode(uint256 parentId, uint256 oldId, uint256 newId) internal {
        if (parentId != 0) {
            if (nodes[parentId].leftChildId == oldId) {
                nodes[parentId].leftChildId = newId;
            } else {
                nodes[parentId].rightChildId = newId;
            }
        } else if (rootUserId == oldId) {
            rootUserId = newId;
        }

        nodes[newId].parentId = parentId;
    }

    function _detachFromParent(uint256 parentId, uint256 userId) internal {
        if (parentId == 0) {
            return;
        }

        if (nodes[parentId].leftChildId == userId) {
            nodes[parentId].leftChildId = 0;
        } else if (nodes[parentId].rightChildId == userId) {
            nodes[parentId].rightChildId = 0;
        }
    }

    function _attachAsChild(uint256 parentId, uint256 childId) internal {
        require(childId != parentId, "Self attach");
        require(
            nodes[childId].parentId == 0 || nodes[childId].parentId == parentId,
            "Invalid parent state"
        );
        if (nodes[parentId].leftChildId == 0) {
            nodes[parentId].leftChildId = childId;
        } else if (nodes[parentId].rightChildId == 0) {
            nodes[parentId].rightChildId = childId;
        } else {
            // Both slots occupied — find next available slot via BFS
            uint256 slot = _findNextAvailableSlotBFS(parentId);
            require(slot != 0, "No available slot under replacement");
            if (nodes[slot].leftChildId == 0) {
                nodes[slot].leftChildId = childId;
            } else {
                nodes[slot].rightChildId = childId;
            }
            // Use actual attachment parent (slot), not original parentId
            nodes[childId].parentId = slot;
            return;
        }
        nodes[childId].parentId = parentId;
    }

    function _findNextAvailableSlotBFS(uint256 startId) internal view returns (uint256) {
        uint256[512] memory queue;
        uint256 head = 0;
        uint256 tail = 0;
        queue[tail++] = startId;
        while (head < tail && tail < 512) {
            uint256 current = queue[head++];
            if (nodes[current].leftChildId == 0 || nodes[current].rightChildId == 0) {
                return current;
            }
            if (tail < 511) queue[tail++] = nodes[current].leftChildId;
            if (tail < 511) queue[tail++] = nodes[current].rightChildId;
        }
        return 0;
    }

    function _validateNode(uint256 userId) internal view {
        MGXTypes.TreeNode storage node = nodes[userId];

        if (node.leftChildId != 0) {
            require(nodes[node.leftChildId].parentId == userId, "Invalid left link");
        }

        if (node.rightChildId != 0) {
            require(nodes[node.rightChildId].parentId == userId, "Invalid right link");
        }
    }

    function _refreshDepths(uint256 userId, uint256 depthValue, uint8 iterations) internal {
        if (userId == 0 || iterations >= 20) {
            return;
        }

        nodeDepth[userId] = depthValue;
        nodes[userId].depth = uint8(depthValue);

        _refreshDepths(nodes[userId].leftChildId, depthValue + 1, iterations + 1);
        _refreshDepths(nodes[userId].rightChildId, depthValue + 1, iterations + 1);
    }

    function findNextAvailableSlot(uint256 startNodeId) public view returns (uint256 parentId, bool isLeft) {
        uint256[] memory currentLevel = new uint256[](1);
        currentLevel[0] = startNodeId;

        while (currentLevel.length > 0) {
            for (uint256 i = 0; i < currentLevel.length; i++) {
                uint256 currentNodeId = currentLevel[i];
                MGXTypes.TreeNode storage currentNode = nodes[currentNodeId];
                if (currentNode.userId == 0) {
                    continue;
                }

                require(nodeDepth[currentNodeId] <= maxDepth, "Max tree depth reached");
                if (nodeDepth[currentNodeId] < maxDepth && currentNode.leftChildId == 0) {
                    return (currentNodeId, true);
                }
            }

            for (uint256 i = 0; i < currentLevel.length; i++) {
                uint256 currentNodeId = currentLevel[i];
                MGXTypes.TreeNode storage currentNode = nodes[currentNodeId];
                if (currentNode.userId == 0) {
                    continue;
                }

                if (nodeDepth[currentNodeId] < maxDepth && currentNode.rightChildId == 0) {
                    return (currentNodeId, false);
                }
            }

            uint256 childCount = 0;
            for (uint256 i = 0; i < currentLevel.length; i++) {
                uint256 currentNodeId = currentLevel[i];
                MGXTypes.TreeNode storage currentNode = nodes[currentNodeId];
                if (currentNode.userId == 0 || nodeDepth[currentNodeId] >= maxDepth) {
                    continue;
                }

                if (currentNode.leftChildId != 0) {
                    childCount++;
                }
                if (currentNode.rightChildId != 0) {
                    childCount++;
                }
            }

            if (childCount == 0) {
                break;
            }

            uint256[] memory nextLevel = new uint256[](childCount);
            uint256 nextIndex = 0;
            for (uint256 i = 0; i < currentLevel.length; i++) {
                uint256 currentNodeId = currentLevel[i];
                MGXTypes.TreeNode storage currentNode = nodes[currentNodeId];
                if (currentNode.userId == 0 || nodeDepth[currentNodeId] >= maxDepth) {
                    continue;
                }

                if (currentNode.leftChildId != 0) {
                    nextLevel[nextIndex] = currentNode.leftChildId;
                    nextIndex++;
                }
            }

            for (uint256 i = 0; i < currentLevel.length; i++) {
                uint256 currentNodeId = currentLevel[i];
                MGXTypes.TreeNode storage currentNode = nodes[currentNodeId];
                if (currentNode.userId == 0 || nodeDepth[currentNodeId] >= maxDepth) {
                    continue;
                }

                if (currentNode.rightChildId != 0) {
                    nextLevel[nextIndex] = currentNode.rightChildId;
                    nextIndex++;
                }
            }

            currentLevel = nextLevel;
        }

        revert("Max tree depth reached");
    }

    function findNextSlotUnderSponsor(uint256 sponsorId) public view returns (uint256 parentId, bool isLeft) {
        if (sponsorId == 0) {
            return findNextAvailableSlot(rootUserId);
        }

        MGXTypes.TreeNode storage sponsorNode = nodes[sponsorId];
        require(sponsorNode.userId != 0, "Sponsor not found");
        require(nodeDepth[sponsorId] <= maxDepth, "Max tree depth reached");

        if (nodeDepth[sponsorId] < maxDepth && sponsorNode.leftChildId == 0) {
            return (sponsorId, true);
        }

        if (nodeDepth[sponsorId] < maxDepth && sponsorNode.rightChildId == 0) {
            return (sponsorId, false);
        }

        uint256[] memory queue = new uint256[](1024);
        uint256 front = 0;
        uint256 back = 0;

        queue[back++] = sponsorNode.leftChildId;
        queue[back++] = sponsorNode.rightChildId;

        while (front < back) {
            if (front + 1 < back) {
                uint256 leftNodeId = queue[front];
                uint256 rightNodeId = queue[front + 1];
                MGXTypes.TreeNode storage leftNode = nodes[leftNodeId];
                MGXTypes.TreeNode storage rightNode = nodes[rightNodeId];

                if (nodeDepth[leftNodeId] < maxDepth && leftNode.leftChildId == 0) {
                    return (leftNodeId, true);
                }
                if (nodeDepth[rightNodeId] < maxDepth && rightNode.leftChildId == 0) {
                    return (rightNodeId, true);
                }
                if (nodeDepth[leftNodeId] < maxDepth && leftNode.rightChildId == 0) {
                    return (leftNodeId, false);
                }
                if (nodeDepth[rightNodeId] < maxDepth && rightNode.rightChildId == 0) {
                    return (rightNodeId, false);
                }

                if (leftNode.leftChildId != 0 && back < 1023) {
                    queue[back++] = leftNode.leftChildId;
                }
                if (rightNode.leftChildId != 0 && back < 1023) {
                    queue[back++] = rightNode.leftChildId;
                }
                if (leftNode.rightChildId != 0 && back < 1023) {
                    queue[back++] = leftNode.rightChildId;
                }
                if (rightNode.rightChildId != 0 && back < 1023) {
                    queue[back++] = rightNode.rightChildId;
                }

                front += 2;
            } else {
                uint256 nodeId = queue[front++];
                MGXTypes.TreeNode storage node = nodes[nodeId];

                if (nodeDepth[nodeId] < maxDepth && node.leftChildId == 0) {
                    return (nodeId, true);
                }
                if (nodeDepth[nodeId] < maxDepth && node.rightChildId == 0) {
                    return (nodeId, false);
                }
                if (node.leftChildId != 0 && back < 1023) {
                    queue[back++] = node.leftChildId;
                }
                if (node.rightChildId != 0 && back < 1023) {
                    queue[back++] = node.rightChildId;
                }
            }
        }

        revert("No slot available in sponsor subtree");
    }

    function _updateEligibility(uint256 userId, uint256 referralCount, uint256 sponsorId) internal {
        if (userId == 0 || isLevelEligible[userId] || referralCount < 1) {
            return;
        }

        isLevelEligible[userId] = true;
        levelEligibilityCounter++;
        levelEligibleAt[userId] = levelEligibilityCounter;
        _insertIntoLevelTree(userId, sponsorId);
    }

    function _insertIntoLevelTree(uint256 userId, uint256 sponsorId) internal {
        // If no root yet, this user becomes root
        if (levelRootId == 0) {
            levelRootId = userId;
            levelParent[userId] = 0;
            return;
        }

        // Find insertion point: BFS under sponsor's subtree
        uint256 insertUnder = sponsorId;

        // Walk up sponsor ancestry until the first level-eligible ancestor.
        uint8 safety = 20;
        while (insertUnder != 0 && safety > 0) {
            if (isLevelEligible[insertUnder]) {
                break;
            }

            uint256 parentSponsor = IMetaGuildXCoreSponsorView(coreContract).getUserSponsorId(insertUnder);
            if (parentSponsor == 0) {
                insertUnder = levelRootId;
                break;
            }

            insertUnder = parentSponsor;
            safety--;
        }

        if (insertUnder == 0 || !isLevelEligible[insertUnder]) {
            insertUnder = levelRootId;
        }

        // Level-order traversal with left-slot priority across the whole level:
        // fill all left children first, then all right children.
        uint256[] memory currentLevel = new uint256[](2000);
        uint256[] memory nextLevel = new uint256[](2000);
        uint256 currentCount = 1;
        currentLevel[0] = insertUnder;

        while (currentCount > 0) {
            for (uint256 i = 0; i < currentCount; i++) {
                uint256 current = currentLevel[i];
                uint256[2] storage children = levelChildren[current];
                if (children[0] == 0) {
                    children[0] = userId;
                    levelParent[userId] = current;
                    return;
                }
            }

            for (uint256 i = 0; i < currentCount; i++) {
                uint256 current = currentLevel[i];
                uint256[2] storage children = levelChildren[current];
                if (children[1] == 0) {
                    children[1] = userId;
                    levelParent[userId] = current;
                    return;
                }
            }

            uint256 nextCount = 0;
            for (uint256 i = 0; i < currentCount; i++) {
                uint256[2] storage children = levelChildren[currentLevel[i]];
                if (children[0] != 0 && nextCount < 1999) {
                    nextLevel[nextCount++] = children[0];
                }
            }
            for (uint256 i = 0; i < currentCount; i++) {
                uint256[2] storage children = levelChildren[currentLevel[i]];
                if (children[1] != 0 && nextCount < 1999) {
                    nextLevel[nextCount++] = children[1];
                }
            }

            for (uint256 i = 0; i < nextCount; i++) {
                currentLevel[i] = nextLevel[i];
                nextLevel[i] = 0;
            }
            currentCount = nextCount;
        }

        // Fallback: should not reach here
        revert("Level tree insertion failed");
    }

    function adminResetLevelTree(uint256 maxUserId) external {
        require(msg.sender == coreContract, "Only core contract");
        for (uint256 i = 1; i <= maxUserId; i++) {
            isLevelEligible[i] = false;
            delete levelChildren[i];
            levelParent[i] = 0;
            levelEligibleAt[i] = 0;
        }
        levelRootId = 0;
        levelEligibilityCounter = 0;
    }

    function adminInsertLevelUser(
        uint256 userId,
        uint256 sponsorId
    ) external {
        require(msg.sender == coreContract, "Only core contract");
        isLevelEligible[userId] = true;
        levelEligibilityCounter++;
        levelEligibleAt[userId] = levelEligibilityCounter;
        _insertIntoLevelTree(userId, sponsorId);
    }

    function _refreshCountsUpward(uint256 nodeId) internal {
        uint256 currentId = nodeId;
        while (currentId != 0) {
            MGXTypes.TreeNode storage currentNode = nodes[currentId];
            subtreeCounts[currentId] =
                1 +
                subtreeCounts[currentNode.leftChildId] +
                subtreeCounts[currentNode.rightChildId];
            currentId = currentNode.parentId;
        }
    }

    function _validateContract(address target) internal view {
        require(target != address(0), "Invalid contract");
        require(target.code.length > 0, "Target is not a contract");
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    uint256[43] private __gap;
}
