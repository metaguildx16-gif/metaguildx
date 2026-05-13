export async function sendTransaction(
  contractFn: () => Promise<{ wait: () => Promise<unknown> }>,
  onSuccess: (msg: string) => void,
  onError: (msg: string) => void,
  successMsg: string
) {
  try {
    const tx = await contractFn();
    await tx.wait();
    onSuccess(successMsg);
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    if (err?.code === 4001) {
      onError("Transaction cancelled");
      return;
    }
    onError(err?.message || "Transaction failed");
  }
}
