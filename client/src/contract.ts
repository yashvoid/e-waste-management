import { Contract, type BrowserProvider, type EventLog } from "ethers";
import { contractConfig } from "./config";
import type { BatchHistoryEventInfo } from "./types";
import type { ParticipantInfo, BatchInfo, TransferInfo, RecoveredMaterialInfo, ProcessingEventInfo, MaterialTransferInfo, MaterialProcessingRecordInfo } from "./types";

const ABI = [
  "function registerParticipant(string memory _name, uint8 _role) external",
  "function getParticipant(address _wallet) external view returns (string name, uint8 role, bool isRegistered, uint256 registeredAt)",
  "function getParticipantCount() external view returns (uint256)",
  "function getParticipantAddress(uint256 _index) external view returns (address)",
  "function createBatch(uint256 _quantityGrams) external returns (uint256)",
  "function getBatch(uint256 _batchId) external view returns (uint256 id, address generator, uint256 originalQuantityGrams, uint256 availableQuantityGrams, uint256 pendingQuantityGrams, uint256 createdAt, uint8 status, bool exists)",
  "function batchExists(uint256 _batchId) external view returns (bool)",
  "function getBatchCount() external view returns (uint256)",
  "function getBatchIdByIndex(uint256 _index) external view returns (uint256)",
  "function createTransfer(uint256 _batchId, address _receiver, uint256 _quantityGrams) external returns (uint256)",
  "function receiveTransfer(uint256 _transferId, uint256 _receivedQuantityGrams) external",
  "function approveTransfer(uint256 _transferId) external",
  "function cancelTransfer(uint256 _transferId) external",
  "function getTransfer(uint256 _transferId) external view returns (uint256 id, uint256 batchId, address sender, address receiver, uint256 declaredQuantityGrams, uint256 receivedQuantityGrams, uint8 status, bool senderApproved, bool receiverApproved, uint256 createdAt, uint256 receivedAt, uint256 confirmedAt, bool exists)",
  "function transferExists(uint256 _transferId) external view returns (bool)",
  "function getTransferCount() external view returns (uint256)",
  "function getConfirmedCustody(uint256 _batchId, address _wallet) external view returns (uint256)",
  "function getPendingOutgoing(uint256 _batchId, address _wallet) external view returns (uint256)",
  "function getAvailableCustody(uint256 _batchId, address _wallet) external view returns (uint256)",
  "event ParticipantRegistered(address indexed wallet, string name, uint8 role, uint256 timestamp)",
  "event BatchCreated(uint256 indexed batchId, address indexed generator, uint256 quantityGrams, uint256 timestamp)",
  "event TransferCreated(uint256 indexed transferId, uint256 indexed batchId, address indexed sender, address receiver, uint256 declaredQuantityGrams, uint256 timestamp)",
  "event QuantityReceived(uint256 indexed transferId, uint256 receivedQuantityGrams, uint256 timestamp)",
  "event TransferConfirmed(uint256 indexed transferId, uint256 confirmedAt)",
  "event TransferCancelled(uint256 indexed transferId, uint256 cancelledAt)",
  "function processEwaste(uint256 _batchId, uint256 _inputQuantityGrams, string[] calldata _materialTypes, uint256[] calldata _materialQuantities, uint256 _residualGrams) external returns (uint256)",
  "function getMaterial(uint256 _materialId) external view returns (uint256 id, uint256 batchId, address recycler, string materialType, uint256 producedQuantityGrams, uint256 availableQuantityGrams, uint256 processingEventId, uint256 createdAt, bool exists)",
  "function materialExists(uint256 _materialId) external view returns (bool)",
  "function getMaterialCount() external view returns (uint256)",
  "function getMaterialIdByIndex(uint256 _index) external view returns (uint256)",
  "function getProcessingEvent(uint256 _processingEventId) external view returns (uint256 id, uint256 batchId, address recycler, uint256 inputQuantityGrams, uint256 residualGrams, uint256 processedAt, bool exists)",
  "function processingEventExists(uint256 _processingEventId) external view returns (bool)",
  "function getProcessingEventCount() external view returns (uint256)",
  "event EwasteProcessed(uint256 indexed processingEventId, uint256 indexed batchId, address indexed recycler, uint256 inputQuantityGrams, uint256 residualGrams, uint256 timestamp)",
  "event MaterialRecovered(uint256 indexed materialId, uint256 indexed processingEventId, uint256 indexed batchId, address recycler, string materialType, uint256 quantityGrams, uint256 timestamp)",
  "function createMaterialTransfer(uint256 _materialId, address _receiver, uint256 _quantityGrams) external returns (uint256)",
  "function receiveMaterialTransfer(uint256 _transferId, uint256 _receivedQuantityGrams) external",
  "function approveMaterialTransfer(uint256 _transferId) external",
  "function cancelMaterialTransfer(uint256 _transferId) external",
  "function getMaterialTransfer(uint256 _transferId) external view returns (uint256 id, uint256 materialId, uint256 batchId, address sender, address receiver, uint256 declaredQuantityGrams, uint256 receivedQuantityGrams, uint8 status, bool senderApproved, bool receiverApproved, uint256 createdAt, uint256 receivedAt, uint256 confirmedAt, bool exists)",
  "function materialTransferExists(uint256 _transferId) external view returns (bool)",
  "function getMaterialTransferCount() external view returns (uint256)",
  "function getMaterialTransferIdByIndex(uint256 _index) external view returns (uint256)",
  "function getMaterialConfirmedCustody(uint256 _materialId, address _wallet) external view returns (uint256)",
  "function getMaterialPendingOutgoing(uint256 _materialId, address _wallet) external view returns (uint256)",
  "function getMaterialAvailableCustody(uint256 _materialId, address _wallet) external view returns (uint256)",
  "event MaterialTransferCreated(uint256 indexed transferId, uint256 indexed materialId, uint256 indexed batchId, address sender, address receiver, uint256 declaredQuantityGrams, uint256 timestamp)",
  "event MaterialQuantityReceived(uint256 indexed transferId, uint256 receivedQuantityGrams, uint256 timestamp)",
  "event MaterialTransferConfirmed(uint256 indexed transferId, uint256 confirmedAt)",
  "event MaterialTransferCancelled(uint256 indexed transferId, uint256 cancelledAt)",
  "function processMaterial(uint256 _materialId, uint256 _quantityGrams) external returns (uint256)",
  "function getMaterialProcessingRecord(uint256 _recordId) external view returns (uint256 id, uint256 materialId, uint256 batchId, address processor, uint256 inputQuantityGrams, uint256 processedAt, bool exists)",
  "function materialProcessingRecordExists(uint256 _recordId) external view returns (bool)",
  "function getMaterialProcessingRecordCount() external view returns (uint256)",
  "function getMaterialProcessingRecordIdByIndex(uint256 _index) external view returns (uint256)",
  "event MaterialProcessed(uint256 indexed recordId, uint256 indexed materialId, uint256 indexed batchId, address processor, uint256 inputQuantityGrams, uint256 timestamp)",
  "event BatchCompleted(uint256 indexed batchId, address indexed processor, uint256 timestamp)",
];

export function getContract(provider: BrowserProvider): Contract {
  return new Contract(contractConfig.address, ABI, provider);
}

export async function getParticipantInfo(
  provider: BrowserProvider,
  address: string
): Promise<ParticipantInfo> {
  const contract = getContract(provider);
  const [name, role, isRegistered, registeredAt] = (await contract.getParticipant(address)) as [
    string,
    number,
    boolean,
    bigint,
  ];

  return { name, role: Number(role), isRegistered, registeredAt };
}

export async function getBatchInfo(
  provider: BrowserProvider,
  batchId: number
): Promise<BatchInfo> {
  const contract = getContract(provider);
  const result = (await contract.getBatch(batchId)) as [
    bigint,
    string,
    bigint,
    bigint,
    bigint,
    bigint,
    number,
    boolean,
  ];

  return {
    id: result[0],
    generator: result[1],
    originalQuantityGrams: result[2],
    availableQuantityGrams: result[3],
    pendingQuantityGrams: result[4],
    createdAt: result[5],
    status: Number(result[6]),
    exists: result[7],
  };
}

export async function getBatchCount(provider: BrowserProvider): Promise<number> {
  const contract = getContract(provider);
  const count = (await contract.getBatchCount()) as bigint;
  return Number(count);
}

export async function getBatchIds(provider: BrowserProvider): Promise<number[]> {
  const contract = getContract(provider);
  const count = (await contract.getBatchCount()) as bigint;
  const countNum = Number(count);
  const ids: number[] = [];
  for (let i = 0; i < countNum; i++) {
    const id = (await contract.getBatchIdByIndex(i)) as bigint;
    ids.push(Number(id));
  }
  return ids;
}

export async function getTransferInfo(
  provider: BrowserProvider,
  transferId: number
): Promise<TransferInfo> {
  const contract = getContract(provider);
  const result = (await contract.getTransfer(transferId)) as [
    bigint,
    bigint,
    string,
    string,
    bigint,
    bigint,
    number,
    boolean,
    boolean,
    bigint,
    bigint,
    bigint,
    boolean,
  ];

  return {
    id: result[0],
    batchId: result[1],
    sender: result[2],
    receiver: result[3],
    declaredQuantityGrams: result[4],
    receivedQuantityGrams: result[5],
    status: Number(result[6]),
    senderApproved: result[7],
    receiverApproved: result[8],
    createdAt: result[9],
    receivedAt: result[10],
    confirmedAt: result[11],
    exists: result[12],
  };
}

export async function getTransferCount(provider: BrowserProvider): Promise<number> {
  const contract = getContract(provider);
  const count = (await contract.getTransferCount()) as bigint;
  return Number(count);
}

export async function getAllTransfers(provider: BrowserProvider): Promise<TransferInfo[]> {
  const contract = getContract(provider);
  const count = (await contract.getTransferCount()) as bigint;
  const countNum = Number(count);
  const transfers: TransferInfo[] = [];
  for (let i = 1; i <= countNum; i++) {
    const result = (await contract.getTransfer(i)) as [
      bigint,
      bigint,
      string,
      string,
      bigint,
      bigint,
      number,
      boolean,
      boolean,
      bigint,
      bigint,
      bigint,
      boolean,
    ];

    if (result[12]) {
      transfers.push({
        id: result[0],
        batchId: result[1],
        sender: result[2],
        receiver: result[3],
        declaredQuantityGrams: result[4],
        receivedQuantityGrams: result[5],
        status: Number(result[6]),
        senderApproved: result[7],
        receiverApproved: result[8],
        createdAt: result[9],
        receivedAt: result[10],
        confirmedAt: result[11],
        exists: result[12],
      });
    }
  }
  return transfers;
}

export async function getConfirmedCustody(
  provider: BrowserProvider,
  batchId: number,
  wallet: string
): Promise<bigint> {
  const contract = getContract(provider);
  return (await contract.getConfirmedCustody(batchId, wallet)) as bigint;
}

export async function getPendingOutgoing(
  provider: BrowserProvider,
  batchId: number,
  wallet: string
): Promise<bigint> {
  const contract = getContract(provider);
  return (await contract.getPendingOutgoing(batchId, wallet)) as bigint;
}

export async function getAvailableCustody(
  provider: BrowserProvider,
  batchId: number,
  wallet: string
): Promise<bigint> {
  const contract = getContract(provider);
  return (await contract.getAvailableCustody(batchId, wallet)) as bigint;
}

export async function getMaterialInfo(
  provider: BrowserProvider,
  materialId: number
): Promise<RecoveredMaterialInfo> {
  const contract = getContract(provider);
  const result = (await contract.getMaterial(materialId)) as [
    bigint,
    bigint,
    string,
    string,
    bigint,
    bigint,
    bigint,
    bigint,
    boolean,
  ];

  return {
    id: result[0],
    batchId: result[1],
    recycler: result[2],
    materialType: result[3],
    producedQuantityGrams: result[4],
    availableQuantityGrams: result[5],
    processingEventId: result[6],
    createdAt: result[7],
    exists: result[8],
  };
}

export async function getMaterialCount(provider: BrowserProvider): Promise<number> {
  const contract = getContract(provider);
  const count = (await contract.getMaterialCount()) as bigint;
  return Number(count);
}

export async function getAllMaterials(provider: BrowserProvider): Promise<RecoveredMaterialInfo[]> {
  const contract = getContract(provider);
  const count = (await contract.getMaterialCount()) as bigint;
  const countNum = Number(count);
  const materials: RecoveredMaterialInfo[] = [];
  for (let i = 1; i <= countNum; i++) {
    const result = (await contract.getMaterial(i)) as [
      bigint,
      bigint,
      string,
      string,
      bigint,
      bigint,
      bigint,
      bigint,
      boolean,
    ];

    if (result[8]) {
      materials.push({
        id: result[0],
        batchId: result[1],
        recycler: result[2],
        materialType: result[3],
        producedQuantityGrams: result[4],
        availableQuantityGrams: result[5],
        processingEventId: result[6],
        createdAt: result[7],
        exists: result[8],
      });
    }
  }
  return materials;
}

export async function getProcessingEventInfo(
  provider: BrowserProvider,
  processingEventId: number
): Promise<ProcessingEventInfo> {
  const contract = getContract(provider);
  const result = (await contract.getProcessingEvent(processingEventId)) as [
    bigint,
    bigint,
    string,
    bigint,
    bigint,
    bigint,
    boolean,
  ];

  return {
    id: result[0],
    batchId: result[1],
    recycler: result[2],
    inputQuantityGrams: result[3],
    residualGrams: result[4],
    processedAt: result[5],
    exists: result[6],
  };
}

export async function getProcessingEventCount(provider: BrowserProvider): Promise<number> {
  const contract = getContract(provider);
  const count = (await contract.getProcessingEventCount()) as bigint;
  return Number(count);
}

export async function getAllProcessingEvents(provider: BrowserProvider): Promise<ProcessingEventInfo[]> {
  const contract = getContract(provider);
  const count = (await contract.getProcessingEventCount()) as bigint;
  const countNum = Number(count);
  const events: ProcessingEventInfo[] = [];
  for (let i = 1; i <= countNum; i++) {
    const result = (await contract.getProcessingEvent(i)) as [
      bigint,
      bigint,
      string,
      bigint,
      bigint,
      bigint,
      boolean,
    ];

    if (result[6]) {
      events.push({
        id: result[0],
        batchId: result[1],
        recycler: result[2],
        inputQuantityGrams: result[3],
        residualGrams: result[4],
        processedAt: result[5],
        exists: result[6],
      });
    }
  }
  return events;
}

export async function getMaterialTransferInfo(
  provider: BrowserProvider,
  transferId: number
): Promise<MaterialTransferInfo> {
  const contract = getContract(provider);
  const result = (await contract.getMaterialTransfer(transferId)) as [
    bigint,
    bigint,
    bigint,
    string,
    string,
    bigint,
    bigint,
    number,
    boolean,
    boolean,
    bigint,
    bigint,
    bigint,
    boolean,
  ];

  return {
    id: result[0],
    materialId: result[1],
    batchId: result[2],
    sender: result[3],
    receiver: result[4],
    declaredQuantityGrams: result[5],
    receivedQuantityGrams: result[6],
    status: Number(result[7]),
    senderApproved: result[8],
    receiverApproved: result[9],
    createdAt: result[10],
    receivedAt: result[11],
    confirmedAt: result[12],
    exists: result[13],
  };
}

export async function getMaterialTransferCount(provider: BrowserProvider): Promise<number> {
  const contract = getContract(provider);
  const count = (await contract.getMaterialTransferCount()) as bigint;
  return Number(count);
}

export async function getAllMaterialTransfers(provider: BrowserProvider): Promise<MaterialTransferInfo[]> {
  const contract = getContract(provider);
  const count = (await contract.getMaterialTransferCount()) as bigint;
  const countNum = Number(count);
  const transfers: MaterialTransferInfo[] = [];
  for (let i = 1; i <= countNum; i++) {
    const result = (await contract.getMaterialTransfer(i)) as [
      bigint,
      bigint,
      bigint,
      string,
      string,
      bigint,
      bigint,
      number,
      boolean,
      boolean,
      bigint,
      bigint,
      bigint,
      boolean,
    ];

    if (result[13]) {
      transfers.push({
        id: result[0],
        materialId: result[1],
        batchId: result[2],
        sender: result[3],
        receiver: result[4],
        declaredQuantityGrams: result[5],
        receivedQuantityGrams: result[6],
        status: Number(result[7]),
        senderApproved: result[8],
        receiverApproved: result[9],
        createdAt: result[10],
        receivedAt: result[11],
        confirmedAt: result[12],
        exists: result[13],
      });
    }
  }
  return transfers;
}

export async function getMaterialConfirmedCustody(
  provider: BrowserProvider,
  materialId: number,
  wallet: string
): Promise<bigint> {
  const contract = getContract(provider);
  return (await contract.getMaterialConfirmedCustody(materialId, wallet)) as bigint;
}

export async function getMaterialPendingOutgoing(
  provider: BrowserProvider,
  materialId: number,
  wallet: string
): Promise<bigint> {
  const contract = getContract(provider);
  return (await contract.getMaterialPendingOutgoing(materialId, wallet)) as bigint;
}

export async function getMaterialAvailableCustody(
  provider: BrowserProvider,
  materialId: number,
  wallet: string
): Promise<bigint> {
  const contract = getContract(provider);
  return (await contract.getMaterialAvailableCustody(materialId, wallet)) as bigint;
}

export async function getMaterialProcessingRecordInfo(
  provider: BrowserProvider,
  recordId: number
): Promise<MaterialProcessingRecordInfo> {
  const contract = getContract(provider);
  const result = (await contract.getMaterialProcessingRecord(recordId)) as [
    bigint,
    bigint,
    bigint,
    string,
    bigint,
    bigint,
    boolean,
  ];

  return {
    id: result[0],
    materialId: result[1],
    batchId: result[2],
    processor: result[3],
    inputQuantityGrams: result[4],
    processedAt: result[5],
    exists: result[6],
  };
}

export async function getMaterialProcessingRecordCount(provider: BrowserProvider): Promise<number> {
  const contract = getContract(provider);
  const count = (await contract.getMaterialProcessingRecordCount()) as bigint;
  return Number(count);
}

export async function getAllMaterialProcessingRecords(provider: BrowserProvider): Promise<MaterialProcessingRecordInfo[]> {
  const contract = getContract(provider);
  const count = (await contract.getMaterialProcessingRecordCount()) as bigint;
  const countNum = Number(count);
  const records: MaterialProcessingRecordInfo[] = [];
  for (let i = 1; i <= countNum; i++) {
    const result = (await contract.getMaterialProcessingRecord(i)) as [
      bigint,
      bigint,
      bigint,
      string,
      bigint,
      bigint,
      boolean,
    ];

    if (result[6]) {
      records.push({
        id: result[0],
        materialId: result[1],
        batchId: result[2],
        processor: result[3],
        inputQuantityGrams: result[4],
        processedAt: result[5],
        exists: result[6],
      });
    }
  }
  return records;
}

const CHUNK_SIZE = 9000;

export async function getBatchHistoryEvents(
  provider: BrowserProvider,
  batchId: number,
  ewasteTransferIds: number[],
  materialTransferIds: number[],
): Promise<BatchHistoryEventInfo[]> {
  const contract = getContract(provider);
  const events: BatchHistoryEventInfo[] = [];

  const blockTimestampCache = new Map<number, number>();
  async function getBlockTimestamp(blockNum: number): Promise<number> {
    if (blockTimestampCache.has(blockNum)) return blockTimestampCache.get(blockNum)!;
    const block = await provider.getBlock(blockNum);
    const ts = block ? Number(block.timestamp) : 0;
    blockTimestampCache.set(blockNum, ts);
    return ts;
  }

  async function processEvent(
    log: EventLog,
    kind: BatchHistoryEventInfo["kind"],
    transferId: number | null,
  ): Promise<void> {
    const blockNum = log.blockNumber;
    let timestamp = 0;
    try {
      timestamp = await getBlockTimestamp(blockNum);
    } catch {
      // leave as 0 if block fetch fails
    }
    events.push({
      kind,
      batchId,
      transferId,
      txHash: log.transactionHash || "",
      blockNumber: blockNum,
      timestamp,
    });
  }

  let currentBlock = 0;
  try {
    currentBlock = await provider.getBlockNumber();
  } catch {
    return events;
  }

  async function queryInChunks(
    filter: unknown,
    fromBlock: number,
    toBlock: number,
  ): Promise<EventLog[]> {
    const allLogs: EventLog[] = [];
    for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE - 1, toBlock);
      try {
        const logs = (await contract.queryFilter(filter as never, start, end)) as EventLog[];
        allLogs.push(...logs);
      } catch {
        // individual chunk failure — keep results from successful chunks
      }
    }
    return allLogs;
  }

  try {
    const cancelledFilter = contract.filters.TransferCancelled();
    const cancelledLogs = await queryInChunks(cancelledFilter, 0, currentBlock);
    for (const log of cancelledLogs) {
      const transferId = Number(log.args[0]);
      if (!ewasteTransferIds.includes(transferId)) continue;
      await processEvent(log, "TransferCancelled", transferId);
    }
  } catch {
    // RPC query failed entirely
  }

  try {
    const matCancelledFilter = contract.filters.MaterialTransferCancelled();
    const matCancelledLogs = await queryInChunks(matCancelledFilter, 0, currentBlock);
    for (const log of matCancelledLogs) {
      const transferId = Number(log.args[0]);
      if (!materialTransferIds.includes(transferId)) continue;
      await processEvent(log, "MaterialTransferCancelled", transferId);
    }
  } catch {
    // RPC query failed entirely
  }

  try {
    const completedFilter = contract.filters.BatchCompleted(batchId);
    const completedLogs = await queryInChunks(completedFilter, 0, currentBlock);
    for (const log of completedLogs) {
      const processor = (log.args as unknown as [bigint, string, bigint])[1];
      await processEvent(log, "BatchCompleted", null);
      const lastIdx = events.length - 1;
      if (lastIdx >= 0 && events[lastIdx].kind === "BatchCompleted") {
        events[lastIdx].processor = processor;
      }
    }
  } catch {
    // RPC query failed entirely
  }

  return events;
}
