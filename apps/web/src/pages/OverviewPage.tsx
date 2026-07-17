import type { DashboardPageProps } from "./DashboardPageTypes";

export function OverviewPage(props: DashboardPageProps) {
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
    rebirthEscrowDisplay,
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
  <section className="panel dashboard-preview dashboard-view w-full max-w-full">
    <div className="overview-layout flex flex-col gap-4 w-full max-w-full">
      <div className="overview-row overview-row-primary grid grid-cols-1 lg:grid-cols-2 gap-4 w-full max-w-full">
        <article className="section-card premium-panel dashboard-home-card">
          <div className="section-card-header">
            <div className="dashboard-card-title-stack">
              <span className="section-badge blue">Earnings Summary</span>
            </div>
            <button type="button" className="btn-refresh-reward" onClick={() => void handleRefreshSection("Home")} disabled={isLoading}>
              ↻
            </button>
          </div>
          <div className="section-card-body dashboard-home-body">
            {showDashboardSkeleton ? (
              renderSkeletonRows(3)
            ) : (
              <>
                <div className="income-row dashboard-summary-row"><span className="income-label">Direct Income</span><span className="income-amount">${directIncomeDisplay}</span></div>
                <div className="income-row dashboard-summary-row"><span className="income-label">Level Income</span><span className="income-amount">${levelIncomeDisplay}</span></div>
                {snapshot.incomeDistributionPending ? (
                  <div className="income-row dashboard-summary-row" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.22)", borderRadius: "10px", padding: "10px 12px" }}>
                    <span className="income-label">Distribution Pending</span>
                    <span className="income-amount" style={{ color: "#C9A84C", fontSize: "12px", textAlign: "right" }}>Income will be processed shortly</span>
                  </div>
                ) : null}
                <div className="income-row dashboard-summary-row"><span className="income-label">Upgrade Escrow</span><span className="income-amount">${frozenEscrowDisplay}</span></div>
                <div className="income-row dashboard-summary-row"><span className="income-label">Rebirth Escrow</span><span className="income-amount">${rebirthEscrowDisplay}</span></div>
                {/* ── Locked Earnings row ───────────────────────── */}
                <div className="income-row dashboard-summary-row" style={{borderTop:"1px solid rgba(251,191,36,0.12)",marginTop:2,paddingTop:6}}>
                  <span className="income-label" style={{color:"#FBBF24",display:"flex",alignItems:"center",gap:5}}>
                    <span>🔒</span>
                    <span>Locked Earnings</span>
                  </span>
                  <span className="income-amount" style={{color:"#FBBF24"}}>
                    ${(parseFloat((snapshot as any).lockedEarnings ?? "0") || 0).toFixed(2)}
                  </span>
                </div>
                <p style={{fontSize:"0.72rem",color:"#64748b",margin:"3px 0 6px",lineHeight:1.5,padding:"0 2px"}}>
                  {(parseFloat((snapshot as any).lockedEarnings ?? "0") || 0) > 0
                    ? "🔒 You are currently not eligible for these earnings. Upgrade your package to unlock future earning opportunities."
                    : "✅ You are currently eligible for all available earnings."}
                </p>
                <div className="dashboard-summary-total">
                  <span>Total</span>
                  <strong>{`$${totalReceivedDisplay}`}</strong>
                </div>
              </>
            )}
          </div>
        </article>

        <article className="section-card premium-panel dashboard-home-card">
          <div className="section-card-header">
            <span className="section-badge blue">My Tree</span>
          </div>
          <div className="section-card-body dashboard-home-body">
            {showDashboardSkeleton ? (
              <>
                {renderSkeletonRows(6)}
                <div className="mt-4 h-10 w-full animate-pulse rounded-lg bg-gray-700/50" />
              </>
            ) : (
              <>
                <div className="income-row dashboard-tree-row"><span className="income-label">Direct Left</span><span className={`income-amount ${directLeftNode ? "" : "text-amber"}`}>{directLeftNode ? getDisplayName(directLeftNode.account, directLeftNode.userId) : (directLeftNode === null && (props as any).currentUserTreeNode?.leftChildId > 0 ? "Loading..." : "Empty slot")}</span></div>
                <div className="income-row dashboard-tree-row"><span className="income-label">Direct Right</span><span className={`income-amount ${directRightNode ? "" : "text-amber"}`}>{directRightNode ? getDisplayName(directRightNode.account, directRightNode.userId) : (directRightNode === null && (props as any).currentUserTreeNode?.rightChildId > 0 ? "Loading..." : "Empty slot")}</span></div>
                <div className="income-row dashboard-tree-row"><span className="income-label">Level Left</span><span className="income-amount">{snapshot.levelTreeLeft ?? 0}</span></div>
                <div className="income-row dashboard-tree-row"><span className="income-label">Level Right</span><span className="income-amount">{snapshot.levelTreeRight ?? 0}</span></div>
                <div className="income-row dashboard-tree-row"><span className="income-label">Total Team</span><span className="income-amount">{totalTeamLabel}</span></div>
                <div className="income-row dashboard-tree-row"><span className="income-label">Left | Right</span><span className="income-amount">{snapshot.leftBranchNodes} | {snapshot.rightBranchNodes}</span></div>
                <button
                  type="button"
                  className="btn-primary-large mt-4 dashboard-tree-cta"
                  onClick={() => setDashboardView("network")}
                >
                  View Full Tree
                </button>
              </>
            )}
          </div>
        </article>
      </div>
    </div>
  </section>
  );
}
