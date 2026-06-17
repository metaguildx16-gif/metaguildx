import type { DashboardPageProps } from "./DashboardPageTypes";

export function TeamPage(props: DashboardPageProps) {
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
      👥 My Team
    </h2>
    <p style={{ color: "#8899BB", fontSize: "13px", marginBottom: "24px" }}>
      Your direct referrals and network members
    </p>

    {/* Stats row */}
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))",
      gap: "16px", marginBottom: "24px"
    }}>
      {[
        { icon: "👥", label: "Direct Referrals", value: snapshot.directReferrals ?? 0, color: "#7EB3FF" },
        { icon: "🌐", label: "Total Team", value: totalTeamMembers, color: "#7EB3FF" },
        { icon: "⬅️", label: "Left Branch", value: snapshot.leftBranchNodes > 0 ? snapshot.leftBranchNodes : "—", color: "#2EC48F" },
        { icon: "➡️", label: "Right Branch", value: snapshot.rightBranchNodes > 0 ? snapshot.rightBranchNodes : "—", color: "#2EC48F" },
      ].map((s, i) => (
        <div key={i} className="stat-card" style={{ textAlign: "center", padding: "20px 16px" }}>
          <div style={{ fontSize: "26px", marginBottom: "8px" }}>{s.icon}</div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: s.color, marginBottom: "4px" }}>{s.value}</div>
          <div style={{ fontSize: "12px", color: "#8899BB" }}>{s.label}</div>
        </div>
      ))}
    </div>

    {/* Direct referrals list */}
    <div className="dashboard-card" style={{ padding: "24px", borderRadius: "16px" }}>
      <h3 style={{ color: "#C9A84C", fontSize: "15px", fontWeight: 600, marginBottom: "20px" }}>
        🔗 Direct Referrals ({snapshot.directReferralIds?.length ?? 0})
      </h3>
      {snapshot.directReferralIds?.length === 0 ? (
        <div style={{ textAlign: "center", color: "#8899BB", padding: "40px 0" }}>
          No direct referrals yet. Share your referral link to grow your team!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {(snapshot.directReferralIds ?? []).map((uid: any, i: any) => {
            const node = snapshot.treePreview.find((n: any) => n.userId === uid)
              ?? snapshot.featuredUsers.find((n: any) => n.userId === uid) as any;
            const wallet = node?.account;
            const name = wallet
              ? (userDisplayNames[wallet.toLowerCase()] || `User #${(()=>{const c="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";let n=uid+100000,e="";while(n>0){e=c[n%62]+e;n=Math.floor(n/62);}return e;})()}`)
              : `User #${(()=>{const c="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";let n=uid+100000,e="";while(n>0){e=c[n%62]+e;n=Math.floor(n/62);}return e;})()}`;
            const income = snapshot.directReferralIncomeByUserId?.[uid] ?? "0";
            return (
              <div key={uid} style={{
                display: "flex", alignItems: "center", gap: "14px",
                padding: "14px 16px", borderRadius: "12px",
                background: "rgba(46,111,216,0.06)",
                border: "1px solid rgba(46,111,216,0.15)"
              }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: "linear-gradient(135deg,rgba(201,168,76,.25),rgba(46,111,216,.2))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, color: "#C9A84C", fontSize: "14px", flexShrink: 0
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#EEF4FF" }}>{name}</div>
                  <div style={{ fontSize: "11px", color: "#8899BB", fontFamily: "monospace" }}>
                    {wallet ? `${wallet.slice(0,6)}...${wallet.slice(-4)}` : `#${uid}`}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#2EC48F" }}>${income}</div>
                  <div style={{ fontSize: "11px", color: "#8899BB" }}>
                    Pkg {node?.packageLevel ?? "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
  );
}
