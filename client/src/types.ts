export interface ParticipantInfo {
  name: string;
  role: number;
  isRegistered: boolean;
  registeredAt: bigint;
}

export type WalletState = "disconnected" | "connecting" | "connected";

export type TxState =
  | "idle"
  | "preparing"
  | "pending"
  | "confirmed"
  | "failed"
  | "rejected";

export interface TxStatus {
  state: TxState;
  message: string;
  txHash?: string;
}

export interface BatchInfo {
  id: bigint;
  generator: string;
  originalQuantityGrams: bigint;
  availableQuantityGrams: bigint;
  pendingQuantityGrams: bigint;
  createdAt: bigint;
  status: number;
  exists: boolean;
}

export interface TransferInfo {
  id: bigint;
  batchId: bigint;
  sender: string;
  receiver: string;
  declaredQuantityGrams: bigint;
  receivedQuantityGrams: bigint;
  status: number;
  senderApproved: boolean;
  receiverApproved: boolean;
  createdAt: bigint;
  receivedAt: bigint;
  confirmedAt: bigint;
  exists: boolean;
}

export const GRAMS_PER_KG = 1000;

export const TRANSFER_STATUS = {
  Pending: 0,
  Received: 1,
  Confirmed: 2,
  Cancelled: 3,
} as const;

export const TRANSFER_STATUS_LABELS: Record<number, string> = {
  0: "Pending",
  1: "Received",
  2: "Confirmed",
  3: "Cancelled",
};

export interface RecoveredMaterialInfo {
  id: bigint;
  batchId: bigint;
  recycler: string;
  materialType: string;
  producedQuantityGrams: bigint;
  availableQuantityGrams: bigint;
  processingEventId: bigint;
  createdAt: bigint;
  exists: boolean;
}

export interface ProcessingEventInfo {
  id: bigint;
  batchId: bigint;
  recycler: string;
  inputQuantityGrams: bigint;
  residualGrams: bigint;
  processedAt: bigint;
  exists: boolean;
}

export interface MaterialTransferInfo {
  id: bigint;
  materialId: bigint;
  batchId: bigint;
  sender: string;
  receiver: string;
  declaredQuantityGrams: bigint;
  receivedQuantityGrams: bigint;
  status: number;
  senderApproved: boolean;
  receiverApproved: boolean;
  createdAt: bigint;
  receivedAt: bigint;
  confirmedAt: bigint;
  exists: boolean;
}

export interface MaterialProcessingRecordInfo {
  id: bigint;
  materialId: bigint;
  batchId: bigint;
  processor: string;
  inputQuantityGrams: bigint;
  processedAt: bigint;
  exists: boolean;
}

export interface BatchHistoryEventInfo {
  kind: "TransferCancelled" | "MaterialTransferCancelled" | "BatchCompleted";
  batchId: number;
  transferId: number | null;
  processor?: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}
