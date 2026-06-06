import type { DashboardPageProps } from "./DashboardPageTypes";

export function SettingsPage(props: DashboardPageProps) {
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
    <h2 style={{ color: "#EEF4FF", fontSize: "20px", fontWeight: 700, marginBottom: "24px" }}>
      ⚙️ Settings
    </h2>

    <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
    {/* === PROFILE SECTION === */}
    <div className="dashboard-card" style={{ padding: "28px", borderRadius: "16px", marginBottom: "20px", flex: "1 1 340px" }}>
      <h3 style={{ color: "#C9A84C", fontSize: "15px", fontWeight: 600, marginBottom: "6px" }}>
        👤 Profile
      </h3>
      <p style={{ color: "#8899BB", fontSize: "13px", marginBottom: "24px" }}>
        Customize how you appear to others
      </p>

      {/* Avatar Upload — Coming Soon */}
      <div style={{
        display: "flex", alignItems: "center", gap: "20px",
        padding: "16px 0", borderBottom: "1px solid rgba(46,111,216,0.12)",
        marginBottom: "20px"
      }}>
        <img
          src="/mgx-logo.png"
          alt="MGX"
          style={{
            width: "72px", height: "72px", objectFit: "contain",
            flexShrink: 0,
            filter: "drop-shadow(0 0 8px rgba(201,168,76,0.4))"
          }}
          onError={e => { e.currentTarget.style.display="none"; }}
        />
        <div>
          <div style={{ fontSize: "13px", color: "#EEF4FF", marginBottom: "4px", fontWeight: 500 }}>
            Profile Photo
          </div>
          <div style={{
            fontSize: "11px", color: "#8899BB", marginBottom: "8px"
          }}>
            Permanent storage — backend integration coming soon
          </div>
          <button style={{
            padding: "7px 16px", borderRadius: "8px", fontSize: "12px",
            background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)",
            color: "#C9A84C", cursor: "not-allowed", fontWeight: 500
          }} disabled>
            📷 Upload Photo (Coming Soon)
          </button>
        </div>
      </div>

      {/* Nickname Input */}
      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", fontSize: "13px", color: "#8899BB", marginBottom: "6px" }}>
          Username / Nickname
        </label>
        <input
          type="text"
          value={profileMeta.nickname}
          onChange={e => setProfileMeta({ ...profileMeta, nickname: e.target.value })}
          placeholder="e.g. cryptoking"
          maxLength={30}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: "10px",
            background: "rgba(46,111,216,0.08)", border: "1px solid rgba(46,111,216,0.25)",
            color: "#EEF4FF", fontSize: "14px", outline: "none",
            boxSizing: "border-box",
            fontFamily: "inherit"
          }}
        />
      </div>

      {/* Display Name Input */}
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", fontSize: "13px", color: "#8899BB", marginBottom: "6px" }}>
          Display Name
        </label>
        <input
          type="text"
          value={profileMeta.displayName}
          onChange={e => setProfileMeta({ ...profileMeta, displayName: e.target.value })}
          placeholder="e.g. John Smith"
          maxLength={40}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: "10px",
            background: "rgba(46,111,216,0.08)", border: "1px solid rgba(46,111,216,0.25)",
            color: "#EEF4FF", fontSize: "14px", outline: "none",
            boxSizing: "border-box",
            fontFamily: "inherit"
          }}
        />
      </div>

      {/* Save Button */}
      <button
        className="btn-primary"
        style={{ padding: "11px 28px", borderRadius: "10px", fontSize: "14px", fontWeight: 600 }}
        onClick={() => {
          saveProfileMeta(profileMeta);
          setProfileSaved(true);
          setTimeout(() => setProfileSaved(false), 2500);
        }}
      >
        {profileSaved ? "✅ Saved!" : "💾 Save Changes"}
      </button>
    </div>

    {/* === PRIVACY SECTION === */}
    <div className="dashboard-card" style={{ padding: "28px", borderRadius: "16px", marginBottom: "20px", flex: "1 1 340px" }}>
      <h3 style={{ color: "#C9A84C", fontSize: "15px", fontWeight: 600, marginBottom: "6px" }}>
        🔒 Privacy Controls
      </h3>
      <p style={{ color: "#8899BB", fontSize: "13px", marginBottom: "24px" }}>
        Control what others can see on your public profile
      </p>

      {([
        { key: "earnings",      label: "💰 Income / Earnings",  desc: "Your total and breakdown earnings" },
        { key: "referralTree",  label: "🌳 Referral Tree",       desc: "Your downline and network tree" },
        { key: "packageLevel",  label: "📦 Package Level",       desc: "Your current active package" },
        { key: "walletAddress", label: "👛 Wallet Address",      desc: "Your full wallet address" }
      ] as const).map((item, i, arr) => (
        <div key={item.key} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 0",
          borderBottom: i < arr.length - 1 ? "1px solid rgba(46,111,216,0.12)" : "none"
        }}>
          <div>
            <div style={{ fontSize: "14px", color: "#EEF4FF", marginBottom: "3px" }}>{item.label}</div>
            <div style={{ fontSize: "12px", color: "#8899BB" }}>{item.desc}</div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            {(["all", "only_me"] as const).map(opt => (
              <button
                key={opt}
                onClick={() => savePrivacy({ ...privacySettings, [item.key]: opt })}
                style={{
                  padding: "6px 14px", borderRadius: "20px", fontSize: "12px",
                  fontWeight: 500, cursor: "pointer",
                  border: privacySettings[item.key] === opt
                    ? "1px solid #C9A84C"
                    : "1px solid rgba(255,255,255,0.1)",
                  background: privacySettings[item.key] === opt
                    ? "rgba(201,168,76,0.2)"
                    : "rgba(255,255,255,0.04)",
                  color: privacySettings[item.key] === opt ? "#C9A84C" : "#8899BB",
                  transition: "all 0.2s"
                }}
              >
                {opt === "all" ? "🌐 All Users" : "🔒 Only Me"}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
    </div>

    {/* Auto-save note */}
    <div style={{
      textAlign: "center", fontSize: "12px", color: "#4CAF82",
      padding: "10px", background: "rgba(76,175,130,0.08)",
      borderRadius: "8px", border: "1px solid rgba(76,175,130,0.2)"
    }}>
      ✅ Privacy settings auto-saved • Profile saved manually
    </div>

  </div>
  );
}
