import type { DashboardPageProps } from "./DashboardPageTypes";

export function ProfilePage(props: DashboardPageProps) {
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

    {/* Profile Header Card */}
    <div className="dashboard-card" style={{
      padding: "32px",
      marginBottom: "24px",
      background: "linear-gradient(135deg, rgba(46,111,216,0.15) 0%, rgba(201,168,76,0.08) 100%)",
      border: "1px solid rgba(201,168,76,0.3)",
      borderRadius: "20px",
      display: "flex",
      alignItems: "center",
      gap: "24px",
      flexWrap: "wrap",
      position: "relative",
      width: "100%"
    }}>
      {/* Avatar */}
      <img
        src="/mgx-logo.png"
        alt="MGX"
        style={{
          width: "88px", height: "88px", objectFit: "contain",
          flexShrink: 0,
          filter: "drop-shadow(0 0 12px rgba(201,168,76,0.5))"
        }}
        onError={e => { e.currentTarget.style.display="none"; }}
      />

      {/* User Info */}
      <div style={{ flex: 1, minWidth: "200px" }}>
        <div style={{ fontSize: "24px", fontWeight: 700, color: "#EEF4FF", marginBottom: "4px" }}>
          {profileMeta.displayName || `User #${snapshot?.userId || "—"}`}
        </div>
        {profileMeta.nickname && (
          <div style={{ fontSize: "13px", color: "#8899BB", marginBottom: "6px" }}>
            @{profileMeta.nickname}
          </div>
        )}
        <div style={{
          fontSize: "12px", color: "#7EB3FF", marginBottom: "10px",
          fontFamily: "monospace", display: "flex", alignItems: "center", gap: "6px"
        }}>
          {snapshot?.walletAddress
            ? `${snapshot.walletAddress.slice(0,6)}...${snapshot.walletAddress.slice(-4)}`
            : "—"}
          <button
            id="wallet-copy-btn"
            onClick={() => {
              navigator.clipboard.writeText(snapshot?.walletAddress || "");
              const btn = document.getElementById("wallet-copy-btn");
              if (btn) { btn.textContent = "✅"; setTimeout(() => { btn.textContent = "📋"; }, 2000); }
            }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#C9A84C", fontSize: "13px", padding: "0"
            }}
            title="Copy wallet address"
          >📋</button>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <span style={{
            background: "rgba(76,175,130,0.15)", border: "1px solid rgba(76,175,130,0.4)",
            borderRadius: "20px", padding: "3px 12px", fontSize: "11px", color: "#4CAF82", fontWeight: 600
          }}>✅ Verified Member</span>
          <span style={{
            background: "rgba(46,111,216,0.15)", border: "1px solid rgba(46,111,216,0.4)",
            borderRadius: "20px", padding: "3px 12px", fontSize: "11px", color: "#7EB3FF", fontWeight: 600
          }}>📦 Package {snapshot?.packageLevel || 0}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
        <button
          className="btn-primary"
          style={{ padding: "10px 20px", fontSize: "13px", borderRadius: "10px", whiteSpace: "nowrap" }}
          onClick={() => {
            const uid = snapshot?.userId || 0; const chars2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; let n2 = uid + 100000; let enc2 = ""; while (n2 > 0) { enc2 = chars2[n2 % 62] + enc2; n2 = Math.floor(n2 / 62); } const link = `${window.location.origin}?ref=${enc2}`;
            navigator.clipboard.writeText(link);
          }}
        >
          🔗 Copy Referral Link
        </button>
        <button
          onClick={handleLogout}
          style={{
            padding: "10px 20px", fontSize: "13px", borderRadius: "10px",
            background: "rgba(220,53,69,0.12)", border: "1px solid rgba(220,53,69,0.35)",
            color: "#FF6B7A", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap",
            transition: "all 0.2s"
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(220,53,69,0.22)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(220,53,69,0.12)")}
        >
          🚪 Logout
        </button>
      </div>
    </div>

    {/* Stats Grid — 2×2 */}
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "16px",
      marginBottom: "24px"
    }}>
      {[
        { icon: "👥", label: "Direct Referrals", value: String(snapshot?.directReferrals ?? "—"), color: "#7EB3FF" },
        { icon: "🌐", label: "Total Team", value: String(snapshot.leftBranchNodes + snapshot.rightBranchNodes > 0
          ? snapshot.leftBranchNodes + snapshot.rightBranchNodes
          : totalTeamMembers), color: "#7EB3FF" },
        {
          icon: "💰", label: "Total Earnings",
          value: privacySettings.earnings === "all" ? `$${snapshot?.totalEarnings ?? "0"}` : "🔒 Hidden",
          color: "#C9A84C"
        },
        {
          icon: "📦", label: "Package Level",
          value: privacySettings.packageLevel === "all" ? `Level ${snapshot?.packageLevel ?? 0}` : "🔒 Hidden",
          color: "#C9A84C"
        }
      ].map((stat, i) => (
        <div key={i} className="stat-card" style={{
          textAlign: "center", padding: "24px 16px", borderRadius: "16px"
        }}>
          <div style={{ fontSize: "30px", marginBottom: "10px" }}>{stat.icon}</div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: stat.color, marginBottom: "4px" }}>
            {stat.value}
          </div>
          <div style={{ fontSize: "12px", color: "#8899BB" }}>{stat.label}</div>
        </div>
      ))}
    </div>

    {/* Personal Info Card */}
    <div className="dashboard-card" style={{ padding: "28px", borderRadius: "16px", width: "100%" }}>
      <h3 style={{ color: "#C9A84C", marginBottom: "20px", fontSize: "15px", fontWeight: 600 }}>
        📋 Personal Info
      </h3>
      {[
        { label: "User ID", value: `#${snapshot?.userId || "—"}` },
        { label: "Sponsor ID", value: `#${snapshot?.sponsorId || "—"}` },
        {
          label: "Wallet",
          value: privacySettings.walletAddress === "all"
            ? snapshot?.walletAddress || "—"
            : `${(snapshot?.walletAddress || "").slice(0,6)}...••••`
        },
        {
          label: "Joined",
          value: snapshot?.joinedAt
            ? new Date(Number(snapshot.joinedAt) * 1000).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
            : "—"
        }
      ].map((row, i) => (
        <div key={i} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 0",
          borderBottom: i < 3 ? "1px solid rgba(46,111,216,0.12)" : "none"
        }}>
          <span style={{ fontSize: "13px", color: "#8899BB" }}>{row.label}</span>
          <span style={{ fontSize: "13px", color: "#EEF4FF", fontFamily: "monospace" }}>{row.value}</span>
        </div>
      ))}
    </div>

  </div>
  );
}
