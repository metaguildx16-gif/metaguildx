import type { DashboardPageProps } from "./DashboardPageTypes";

export function UserSearchPage(props: DashboardPageProps) {
  const {
    activeLevelsCount,
    activeTreePreview,
    asMgx,
    availableStakeAmount,
    boxEarningsDisplay,
    canSubmitStake,
    canUpgradeCurrentPackage,
    canUseIndexedStakingActions,
    connectedWalletHistoryRows,
    connectedWalletTotalDisplay,
    directIncomeDisplay,
    directLeftNode,
    directRightNode,
    displayedMgxAllocated,
    displayedPendingStakingReward,
    displayedPersonalStaked,
    displayedStakePositions,
    displayedTotalMgxAllocated,
    displayedTotalStaked,
    earningsDashTab,
    escrowBalance,
    frozenEscrowDisplay,
    getDisplayName,
    handleCopyRebirthReferralLink,
    handleCopyReferralLink,
    handleCopyWalletAddress,
    handleLoadMoreHistory,
    handleLogout,
    handleRefreshRewards,
    handleRefreshSection,
    handleShareReferralLink,
    hasClaimableReward,
    hasWithdrawableStake,
    isConnectedWalletHistoryLoading,
    isConnectedWalletLoading,
    isLoading,
    isLoadingLevelTree,
    isLoadingRebirthDetails,
    isLoadingTreeDetails,
    isStakePending,
    LazyTreePanel,
    leftBranchNodes,
    levelIncomeDisplay,
    lockPeriods,
    metaguildx,
    mgxAllocationRows,
    mgxAvailableDisplay,
    navigateToRebirth,
    networkBonusDisplay,
    networkBonusHistoryRows,
    networkDashTab,
    nextUnlockReferralTarget,
    nextUpgradeLevel,
    opBnbGasDisplay,
    outerUsdtBalanceDisplay,
    parseDisplayNumber,
    privacySettings,
    profileMeta,
    profileSaved,
    rebirthBoxEarningsByPkg,
    rebirthDashView,
    rebirthEscrowProgress,
    rebirthFrozenAmount,
    rebirthGoBack,
    rebirthIncomeByUserId,
    rebirthNavStack,
    rebirthNeededAmount,
    rebirthNodeDetails,
    rebirthPkgLevel,
    rebirthProgressLabel,
    rebirthProgressPercent,
    rebirthProgressStep,
    rebirthRows,
    rebirthStatusLabel,
    rebirthTreePreview,
    rebirthXSlotStep,
    recentActivityRows,
    referralCopyStatus,
    referralGoalLabel,
    referralLink,
    referralSponsorId,
    referralSponsorProfile,
    registerForm,
    registrationSummary,
    regStep,
    renderSkeletonRows,
    rewardWindowReady,
    rightBranchNodes,
    runWalletAction,
    savePrivacy,
    saveProfileMeta,
    selectedFeaturedUser,
    selectedRebirthId,
    selectedRebirthRow,
    selectedTreeChildren,
    selectedTreeDetails,
    selectedTreeNode,
    selectedTreeParent,
    selectedTreePath,
    selectedTreeUserId,
    setActionFeedback,
    setDashboardView,
    setEarningsDashTab,
    setNetworkDashTab,
    setProfileMeta,
    setProfileSaved,
    setRebirthDashView,
    setRebirthNavStack,
    setRegisterForm,
    setSelectedRebirthId,
    setSelectedTreeUserId,
    setShowActivationConfirm,
    setStakeForm,
    setStatus,
    setTreeMode,
    setUserSearchQuery,
    setWalletMoveAmount,
    setWalletSubView,
    shortWalletAddress,
    showDashboardSkeleton,
    snapshot,
    spilloverIncomeDisplay,
    stakeableMgxAllocated,
    stakeForm,
    StakingSummary,
    Suspense,
    teamBusinessDisplay,
    totalMgxAllocatedDisplay,
    totalReceivedDisplay,
    totalTeamLabel,
    totalTeamMembers,
    transferFromBalance,
    transferFromLabel,
    transferToLabel,
    treeLevels,
    treeMode,
    upgradeMilestones,
    upgradeNeedDisplay,
    upgradeProgressPercent,
    upgradeRemainingDisplay,
    userDisplayNames,
    userLevelSummaryRows,
    userPackageLevel,
    userReferralRows,
    userSearchQuery,
    visibleLevelBreakdownRows,
    walletMoveAmount,
    walletSubView,
  } = props;
  return (
  <div className="dashboard-page" style={{ padding: "24px" }}>
    <h2 style={{ color: "#EEF4FF", fontSize: "20px", fontWeight: 700, marginBottom: "6px" }}>
      🔍 User Search
    </h2>
    <p style={{ color: "#8899BB", fontSize: "13px", marginBottom: "24px" }}>
      Search by User ID, wallet address, or display name
    </p>

    {/* Search input */}
    <div style={{ marginBottom: "24px" }}>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={userSearchQuery}
          onChange={e => setUserSearchQuery(e.target.value)}
          placeholder="User ID, wallet address, or name..."
          style={{
            width: "100%", padding: "14px 16px 14px 44px",
            borderRadius: "12px",
            background: "rgba(46,111,216,0.08)",
            border: "1px solid rgba(46,111,216,0.25)",
            color: "#EEF4FF", fontSize: "15px", outline: "none",
            boxSizing: "border-box", fontFamily: "inherit"
          }}
        />
        <span style={{
          position: "absolute", left: "14px", top: "50%",
          transform: "translateY(-50%)", fontSize: "18px"
        }}>🔍</span>
      </div>
    </div>

    {/* Search results */}
    {userSearchQuery.trim().length > 0 && (
      <div className="dashboard-card" style={{ padding: "24px", borderRadius: "16px" }}>
        <h3 style={{ color: "#C9A84C", fontSize: "14px", fontWeight: 600, marginBottom: "16px" }}>
          Results
        </h3>
        <div style={{ fontSize: "11px", color: "#3D5580", marginBottom: "12px" }}>
          Showing results from visible network ({snapshot.treePreview.length} nodes)
        </div>
        {(() => {
          const q = userSearchQuery.trim().toLowerCase();
          const results = snapshot.treePreview.filter((node: any) => {
            const name = node.account ? (userDisplayNames[node.account.toLowerCase()] || "") : "";
            return (
              String(node.userId).includes(q) ||
              (node.account?.toLowerCase().includes(q)) ||
              name.toLowerCase().includes(q)
            );
          });
          if (results.length === 0) {
            return (
              <div style={{ textAlign: "center", color: "#8899BB", padding: "30px 0" }}>
                No users found. Try a different search term.
              </div>
            );
          }
          return results.map((node: any) => {
            const wallet = node.account;
            const name = wallet ? (userDisplayNames[wallet.toLowerCase()] || `User #${node.userId}`) : `User #${node.userId}`;
            return (
              <div key={node.userId} style={{
                display: "flex", alignItems: "center", gap: "14px",
                padding: "12px 0",
                borderBottom: "1px solid rgba(46,111,216,0.1)"
              }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: "linear-gradient(135deg,rgba(46,111,216,.2),rgba(201,168,76,.1))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#7EB3FF", fontWeight: 700, fontSize: "13px", flexShrink: 0
                }}>
                  #{node.userId}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#EEF4FF" }}>{name}</div>
                  <div style={{ fontSize: "11px", color: "#8899BB", fontFamily: "monospace" }}>
                    {wallet ? `${wallet.slice(0,6)}...${wallet.slice(-4)}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "12px", color: "#C9A84C" }}>Pkg {node.packageLevel}</div>
                  <div style={{ fontSize: "11px", color: "#8899BB" }}>{node.directReferrals} referrals</div>
                </div>
              </div>
            );
          });
        })()}
      </div>
    )}

    {userSearchQuery.trim().length === 0 && (
      <div style={{
        textAlign: "center", color: "#8899BB", padding: "60px 0",
        fontSize: "14px"
      }}>
        🔍 Search within your visible network ({snapshot.treePreview.length} members shown)
      </div>
    )}
  </div>
  );
}
