export const SEPOLIA_CHAIN_ID = "0xaa36a7";
export const SEPOLIA_CHAIN_ID_DECIMAL = 11155111;

export interface ContractConfig {
  address: string;
  chainId: number;
}

const envAddress = import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined;

export const contractConfig: ContractConfig = {
  address: envAddress ?? "",
  chainId: SEPOLIA_CHAIN_ID_DECIMAL,
};

export const isConfigured = (): boolean => {
  return contractConfig.address.length > 0;
};

export const ROLE_LABELS: Record<number, string> = {
  0: "Generator",
  1: "Collector",
  2: "Transporter",
  3: "Recycler",
  4: "Material Processor",
};

export const ROLE_OPTIONS = [
  { value: 0, label: "Generator" },
  { value: 1, label: "Collector" },
  { value: 2, label: "Transporter" },
  { value: 3, label: "Recycler" },
  { value: 4, label: "Material Processor" },
];
