import { Wallet, getBytes, solidityPackedKeccak256 } from "ethers";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function placementSigningPlugin(env: Record<string, string>) {
  return {
    name: "placement-signing-endpoint",
    configureServer(server: { middlewares: { use: (handler: (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== "/api/placement-sign" || req.method !== "POST") {
          next();
          return;
        }

        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        req.on("end", async () => {
          try {
            const signerKey =
              env.LOCAL_PLACEMENT_SIGNER_KEY ||
              env.VITE_LOCAL_PLACEMENT_SIGNER_KEY ||
              process.env.LOCAL_PLACEMENT_SIGNER_KEY ||
              process.env.VITE_LOCAL_PLACEMENT_SIGNER_KEY;

            if (!signerKey) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Placement signer private key is not configured" }));
              return;
            }

            const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
              placementData?: {
                chainId: string;
                contractAddress: string;
                account: string;
                sponsorId: number;
                nonce: number;
              };
            };

            const placementData = payload.placementData;
            if (!placementData) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Missing placementData" }));
              return;
            }

            const structHash = solidityPackedKeccak256(
              ["uint256", "address", "address", "uint256", "uint256"],
              [
                BigInt(placementData.chainId),
                placementData.contractAddress,
                placementData.account,
                BigInt(placementData.sponsorId),
                BigInt(placementData.nonce)
              ]
            );

            const signer = new Wallet(signerKey);
            console.log("[signer] Using key for address:", signer.address);
            const signature = await signer.signMessage(getBytes(structHash));

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ signature }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : "Placement signing failed"
              })
            );
          }
        });
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), placementSigningPlugin(env)],
    build: {
      chunkSizeWarningLimit: 300,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("TreePanel")) {
              return "tree-view";
            }
            if (id.includes("node_modules")) {
              if (id.includes("ethers")) {
                return "ethers-vendor";
              }
              if (id.includes("react")) {
                return "react-vendor";
              }
              return "vendor";
            }
            return undefined;
          }
        }
      }
    },
    server: {
      host: true,
      port: 5173,
      allowedHosts: true,
      proxy: {
        "/rpc": {
          target: "http://127.0.0.1:8545",
          changeOrigin: true,
          secure: false
        }
      }
    },
    preview: {
      host: "0.0.0.0",
      port: 4173
    }
  };
});
