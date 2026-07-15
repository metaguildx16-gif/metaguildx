import { useEffect, useState } from "react";
import TreeCanvas from "./TreeCanvas";
import RadarCanvas from "./RadarCanvas";

type TreeNodeLike = {
  userId: number;
  packageLevel: number;
  parentId: number;
  leftChildId: number;
  rightChildId: number;
  depth: number;
  directReferrals: number;
  account: string;
};

type TreeChildLike = {
  side: "Left" | "Right";
  node: TreeNodeLike;
};

type DisplayTreeNode = {
  node: TreeNodeLike | null;
  side: "ROOT" | "Left" | "Right";
  left: DisplayTreeNode | null;
  right: DisplayTreeNode | null;
};

type TreePanelProps = {
  userDisplayNames?: Record<string, string>;
  [key: string]: any;
};

function getDisplayName(userDisplayNames: Record<string, string> | undefined, node?: TreeNodeLike | null) {
  if (!node) return "Open slot";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; let n = node.userId + 100000; let enc = ""; while (n > 0) { enc = chars[n % 62] + enc; n = Math.floor(n / 62); } return (node.account && userDisplayNames?.[node.account.toLowerCase()]) || `User #${enc}`;
}

function formatSideUser(
  userId: number,
  treeNodeMap?: Map<number, TreeNodeLike>,
  userDisplayNames?: Record<string, string>
) {
  if (!userId) return "Open slot";
  return getDisplayName(userDisplayNames, treeNodeMap?.get(userId) ?? null);
}
export default function TreePanel(props: TreePanelProps) {
  const {
    snapshot,
    treePreview = snapshot.treePreview,
    selectedTreeUserId,
    setSelectedTreeUserId,
    selectedTreeNode,
    selectedTreePath,
    selectedTreeParent,
    selectedTreeChildren,
    selectedTreeDetails,
    selectedFeaturedUser,
    leftBranchNodes,
    rightBranchNodes,
    isLoadingTreeDetails,
    treeTitle = "Binary Tree View",
    treeDescription = "Root stays centered. Left and right child slots stay visible for at least three levels.",
    treeLabel = "Tree",
    emptyStateText = "No tree nodes loaded yet.",
    initialRootId = null,
    disableRootSync = false,
    showEventHistory = true,
    userDisplayNames
  } = props;

  const treeNodeMap = new Map<number, TreeNodeLike>(treePreview.map((node: TreeNodeLike) => [node.userId, node] as const));
  const rootNode = treePreview.find((node: TreeNodeLike) => node.parentId === 0) ?? treePreview[0] ?? null;
  const preferredRootNode =
    initialRootId && treeNodeMap.has(initialRootId) ? treeNodeMap.get(initialRootId) ?? rootNode : rootNode;
  const [viewMode,setViewMode]=useState<"radar"|"tree">("radar");
  const [treeViewRootId, setTreeViewRootId] = useState<number | null>(preferredRootNode?.userId ?? null);
  const [manualRootSet, setManualRootSet] = useState(false);
  const [showIncomeDetails, setShowIncomeDetails] = useState(false);
  const [treeDataReady, setTreeDataReady] = useState<boolean>(() =>
    initialRootId ? treeNodeMap.has(initialRootId) : treeNodeMap.size > 0
  );

  useEffect(() => {
    if (initialRootId) {
      setTreeDataReady(treeNodeMap.has(initialRootId));
      return;
    }

    setTreeDataReady(treeNodeMap.size > 0);
  }, [initialRootId, treeNodeMap]);

  useEffect(() => {
    if (manualRootSet) return;
    if (treeNodeMap.size === 0) return;
    if (!preferredRootNode) {
      setTreeViewRootId(null);
      return;
    }
    if (!treeViewRootId || !treeNodeMap.has(treeViewRootId)) {
      if (initialRootId && treeNodeMap.has(initialRootId)) {
        setTreeViewRootId(initialRootId);
      } else {
        setTreeViewRootId(preferredRootNode.userId);
      }
    }
  }, [initialRootId, manualRootSet, preferredRootNode, treeNodeMap, treeViewRootId]);

  useEffect(() => {
    if (disableRootSync) return;
    if (preferredRootNode) {
      if (manualRootSet) return;
      setTreeViewRootId(preferredRootNode.userId);
      if (preferredRootNode.userId !== selectedTreeUserId) {
        setSelectedTreeUserId(preferredRootNode.userId);
      }
    }
  }, [disableRootSync, initialRootId, manualRootSet, preferredRootNode, selectedTreeUserId, setSelectedTreeUserId]);

  useEffect(() => {
    if (disableRootSync) return;
    if (manualRootSet) return;
    if (selectedTreeUserId && treeNodeMap.has(selectedTreeUserId)) {
      setTreeViewRootId(selectedTreeUserId);
    }
  }, [disableRootSync, manualRootSet, selectedTreeUserId, treeNodeMap]);

  const viewRootNode = treeViewRootId ? treeNodeMap.get(treeViewRootId) ?? rootNode : rootNode;

  function focusTreeUser(userId: number) {
    setSelectedTreeUserId(userId);
    setTreeViewRootId(userId);
  }

  function buildDisplayTree(node: TreeNodeLike | null, depth: number, side: "ROOT" | "Left" | "Right"): DisplayTreeNode | null {
    if (depth >= 3) {
      return null;
    }

    if (!node) {
      if (depth === 2) {
        return {
          node: null,
          side,
          left: null,
          right: null
        };
      }
      return {
        node: null,
        side,
        left: buildDisplayTree(null, depth + 1, "Left"),
        right: buildDisplayTree(null, depth + 1, "Right")
      };
    }

    return {
      node,
      side,
      left: buildDisplayTree((treeNodeMap.get(node.leftChildId) as TreeNodeLike | undefined) ?? null, depth + 1, "Left"),
      right: buildDisplayTree((treeNodeMap.get(node.rightChildId) as TreeNodeLike | undefined) ?? null, depth + 1, "Right")
    };
  }

  const visualTree = buildDisplayTree(viewRootNode ?? null, 0, "ROOT");
  const effectiveLeftSideId = selectedTreeDetails?.leftChildId ?? selectedTreeNode?.leftChildId ?? 0;
  const effectiveRightSideId = selectedTreeDetails?.rightChildId ?? selectedTreeNode?.rightChildId ?? 0;
  const effectiveTreeChildren = (selectedTreeChildren as TreeChildLike[]).filter((child) =>
    child.node.userId === effectiveLeftSideId || child.node.userId === effectiveRightSideId
  );
  const selectedTotalTeam =
    (selectedTreeDetails?.leftBranchNodes ?? leftBranchNodes.length) +
    (selectedTreeDetails?.rightBranchNodes ?? rightBranchNodes.length);
  const selectedLeftBusiness = selectedTreeDetails?.leftBranchBusiness ?? "0";
  const selectedRightBusiness = selectedTreeDetails?.rightBranchBusiness ?? "0";
  const selectedPackageLevel = selectedTreeDetails?.packageLevel ?? selectedTreeNode?.packageLevel ?? 0;
  const selectedTeamBusiness = selectedTreeDetails?.totalTeamBusiness ?? selectedTreeNode?.totalTeamBusiness ?? "0";
  const selectedDirectIncome = selectedTreeDetails?.directIncome ?? "0";
  const selectedLevelIncome = selectedTreeDetails?.levelIncome ?? "0";
  const selectedCrossLineIncome = selectedTreeDetails?.crossLineIncome ?? "0";
  const leftLegNode =
    effectiveTreeChildren.find((child) => child.side === "Left")?.node ??
    (effectiveLeftSideId ? treeNodeMap.get(effectiveLeftSideId) ?? null : null);
  const rightLegNode =
    effectiveTreeChildren.find((child) => child.side === "Right")?.node ??
    (effectiveRightSideId ? treeNodeMap.get(effectiveRightSideId) ?? null : null);

  if (!treeDataReady) {
    return (
      <section className="panel">
        <p className="section-label">{treeLabel}</p>
        <div className="flex min-h-[200px] flex-col items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-cyan-400/20 border-t-cyan-400" />
          <p className="mt-4 text-center text-sm text-[#8892a4]">Loading tree data...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <p className="section-label">{treeLabel}</p>
      <div className="tree-page-layout tree-page-layout-binary">
        <article className="dashboard-card tree-main-card">
          <div className="tree-canvas-header">
            <div>
              <h3>{treeTitle}</h3>
              <p>{treeDescription}</p>
            </div>
            <div className="tree-legend">
              <button
                type="button"
                className="secondary-button"
                disabled={!preferredRootNode}
                onClick={() => {
                  if (preferredRootNode) {
                    setManualRootSet(false);
                    setSelectedTreeUserId(preferredRootNode.userId);
                    setTreeViewRootId(preferredRootNode.userId);
                  }
                }}
              >
                Back to Root
              </button>
              <span className="tree-legend-chip">ROOT</span>
              <span className="tree-legend-chip">L = Left</span>
              <span className="tree-legend-chip">R = Right</span>
              <span className="tree-legend-chip">Dashed = Open Slot</span>
            </div>
          </div>

          <div className="tree-canvas-shell" style={{padding:0,border:"none",background:"none",position:"relative"}}>
            {visualTree&&(
              <div style={{display:"flex",justifyContent:"center",gap:8,padding:"10px 0 6px",position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",zIndex:20}}>
                {(["radar","tree"] as const).map(m=>(
                  <button key={m} type="button" onClick={()=>setViewMode(m)} style={{
                    padding:"4px 14px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",
                    border:viewMode===m?"1px solid #4f6ef7":"1px solid rgba(79,110,247,0.22)",
                    background:viewMode===m?"rgba(79,110,247,0.25)":"rgba(79,110,247,0.08)",
                    color:viewMode===m?"#c5d4ff":"#64748b",transition:"all 0.18s",
                  }}>{m==="radar"?"◉ Radar":"⊞ Tree"}</button>
                ))}
              </div>
            )}
            {visualTree?(
              viewMode==="radar"?(
                <RadarCanvas
                  visualTree={visualTree}
                  selectedId={selectedTreeUserId}
                  currentUserId={snapshot.userId??null}
                  onNodeClick={focusTreeUser}
                  userDisplayNames={userDisplayNames}
                />
              ):(
                <TreeCanvas
                  visualTree={visualTree}
                  selectedId={selectedTreeUserId}
                  currentUserId={snapshot.userId??null}
                  onNodeClick={focusTreeUser}
                  userDisplayNames={userDisplayNames}
                />
              )
            ):(
              <div className="empty-state">
                <p className="empty-state-text">{emptyStateText}</p>
              </div>
            )}
          </div>

          <div className="tree-focus-strip">
            <div className="tree-focus-card">
              <span>Parent</span>
              <strong>{selectedTreeParent ? getDisplayName(userDisplayNames, selectedTreeParent) : "Root"}</strong>
            </div>
            <div className="tree-focus-card">
              <span>Left</span>
              <strong>{formatSideUser(effectiveLeftSideId, treeNodeMap, userDisplayNames)}</strong>
            </div>
            <div className="tree-focus-card">
              <span>Selected</span>
              <strong>{selectedTreeNode ? getDisplayName(userDisplayNames, selectedTreeNode) : "Pick a node"}</strong>
            </div>
            <div className="tree-focus-card">
              <span>Right</span>
              <strong>{formatSideUser(effectiveRightSideId, treeNodeMap, userDisplayNames)}</strong>
            </div>
          </div>
        </article>

        <div className="tree-side-column">
          <article className="dashboard-card tree-detail-card">
            <h3>Selected Node Details</h3>
            {selectedTreeNode ? (
              <div className="selected-node-panel">
                <div className="selected-node-breadcrumb">
                  {selectedTreePath.map((userId: number, index: number) => (
                    <span key={userId}>
                      {index > 0 ? <span className="breadcrumb-separator"> &gt; </span> : null}
                      <button
                        type="button"
                        className={`breadcrumb-button ${selectedTreeUserId === userId ? "breadcrumb-button-active" : ""}`}
                        onClick={() => focusTreeUser(userId)}
                      >
                        {getDisplayName(userDisplayNames, treeNodeMap.get(userId))}
                      </button>
                    </span>
                  ))}
                </div>

                <div className="selected-node-header">
                  <strong>{`${getDisplayName(userDisplayNames, selectedTreeNode)} · Package ${selectedPackageLevel}`}</strong>
                  <span>{`Depth: ${selectedTreeNode.depth} · Parent: ${selectedTreeParent ? getDisplayName(userDisplayNames, selectedTreeParent) : "Root"}`}</span>
                </div>

                <div className="selected-node-grid">
                  <div className="selected-node-stat">
                    <span>Left Team</span>
                    <strong>{selectedTreeDetails?.leftBranchNodes ?? leftBranchNodes.length}</strong>
                  </div>
                  <div className="selected-node-stat">
                    <span>Right Team</span>
                    <strong>{selectedTreeDetails?.rightBranchNodes ?? rightBranchNodes.length}</strong>
                  </div>
                  <div className="selected-node-stat">
                    <span>Total Team</span>
                    <strong>{selectedTotalTeam}</strong>
                  </div>
                  <div className="selected-node-stat">
                    <span>Business</span>
                    <strong>${selectedTeamBusiness}</strong>
                  </div>
                </div>

                <div className="tree-income-toggle">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setShowIncomeDetails((current) => !current)}
                  >
                    {showIncomeDetails ? "▲ Hide Income Details" : "▼ Show Income Details"}
                  </button>
                  {showIncomeDetails ? (
                    <ul className="metric-list compact progress-list mt-4">
                      <li>Direct: ${selectedDirectIncome}</li>
                      <li>Level: ${selectedLevelIncome}</li>
                      <li>Network Bonus: ${selectedCrossLineIncome}</li>
                    </ul>
                  ) : null}
                </div>

                <div className="selected-node-subgrid">
                  <div className="selected-node-mini-card">
                    <strong>Left Leg</strong>
                    {leftLegNode ? (
                      <ul className="metric-list compact">
                        <li>{`${getDisplayName(userDisplayNames, leftLegNode)} · Pkg ${leftLegNode.packageLevel}`}</li>
                        <li>Subtree members: {selectedTreeDetails?.leftBranchNodes ?? leftBranchNodes.length}</li>
                      </ul>
                    ) : (
                      <p>Empty slot</p>
                    )}
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={!effectiveLeftSideId}
                      onClick={() => {
                        if (effectiveLeftSideId) {
                          focusTreeUser(effectiveLeftSideId);
                        }
                      }}
                    >
                      View Left
                    </button>
                  </div>
                  <div className="selected-node-mini-card">
                    <strong>Right Leg</strong>
                    {rightLegNode ? (
                      <ul className="metric-list compact">
                        <li>{`${getDisplayName(userDisplayNames, rightLegNode)} · Pkg ${rightLegNode.packageLevel}`}</li>
                        <li>Subtree members: {selectedTreeDetails?.rightBranchNodes ?? rightBranchNodes.length}</li>
                      </ul>
                    ) : (
                      <p>Empty slot</p>
                    )}
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={!effectiveRightSideId}
                      onClick={() => {
                        if (effectiveRightSideId) {
                          focusTreeUser(effectiveRightSideId);
                        }
                      }}
                    >
                      View Right
                    </button>
                  </div>
                  <div className="selected-node-mini-card">
                    <strong>Navigator</strong>
                    <p>
                      {isLoadingTreeDetails
                        ? "Loading exact contract data for this node..."
                        : "Click any user in the tree or jump directly into the left or right leg from here."}
                    </p>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={!selectedTreeParent}
                      onClick={() => {
                        if (selectedTreeParent) {
                          focusTreeUser(selectedTreeParent.userId);
                        }
                      }}
                    >
                      View Parent
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p>Select a node to inspect its details.</p>
            )}
          </article>

          {showEventHistory ? (
            <article className="dashboard-card">
              <h3>Live Event History</h3>
              <div className="activity-timeline">
                {snapshot.activityFeed.length > 0 ? (
                  snapshot.activityFeed.map((item: any, index: number) => (
                    <article key={`${item.kind}-tree-${index}`} className="activity-item">
                      <div className="activity-badge">{item.kind}</div>
                      <div className="activity-copy">
                        <strong>{item.primary}</strong>
                        <span>{item.secondary}</span>
                      </div>
                      <time>{item.timestampLabel ?? "Live"}</time>
                    </article>
                  ))
                ) : (
                  <p>No activity loaded yet.</p>
                )}
              </div>
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}
