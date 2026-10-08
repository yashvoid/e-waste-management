import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, formatEther } from "ethers";
import { SEPOLIA_CHAIN_ID } from "./config";

export interface WalletInfo {
  address: string;
  chainId: string;
  provider: BrowserProvider;
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [state, setState] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState<boolean>(true);

  const checkNetwork = useCallback((chainId: string) => {
    setIsCorrectNetwork(chainId === SEPOLIA_CHAIN_ID);
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask is not installed. Please install MetaMask to continue.");
      return;
    }

    setState("connecting");
    setError(null);

    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts || accounts.length === 0) {
        setError("No accounts found. Please unlock MetaMask and try again.");
        setState("disconnected");
        return;
      }

      const chainId = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;

      const provider = new BrowserProvider(window.ethereum);
      setWallet({ address: accounts[0], chainId, provider });
      checkNetwork(chainId);
      setState("connected");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(msg);
      setState("disconnected");
    }
  }, [checkNetwork]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (!accounts || accounts.length === 0) {
        setWallet(null);
        setState("disconnected");
      } else if (wallet) {
        setWallet({ ...wallet, address: accounts[0] });
      }
    };

    const handleChainChanged = (...args: unknown[]) => {
      const chainId = args[0] as string;
      checkNetwork(chainId);
      if (wallet) {
        setWallet({ ...wallet, chainId });
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [wallet, checkNetwork]);

  return { wallet, state, error, isCorrectNetwork, connect };
}

export function useBalance(wallet: WalletInfo | null) {
  const [balance, setBalance] = useState<string>("0");

  useEffect(() => {
    if (!wallet) {
      setBalance("0");
      return;
    }

    wallet.provider
      .getBalance(wallet.address)
      .then((bal) => setBalance(formatEther(bal)))
      .catch(() => setBalance("0"));
  }, [wallet]);

  return balance;
}
