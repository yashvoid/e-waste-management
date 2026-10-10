import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, Contract, parseUnits } from "ethers";
import { ROLE_LABELS, ROLE_OPTIONS, isConfigured, contractConfig } from "./config";
import { useWallet, useBalance } from "./useWallet";
import {
  getParticipantInfo,
  getBatchInfo,
  getBatchCount,
  getAllTransfers,
  getAvailableCustody,
  getPendingOutgoing,
  getConfirmedCustody,
  getAllMaterials,
  getMaterialCount,
  getAllMaterialTransfers,
  getMaterialTransferCount,
  getMaterialAvailableCustody,
  getAllMaterialProcessingRecords,
  getMaterialProcessingRecordCount,
  getAllProcessingEvents,
  getProcessingEventCount,
  getBatchHistoryEvents,
} from "./contract";
import type { ParticipantInfo, BatchInfo, TransferInfo, RecoveredMaterialInfo, MaterialTransferInfo, MaterialProcessingRecordInfo, ProcessingEventInfo, BatchHistoryEventInfo, TxStatus } from "./types";
import { GRAMS_PER_KG, TRANSFER_STATUS, TRANSFER_STATUS_LABELS } from "./types";
import { useParticipantCache, type ParticipantNameInfo } from "./useParticipantCache";

const ROLE_GENERATOR = 0;
const ROLE_COLLECTOR = 1;
const ROLE_TRANSPORTER = 2;
const ROLE_RECYCLER = 3;
const ROLE_MATERIAL_PROCESSOR = 4;
const BATCH_STATUS_ACTIVE = 0;

const VALID_RECEIVER_ROLES: Record<number, string[]> = {
  [ROLE_GENERATOR]: ["Collector"],
  [ROLE_COLLECTOR]: ["Transporter"],
  [ROLE_TRANSPORTER]: ["Recycler"],
};

export default function App() {
  const { wallet, state, error, isCorrectNetwork, connect } = useWallet();
  const balance = useBalance(wallet);

  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
  const [loadingParticipant, setLoadingParticipant] = useState(false);

  const [orgName, setOrgName] = useState("");
  const [selectedRole, setSelectedRole] = useState<number>(0);
  const [regTxStatus, setRegTxStatus] = useState<TxStatus>({ state: "idle", message: "" });

  const [batchQtyKg, setBatchQtyKg] = useState("");
  const [batchTxStatus, setBatchTxStatus] = useState<TxStatus>({ state: "idle", message: "" });
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [batchCount, setBatchCount] = useState(0);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const [transfers, setTransfers] = useState<TransferInfo[]>([]);
  const [transferCount, setTransferCount] = useState(0);
  const [loadingTransfers, setLoadingTransfers] = useState(false);

  const [transferTxStatus, setTransferTxStatus] = useState<TxStatus>({ state: "idle", message: "" });

  const [materials, setMaterials] = useState<RecoveredMaterialInfo[]>([]);
  const [materialCount, setMaterialCount] = useState(0);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  const [materialTransfers, setMaterialTransfers] = useState<MaterialTransferInfo[]>([]);
  const [materialTransferCount, setMaterialTransferCount] = useState(0);
  const [loadingMaterialTransfers, setLoadingMaterialTransfers] = useState(false);

  const [processingRecords, setProcessingRecords] = useState<MaterialProcessingRecordInfo[]>([]);
  const [processingRecordCount, setProcessingRecordCount] = useState(0);
  const [loadingProcessingRecords, setLoadingProcessingRecords] = useState(false);

  const [ewasteProcessingEvents, setEwasteProcessingEvents] = useState<ProcessingEventInfo[]>([]);
  const [ewasteProcessingEventCount, setEwasteProcessingEventCount] = useState(0);
  const [loadingEwasteProcessingEvents, setLoadingEwasteProcessingEvents] = useState(false);

  const [historyBatchId, setHistoryBatchId] = useState<number | null>(null);

  const participantCache = useParticipantCache(wallet ? wallet.provider : null);

  useEffect(() => {
    if (!wallet) return;
    const addresses = new Set<string>();
    batches.forEach((b) => addresses.add(b.generator));
    transfers.forEach((t) => { addresses.add(t.sender); addresses.add(t.receiver); });
    materials.forEach((m) => addresses.add(m.recycler));
    materialTransfers.forEach((t) => { addresses.add(t.sender); addresses.add(t.receiver); });
    processingRecords.forEach((r) => addresses.add(r.processor));
    ewasteProcessingEvents.forEach((e) => addresses.add(e.recycler));
    addresses.forEach((addr) => participantCache.ensureParticipant(addr));
  }, [wallet, batches, transfers, materials, materialTransfers, processingRecords, ewasteProcessingEvents, participantCache]);

  const isGenerator = participant?.isRegistered === true && participant.role === ROLE_GENERATOR;
  const isCollector = participant?.isRegistered === true && participant.role === ROLE_COLLECTOR;
  const isTransporter = participant?.isRegistered === true && participant.role === ROLE_TRANSPORTER;
  const isRecycler = participant?.isRegistered === true && participant.role === ROLE_RECYCLER;
  const isMaterialProcessor = participant?.isRegistered === true && participant.role === ROLE_MATERIAL_PROCESSOR;
  const canCreateEwasteTransfers = isGenerator || isCollector || isTransporter;

  const fetchParticipant = useCallback(async () => {
    if (!wallet) return;
    setLoadingParticipant(true);
    try {
      const info = await getParticipantInfo(wallet.provider, wallet.address);
      setParticipant(info);
    } catch {
      setParticipant(null);
    } finally {
      setLoadingParticipant(false);
    }
  }, [wallet]);

  const fetchBatches = useCallback(async () => {
    if (!wallet) return;
    setLoadingBatches(true);
    try {
      const count = await getBatchCount(wallet.provider);
      setBatchCount(count);
      const loaded: BatchInfo[] = [];
      for (let i = 1; i <= count; i++) {
        const batch = await getBatchInfo(wallet.provider, i);
        if (batch.exists) {
          loaded.push(batch);
        }
      }
      loaded.sort((a, b) => Number(b.id) - Number(a.id));
      setBatches(loaded);
    } catch {
      setBatches([]);
      setBatchCount(0);
    } finally {
      setLoadingBatches(false);
    }
  }, [wallet]);

  const fetchTransfers = useCallback(async () => {
    if (!wallet) return;
    setLoadingTransfers(true);
    try {
      const all = await getAllTransfers(wallet.provider);
      all.sort((a, b) => Number(b.id) - Number(a.id));
      setTransfers(all);
      setTransferCount(all.length);
    } catch {
      setTransfers([]);
      setTransferCount(0);
    } finally {
      setLoadingTransfers(false);
    }
  }, [wallet]);

  const fetchMaterials = useCallback(async () => {
    if (!wallet) return;
    setLoadingMaterials(true);
    try {
      const count = await getMaterialCount(wallet.provider);
      setMaterialCount(count);
      const all = await getAllMaterials(wallet.provider);
      all.sort((a, b) => Number(b.id) - Number(a.id));
      setMaterials(all);
    } catch {
      setMaterials([]);
      setMaterialCount(0);
    } finally {
      setLoadingMaterials(false);
    }
  }, [wallet]);

  const fetchMaterialTransfers = useCallback(async () => {
    if (!wallet) return;
    setLoadingMaterialTransfers(true);
    try {
      const count = await getMaterialTransferCount(wallet.provider);
      setMaterialTransferCount(count);
      const all = await getAllMaterialTransfers(wallet.provider);
      all.sort((a, b) => Number(b.id) - Number(a.id));
      setMaterialTransfers(all);
    } catch {
      setMaterialTransfers([]);
      setMaterialTransferCount(0);
    } finally {
      setLoadingMaterialTransfers(false);
    }
  }, [wallet]);

  const fetchProcessingRecords = useCallback(async () => {
    if (!wallet) return;
    setLoadingProcessingRecords(true);
    try {
      const count = await getMaterialProcessingRecordCount(wallet.provider);
      setProcessingRecordCount(count);
      const all = await getAllMaterialProcessingRecords(wallet.provider);
      all.sort((a, b) => Number(b.id) - Number(a.id));
      setProcessingRecords(all);
    } catch {
      setProcessingRecords([]);
      setProcessingRecordCount(0);
    } finally {
      setLoadingProcessingRecords(false);
    }
  }, [wallet]);

  const fetchEwasteProcessingEvents = useCallback(async () => {
    if (!wallet) return;
    setLoadingEwasteProcessingEvents(true);
    try {
      const count = await getProcessingEventCount(wallet.provider);
      setEwasteProcessingEventCount(count);
      const all = await getAllProcessingEvents(wallet.provider);
      all.sort((a, b) => Number(b.id) - Number(a.id));
      setEwasteProcessingEvents(all);
    } catch {
      setEwasteProcessingEvents([]);
      setEwasteProcessingEventCount(0);
    } finally {
      setLoadingEwasteProcessingEvents(false);
    }
  }, [wallet]);

  useEffect(() => {
    if (wallet && isCorrectNetwork) {
      fetchParticipant();
      fetchBatches();
      fetchTransfers();
      fetchMaterials();
      fetchMaterialTransfers();
      fetchProcessingRecords();
      fetchEwasteProcessingEvents();
    } else {
      setParticipant(null);
      setBatches([]);
      setBatchCount(0);
      setTransfers([]);
      setTransferCount(0);
      setMaterials([]);
      setMaterialCount(0);
      setMaterialTransfers([]);
      setMaterialTransferCount(0);
      setProcessingRecords([]);
      setProcessingRecordCount(0);
      setEwasteProcessingEvents([]);
      setEwasteProcessingEventCount(0);
    }
  }, [wallet, isCorrectNetwork, fetchParticipant, fetchBatches, fetchTransfers, fetchMaterials, fetchMaterialTransfers, fetchProcessingRecords, fetchEwasteProcessingEvents]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchBatches(), fetchTransfers(), fetchMaterials(), fetchMaterialTransfers(), fetchProcessingRecords(), fetchEwasteProcessingEvents()]);
  }, [fetchBatches, fetchTransfers, fetchMaterials, fetchMaterialTransfers, fetchProcessingRecords, fetchEwasteProcessingEvents]);

  const handleRegister = async () => {
    if (!wallet) return;
    if (!orgName.trim()) {
      setRegTxStatus({ state: "failed", message: "Organization name cannot be empty." });
      return;
    }

    setRegTxStatus({ state: "preparing", message: "Preparing transaction..." });

    try {
      const signer = await wallet.provider.getSigner();
      setRegTxStatus({ state: "pending", message: "Waiting for wallet confirmation..." });

      const txHash = await registerParticipantOnChain(signer, orgName.trim(), selectedRole);

      setRegTxStatus({
        state: "confirmed",
        message: "Registration confirmed.",
        txHash,
      });

      setOrgName("");
      await fetchParticipant();
    } catch (err) {
      handleTxError(err, setRegTxStatus);
    }
  };

  const handleCreateBatch = async () => {
    if (!wallet) return;

    const grams = kgToGrams(batchQtyKg);
    if (grams === null) {
      setBatchTxStatus({ state: "failed", message: "Enter a valid quantity in kilograms (greater than zero)." });
      return;
    }

    setBatchTxStatus({ state: "preparing", message: "Preparing transaction..." });

    try {
      const signer = await wallet.provider.getSigner();
      setBatchTxStatus({ state: "pending", message: "Waiting for wallet confirmation..." });

      const txHash = await createBatchOnChain(signer, grams);

      setBatchTxStatus({
        state: "confirmed",
        message: "Batch created.",
        txHash,
      });

      setBatchQtyKg("");
      await refreshAll();
    } catch (err) {
      handleTxError(err, setBatchTxStatus);
    }
  };

  if (!isConfigured()) {
    return <ConfigMissingBanner />;
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>E-Waste Management Tracking System</h1>
        <p style={styles.subtitle}>Decentralized Traceability Ledger</p>

        {error && <div style={styles.errorBox}>{error}</div>}

        {!wallet && (
          <div style={styles.section}>
            <p style={styles.statusText}>Wallet not connected</p>
            <button
              style={styles.button}
              onClick={connect}
              disabled={state === "connecting"}
            >
              {state === "connecting" ? "Connecting..." : "Connect MetaMask"}
            </button>
          </div>
        )}

        {wallet && (
          <>
            <div style={styles.walletBox}>
              <div style={styles.walletRow}>
                <span style={styles.label}>Wallet Address</span>
                <span style={styles.mono}>{wallet.address}</span>
              </div>
              <div style={styles.walletRow}>
                <span style={styles.label}>Balance</span>
                <span>{balance} ETH</span>
              </div>
              <div style={styles.walletRow}>
                <span style={styles.label}>Network</span>
                <span style={isCorrectNetwork ? styles.ok : styles.bad}>
                  {isCorrectNetwork ? "Sepolia" : `Wrong network (chain ID: ${wallet.chainId})`}
                </span>
              </div>
            </div>

            {!isCorrectNetwork && (
              <div style={styles.warnBox}>
                Please switch to Ethereum Sepolia testnet in MetaMask.
              </div>
            )}

            {isCorrectNetwork && (
              <>
                {loadingParticipant && <p style={styles.statusText}>Loading participant info...</p>}

                {participant && participant.isRegistered && (
                  <div style={styles.registeredBox}>
                    <h2 style={styles.h2}>Registered Participant</h2>
                    <div style={styles.walletRow}>
                      <span style={styles.label}>Organization</span>
                      <span>{participant.name}</span>
                    </div>
                    <div style={styles.walletRow}>
                      <span style={styles.label}>Role</span>
                      <span>{ROLE_LABELS[participant.role] ?? "Unknown"}</span>
                    </div>
                    <div style={styles.walletRow}>
                      <span style={styles.label}>Registered At</span>
                      <span>
                        {new Date(Number(participant.registeredAt) * 1000).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {isCorrectNetwork && !loadingParticipant && (!participant || !participant.isRegistered) && (
                  <div style={styles.section}>
                    <h2 style={styles.h2}>Register Your Organization</h2>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Organization Name</label>
                      <input
                        type="text"
                        style={styles.input}
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Enter your organization name"
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Role</label>
                      <select
                        style={styles.select}
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(Number(e.target.value))}
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      style={{
                        ...styles.button,
                        ...(isTxInProgress(regTxStatus) ? styles.buttonDisabled : {}),
                      }}
                      onClick={handleRegister}
                      disabled={isTxInProgress(regTxStatus)}
                    >
                      {regTxStatus.state === "preparing"
                        ? "Preparing..."
                        : regTxStatus.state === "pending"
                        ? "Waiting for confirmation..."
                        : "Register on Blockchain"}
                    </button>
                    <TxStatusBox txStatus={regTxStatus} />
                  </div>
                )}

                {isGenerator && (
                  <div style={styles.section}>
                    <h2 style={styles.h2}>Create E-Waste Batch</h2>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>Quantity (kilograms)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        style={styles.input}
                        value={batchQtyKg}
                        onChange={(e) => setBatchQtyKg(e.target.value)}
                        placeholder="e.g. 500"
                      />
                      <p style={styles.hint}>
                        {batchQtyKg && kgToGrams(batchQtyKg) !== null
                          ? `= ${kgToGrams(batchQtyKg)!.toLocaleString()} grams`
                          : "Enter a positive number of kilograms"}
                      </p>
                    </div>
                    <button
                      style={{
                        ...styles.button,
                        ...styles.buttonGreen,
                        ...(isTxInProgress(batchTxStatus) ? styles.buttonDisabled : {}),
                      }}
                      onClick={handleCreateBatch}
                      disabled={isTxInProgress(batchTxStatus)}
                    >
                      {batchTxStatus.state === "preparing"
                        ? "Preparing..."
                        : batchTxStatus.state === "pending"
                        ? "Waiting for confirmation..."
                        : "Create Batch"}
                    </button>
                    <TxStatusBox txStatus={batchTxStatus} />
                  </div>
                )}

                {participant?.isRegistered && (
                  <BatchesSection
                    batches={batches}
                    batchCount={batchCount}
                    loadingBatches={loadingBatches}
                    participantCache={participantCache}
                    onViewHistory={(id) => setHistoryBatchId(id)}
                  />
                )}

                {(isCollector || isTransporter || isRecycler) && (
                  <BatchCustodySection
                    wallet={wallet}
                    participant={participant}
                    batches={batches}
                    loadingBatches={loadingBatches}
                  />
                )}

                {canCreateEwasteTransfers && (
                  <CreateTransferSection
                    wallet={wallet}
                    participant={participant}
                    batches={batches}
                    transferTxStatus={transferTxStatus}
                    setTransferTxStatus={setTransferTxStatus}
                    onSuccess={refreshAll}
                  />
                )}

                {(isGenerator || isCollector || isTransporter || isRecycler) && (
                  <TransfersSection
                    wallet={wallet}
                    participant={participant}
                    transfers={transfers}
                    loadingTransfers={loadingTransfers}
                    transferCount={transferCount}
                    onRefresh={refreshAll}
                    participantCache={participantCache}
                  />
                )}




                {isRecycler && (
                  <ProcessEwasteSection
                    wallet={wallet}
                    batches={batches}
                    onSuccess={refreshAll}
                  />
                )}

                {(isRecycler || isMaterialProcessor) && (
                  <MaterialsSection
                    wallet={wallet}
                    materials={materials}
                    materialCount={materialCount}
                    loadingMaterials={loadingMaterials}
                    participant={participant}
                    participantCache={participantCache}
                  />
                )}

                {isRecycler && (
                  <CreateMaterialTransferSection
                    wallet={wallet}
                    materials={materials}
                    onSuccess={refreshAll}
                  />
                )}

                {(isRecycler || isMaterialProcessor) && (
                  <MaterialTransfersSection
                    wallet={wallet}
                    participant={participant}
                    materialTransfers={materialTransfers}
                    loadingMaterialTransfers={loadingMaterialTransfers}
                    materialTransferCount={materialTransferCount}
                    onRefresh={refreshAll}
                    participantCache={participantCache}
                  />
                )}

                {isMaterialProcessor && (
                  <ProcessMaterialSection
                    wallet={wallet}
                    materials={materials}
                    batches={batches}
                    onSuccess={refreshAll}
                  />
                )}

                {isMaterialProcessor && (
                  <ProcessingHistorySection
                    processingRecords={processingRecords}
                    processingRecordCount={processingRecordCount}
                    loadingProcessingRecords={loadingProcessingRecords}
                    participantCache={participantCache}
                  />
                )}

                {historyBatchId !== null && wallet && (
                  <BatchHistoryView
                    batchId={historyBatchId}
                    batches={batches}
                    transfers={transfers}
                    materials={materials}
                    materialTransfers={materialTransfers}
                    processingRecords={processingRecords}
                    ewasteProcessingEvents={ewasteProcessingEvents}
                    participantCache={participantCache}
                    provider={wallet.provider}
                    onBack={() => setHistoryBatchId(null)}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Batches table
// ---------------------------------------------------------------------------

function BatchesSection({
  batches,
  batchCount,
  loadingBatches,
  participantCache,
  onViewHistory,
}: {
  batches: BatchInfo[];
  batchCount: number;
  loadingBatches: boolean;
  participantCache: ReturnType<typeof useParticipantCache>;
  onViewHistory: (id: number) => void;
}) {
  if (loadingBatches) {
    return (
      <div style={styles.section}>
        <h2 style={styles.h2}>E-Waste Batches</h2>
        <p style={styles.statusText}>Loading batches...</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h2 style={styles.h2}>E-Waste Batches ({batchCount})</h2>
      {batches.length === 0 ? (
        <p style={styles.statusText}>No batches have been created yet.</p>
      ) : (
        <div style={styles.tableWrap}>
          <div style={styles.tableHead}>
            <span style={styles.colId}>ID</span>
            <span style={styles.colFlex}>Generator</span>
            <span style={styles.colQty}>Original</span>
            <span style={styles.colQty}>Available</span>
            <span style={styles.colQty}>Pending</span>
            <span style={styles.colStatus}>Status</span>
            <span style={styles.colDate}>Created</span>
            <span style={styles.colAction}>Actions</span>
          </div>
          {batches.map((batch) => (
            <div key={Number(batch.id)} style={styles.tableRow}>
              <span style={styles.colId}>#{Number(batch.id)}</span>
              <span style={styles.colFlex}>
                <ParticipantNameDisplay
                  address={batch.generator}
                  info={participantCache.getParticipant(batch.generator)}
                />
              </span>
              <span style={styles.colQty}>{formatGrams(batch.originalQuantityGrams)}</span>
              <span style={styles.colQty}>{formatGrams(batch.availableQuantityGrams)}</span>
              <span style={styles.colQty}>{formatGrams(batch.pendingQuantityGrams)}</span>
              <span style={styles.colStatus}>
                <span style={batch.status === BATCH_STATUS_ACTIVE ? styles.statusActive : styles.statusDone}>
                  {batch.status === BATCH_STATUS_ACTIVE ? "Active" : "Completed"}
                </span>
              </span>
              <span style={styles.colDate}>{formatDate(batch.createdAt)}</span>
              <span style={styles.colAction}>
                <button
                  style={{ ...styles.buttonSmall, ...styles.buttonSecondary }}
                  onClick={() => onViewHistory(Number(batch.id))}
                >
                  View History
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custody display per batch
// ---------------------------------------------------------------------------

function BatchCustodySection({
  wallet,
  batches,
  loadingBatches,
}: {
  wallet: { address: string; provider: BrowserProvider };
  participant: ParticipantInfo;
  batches: BatchInfo[];
  loadingBatches: boolean;
}) {
  const [custodyData, setCustodyData] = useState<Record<number, { confirmed: bigint; pending: bigint; available: bigint }>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data: Record<number, { confirmed: bigint; pending: bigint; available: bigint }> = {};
      for (const batch of batches) {
        const batchId = Number(batch.id);
        try {
          const [confirmed, pending, available] = await Promise.all([
            getConfirmedCustody(wallet.provider, batchId, wallet.address),
            getPendingOutgoing(wallet.provider, batchId, wallet.address),
            getAvailableCustody(wallet.provider, batchId, wallet.address),
          ]);
          data[batchId] = { confirmed, pending, available };
        } catch {
          // skip
        }
      }
      if (!cancelled) setCustodyData(data);
    }
    load();
    return () => { cancelled = true; };
  }, [wallet, batches]);

  if (loadingBatches) return null;
  if (batches.length === 0) return null;

  return (
    <div style={styles.section}>
      <h2 style={styles.h2}>My Custody</h2>
      {batches.map((batch) => {
        const cd = custodyData[Number(batch.id)];
        const hasCustody = cd && (cd.confirmed > 0n || cd.pending > 0n);
        if (!hasCustody) return null;
        return (
          <div key={Number(batch.id)} style={styles.custodyCard}>
            <div style={styles.custodyHeader}>
              <span style={styles.batchId}>Batch #{Number(batch.id)}</span>
            </div>
            <div style={styles.batchRow}>
              <span style={styles.label}>Confirmed</span>
              <span>{cd ? formatGrams(cd.confirmed) : "..."}</span>
            </div>
            <div style={styles.batchRow}>
              <span style={styles.label}>Pending outgoing</span>
              <span>{cd ? formatGrams(cd.pending) : "..."}</span>
            </div>
            <div style={styles.batchRow}>
              <span style={styles.label}>Available</span>
              <span>{cd ? formatGrams(cd.available) : "..."}</span>
            </div>
          </div>
        );
      })}
      {Object.values(custodyData).every((cd) => cd.confirmed === 0n && cd.pending === 0n) && (
        <p style={styles.statusText}>You do not hold custody in any batch.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Transfer
// ---------------------------------------------------------------------------

function CreateTransferSection({
  wallet,
  participant,
  batches,
  transferTxStatus,
  setTransferTxStatus,
  onSuccess,
}: {
  wallet: { address: string; provider: BrowserProvider };
  participant: ParticipantInfo;
  batches: BatchInfo[];
  transferTxStatus: TxStatus;
  setTransferTxStatus: (s: TxStatus) => void;
  onSuccess: () => Promise<void>;
}) {
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [receiverAddress, setReceiverAddress] = useState<string>("");
  const [qtyKg, setQtyKg] = useState<string>("");
  const [availableCustody, setAvailableCustody] = useState<bigint | null>(null);

  const eligibleBatches = batches.filter((b) => b.status === BATCH_STATUS_ACTIVE);

  const canCreateTransfers = VALID_RECEIVER_ROLES[participant.role] !== undefined;

  useEffect(() => {
    let cancelled = false;
    async function loadCustody() {
      if (!selectedBatchId) {
        setAvailableCustody(null);
        return;
      }
      try {
        const custody = await getAvailableCustody(
          wallet.provider,
          Number(selectedBatchId),
          wallet.address
        );
        if (!cancelled) setAvailableCustody(custody);
      } catch {
        if (!cancelled) setAvailableCustody(null);
      }
    }
    loadCustody();
    return () => { cancelled = true; };
  }, [wallet, selectedBatchId]);

  const handleSubmit = async () => {
    if (!wallet) return;

    if (!selectedBatchId) {
      setTransferTxStatus({ state: "failed", message: "Select a batch." });
      return;
    }
    if (!receiverAddress.trim()) {
      setTransferTxStatus({ state: "failed", message: "Enter the receiver's wallet address." });
      return;
    }
    const grams = kgToGrams(qtyKg);
    if (grams === null) {
      setTransferTxStatus({ state: "failed", message: "Enter a valid quantity in kilograms." });
      return;
    }

    setTransferTxStatus({ state: "preparing", message: "Preparing transaction..." });

    try {
      const signer = await wallet.provider.getSigner();
      setTransferTxStatus({ state: "pending", message: "Waiting for wallet confirmation..." });

      const txHash = await createTransferOnChain(
        signer,
        Number(selectedBatchId),
        receiverAddress.trim(),
        grams
      );

      setTransferTxStatus({
        state: "confirmed",
        message: "Transfer created.",
        txHash,
      });

      setSelectedBatchId("");
      setReceiverAddress("");
      setQtyKg("");
      setAvailableCustody(null);
      await onSuccess();
    } catch (err) {
      handleTxError(err, setTransferTxStatus);
    }
  };

  if (!canCreateTransfers) {
    return null;
  }

  return (
    <div style={styles.section}>
      <h2 style={styles.h2}>Create Transfer</h2>

      {eligibleBatches.length === 0 ? (
        <p style={styles.statusText}>No active batches available for transfer.</p>
      ) : (
        <>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Batch</label>
            <select
              style={styles.select}
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
            >
              <option value="">Select a batch</option>
              {eligibleBatches.map((batch) => (
                <option key={Number(batch.id)} value={String(batch.id)}>
                  Batch #{Number(batch.id)} ({formatGrams(batch.originalQuantityGrams)})
                </option>
              ))}
            </select>
          </div>

          {selectedBatchId && availableCustody !== null && (
            <p style={styles.hint}>
              Your available quantity in this batch: {formatGrams(availableCustody)}
            </p>
          )}

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>
              Receiver wallet address
            </label>
            <input
              type="text"
              style={styles.input}
              value={receiverAddress}
              onChange={(e) => setReceiverAddress(e.target.value)}
              placeholder="0x..."
            />
            <p style={styles.hint}>
              Must be a registered {VALID_RECEIVER_ROLES[participant.role]?.join(" or ")}
            </p>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Quantity (kilograms)</label>
            <input
              type="text"
              inputMode="decimal"
              style={styles.input}
              value={qtyKg}
              onChange={(e) => setQtyKg(e.target.value)}
              placeholder="e.g. 100"
            />
            <p style={styles.hint}>
              {qtyKg && kgToGrams(qtyKg) !== null
                ? `= ${kgToGrams(qtyKg)!.toLocaleString()} grams`
                : "Enter a positive number of kilograms"}
            </p>
          </div>

          <button
            style={{
              ...styles.button,
              ...styles.buttonBlue,
              ...(isTxInProgress(transferTxStatus) ? styles.buttonDisabled : {}),
            }}
            onClick={handleSubmit}
            disabled={isTxInProgress(transferTxStatus)}
          >
            {transferTxStatus.state === "preparing"
              ? "Preparing..."
              : transferTxStatus.state === "pending"
              ? "Waiting for confirmation..."
              : "Create Transfer"}
          </button>
          <TxStatusBox txStatus={transferTxStatus} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transfers list with actions
// ---------------------------------------------------------------------------

function TransfersSection({
  wallet,
  participant,
  transfers,
  loadingTransfers,
  transferCount,
  onRefresh,
  participantCache,
}: {
  wallet: { address: string; provider: BrowserProvider };
  participant: ParticipantInfo;
  transfers: TransferInfo[];
  loadingTransfers: boolean;
  transferCount: number;
  onRefresh: () => Promise<void>;
  participantCache: ReturnType<typeof useParticipantCache>;
}) {
  const [actionTxStatus, setActionTxStatus] = useState<TxStatus>({ state: "idle", message: "" });
  const [dirFilter, setDirFilter] = useState<"all" | "incoming" | "outgoing">("all");
  const [statusFilter, setStatusFilter] = useState<number | "all">("all");

  const walletAddr = wallet.address.toLowerCase();

  const filtered = transfers.filter((t) => {
    if (dirFilter === "incoming" && t.receiver.toLowerCase() !== walletAddr) return false;
    if (dirFilter === "outgoing" && t.sender.toLowerCase() !== walletAddr) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });

  if (loadingTransfers) {
    return (
      <div style={styles.section}>
        <h2 style={styles.h2}>E-Waste Transfers</h2>
        <p style={styles.statusText}>Loading transfers...</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h2 style={styles.h2}>E-Waste Transfers ({transferCount})</h2>

      {transfers.length > 0 && (
        <div style={styles.filterBar}>
          <div style={styles.filterGroup}>
            {(["all", "incoming", "outgoing"] as const).map((d) => (
              <button
                key={d}
                style={dirFilter === d ? styles.filterBtnActive : styles.filterBtn}
                onClick={() => setDirFilter(d)}
              >
                {d === "all" ? "All" : d === "incoming" ? "Incoming" : "Outgoing"}
              </button>
            ))}
          </div>
          <div style={styles.filterGroup}>
            <button
              style={statusFilter === "all" ? styles.filterBtnActive : styles.filterBtn}
              onClick={() => setStatusFilter("all")}
            >
              All Statuses
            </button>
            {Object.values(TRANSFER_STATUS).map((s) => (
              <button
                key={s}
                style={statusFilter === s ? styles.filterBtnActive : styles.filterBtn}
                onClick={() => setStatusFilter(s)}
              >
                {TRANSFER_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      <TxStatusBox txStatus={actionTxStatus} />

      {transfers.length === 0 ? (
        <p style={styles.statusText}>No transfers found.</p>
      ) : filtered.length === 0 ? (
        <p style={styles.statusText}>No transfers match the selected filters.</p>
      ) : (
        <div style={styles.tableWrap}>
          <div style={styles.tableHead}>
            <span style={styles.colId}>ID</span>
            <span style={styles.colFlex}>From / To</span>
            <span style={styles.colQty}>Declared</span>
            <span style={styles.colQty}>Received</span>
            <span style={styles.colQty}>Diff</span>
            <span style={styles.colStatus}>Status</span>
            <span style={styles.colDate}>Created</span>
          </div>
          {filtered.map((transfer) => (
            <TransferRow
              key={Number(transfer.id)}
              transfer={transfer}
              wallet={wallet}
              actionTxStatus={actionTxStatus}
              setActionTxStatus={setActionTxStatus}
              onRefresh={onRefresh}
              participantCache={participantCache}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TransferRow({
  transfer,
  wallet,
  actionTxStatus,
  setActionTxStatus,
  onRefresh,
  participantCache,
}: {
  transfer: TransferInfo;
  wallet: { address: string; provider: BrowserProvider };
  actionTxStatus: TxStatus;
  setActionTxStatus: (s: TxStatus) => void;
  onRefresh: () => Promise<void>;
  participantCache: ReturnType<typeof useParticipantCache>;
}) {
  const [receiveQtyKg, setReceiveQtyKg] = useState<string>("");
  const [expanded, setExpanded] = useState(false);

  const isSender = transfer.sender.toLowerCase() === wallet.address.toLowerCase();
  const isReceiver = transfer.receiver.toLowerCase() === wallet.address.toLowerCase();
  const status = transfer.status;
  const statusLabel = TRANSFER_STATUS_LABELS[status] ?? "Unknown";

  const canReceive = isReceiver && status === TRANSFER_STATUS.Pending;
  const canApproveSender = isSender && status === TRANSFER_STATUS.Received && !transfer.senderApproved;
  const canApproveReceiver = isReceiver && status === TRANSFER_STATUS.Received && !transfer.receiverApproved;
  const canCancel = isSender && status === TRANSFER_STATUS.Pending;
  const hasActions = canReceive || canApproveSender || canApproveReceiver || canCancel;
  const isParty = isSender || isReceiver;

  const handleReceive = async () => {
    const grams = kgToGrams(receiveQtyKg);
    if (grams === null) {
      setActionTxStatus({ state: "failed", message: "Enter a valid received quantity in kilograms." });
      return;
    }
    if (grams > Number(transfer.declaredQuantityGrams)) {
      setActionTxStatus({ state: "failed", message: "Received quantity cannot exceed declared quantity." });
      return;
    }
    setActionTxStatus({ state: "preparing", message: "Preparing transaction..." });
    try {
      const signer = await wallet.provider.getSigner();
      setActionTxStatus({ state: "pending", message: "Waiting for wallet confirmation..." });
      const txHash = await receiveTransferOnChain(signer, Number(transfer.id), grams);
      setActionTxStatus({ state: "confirmed", message: "Quantity received.", txHash });
      setReceiveQtyKg("");
      await onRefresh();
    } catch (err) {
      handleTxError(err, setActionTxStatus);
    }
  };

  const handleApprove = async () => {
    setActionTxStatus({ state: "preparing", message: "Preparing transaction..." });
    try {
      const signer = await wallet.provider.getSigner();
      setActionTxStatus({ state: "pending", message: "Waiting for wallet confirmation..." });
      const txHash = await approveTransferOnChain(signer, Number(transfer.id));
      setActionTxStatus({ state: "confirmed", message: "Approval recorded.", txHash });
      await onRefresh();
    } catch (err) {
      handleTxError(err, setActionTxStatus);
    }
  };

  const handleCancel = async () => {
    setActionTxStatus({ state: "preparing", message: "Preparing transaction..." });
    try {
      const signer = await wallet.provider.getSigner();
      setActionTxStatus({ state: "pending", message: "Waiting for wallet confirmation..." });
      const txHash = await cancelTransferOnChain(signer, Number(transfer.id));
      setActionTxStatus({ state: "confirmed", message: "Transfer cancelled.", txHash });
      await onRefresh();
    } catch (err) {
      handleTxError(err, setActionTxStatus);
    }
  };

  const receivedGrams = transfer.receivedQuantityGrams;
  const declaredGrams = transfer.declaredQuantityGrams;
  const diff = receivedGrams > 0n ? declaredGrams - receivedGrams : null;

  return (
    <>
      <div
        style={{ ...styles.tableRow, ...(isParty && hasActions ? styles.tableRowClickable : {}) }}
        onClick={() => isParty && hasActions && setExpanded(!expanded)}
      >
        <span style={styles.colId}>#{Number(transfer.id)}</span>
        <span style={styles.colFlex}>
          <div style={styles.fromToCell}>
            <span style={styles.fromToLine}>
              <span style={styles.fromToArrow}>From</span>
              <ParticipantNameDisplay
                address={transfer.sender}
                info={participantCache.getParticipant(transfer.sender)}
              />
            </span>
            <span style={styles.fromToLine}>
              <span style={styles.fromToArrow}>To</span>
              <ParticipantNameDisplay
                address={transfer.receiver}
                info={participantCache.getParticipant(transfer.receiver)}
              />
            </span>
          </div>
        </span>
        <span style={styles.colQty}>{formatGrams(declaredGrams)}</span>
        <span style={styles.colQty}>{receivedGrams > 0n ? formatGrams(receivedGrams) : "\u2014"}</span>
        <span style={styles.colQty}>{diff !== null && diff !== 0n ? formatGrams(diff) : "\u2014"}</span>
        <span style={styles.colStatus}>
          <span style={statusBadgeStyle(status)}>{statusLabel}</span>
        </span>
        <span style={styles.colDate}>{formatDate(transfer.createdAt)}</span>
      </div>

      {expanded && isParty && (
        <div style={styles.rowDetail}>
          <div style={styles.rowDetailMeta}>
            <span>Batch #{Number(transfer.batchId)}</span>
            {status >= TRANSFER_STATUS.Received && status !== TRANSFER_STATUS.Cancelled && (
              <span style={styles.rowDetailApprovals}>
                Sender: {transfer.senderApproved ? "Approved" : "Pending"}
                {" \u00b7 "}
                Receiver: {transfer.receiverApproved ? "Approved" : "Pending"}
              </span>
            )}
          </div>

          {canReceive && (
            <div style={styles.actionGroup}>
              <label style={styles.formLabel}>Record received quantity (kg)</label>
              <div style={styles.inlineForm}>
                <input
                  type="text"
                  inputMode="decimal"
                  style={styles.input}
                  value={receiveQtyKg}
                  onChange={(e) => setReceiveQtyKg(e.target.value)}
                  placeholder="e.g. 95"
                />
                <button
                  style={{
                    ...styles.button,
                    ...styles.buttonBlue,
                    ...(isTxInProgress(actionTxStatus) ? styles.buttonDisabled : {}),
                  }}
                  onClick={handleReceive}
                  disabled={isTxInProgress(actionTxStatus)}
                >
                  Record
                </button>
              </div>
            </div>
          )}

          {canApproveSender && (
            <div style={styles.actionGroup}>
              <button
                style={{
                  ...styles.button,
                  ...styles.buttonBlue,
                  ...(isTxInProgress(actionTxStatus) ? styles.buttonDisabled : {}),
                }}
                onClick={handleApprove}
                disabled={isTxInProgress(actionTxStatus)}
              >
                Approve as Sender
              </button>
            </div>
          )}

          {canApproveReceiver && (
            <div style={styles.actionGroup}>
              <button
                style={{
                  ...styles.button,
                  ...styles.buttonBlue,
                  ...(isTxInProgress(actionTxStatus) ? styles.buttonDisabled : {}),
                }}
                onClick={handleApprove}
                disabled={isTxInProgress(actionTxStatus)}
              >
                Approve as Receiver
              </button>
            </div>
          )}

          {canCancel && (
            <div style={styles.actionGroup}>
              <button
                style={{
                  ...styles.button,
                  ...styles.buttonRed,
                  ...(isTxInProgress(actionTxStatus) ? styles.buttonDisabled : {}),
                }}
                onClick={handleCancel}
                disabled={isTxInProgress(actionTxStatus)}
              >
                Cancel Transfer
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTxInProgress(tx: TxStatus): boolean {
  return tx.state === "pending" || tx.state === "preparing";
}

function handleTxError(err: unknown, setter: (s: TxStatus) => void) {
  const msg = err instanceof Error ? err.message : "Transaction failed";
  if (msg.includes("user rejected") || msg.includes("User denied")) {
    setter({ state: "rejected", message: "Transaction was rejected in MetaMask." });
  } else {
    setter({ state: "failed", message: `Transaction failed: ${msg}` });
  }
}

function kgToGrams(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;

  const grams = parseUnits(trimmed, 3);
  const gramsNum = Number(grams);

  if (gramsNum <= 0 || !Number.isSafeInteger(gramsNum)) return null;

  return gramsNum;
}

function formatGrams(grams: bigint): string {
  const g = Number(grams);
  const kg = g / GRAMS_PER_KG;
  if (g % GRAMS_PER_KG === 0) {
    return `${kg.toLocaleString()} kg`;
  }
  return `${g.toLocaleString()} g`;
}

function formatDate(timestamp: bigint): string {
  const ts = Number(timestamp);
  if (ts === 0) return "\u2014";
  return new Date(ts * 1000).toLocaleString();
}

function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function ParticipantNameDisplay({
  address,
  info,
}: {
  address: string;
  info: ParticipantNameInfo;
}) {
  return (
    <span style={styles.participantNameCell}>
      <span style={styles.participantName}>
        {info.loading ? "Loading…" : info.name}
      </span>
      <span style={styles.mono}>{shortAddr(address)}</span>
    </span>
  );
}

function statusBadgeStyle(status: number): React.CSSProperties {
  switch (status) {
    case TRANSFER_STATUS.Pending:
      return { ...styles.badge, ...styles.badgePending };
    case TRANSFER_STATUS.Received:
      return { ...styles.badge, ...styles.badgeReceived };
    case TRANSFER_STATUS.Confirmed:
      return { ...styles.badge, ...styles.badgeConfirmed };
    case TRANSFER_STATUS.Cancelled:
      return { ...styles.badge, ...styles.badgeCancelled };
    default:
      return { ...styles.badge, ...styles.badgePending };
  }
}

function TxStatusBox({ txStatus }: { txStatus: TxStatus }) {
  if (txStatus.state === "idle") return null;

  const styleMap: Record<string, React.CSSProperties> = {
    confirmed: { ...styles.txBox, ...styles.txConfirmed },
    failed: { ...styles.txBox, ...styles.txFailed },
    rejected: { ...styles.txBox, ...styles.txRejected },
    pending: { ...styles.txBox, ...styles.txPending },
    preparing: { ...styles.txBox, ...styles.txPreparing },
  };

  return (
    <div style={styleMap[txStatus.state] ?? styles.txBox}>
      <p style={styles.txMessage}>{txStatus.message}</p>
      {txStatus.txHash && (
        <p style={styles.txHash}>
          Transaction:{" "}
          <a
            href={`https://sepolia.etherscan.io/tx/${txStatus.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            {txStatus.txHash.slice(0, 20)}...
          </a>
        </p>
      )}
    </div>
  );
}

// --- On-chain transaction helpers ---

async function registerParticipantOnChain(
  signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>,
  name: string,
  role: number
): Promise<string> {
  const ABI = ["function registerParticipant(string memory _name, uint8 _role) external"];
  const contract = new Contract(contractConfig.address, ABI, signer);
  const tx = await contract.registerParticipant(name, role);
  await tx.wait();
  return tx.hash;
}

async function createBatchOnChain(
  signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>,
  quantityGrams: number
): Promise<string> {
  const ABI = ["function createBatch(uint256 _quantityGrams) external returns (uint256)"];
  const contract = new Contract(contractConfig.address, ABI, signer);
  const tx = await contract.createBatch(quantityGrams);
  await tx.wait();
  return tx.hash;
}

async function createTransferOnChain(
  signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>,
  batchId: number,
  receiver: string,
  quantityGrams: number
): Promise<string> {
  const ABI = ["function createTransfer(uint256 _batchId, address _receiver, uint256 _quantityGrams) external returns (uint256)"];
  const contract = new Contract(contractConfig.address, ABI, signer);
  const tx = await contract.createTransfer(batchId, receiver, quantityGrams);
  await tx.wait();
  return tx.hash;
}

async function receiveTransferOnChain(
  signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>,
  transferId: number,
  receivedGrams: number
): Promise<string> {
  const ABI = ["function receiveTransfer(uint256 _transferId, uint256 _receivedQuantityGrams) external"];
  const contract = new Contract(contractConfig.address, ABI, signer);
  const tx = await contract.receiveTransfer(transferId, receivedGrams);
  await tx.wait();
  return tx.hash;
}

async function approveTransferOnChain(
  signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>,
  transferId: number
): Promise<string> {
  const ABI = ["function approveTransfer(uint256 _transferId) external"];
  const contract = new Contract(contractConfig.address, ABI, signer);
  const tx = await contract.approveTransfer(transferId);
  await tx.wait();
  return tx.hash;
}

async function cancelTransferOnChain(
  signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>,
  transferId: number
): Promise<string> {
  const ABI = ["function cancelTransfer(uint256 _transferId) external"];
  const contract = new Contract(contractConfig.address, ABI, signer);
  const tx = await contract.cancelTransfer(transferId);
  await tx.wait();
  return tx.hash;
}

async function processEwasteOnChain(
  signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>,
  batchId: number,
  inputGrams: number,
  materialTypes: string[],
  materialQuantities: number[],
  residualGrams: number
): Promise<string> {
  const ABI = [
    "function processEwaste(uint256 _batchId, uint256 _inputQuantityGrams, string[] calldata _materialTypes, uint256[] calldata _materialQuantities, uint256 _residualGrams) external returns (uint256)",
  ];
  const contract = new Contract(contractConfig.address, ABI, signer);
  const tx = await contract.processEwaste(
    batchId,
    inputGrams,
    materialTypes,
    materialQuantities,
    residualGrams
  );
  await tx.wait();
  return tx.hash;
}

async function createMaterialTransferOnChain(
  signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>,
  materialId: number,
  receiver: string,
  quantityGrams: number
): Promise<string> {
  const ABI = ["function createMaterialTransfer(uint256 _materialId, address _receiver, uint256 _quantityGrams) external returns (uint256)"];
  const contract = new Contract(contractConfig.address, ABI, signer);
  const tx = await contract.createMaterialTransfer(materialId, receiver, quantityGrams);
  await tx.wait();
  return tx.hash;
}

async function receiveMaterialTransferOnChain(
  signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>,
  transferId: number,
  receivedGrams: number
): Promise<string> {
  const ABI = ["function receiveMaterialTransfer(uint256 _transferId, uint256 _receivedQuantityGrams) external"];
  const contract = new Contract(contractConfig.address, ABI, signer);
  const tx = await contract.receiveMaterialTransfer(transferId, receivedGrams);
  await tx.wait();
  return tx.hash;
}

async function approveMaterialTransferOnChain(
  signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>,
  transferId: number
): Promise<string> {
  const ABI = ["function approveMaterialTransfer(uint256 _transferId) external"];
  const contract = new Contract(contractConfig.address, ABI, signer);
  const tx = await contract.approveMaterialTransfer(transferId);
  await tx.wait();
  return tx.hash;
}

async function cancelMaterialTransferOnChain(
  signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>,
  transferId: number
): Promise<string> {
  const ABI = ["function cancelMaterialTransfer(uint256 _transferId) external"];
  const contract = new Contract(contractConfig.address, ABI, signer);
  const tx = await contract.cancelMaterialTransfer(transferId);
  await tx.wait();
  return tx.hash;
}

async function processMaterialOnChain(
  signer: Awaited<ReturnType<BrowserProvider["getSigner"]>>,
  materialId: number,
  quantityGrams: number
): Promise<string> {
  const ABI = ["function processMaterial(uint256 _materialId, uint256 _quantityGrams) external returns (uint256)"];
  const contract = new Contract(contractConfig.address, ABI, signer);
  const tx = await contract.processMaterial(materialId, quantityGrams);
  await tx.wait();
  return tx.hash;
}

// ---------------------------------------------------------------------------
// Process E-Waste (Recycler)
// ---------------------------------------------------------------------------

interface MaterialEntry {
  materialType: string;
  qtyKg: string;
}

function ProcessEwasteSection({
  wallet,
  batches,
  onSuccess,
}: {
  wallet: { address: string; provider: BrowserProvider };
  batches: BatchInfo[];
  onSuccess: () => Promise<void>;
}) {
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [inputQtyKg, setInputQtyKg] = useState<string>("");
  const [materialEntries, setMaterialEntries] = useState<MaterialEntry[]>([
    { materialType: "", qtyKg: "" },
  ]);
  const [residualKg, setResidualKg] = useState<string>("");
  const [availableCustody, setAvailableCustody] = useState<bigint | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>({ state: "idle", message: "" });

  const eligibleBatches = batches.filter((b) => b.status === BATCH_STATUS_ACTIVE);

  useEffect(() => {
    let cancelled = false;
    async function loadCustody() {
      if (!selectedBatchId) {
        setAvailableCustody(null);
        return;
      }
      try {
        const custody = await getAvailableCustody(
          wallet.provider,
          Number(selectedBatchId),
          wallet.address
        );
        if (!cancelled) setAvailableCustody(custody);
      } catch {
        if (!cancelled) setAvailableCustody(null);
      }
    }
    loadCustody();
    return () => { cancelled = true; };
  }, [wallet, selectedBatchId]);

  const inputGrams = kgToGrams(inputQtyKg);
  const residualGrams = kgToGrams(residualKg);

  const materialGrams = materialEntries.map((e) => kgToGrams(e.qtyKg));
  const totalMaterialGrams = materialGrams.reduce((sum, g) => (sum !== null && g !== null ? sum + g : null), 0 as number | null);
  const totalOutputGrams = totalMaterialGrams !== null && residualGrams !== null ? totalMaterialGrams + residualGrams : null;
  const balanced = inputGrams !== null && totalOutputGrams !== null && inputGrams === totalOutputGrams;

  const hasDuplicateTypes = (() => {
    const types = materialEntries.map((e) => e.materialType.trim().toLowerCase()).filter((t) => t !== "");
    return new Set(types).size !== types.length;
  })();

  const addMaterialRow = () => {
    if (materialEntries.length >= 20) return;
    setMaterialEntries([...materialEntries, { materialType: "", qtyKg: "" }]);
  };

  const removeMaterialRow = (index: number) => {
    if (materialEntries.length <= 1) return;
    setMaterialEntries(materialEntries.filter((_, i) => i !== index));
  };

  const updateMaterialEntry = (index: number, field: keyof MaterialEntry, value: string) => {
    setMaterialEntries(
      materialEntries.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  };

  const handleSubmit = async () => {
    if (!wallet) return;

    if (!selectedBatchId) {
      setTxStatus({ state: "failed", message: "Select a batch to process." });
      return;
    }
    if (inputGrams === null) {
      setTxStatus({ state: "failed", message: "Enter a valid input quantity in kilograms." });
      return;
    }
    if (residualGrams === null) {
      setTxStatus({ state: "failed", message: "Enter a valid residual quantity in kilograms." });
      return;
    }

    const validEntries = materialEntries.filter(
      (e) => e.materialType.trim() !== "" && kgToGrams(e.qtyKg) !== null
    );
    if (validEntries.length === 0) {
      setTxStatus({ state: "failed", message: "Add at least one recovered material." });
      return;
    }
    if (validEntries.length !== materialEntries.length) {
      setTxStatus({ state: "failed", message: "Fill in all material types and quantities, or remove empty rows." });
      return;
    }
    if (hasDuplicateTypes) {
      setTxStatus({ state: "failed", message: "Duplicate material types are not allowed in one processing transaction." });
      return;
    }
    if (!balanced) {
      setTxStatus({ state: "failed", message: "Input quantity must equal the sum of recovered materials plus residual." });
      return;
    }

    setTxStatus({ state: "preparing", message: "Preparing transaction..." });

    try {
      const signer = await wallet.provider.getSigner();
      setTxStatus({ state: "pending", message: "Waiting for wallet confirmation..." });

      const types = materialEntries.map((e) => e.materialType.trim());
      const quantities = materialEntries.map((e) => kgToGrams(e.qtyKg)!);

      const txHash = await processEwasteOnChain(
        signer,
        Number(selectedBatchId),
        inputGrams,
        types,
        quantities,
        residualGrams
      );

      setTxStatus({
        state: "confirmed",
        message: "E-waste processed successfully.",
        txHash,
      });

      setSelectedBatchId("");
      setInputQtyKg("");
      setResidualKg("");
      setMaterialEntries([{ materialType: "", qtyKg: "" }]);
      setAvailableCustody(null);
      await onSuccess();
    } catch (err) {
      handleTxError(err, setTxStatus);
    }
  };

  return (
    <div style={styles.section}>
      <h2 style={styles.h2}>Process E-Waste</h2>
      <p style={styles.hint}>
        Input e-waste quantity must equal the sum of all recovered materials plus residual.
      </p>

      {eligibleBatches.length === 0 ? (
        <p style={styles.statusText}>No active batches available for processing.</p>
      ) : (
        <>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Batch</label>
            <select
              style={styles.select}
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
            >
              <option value="">Select a batch</option>
              {eligibleBatches.map((batch) => (
                <option key={Number(batch.id)} value={String(batch.id)}>
                  Batch #{Number(batch.id)} ({formatGrams(batch.originalQuantityGrams)})
                </option>
              ))}
            </select>
          </div>

          {selectedBatchId && availableCustody !== null && (
            <p style={styles.hint}>
              Your available quantity in this batch: {formatGrams(availableCustody)}
            </p>
          )}

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Input quantity (kilograms)</label>
            <input
              type="text"
              inputMode="decimal"
              style={styles.input}
              value={inputQtyKg}
              onChange={(e) => setInputQtyKg(e.target.value)}
              placeholder="e.g. 500"
            />
            <p style={styles.hint}>
              {inputQtyKg && inputGrams !== null
                ? `= ${inputGrams.toLocaleString()} grams`
                : "Enter the e-waste quantity to process"}
            </p>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Recovered Materials</label>
            {materialEntries.map((entry, index) => (
              <div key={index} style={styles.materialRow}>
                <input
                  type="text"
                  style={{ ...styles.input, flex: 2 }}
                  value={entry.materialType}
                  onChange={(e) => updateMaterialEntry(index, "materialType", e.target.value)}
                  placeholder="Material type (e.g. Copper)"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  style={{ ...styles.input, flex: 1 }}
                  value={entry.qtyKg}
                  onChange={(e) => updateMaterialEntry(index, "qtyKg", e.target.value)}
                  placeholder="kg"
                />
                {materialEntries.length > 1 && (
                  <button
                    style={{ ...styles.buttonSmall, ...styles.buttonRed }}
                    onClick={() => removeMaterialRow(index)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {materialEntries.length < 20 && (
              <button
                style={{ ...styles.button, ...styles.buttonSecondary, marginTop: 8 }}
                onClick={addMaterialRow}
              >
                Add Material
              </button>
            )}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Residual quantity (kilograms)</label>
            <input
              type="text"
              inputMode="decimal"
              style={styles.input}
              value={residualKg}
              onChange={(e) => setResidualKg(e.target.value)}
              placeholder="e.g. 50"
            />
            <p style={styles.hint}>
              {residualKg && residualGrams !== null
                ? `= ${residualGrams.toLocaleString()} grams`
                : "Unrecoverable portion of the input"}
            </p>
          </div>

          {inputGrams !== null && totalOutputGrams !== null && (
            <div style={balanced ? styles.balanceOk : styles.balanceBad}>
              {balanced
                ? "Input equals recovered materials plus residual."
                : `Input (${inputGrams.toLocaleString()} g) does not match output (${totalOutputGrams.toLocaleString()} g).`}
            </div>
          )}

          <button
            style={{
              ...styles.button,
              ...styles.buttonGreen,
              ...(isTxInProgress(txStatus) ? styles.buttonDisabled : {}),
            }}
            onClick={handleSubmit}
            disabled={isTxInProgress(txStatus)}
          >
            {txStatus.state === "preparing"
              ? "Preparing..."
              : txStatus.state === "pending"
              ? "Waiting for confirmation..."
              : "Process E-Waste"}
          </button>
          <TxStatusBox txStatus={txStatus} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recovered Materials list
// ---------------------------------------------------------------------------

function MaterialsSection({
  wallet,
  materials,
  materialCount,
  loadingMaterials,
  participant,
  participantCache,
}: {
  wallet: { address: string; provider: BrowserProvider };
  materials: RecoveredMaterialInfo[];
  materialCount: number;
  loadingMaterials: boolean;
  participant: ParticipantInfo;
  participantCache: ReturnType<typeof useParticipantCache>;
}) {
  if (loadingMaterials) {
    return (
      <div style={styles.section}>
        <h2 style={styles.h2}>Recovered Materials</h2>
        <p style={styles.statusText}>Loading materials...</p>
      </div>
    );
  }

  const isRecycler = participant.role === ROLE_RECYCLER;
  const isMaterialProcessor = participant.role === ROLE_MATERIAL_PROCESSOR;

  const visibleMaterials = materials.filter((m) => {
    if (isRecycler) {
      return m.recycler.toLowerCase() === wallet.address.toLowerCase();
    }
    if (isMaterialProcessor) {
      return true;
    }
    return true;
  });

  return (
    <div style={styles.section}>
      <h2 style={styles.h2}>Recovered Materials ({materialCount})</h2>
      {visibleMaterials.length === 0 ? (
        <p style={styles.statusText}>No recovered materials have been recorded yet.</p>
      ) : (
        <div style={styles.batchList}>
          {visibleMaterials.map((material) => (
            <div key={Number(material.id)} style={styles.batchCard}>
              <div style={styles.batchHeader}>
                <span style={styles.batchId}>Material #{Number(material.id)}</span>
                <span style={styles.materialTypeBadge}>{material.materialType}</span>
              </div>
              <div style={styles.batchRow}>
                <span style={styles.label}>Batch</span>
                <span>#{Number(material.batchId)}</span>
              </div>
              <div style={styles.batchRow}>
                <span style={styles.label}>Recycler</span>
                <ParticipantNameDisplay
                  address={material.recycler}
                  info={participantCache.getParticipant(material.recycler)}
                />
              </div>
              <div style={styles.batchRow}>
                <span style={styles.label}>Produced</span>
                <span>{formatGrams(material.producedQuantityGrams)}</span>
              </div>
              <div style={styles.batchRow}>
                <span style={styles.label}>Available</span>
                <span>{formatGrams(material.availableQuantityGrams)}</span>
              </div>
              <div style={styles.batchRow}>
                <span style={styles.label}>Created</span>
                <span>{new Date(Number(material.createdAt) * 1000).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Material Transfer (Recycler → Material Processor)
// ---------------------------------------------------------------------------

function CreateMaterialTransferSection({
  wallet,
  materials,
  onSuccess,
}: {
  wallet: { address: string; provider: BrowserProvider };
  materials: RecoveredMaterialInfo[];
  onSuccess: () => Promise<void>;
}) {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [receiverAddress, setReceiverAddress] = useState<string>("");
  const [qtyKg, setQtyKg] = useState<string>("");
  const [availableCustody, setAvailableCustody] = useState<bigint | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>({ state: "idle", message: "" });

  const myMaterials = materials.filter(
    (m) => m.recycler.toLowerCase() === wallet.address.toLowerCase()
  );

  useEffect(() => {
    let cancelled = false;
    async function loadCustody() {
      if (!selectedMaterialId) {
        setAvailableCustody(null);
        return;
      }
      try {
        const custody = await getMaterialAvailableCustody(
          wallet.provider,
          Number(selectedMaterialId),
          wallet.address
        );
        if (!cancelled) setAvailableCustody(custody);
      } catch {
        if (!cancelled) setAvailableCustody(null);
      }
    }
    loadCustody();
    return () => { cancelled = true; };
  }, [wallet, selectedMaterialId]);

  const handleSubmit = async () => {
    if (!wallet) return;

    if (!selectedMaterialId) {
      setTxStatus({ state: "failed", message: "Select a recovered material to transfer." });
      return;
    }
    if (!receiverAddress.trim()) {
      setTxStatus({ state: "failed", message: "Enter the receiver's wallet address." });
      return;
    }
    const grams = kgToGrams(qtyKg);
    if (grams === null) {
      setTxStatus({ state: "failed", message: "Enter a valid quantity in kilograms." });
      return;
    }

    setTxStatus({ state: "preparing", message: "Preparing transaction..." });

    try {
      const signer = await wallet.provider.getSigner();
      setTxStatus({ state: "pending", message: "Waiting for wallet confirmation..." });

      const txHash = await createMaterialTransferOnChain(
        signer,
        Number(selectedMaterialId),
        receiverAddress.trim(),
        grams
      );

      setTxStatus({
        state: "confirmed",
        message: "Material transfer created.",
        txHash,
      });

      setSelectedMaterialId("");
      setReceiverAddress("");
      setQtyKg("");
      setAvailableCustody(null);
      await onSuccess();
    } catch (err) {
      handleTxError(err, setTxStatus);
    }
  };

  return (
    <div style={styles.section}>
      <h2 style={styles.h2}>Send Material</h2>

      {myMaterials.length === 0 ? (
        <p style={styles.statusText}>You have no recovered materials available to transfer.</p>
      ) : (
        <>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Material</label>
            <select
              style={styles.select}
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
            >
              <option value="">Select a material</option>
              {myMaterials.map((material) => (
                <option key={Number(material.id)} value={String(material.id)}>
                  Material #{Number(material.id)} — {material.materialType} ({formatGrams(material.availableQuantityGrams)})
                </option>
              ))}
            </select>
          </div>

          {selectedMaterialId && availableCustody !== null && (
            <p style={styles.hint}>
              Your available quantity: {formatGrams(availableCustody)}
            </p>
          )}

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>
              Receiver wallet address
            </label>
            <input
              type="text"
              style={styles.input}
              value={receiverAddress}
              onChange={(e) => setReceiverAddress(e.target.value)}
              placeholder="0x..."
            />
            <p style={styles.hint}>
              Must be a registered Material Processor
            </p>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Quantity (kilograms)</label>
            <input
              type="text"
              inputMode="decimal"
              style={styles.input}
              value={qtyKg}
              onChange={(e) => setQtyKg(e.target.value)}
              placeholder="e.g. 50"
            />
            <p style={styles.hint}>
              {qtyKg && kgToGrams(qtyKg) !== null
                ? `= ${kgToGrams(qtyKg)!.toLocaleString()} grams`
                : "Enter a positive number of kilograms"}
            </p>
          </div>

          <button
            style={{
              ...styles.button,
              ...styles.buttonBlue,
              ...(isTxInProgress(txStatus) ? styles.buttonDisabled : {}),
            }}
            onClick={handleSubmit}
            disabled={isTxInProgress(txStatus)}
          >
            {txStatus.state === "preparing"
              ? "Preparing..."
              : txStatus.state === "pending"
              ? "Waiting for confirmation..."
              : "Create Material Transfer"}
          </button>
          <TxStatusBox txStatus={txStatus} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Material Transfers list with actions
// ---------------------------------------------------------------------------

function MaterialTransfersSection({
  wallet,
  participant,
  materialTransfers,
  loadingMaterialTransfers,
  materialTransferCount,
  onRefresh,
  participantCache,
}: {
  wallet: { address: string; provider: BrowserProvider };
  participant: ParticipantInfo;
  materialTransfers: MaterialTransferInfo[];
  loadingMaterialTransfers: boolean;
  materialTransferCount: number;
  onRefresh: () => Promise<void>;
  participantCache: ReturnType<typeof useParticipantCache>;
}) {
  const [actionTxStatus, setActionTxStatus] = useState<TxStatus>({ state: "idle", message: "" });
  const [dirFilter, setDirFilter] = useState<"all" | "incoming" | "outgoing">("all");
  const [statusFilter, setStatusFilter] = useState<number | "all">("all");

  const walletAddr = wallet.address.toLowerCase();

  const filtered = materialTransfers.filter((t) => {
    if (dirFilter === "incoming" && t.receiver.toLowerCase() !== walletAddr) return false;
    if (dirFilter === "outgoing" && t.sender.toLowerCase() !== walletAddr) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });

  if (loadingMaterialTransfers) {
    return (
      <div style={styles.section}>
        <h2 style={styles.h2}>Material Transfers</h2>
        <p style={styles.statusText}>Loading material transfers...</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h2 style={styles.h2}>Material Transfers ({materialTransferCount})</h2>

      {materialTransfers.length > 0 && (
        <div style={styles.filterBar}>
          <div style={styles.filterGroup}>
            {(["all", "incoming", "outgoing"] as const).map((d) => (
              <button
                key={d}
                style={dirFilter === d ? styles.filterBtnActive : styles.filterBtn}
                onClick={() => setDirFilter(d)}
              >
                {d === "all" ? "All" : d === "incoming" ? "Incoming" : "Outgoing"}
              </button>
            ))}
          </div>
          <div style={styles.filterGroup}>
            <button
              style={statusFilter === "all" ? styles.filterBtnActive : styles.filterBtn}
              onClick={() => setStatusFilter("all")}
            >
              All Statuses
            </button>
            {Object.values(TRANSFER_STATUS).map((s) => (
              <button
                key={s}
                style={statusFilter === s ? styles.filterBtnActive : styles.filterBtn}
                onClick={() => setStatusFilter(s)}
              >
                {TRANSFER_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      <TxStatusBox txStatus={actionTxStatus} />

      {materialTransfers.length === 0 ? (
        <p style={styles.statusText}>No material transfers found.</p>
      ) : filtered.length === 0 ? (
        <p style={styles.statusText}>No material transfers match the selected filters.</p>
      ) : (
        <div style={styles.tableWrap}>
          <div style={styles.tableHead}>
            <span style={styles.colId}>ID</span>
            <span style={styles.colFlex}>From / To</span>
            <span style={styles.colQty}>Declared</span>
            <span style={styles.colQty}>Received</span>
            <span style={styles.colQty}>Diff</span>
            <span style={styles.colStatus}>Status</span>
            <span style={styles.colDate}>Created</span>
          </div>
          {filtered.map((transfer) => (
            <MaterialTransferRow
              key={Number(transfer.id)}
              transfer={transfer}
              wallet={wallet}
              actionTxStatus={actionTxStatus}
              setActionTxStatus={setActionTxStatus}
              onRefresh={onRefresh}
              participantCache={participantCache}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MaterialTransferRow({
  transfer,
  wallet,
  actionTxStatus,
  setActionTxStatus,
  onRefresh,
  participantCache,
}: {
  transfer: MaterialTransferInfo;
  wallet: { address: string; provider: BrowserProvider };
  actionTxStatus: TxStatus;
  setActionTxStatus: (s: TxStatus) => void;
  onRefresh: () => Promise<void>;
  participantCache: ReturnType<typeof useParticipantCache>;
}) {
  const [receiveQtyKg, setReceiveQtyKg] = useState<string>("");
  const [expanded, setExpanded] = useState(false);

  const isSender = transfer.sender.toLowerCase() === wallet.address.toLowerCase();
  const isReceiver = transfer.receiver.toLowerCase() === wallet.address.toLowerCase();
  const status = transfer.status;
  const statusLabel = TRANSFER_STATUS_LABELS[status] ?? "Unknown";

  const canReceive = isReceiver && status === TRANSFER_STATUS.Pending;
  const canApproveSender = isSender && status === TRANSFER_STATUS.Received && !transfer.senderApproved;
  const canApproveReceiver = isReceiver && status === TRANSFER_STATUS.Received && !transfer.receiverApproved;
  const canCancel = isSender && status === TRANSFER_STATUS.Pending;
  const hasActions = canReceive || canApproveSender || canApproveReceiver || canCancel;
  const isParty = isSender || isReceiver;

  const handleReceive = async () => {
    const grams = kgToGrams(receiveQtyKg);
    if (grams === null) {
      setActionTxStatus({ state: "failed", message: "Enter a valid received quantity in kilograms." });
      return;
    }
    if (grams > Number(transfer.declaredQuantityGrams)) {
      setActionTxStatus({ state: "failed", message: "Received quantity cannot exceed declared quantity." });
      return;
    }
    setActionTxStatus({ state: "preparing", message: "Preparing transaction..." });
    try {
      const signer = await wallet.provider.getSigner();
      setActionTxStatus({ state: "pending", message: "Waiting for wallet confirmation..." });
      const txHash = await receiveMaterialTransferOnChain(signer, Number(transfer.id), grams);
      setActionTxStatus({ state: "confirmed", message: "Quantity received.", txHash });
      setReceiveQtyKg("");
      await onRefresh();
    } catch (err) {
      handleTxError(err, setActionTxStatus);
    }
  };

  const handleApprove = async () => {
    setActionTxStatus({ state: "preparing", message: "Preparing transaction..." });
    try {
      const signer = await wallet.provider.getSigner();
      setActionTxStatus({ state: "pending", message: "Waiting for wallet confirmation..." });
      const txHash = await approveMaterialTransferOnChain(signer, Number(transfer.id));
      setActionTxStatus({ state: "confirmed", message: "Approval recorded.", txHash });
      await onRefresh();
    } catch (err) {
      handleTxError(err, setActionTxStatus);
    }
  };

  const handleCancel = async () => {
    setActionTxStatus({ state: "preparing", message: "Preparing transaction..." });
    try {
      const signer = await wallet.provider.getSigner();
      setActionTxStatus({ state: "pending", message: "Waiting for wallet confirmation..." });
      const txHash = await cancelMaterialTransferOnChain(signer, Number(transfer.id));
      setActionTxStatus({ state: "confirmed", message: "Transfer cancelled.", txHash });
      await onRefresh();
    } catch (err) {
      handleTxError(err, setActionTxStatus);
    }
  };

  const receivedGrams = transfer.receivedQuantityGrams;
  const declaredGrams = transfer.declaredQuantityGrams;
  const diff = receivedGrams > 0n ? declaredGrams - receivedGrams : null;

  return (
    <>
      <div
        style={{ ...styles.tableRow, ...(isParty && hasActions ? styles.tableRowClickable : {}) }}
        onClick={() => isParty && hasActions && setExpanded(!expanded)}
      >
        <span style={styles.colId}>#{Number(transfer.id)}</span>
        <span style={styles.colFlex}>
          <div style={styles.fromToCell}>
            <span style={styles.fromToLine}>
              <span style={styles.fromToArrow}>From</span>
              <ParticipantNameDisplay
                address={transfer.sender}
                info={participantCache.getParticipant(transfer.sender)}
              />
            </span>
            <span style={styles.fromToLine}>
              <span style={styles.fromToArrow}>To</span>
              <ParticipantNameDisplay
                address={transfer.receiver}
                info={participantCache.getParticipant(transfer.receiver)}
              />
            </span>
          </div>
        </span>
        <span style={styles.colQty}>{formatGrams(declaredGrams)}</span>
        <span style={styles.colQty}>{receivedGrams > 0n ? formatGrams(receivedGrams) : "\u2014"}</span>
        <span style={styles.colQty}>{diff !== null && diff !== 0n ? formatGrams(diff) : "\u2014"}</span>
        <span style={styles.colStatus}>
          <span style={statusBadgeStyle(status)}>{statusLabel}</span>
        </span>
        <span style={styles.colDate}>{formatDate(transfer.createdAt)}</span>
      </div>

      {expanded && isParty && (
        <div style={styles.rowDetail}>
          <div style={styles.rowDetailMeta}>
            <span>Material #{Number(transfer.materialId)} {" \u00b7 "} Batch #{Number(transfer.batchId)}</span>
            {status >= TRANSFER_STATUS.Received && status !== TRANSFER_STATUS.Cancelled && (
              <span style={styles.rowDetailApprovals}>
                Sender: {transfer.senderApproved ? "Approved" : "Pending"}
                {" \u00b7 "}
                Receiver: {transfer.receiverApproved ? "Approved" : "Pending"}
              </span>
            )}
          </div>

          {canReceive && (
            <div style={styles.actionGroup}>
              <label style={styles.formLabel}>Record received quantity (kg)</label>
              <div style={styles.inlineForm}>
                <input
                  type="text"
                  inputMode="decimal"
                  style={styles.input}
                  value={receiveQtyKg}
                  onChange={(e) => setReceiveQtyKg(e.target.value)}
                  placeholder="e.g. 68"
                />
                <button
                  style={{
                    ...styles.button,
                    ...styles.buttonBlue,
                    ...(isTxInProgress(actionTxStatus) ? styles.buttonDisabled : {}),
                  }}
                  onClick={handleReceive}
                  disabled={isTxInProgress(actionTxStatus)}
                >
                  Record
                </button>
              </div>
            </div>
          )}

          {canApproveSender && (
            <div style={styles.actionGroup}>
              <button
                style={{
                  ...styles.button,
                  ...styles.buttonBlue,
                  ...(isTxInProgress(actionTxStatus) ? styles.buttonDisabled : {}),
                }}
                onClick={handleApprove}
                disabled={isTxInProgress(actionTxStatus)}
              >
                Approve as Sender
              </button>
            </div>
          )}

          {canApproveReceiver && (
            <div style={styles.actionGroup}>
              <button
                style={{
                  ...styles.button,
                  ...styles.buttonBlue,
                  ...(isTxInProgress(actionTxStatus) ? styles.buttonDisabled : {}),
                }}
                onClick={handleApprove}
                disabled={isTxInProgress(actionTxStatus)}
              >
                Approve as Receiver
              </button>
            </div>
          )}

          {canCancel && (
            <div style={styles.actionGroup}>
              <button
                style={{
                  ...styles.button,
                  ...styles.buttonRed,
                  ...(isTxInProgress(actionTxStatus) ? styles.buttonDisabled : {}),
                }}
                onClick={handleCancel}
                disabled={isTxInProgress(actionTxStatus)}
              >
                Cancel Transfer
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Process Material (Material Processor)
// ---------------------------------------------------------------------------

function ProcessMaterialSection({
  wallet,
  materials,
  batches,
  onSuccess,
}: {
  wallet: { address: string; provider: BrowserProvider };
  materials: RecoveredMaterialInfo[];
  batches: BatchInfo[];
  onSuccess: () => Promise<void>;
}) {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [qtyKg, setQtyKg] = useState<string>("");
  const [availableCustody, setAvailableCustody] = useState<bigint | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>({ state: "idle", message: "" });

  const activeBatchIds = new Set(
    batches.filter((b) => b.status === BATCH_STATUS_ACTIVE).map((b) => Number(b.id))
  );

  useEffect(() => {
    let cancelled = false;
    async function loadCustody() {
      if (!selectedMaterialId) {
        setAvailableCustody(null);
        return;
      }
      try {
        const custody = await getMaterialAvailableCustody(
          wallet.provider,
          Number(selectedMaterialId),
          wallet.address
        );
        if (!cancelled) setAvailableCustody(custody);
      } catch {
        if (!cancelled) setAvailableCustody(null);
      }
    }
    loadCustody();
    return () => { cancelled = true; };
  }, [wallet, selectedMaterialId]);

  const handleSubmit = async () => {
    if (!wallet) return;

    if (!selectedMaterialId) {
      setTxStatus({ state: "failed", message: "Select a material to process." });
      return;
    }
    const grams = kgToGrams(qtyKg);
    if (grams === null) {
      setTxStatus({ state: "failed", message: "Enter a valid quantity in kilograms." });
      return;
    }

    setTxStatus({ state: "preparing", message: "Preparing transaction..." });

    try {
      const signer = await wallet.provider.getSigner();
      setTxStatus({ state: "pending", message: "Waiting for wallet confirmation..." });

      const txHash = await processMaterialOnChain(
        signer,
        Number(selectedMaterialId),
        grams
      );

      setTxStatus({
        state: "confirmed",
        message: "Material processed successfully.",
        txHash,
      });

      setSelectedMaterialId("");
      setQtyKg("");
      setAvailableCustody(null);
      await onSuccess();
    } catch (err) {
      handleTxError(err, setTxStatus);
    }
  };

  return (
    <div style={styles.section}>
      <h2 style={styles.h2}>Process Material</h2>

      {materials.length === 0 ? (
        <p style={styles.statusText}>No recovered materials exist yet.</p>
      ) : (
        <>
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Material</label>
            <select
              style={styles.select}
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
            >
              <option value="">Select a material</option>
              {materials.map((material) => (
                <option key={Number(material.id)} value={String(material.id)}>
                  Material #{Number(material.id)} — {material.materialType} (Batch #{Number(material.batchId)})
                </option>
              ))}
            </select>
          </div>

          {selectedMaterialId && availableCustody !== null && (
            <p style={styles.hint}>
              Your available quantity: {formatGrams(availableCustody)}
            </p>
          )}

          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Quantity to process (kilograms)</label>
            <input
              type="text"
              inputMode="decimal"
              style={styles.input}
              value={qtyKg}
              onChange={(e) => setQtyKg(e.target.value)}
              placeholder="e.g. 50"
            />
            <p style={styles.hint}>
              {qtyKg && kgToGrams(qtyKg) !== null
                ? `= ${kgToGrams(qtyKg)!.toLocaleString()} grams`
                : "Enter a positive number of kilograms"}
            </p>
          </div>

          <button
            style={{
              ...styles.button,
              ...styles.buttonGreen,
              ...(isTxInProgress(txStatus) ? styles.buttonDisabled : {}),
            }}
            onClick={handleSubmit}
            disabled={isTxInProgress(txStatus)}
          >
            {txStatus.state === "preparing"
              ? "Preparing..."
              : txStatus.state === "pending"
              ? "Waiting for confirmation..."
              : "Process Material"}
          </button>
          <TxStatusBox txStatus={txStatus} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Processing History
// ---------------------------------------------------------------------------

function ProcessingHistorySection({
  processingRecords,
  processingRecordCount,
  loadingProcessingRecords,
  participantCache,
}: {
  processingRecords: MaterialProcessingRecordInfo[];
  processingRecordCount: number;
  loadingProcessingRecords: boolean;
  participantCache: ReturnType<typeof useParticipantCache>;
}) {
  if (loadingProcessingRecords) {
    return (
      <div style={styles.section}>
        <h2 style={styles.h2}>Processing History</h2>
        <p style={styles.statusText}>Loading processing history...</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h2 style={styles.h2}>Processing History ({processingRecordCount})</h2>
      {processingRecords.length === 0 ? (
        <p style={styles.statusText}>No material has been processed yet.</p>
      ) : (
        <div style={styles.batchList}>
          {processingRecords.map((record) => (
            <div key={Number(record.id)} style={styles.batchCard}>
              <div style={styles.batchHeader}>
                <span style={styles.batchId}>Record #{Number(record.id)}</span>
              </div>
              <div style={styles.batchRow}>
                <span style={styles.label}>Material</span>
                <span>#{Number(record.materialId)}</span>
              </div>
              <div style={styles.batchRow}>
                <span style={styles.label}>Batch</span>
                <span>#{Number(record.batchId)}</span>
              </div>
              <div style={styles.batchRow}>
                <span style={styles.label}>Processor</span>
                <ParticipantNameDisplay
                  address={record.processor}
                  info={participantCache.getParticipant(record.processor)}
                />
              </div>
              <div style={styles.batchRow}>
                <span style={styles.label}>Processed quantity</span>
                <span>{formatGrams(record.inputQuantityGrams)}</span>
              </div>
              <div style={styles.batchRow}>
                <span style={styles.label}>Date</span>
                <span>{new Date(Number(record.processedAt) * 1000).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Batch History View
// ---------------------------------------------------------------------------

interface HistoryEntry {
  timestamp: number;
  sortKey: string;
  title: string;
  details: React.ReactNode;
  txHash?: string;
}

function BatchHistoryView({
  batchId,
  batches,
  transfers,
  materials,
  materialTransfers,
  processingRecords,
  ewasteProcessingEvents,
  participantCache,
  provider,
  onBack,
}: {
  batchId: number;
  batches: BatchInfo[];
  transfers: TransferInfo[];
  materials: RecoveredMaterialInfo[];
  materialTransfers: MaterialTransferInfo[];
  processingRecords: MaterialProcessingRecordInfo[];
  ewasteProcessingEvents: ProcessingEventInfo[];
  participantCache: ReturnType<typeof useParticipantCache>;
  provider: BrowserProvider;
  onBack: () => void;
}) {
  const batch = batches.find((b) => Number(b.id) === batchId);

  const batchTransfers = transfers.filter((t) => Number(t.batchId) === batchId);
  const batchMaterials = materials.filter((m) => Number(m.batchId) === batchId);
  const batchMaterialTransfers = materialTransfers.filter((t) => Number(t.batchId) === batchId);
  const batchProcessingRecords = processingRecords.filter((r) => Number(r.batchId) === batchId);
  const batchEwasteEvents = ewasteProcessingEvents.filter((e) => Number(e.batchId) === batchId);

  const [historyEvents, setHistoryEvents] = useState<BatchHistoryEventInfo[]>([]);

  const ewasteTransferKey = batchTransfers.map((t) => Number(t.id)).join(",");
  const materialTransferKey = batchMaterialTransfers.map((t) => Number(t.id)).join(",");

  useEffect(() => {
    let cancelled = false;
    async function fetchEvents() {
      const ewasteTransferIds = ewasteTransferKey
        ? ewasteTransferKey.split(",").map(Number)
        : [];
      const materialTransferIds = materialTransferKey
        ? materialTransferKey.split(",").map(Number)
        : [];
      try {
        const events = await getBatchHistoryEvents(
          provider,
          batchId,
          ewasteTransferIds,
          materialTransferIds,
        );
        if (!cancelled) setHistoryEvents(events);
      } catch {
        if (!cancelled) setHistoryEvents([]);
      }
    }
    fetchEvents();
    return () => { cancelled = true; };
  }, [provider, batchId, ewasteTransferKey, materialTransferKey]);

  const cancelEventMap = new Map<number, BatchHistoryEventInfo>();
  const matCancelEventMap = new Map<number, BatchHistoryEventInfo>();
  let batchCompletedEvent: BatchHistoryEventInfo | null = null;
  for (const ev of historyEvents) {
    if (ev.batchId !== batchId) continue;
    if (ev.kind === "TransferCancelled" && ev.transferId !== null) {
      cancelEventMap.set(ev.transferId, ev);
    } else if (ev.kind === "MaterialTransferCancelled" && ev.transferId !== null) {
      matCancelEventMap.set(ev.transferId, ev);
    } else if (ev.kind === "BatchCompleted") {
      batchCompletedEvent = ev;
    }
  }

  const entries: HistoryEntry[] = [];

  if (batch) {
    const ts = Number(batch.createdAt);
    entries.push({
      timestamp: ts,
      sortKey: `batch-created-${batchId}`,
      title: "Batch Created",
      details: (
        <>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Generator</span>
            <ParticipantNameDisplay
              address={batch.generator}
              info={participantCache.getParticipant(batch.generator)}
            />
          </div>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Original quantity</span>
            <span>{formatGrams(batch.originalQuantityGrams)}</span>
          </div>
        </>
      ),
    });
  }

  for (const t of batchTransfers) {
    const ts = Number(t.createdAt);
    entries.push({
      timestamp: ts,
      sortKey: `transfer-created-${Number(t.id)}`,
      title: `E-Waste Transfer #${Number(t.id)} Created`,
      details: (
        <>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>From</span>
            <ParticipantNameDisplay
              address={t.sender}
              info={participantCache.getParticipant(t.sender)}
            />
          </div>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>To</span>
            <ParticipantNameDisplay
              address={t.receiver}
              info={participantCache.getParticipant(t.receiver)}
            />
          </div>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Declared quantity</span>
            <span>{formatGrams(t.declaredQuantityGrams)}</span>
          </div>
        </>
      ),
    });

    if (t.receivedQuantityGrams > 0n) {
      const ts = Number(t.receivedAt);
      entries.push({
        timestamp: ts,
        sortKey: `transfer-received-${Number(t.id)}`,
        title: `Transfer #${Number(t.id)} Quantity Received`,
        details: (
          <>
            <div style={styles.historyDetailRow}>
              <span style={styles.label}>Received quantity</span>
              <span>{formatGrams(t.receivedQuantityGrams)}</span>
            </div>
            {t.declaredQuantityGrams !== t.receivedQuantityGrams && (
              <div style={styles.historyDetailRow}>
                <span style={styles.label}>Discrepancy</span>
                <span>{formatGrams(t.declaredQuantityGrams - t.receivedQuantityGrams)}</span>
              </div>
            )}
          </>
        ),
      });
    }

    if (t.status === TRANSFER_STATUS.Confirmed && t.confirmedAt > 0n) {
      const ts = Number(t.confirmedAt);
      entries.push({
        timestamp: ts,
        sortKey: `transfer-confirmed-${Number(t.id)}`,
        title: `Transfer #${Number(t.id)} Confirmed`,
        details: (
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Status</span>
            <span>Confirmed</span>
          </div>
        ),
      });
    }

    if (t.status === TRANSFER_STATUS.Cancelled) {
      const cancelEv = cancelEventMap.get(Number(t.id));
      entries.push({
        timestamp: cancelEv ? cancelEv.timestamp : 0,
        sortKey: `transfer-cancelled-${Number(t.id)}`,
        title: `Transfer #${Number(t.id)} Cancelled`,
        txHash: cancelEv ? cancelEv.txHash : undefined,
        details: (
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Status</span>
            <span>Cancelled</span>
          </div>
        ),
      });
    }
  }

  for (const e of batchEwasteEvents) {
    const ts = Number(e.processedAt);
    entries.push({
      timestamp: ts,
      sortKey: `ewaste-processed-${Number(e.id)}`,
      title: `E-Waste Processed (Event #${Number(e.id)})`,
      details: (
        <>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Recycler</span>
            <ParticipantNameDisplay
              address={e.recycler}
              info={participantCache.getParticipant(e.recycler)}
            />
          </div>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Input quantity</span>
            <span>{formatGrams(e.inputQuantityGrams)}</span>
          </div>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Residual</span>
            <span>{formatGrams(e.residualGrams)}</span>
          </div>
        </>
      ),
    });
  }

  for (const m of batchMaterials) {
    const ts = Number(m.createdAt);
    entries.push({
      timestamp: ts,
      sortKey: `material-created-${Number(m.id)}`,
      title: `Recovered Material #${Number(m.id)} Created`,
      details: (
        <>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Type</span>
            <span>{m.materialType}</span>
          </div>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Recycler</span>
            <ParticipantNameDisplay
              address={m.recycler}
              info={participantCache.getParticipant(m.recycler)}
            />
          </div>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Produced quantity</span>
            <span>{formatGrams(m.producedQuantityGrams)}</span>
          </div>
        </>
      ),
    });
  }

  for (const t of batchMaterialTransfers) {
    const material = batchMaterials.find((m) => Number(m.id) === Number(t.materialId));
    const ts = Number(t.createdAt);
    entries.push({
      timestamp: ts,
      sortKey: `material-transfer-created-${Number(t.id)}`,
      title: `Material Transfer #${Number(t.id)} Created`,
      details: (
        <>
          {material && (
            <div style={styles.historyDetailRow}>
              <span style={styles.label}>Material</span>
              <span>#{Number(material.id)} — {material.materialType}</span>
            </div>
          )}
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>From</span>
            <ParticipantNameDisplay
              address={t.sender}
              info={participantCache.getParticipant(t.sender)}
            />
          </div>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>To</span>
            <ParticipantNameDisplay
              address={t.receiver}
              info={participantCache.getParticipant(t.receiver)}
            />
          </div>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Declared quantity</span>
            <span>{formatGrams(t.declaredQuantityGrams)}</span>
          </div>
        </>
      ),
    });

    if (t.receivedQuantityGrams > 0n) {
      const ts = Number(t.receivedAt);
      entries.push({
        timestamp: ts,
        sortKey: `material-transfer-received-${Number(t.id)}`,
        title: `Material Transfer #${Number(t.id)} Quantity Received`,
        details: (
          <>
            <div style={styles.historyDetailRow}>
              <span style={styles.label}>Received quantity</span>
              <span>{formatGrams(t.receivedQuantityGrams)}</span>
            </div>
            {t.declaredQuantityGrams !== t.receivedQuantityGrams && (
              <div style={styles.historyDetailRow}>
                <span style={styles.label}>Discrepancy</span>
                <span>{formatGrams(t.declaredQuantityGrams - t.receivedQuantityGrams)}</span>
              </div>
            )}
          </>
        ),
      });
    }

    if (t.status === TRANSFER_STATUS.Confirmed && t.confirmedAt > 0n) {
      const ts = Number(t.confirmedAt);
      entries.push({
        timestamp: ts,
        sortKey: `material-transfer-confirmed-${Number(t.id)}`,
        title: `Material Transfer #${Number(t.id)} Confirmed`,
        details: (
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Status</span>
            <span>Confirmed</span>
          </div>
        ),
      });
    }

    if (t.status === TRANSFER_STATUS.Cancelled) {
      const cancelEv = matCancelEventMap.get(Number(t.id));
      entries.push({
        timestamp: cancelEv ? cancelEv.timestamp : 0,
        sortKey: `material-transfer-cancelled-${Number(t.id)}`,
        title: `Material Transfer #${Number(t.id)} Cancelled`,
        txHash: cancelEv ? cancelEv.txHash : undefined,
        details: (
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Status</span>
            <span>Cancelled</span>
          </div>
        ),
      });
    }
  }

  for (const r of batchProcessingRecords) {
    const ts = Number(r.processedAt);
    entries.push({
      timestamp: ts,
      sortKey: `material-processed-${Number(r.id)}`,
      title: `Material Processed (Record #${Number(r.id)})`,
      details: (
        <>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Material</span>
            <span>#{Number(r.materialId)}</span>
          </div>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Processor</span>
            <ParticipantNameDisplay
              address={r.processor}
              info={participantCache.getParticipant(r.processor)}
            />
          </div>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Processed quantity</span>
            <span>{formatGrams(r.inputQuantityGrams)}</span>
          </div>
        </>
      ),
    });
  }

  if (batchCompletedEvent) {
    entries.push({
      timestamp: batchCompletedEvent.timestamp,
      sortKey: `batch-completed-${batchId}`,
      title: "Batch Completed",
      txHash: batchCompletedEvent.txHash,
      details: (
        <>
          <div style={styles.historyDetailRow}>
            <span style={styles.label}>Completed by</span>
            <ParticipantNameDisplay
              address={batchCompletedEvent.processor ?? ""}
              info={participantCache.getParticipant(batchCompletedEvent.processor ?? "")}
            />
          </div>
        </>
      ),
    });
  }

  entries.sort((a, b) => {
    if (a.timestamp === 0 && b.timestamp === 0) return a.sortKey.localeCompare(b.sortKey);
    if (a.timestamp === 0) return 1;
    if (b.timestamp === 0) return -1;
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return a.sortKey.localeCompare(b.sortKey);
  });

  return (
    <div style={styles.section}>
      <h2 style={styles.h2}>Batch #{batchId} — History</h2>
      <button
        style={{ ...styles.buttonSmall, ...styles.buttonSecondary, marginBottom: 16 }}
        onClick={onBack}
      >
        Back to Batches
      </button>

      {batch ? (
        <div style={styles.batchCard}>
          <div style={styles.batchHeader}>
            <span style={styles.batchId}>Batch #{Number(batch.id)}</span>
            <span style={batch.status === BATCH_STATUS_ACTIVE ? styles.statusActive : styles.statusDone}>
              {batch.status === BATCH_STATUS_ACTIVE ? "Active" : "Completed"}
            </span>
          </div>
          <div style={styles.batchRow}>
            <span style={styles.label}>Generator</span>
            <ParticipantNameDisplay
              address={batch.generator}
              info={participantCache.getParticipant(batch.generator)}
            />
          </div>
          <div style={styles.batchRow}>
            <span style={styles.label}>Original quantity</span>
            <span>{formatGrams(batch.originalQuantityGrams)}</span>
          </div>
          <div style={styles.batchRow}>
            <span style={styles.label}>Available</span>
            <span>{formatGrams(batch.availableQuantityGrams)}</span>
          </div>
          <div style={styles.batchRow}>
            <span style={styles.label}>Created</span>
            <span>{formatDate(batch.createdAt)}</span>
          </div>
        </div>
      ) : (
        <p style={styles.statusText}>Batch not found.</p>
      )}

      <h3 style={styles.h3}>Lifecycle Timeline</h3>
      {entries.length === 0 ? (
        <p style={styles.statusText}>No lifecycle events recorded for this batch.</p>
      ) : (
        <div style={styles.timeline}>
          {entries.map((entry, idx) => (
            <div key={`${entry.sortKey}-${idx}`} style={styles.timelineItem}>
              <div style={styles.timelineDot} />
              <div style={styles.timelineContent}>
                <div style={styles.timelineHeader}>
                  <span style={styles.timelineTitle}>{entry.title}</span>
                  <span style={styles.timelineDate}>
                    {entry.timestamp > 0
                      ? new Date(entry.timestamp * 1000).toLocaleString()
                      : "Date unavailable"}
                  </span>
                </div>
                <div style={styles.timelineDetails}>{entry.details}</div>
                {entry.txHash && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${entry.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.txHashLink}
                  >
                    View transaction
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ConfigMissingBanner() {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>E-Waste Management Tracking System</h1>
        <div style={styles.warnBox}>
          <p style={{ margin: 0 }}>
            The contract address has not been configured yet. After deploying the
            contract, set the address in a <code>VITE_CONTRACT_ADDRESS</code> environment
            variable for the client application.
          </p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "40px 16px",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 720,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: "32px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: "0 0 4px 0",
    color: "#38bdf8",
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
    margin: "0 0 24px 0",
  },
  section: {
    marginTop: 24,
  },
  h2: {
    fontSize: 20,
    fontWeight: 600,
    margin: "0 0 16px 0",
    color: "#f1f5f9",
  },
  button: {
    width: "100%",
    padding: "14px 20px",
    fontSize: 16,
    fontWeight: 600,
    borderRadius: 10,
    border: "none",
    backgroundColor: "#0ea5e9",
    color: "#fff",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  buttonGreen: {
    backgroundColor: "#16a34a",
  },
  buttonBlue: {
    backgroundColor: "#2563eb",
  },
  buttonRed: {
    backgroundColor: "#dc2626",
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  walletBox: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  walletRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #334155",
    gap: 12,
  },
  label: {
    fontWeight: 600,
    color: "#94a3b8",
    flexShrink: 0,
  },
  mono: {
    fontFamily: "monospace",
    fontSize: 13,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  participantNameCell: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
    gap: 2,
  },
  participantName: {
    fontWeight: 600,
    color: "#e2e8f0",
    fontSize: 14,
  },
  ok: { color: "#4ade80", fontWeight: 600 },
  bad: { color: "#f87171", fontWeight: 600 },
  statusText: { color: "#94a3b8", marginBottom: 12 },
  errorBox: {
    backgroundColor: "#7f1d1d",
    color: "#fecaca",
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 14,
  },
  warnBox: {
    backgroundColor: "#78350f",
    color: "#fde68a",
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 14,
  },
  infoBox: {
    backgroundColor: "#1e3a8a",
    color: "#bfdbfe",
    padding: 16,
    borderRadius: 10,
    marginTop: 16,
    fontSize: 14,
  },
  registeredBox: {
    backgroundColor: "#064e3b",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  formGroup: { marginBottom: 16 },
  formLabel: {
    display: "block",
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 6,
    color: "#cbd5e1",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    fontSize: 15,
    borderRadius: 8,
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    boxSizing: "border-box" as const,
  },
  select: {
    width: "100%",
    padding: "12px 14px",
    fontSize: 15,
    borderRadius: 8,
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    boxSizing: "border-box" as const,
  },
  hint: {
    fontSize: 13,
    color: "#64748b",
    margin: "6px 0 0 0",
  },
  batchList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  batchCard: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
    border: "1px solid #334155",
  },
  batchHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  batchId: {
    fontSize: 16,
    fontWeight: 700,
    color: "#38bdf8",
  },
  statusActive: {
    fontSize: 12,
    fontWeight: 600,
    color: "#4ade80",
    backgroundColor: "#064e3b",
    padding: "4px 10px",
    borderRadius: 20,
  },
  statusDone: {
    fontSize: 12,
    fontWeight: 600,
    color: "#94a3b8",
    backgroundColor: "#374151",
    padding: "4px 10px",
    borderRadius: 20,
  },
  batchRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    borderBottom: "1px solid #1e293b",
    gap: 12,
  },
  custodyCard: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    border: "1px solid #334155",
  },
  custodyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badge: {
    fontSize: 12,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 20,
  },
  badgePending: {
    color: "#fde68a",
    backgroundColor: "#78350f",
  },
  badgeReceived: {
    color: "#bfdbfe",
    backgroundColor: "#1e3a8a",
  },
  badgeConfirmed: {
    color: "#6ee7b7",
    backgroundColor: "#064e3b",
  },
  badgeCancelled: {
    color: "#fca5a5",
    backgroundColor: "#7f1d1d",
  },
  actionGroup: {
    marginTop: 12,
  },
  inlineForm: {
    display: "flex",
    gap: 8,
  },
  materialRow: {
    display: "flex",
    gap: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  buttonSmall: {
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 8,
    border: "none",
    color: "#fff",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  buttonSecondary: {
    backgroundColor: "#475569",
  },
  materialTypeBadge: {
    fontSize: 12,
    fontWeight: 600,
    color: "#bfdbfe",
    backgroundColor: "#1e3a8a",
    padding: "4px 10px",
    borderRadius: 20,
  },
  balanceOk: {
    backgroundColor: "#064e3b",
    color: "#6ee7b7",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 14,
  },
  balanceBad: {
    backgroundColor: "#7f1d1d",
    color: "#fecaca",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 14,
  },
  txBox: { marginTop: 16, padding: 16, borderRadius: 10, fontSize: 14 },
  txConfirmed: { backgroundColor: "#064e3b", color: "#6ee7b7" },
  txFailed: { backgroundColor: "#7f1d1d", color: "#fecaca" },
  txRejected: { backgroundColor: "#78350f", color: "#fde68a" },
  txPending: { backgroundColor: "#1e3a8a", color: "#93c5fd" },
  txPreparing: { backgroundColor: "#374151", color: "#d1d5db" },
  txMessage: { margin: "0 0 4px 0", fontWeight: 600 },
  txHash: { margin: 0, fontSize: 13, fontFamily: "monospace" },
  link: { color: "#38bdf8" },
  tableWrap: {
    overflowX: "auto" as const,
  },
  tableHead: {
    display: "flex",
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "2px solid #334155",
    fontSize: 12,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    gap: 8,
    minWidth: 640,
  },
  tableRow: {
    display: "flex",
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "1px solid #1e293b",
    fontSize: 14,
    gap: 8,
    minWidth: 640,
    transition: "background-color 0.15s",
  },
  tableRowClickable: {
    cursor: "pointer",
  },
  colId: {
    flex: "0 0 56px",
    fontWeight: 700,
    color: "#38bdf8",
  },
  colFlex: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
  },
  colQty: {
    flex: "0 0 80px",
    textAlign: "right" as const,
    whiteSpace: "nowrap" as const,
  },
  colStatus: {
    flex: "0 0 90px",
    textAlign: "center" as const,
  },
  colDate: {
    flex: "0 0 140px",
    fontSize: 12,
    color: "#94a3b8",
    whiteSpace: "nowrap" as const,
  },
  filterBar: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 12,
    marginBottom: 16,
  },
  filterGroup: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 4,
  },
  filterBtn: {
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#94a3b8",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  filterBtnActive: {
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: "1px solid #38bdf8",
    backgroundColor: "#0c4a6e",
    color: "#e0f2fe",
    cursor: "pointer",
  },
  fromToCell: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  fromToLine: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
  },
  fromToArrow: {
    color: "#64748b",
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    width: 32,
  },
  rowDetail: {
    backgroundColor: "#172033",
    borderRadius: 10,
    padding: 16,
    margin: "4px 0 12px 0",
    border: "1px solid #334155",
    minWidth: 640,
  },
  rowDetailMeta: {
    display: "flex",
    flexWrap: "wrap" as const,
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 12,
  },
  rowDetailApprovals: {
    fontSize: 13,
  },
  colAction: {
    flex: "0 0 110px",
    textAlign: "center" as const,
  },
  h3: {
    fontSize: 16,
    fontWeight: 600,
    margin: "20px 0 12px 0",
    color: "#f1f5f9",
  },
  timeline: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 0,
  },
  timelineItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    paddingBottom: 16,
    position: "relative" as const,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    backgroundColor: "#38bdf8",
    flexShrink: 0,
    marginTop: 5,
  },
  timelineContent: {
    flex: 1,
    minWidth: 0,
  },
  timelineHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: 8,
    marginBottom: 6,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e2e8f0",
  },
  timelineDate: {
    fontSize: 12,
    color: "#94a3b8",
    whiteSpace: "nowrap" as const,
  },
  timelineDetails: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: "10px 14px",
    border: "1px solid #334155",
  },
  historyDetailRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "3px 0",
    gap: 12,
    fontSize: 13,
  },
  txHashLink: {
    display: "inline-block",
    marginTop: 6,
    fontSize: 12,
    color: "#38bdf8",
    textDecoration: "none",
  },
};
