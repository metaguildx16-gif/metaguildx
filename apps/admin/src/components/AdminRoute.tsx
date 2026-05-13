import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useOwner } from "../hooks/useOwner";

type AdminRouteProps = {
  children: ReactNode;
  walletAddress: string | null;
};

export function AdminRoute({ children, walletAddress }: AdminRouteProps) {
  const { isOwner, loading } = useOwner(walletAddress);
  const [checkedWallet, setCheckedWallet] = useState(false);

  useEffect(() => {
    if (walletAddress !== undefined) {
      setCheckedWallet(true);
    }
  }, [walletAddress]);

  if (loading || !checkedWallet) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white">
        Verifying owner access...
      </div>
    );
  }

  if (!isOwner) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
