import Tree, {
  type CustomNodeElementProps,
  type RawNodeDatum
} from "react-d3-tree";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getTreeNode,
  getTreeRootUserId,
  getUserDetail,
  type TreeNodeRecord,
  type UserDetail
} from "../hooks/useContractData";
import { shortAddress } from "../utils/packageUtils";

type TreeNodeData = RawNodeDatum & {
  nodeId: number;
  packageLevel?: number;
  wallet?: string;
  depth?: number;
  parentId?: number;
  leftChildId?: number;
  rightChildId?: number;
  highlighted?: boolean;
};

function getNodeColor(level?: number, highlighted?: boolean) {
  if (highlighted) {
    return "#22c55e";
  }
  if (!level) {
    return "#1f2937";
  }
  if (level === 10) {
    return "#f59e0b";
  }
  if (level >= 7) {
    return "#8b5cf6";
  }
  if (level >= 4) {
    return "#3b82f6";
  }
  return "#6b7280";
}

function buildEmptyNode(label: string): TreeNodeData {
  return {
    name: label,
    nodeId: 0,
    attributes: {
      Level: "Empty"
    }
  };
}

function TreeSidePanel({
  user,
  loading,
  onClose
}: {
  user: UserDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  if (!user && !loading) {
    return null;
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-gray-800 bg-gray-900/95 p-6 shadow-2xl shadow-black/50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-blue-300">
            Tree Node
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {loading ? "Loading..." : `User #${user?.userId ?? "-"}`}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-gray-500 hover:text-white"
        >
          Close
        </button>
      </div>

      {loading ? (
        <div className="mt-6 space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-3xl bg-gray-800" />
          ))}
        </div>
      ) : user ? (
        <div className="mt-6 space-y-6 text-sm text-gray-300">
          <section className="rounded-3xl border border-gray-800 bg-gray-950/70 p-5">
            <div className="space-y-3">
              <div>User ID: {user.userId}</div>
              <div className="flex items-center gap-2">
                Wallet: <span className="font-mono text-xs">{user.wallet}</span>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(user.wallet)}
                  className="rounded-full border border-gray-700 px-2 py-1 text-xs"
                >
                  Copy
                </button>
              </div>
              <div>Package Level: {user.packageLevel}</div>
              <div>Tree Depth: {user.treePosition.depth}</div>
              <div>Parent: User #{user.treePosition.parentId || 0}</div>
              <div>Left Child: {user.treePosition.leftChildId || "Empty"}</div>
              <div>Right Child: {user.treePosition.rightChildId || "Empty"}</div>
              <div>Position: {user.treePosition.position}</div>
              <div>Total Income: {user.totalIncomeReceived.toFixed(1)} USDT</div>
            </div>
          </section>

          <button
            type="button"
            onClick={() => navigate(`/users?search=${encodeURIComponent(user.wallet)}`)}
            className="w-full rounded-full bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-500"
          >
            View Full Profile
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function BinaryTreePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [treeData, setTreeData] = useState<TreeNodeData | null>(null);
  const [searchUserId, setSearchUserId] = useState(searchParams.get("userId") ?? "");
  const [focusUserId, setFocusUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [depth, setDepth] = useState(3);
  const [loading, setLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [viewport, setViewport] = useState({ width: 1200, height: 720 });

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: Math.max(window.innerWidth - 320, 640),
        height: Math.max(window.innerHeight - 160, 520)
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const buildTree = async (
    userId: number,
    currentDepth: number,
    maxDepth: number,
    highlightedId: number
  ): Promise<TreeNodeData> => {
    if (userId === 0) {
      return buildEmptyNode("Empty");
    }

    setProgress(`Loading level ${currentDepth}...`);
    const node = await getTreeNode(userId);

    if (currentDepth >= maxDepth) {
      return {
        name: `User #${userId}`,
        nodeId: userId,
        packageLevel: node.packageLevel,
        wallet: node.wallet,
        depth: node.depth,
        parentId: node.parent,
        leftChildId: node.left,
        rightChildId: node.right,
        highlighted: userId === highlightedId,
        attributes: {
          Level: `Level ${node.packageLevel}`,
          Wallet: shortAddress(node.wallet),
          Left: node.left ? `User #${node.left}` : "Empty",
          Right: node.right ? `User #${node.right}` : "Empty"
        }
      };
    }

    const children = await Promise.all([
      buildTree(node.left, currentDepth + 1, maxDepth, highlightedId),
      buildTree(node.right, currentDepth + 1, maxDepth, highlightedId)
    ]);

    return {
      name: `User #${userId}`,
      nodeId: userId,
      packageLevel: node.packageLevel,
      wallet: node.wallet,
      depth: node.depth,
      parentId: node.parent,
      leftChildId: node.left,
      rightChildId: node.right,
      highlighted: userId === highlightedId,
      attributes: {
        Level: `Level ${node.packageLevel}`,
        Wallet: shortAddress(node.wallet),
        Left: node.left ? `User #${node.left}` : "Empty",
        Right: node.right ? `User #${node.right}` : "Empty"
      },
      children
    };
  };

  const loadTree = async (targetUserId?: number | null) => {
    setLoading(true);
    setError(null);
    setProgress("Loading root...");

    try {
      const rootUserId = targetUserId && targetUserId > 0 ? targetUserId : await getTreeRootUserId();
      const built = await buildTree(rootUserId, 1, depth, rootUserId);
      setTreeData(built);
      setFocusUserId(rootUserId);
      setSearchUserId(String(rootUserId));
      setSearchParams(rootUserId ? { userId: String(rootUserId) } : {});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load tree");
      setTreeData(null);
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  useEffect(() => {
    const fromUrl = searchParams.get("userId");
    if (fromUrl) {
      void loadTree(Number(fromUrl));
    } else {
      void loadTree();
    }
  }, [depth]);

  const handleSearch = async (nextUserId: number) => {
    if (!nextUserId) {
      return;
    }
    await loadTree(nextUserId);
    setPanelLoading(true);
    try {
      const detail = await getUserDetail(nextUserId);
      setSelectedUser(detail);
    } catch {
      setSelectedUser(null);
    } finally {
      setPanelLoading(false);
    }
  };

  const handleNodeClick = async (nodeDatum: TreeNodeData) => {
    if (!nodeDatum.nodeId) {
      return;
    }
    setPanelLoading(true);
    try {
      const detail = await getUserDetail(nodeDatum.nodeId);
      setSelectedUser(detail);
      if (focusUserId !== nodeDatum.nodeId) {
        setFocusUserId(nodeDatum.nodeId);
      }
    } finally {
      setPanelLoading(false);
    }
  };

  const renderNode = ({ nodeDatum }: CustomNodeElementProps) => {
    const treeNode = nodeDatum as unknown as TreeNodeData;
    const fill = getNodeColor(treeNode.packageLevel, treeNode.highlighted);

    return (
      <g>
        <circle r={30} fill={fill} stroke="#374151" strokeWidth={2} />
        <text textAnchor="middle" fill="white" fontSize={11} dy={4}>
          {treeNode.name}
        </text>
      </g>
    );
  };

  const translate = useMemo(
    () => ({ x: viewport.width / 2, y: 90 }),
    [viewport.width]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Binary Tree</h2>
            <p className="mt-2 text-sm text-gray-400">
              Focus on a user subtree, inspect placements, and open node details without loading the full network tree.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-full border border-gray-800 bg-gray-950 px-4 py-2 text-sm text-gray-300">
              <span>Show Depth</span>
              <select
                value={depth}
                onChange={(event) => setDepth(Number(event.target.value))}
                className="bg-transparent outline-none"
              >
                {[2, 3, 4, 5].map((value) => (
                  <option key={value} value={value} className="bg-gray-900">
                    {value}
                  </option>
                ))}
              </select>
            </label>
            {depth > 4 ? (
              <div className="rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
                Loading deep trees may be slow
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <input
            value={searchUserId}
            onChange={(event) => setSearchUserId(event.target.value)}
            placeholder="Enter User ID to find..."
            className="min-w-[220px] rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => void handleSearch(Number(searchUserId))}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            Find
          </button>
          {focusUserId ? (
            <div className="flex items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              Focused on User #{focusUserId}
            </div>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="flex items-center justify-between gap-4 rounded-3xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          <span>Failed to load tree: {error}</span>
          <button
            type="button"
            onClick={() => void loadTree(focusUserId)}
            className="rounded-full bg-red-500 px-4 py-2 font-medium text-white"
          >
            Retry
          </button>
        </div>
      ) : null}

      <section className="relative overflow-hidden rounded-3xl border border-gray-800 bg-gray-950">
        <div
          className="relative"
          style={{ height: "calc(100vh - 220px)", minHeight: "620px" }}
        >
          {loading || !treeData ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-400">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-800 border-t-blue-500" />
              <p className="text-sm font-medium text-white">Building tree...</p>
              <p className="text-xs text-gray-500">{progress || "Preparing tree view"}</p>
            </div>
          ) : (
            <Tree
              data={treeData}
              orientation="vertical"
              renderCustomNodeElement={renderNode}
              pathFunc="step"
              translate={translate}
              nodeSize={{ x: 220, y: 130 }}
              separation={{ siblings: 1.5, nonSiblings: 2 }}
              zoom={0.7}
              scaleExtent={{ min: 0.3, max: 2 }}
              onNodeClick={(nodeDatum) =>
                void handleNodeClick(nodeDatum.data as unknown as TreeNodeData)
              }
              collapsible={false}
              dimensions={viewport}
            />
          )}
        </div>
      </section>

      <TreeSidePanel
        user={selectedUser}
        loading={panelLoading}
        onClose={() => {
          setSelectedUser(null);
          setPanelLoading(false);
        }}
      />
    </div>
  );
}
