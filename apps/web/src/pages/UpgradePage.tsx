import type { DashboardPageProps } from "./DashboardPageTypes";

export function UpgradePage(props: DashboardPageProps) {
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
  <section className="panel dashboard-view w-full max-w-full">
    <p className="section-label">Upgrade</p>
    <div className="dashboard-card action-card upgrade-premium-card upgrade-journey-shell">
      <div className="upgrade-card-header">
        <span className="upgrade-card-icon">↑</span>
        <div>
          <h3>Package Upgrade</h3>
          <p className="upgrade-card-path">
            {snapshot.packageLevel ? `Pkg ${snapshot.packageLevel}` : "Not active"} <span>→</span> {nextUpgradeLevel ? `Pkg ${nextUpgradeLevel}` : "Maximum"}
          </p>
        </div>
      </div>
      <div className="upgrade-journey-summary">
        <span className="upgrade-journey-label">Your Upgrade Journey</span>
        <p className="upgrade-journey-copy">
          Track every milestone from Pkg 1 through Pkg 10 and see exactly where your next upgrade unlock sits.
        </p>
      </div>
      <div className="upgrade-journey-grid">
        {upgradeMilestones.map((milestone: any) => {
          const isCompleted = milestone.fromPkg < userPackageLevel;
          const isActive = milestone.fromPkg === userPackageLevel;
          const isLocked = milestone.fromPkg > userPackageLevel;
          const isMaxMilestone = milestone.toPkg === "MAX";
          const milestoneCostLabel = isMaxMilestone ? "Final tier" : `$${milestone.cost.toFixed(2)}`;

          return (
            <article
              key={`upgrade-milestone-${milestone.fromPkg}`}
              className={`upgrade-milestone-card ${isCompleted ? "completed" : ""} ${isActive ? "active" : ""} ${isLocked ? "locked" : ""} ${isMaxMilestone ? "max-milestone" : ""}`}
            >
              <div className="upgrade-milestone-head">
                <div className="upgrade-milestone-title-wrap">
                  <span className="upgrade-milestone-icon" aria-hidden="true">
                    {isCompleted ? "✅" : isActive ? "⚡" : "🔒"}
                  </span>
                  <div>
                    <h4>{`Pkg ${milestone.fromPkg} → ${typeof milestone.toPkg === "number" ? `Pkg ${milestone.toPkg}` : milestone.toPkg}`}</h4>
                    {isCompleted ? <p className="upgrade-milestone-subtitle success">Completed</p> : null}
                    {isLocked ? (
                      <>
                        <p className="upgrade-milestone-subtitle muted">Complete previous to unlock</p>
                        <p className="upgrade-milestone-cost">{`Cost: ${milestoneCostLabel}`}</p>
                      </>
                    ) : null}
                    {isActive && isMaxMilestone ? <p className="upgrade-milestone-subtitle success">You are already at the highest package tier.</p> : null}
                  </div>
                </div>
                <span className={`upgrade-milestone-badge ${isCompleted ? "done" : ""} ${isActive ? "active" : ""} ${isLocked ? "locked" : ""}`}>
                  {isCompleted ? "✅ DONE" : isActive ? "⚡ Active" : "🔒 LOCKED"}
                </span>
              </div>

              {isCompleted ? (
                <div className="upgrade-milestone-complete">
                  <div className="upgrade-milestone-meta">
                    <span className="upgrade-milestone-meta-label">✅ Upgraded</span>
                    <span className="upgrade-milestone-cost">{`Cost Paid: ${milestoneCostLabel}`}</span>
                  </div>
                  <div className="upgrade-milestone-progress" aria-hidden="true">
                    <span className="upgrade-milestone-progress-fill" style={{ width: "100%" }} />
                  </div>
                  <div className="upgrade-milestone-meta">
                    <span className="upgrade-milestone-complete-copy">Milestone Complete! 🎉</span>
                    <span className="upgrade-milestone-percent">100%</span>
                  </div>
                </div>
              ) : null}

              {isActive && !isMaxMilestone ? (
                <>
                  <div className="info-card upgrade-progress-card premium-upgrade-progress-card">
                    <div className="upgrade-progress-bar" aria-hidden="true">
                      <span className="upgrade-progress-fill" style={{ width: `${upgradeProgressPercent.toFixed(0)}%` }} />
                    </div>
                    <span className="upgrade-progress-percent">Progress: {upgradeProgressPercent.toFixed(0)}%</span>
                    <div className="upgrade-progress-stats premium-upgrade-stats">
                      <div className="premium-upgrade-stat">
                        <span>Frozen</span>
                        <strong>${frozenEscrowDisplay}</strong>
                      </div>
                      <div className="premium-upgrade-stat">
                        <span>Need</span>
                        <strong>${upgradeNeedDisplay}</strong>
                      </div>
                      <div className="premium-upgrade-stat">
                        <span>Left</span>
                        <strong>${upgradeRemainingDisplay}</strong>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-primary-large premium-upgrade-btn"
                    disabled={isLoading || !canUpgradeCurrentPackage}
                    onClick={() =>
                      runWalletAction(
                        () =>
                          metaguildx.upgradeUserPackage({
                            userId: snapshot.userId ?? 0,
                            newPackageLevel: nextUpgradeLevel ?? 0
                          }),
                        "Upgrading package...",
                        "Package upgraded",
                        (nextSnapshot: any) => ({
                          title: `Package ${nextUpgradeLevel ?? "-"} upgraded successfully`,
                          detail: `Your current package is now ${nextSnapshot.packageLevel ? `Package ${nextSnapshot.packageLevel}` : "updated"}. Running box: Box ${nextSnapshot.currentBoxId} at $${nextSnapshot.currentBoxPrice}.`
                        })
                      )
                    }
                  >
                    ⬆ Upgrade Now
                  </button>
                </>
              ) : null}

              {isActive && isMaxMilestone ? <div className="upgrade-max-state">🏆 You're at Maximum Package Level!</div> : null}
            </article>
          );
        })}
      </div>
    </div>
  </section>
  );
}
