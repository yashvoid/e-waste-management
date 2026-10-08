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
} from "./contract";
import type { ParticipantInfo, BatchInfo, TransferInfo, RecoveredMaterialInfo, MaterialTransferInfo, MaterialProcessingRecordInfo, TxStatus } from "./types";
import { GRAMS_PER_KG, TRANSFER_STATUS, TRANSFER_STATUS_LABELS } from "./types";

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

  const isGenerator = participant?.isRegistered === true && participant.role === ROLE_GENERATOR;
  const isRecycler = participant?.isRegistered === true && participant.role === ROLE_RECYCLER;
  const isMaterialProcessor = participant?.isRegistered === true && participant.role === ROLE_MATERIAL_PROCESSOR;

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

  useEffect(() => {
    if (wallet && isCorrectNetwork) {
      fetchParticipant();
      fetchBatches();
      fetchTransfers();
      fetchMaterials();
      fetchMaterialTransfers();
      fetchProcessingRecords();
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
    }
  }, [wallet, isCorrectNetwork, fetchParticipant, fetchBatches, fetchTransfers, fetchMaterials, fetchMaterialTransfers, fetchProcessingRecords]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchBatches(), fetchTransfers(), fetchMaterials(), fetchMaterialTransfers(), fetchProcessingRecords()]);
  }, [fetchBatches, fetchTransfers, fetchMaterials, fetchMaterialTransfers, fetchProcessingRecords]);

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

                {!isGenerator && participant?.isRegistered && (
                  <div style={styles.infoBox}>
                    Batch creation is only available to Generators. Your role is{" "}
                    {ROLE_LABELS[participant.role] ?? "Unknown"}.
                  </div>
                )}

                {participant?.isRegistered && (
                  <div style={styles.section}>
                    <h2 style={styles.h2}>E-Waste Batches ({batchCount})</h2>
                    {loadingBatches && <p style={styles.statusText}>Loading batches...</p>}
                    {!loadingBatches && batches.length === 0 && (
                      <p style={styles.statusText}>No batches have been created yet.</p>
                    )}
                    {batches.length > 0 && (
                      <div style={styles.batchList}>
                        {batches.map((batch) => (
                          <div key={Number(batch.id)} style={styles.batchCard}>
                            <div style={styles.batchHeader}>
                              <span style={styles.batchId}>Batch #{Number(batch.id)}</span>
                              <span style={batch.status === BATCH_STATUS_ACTIVE ? styles.statusActive : styles.statusDone}>
                                {batch.status === BATCH_STATUS_ACTIVE ? "Active" : "Completed"}
                              </span>
                            </div>
                            <div style={styles.batchRow}>
                              <span style={styles.label}>Generator</span>
                              <span style={styles.mono}>{shortAddr(batch.generator)}</span>
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
                              <span style={styles.label}>Pending</span>
                              <span>{formatGrams(batch.pendingQuantityGrams)}</span>
                            </div>
                            <div style={styles.batchRow}>
                              <span style={styles.label}>Created</span>
                              <span>{new Date(Number(batch.createdAt) * 1000).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {participant?.isRegistered && (
                  <BatchCustodySection
                    wallet={wallet}
                    participant={participant}
                    batches={batches}
                    loadingBatches={loadingBatches}
                  />
                )}

                {participant?.isRegistered && participant.role !== ROLE_MATERIAL_PROCESSOR && (
                  <CreateTransferSection
                    wallet={wallet}
                    participant={participant}
                    batches={batches}
                    transferTxStatus={transferTxStatus}
                    setTransferTxStatus={setTransferTxStatus}
                    onSuccess={refreshAll}
                  />
                )}

                {participant?.isRegistered && (
                  <TransfersSection
                    wallet={wallet}
                    participant={participant}
                    transfers={transfers}
                    loadingTransfers={loadingTransfers}
                    transferCount={transferCount}
                    onRefresh={refreshAll}
                  />
                )}

                {isRecycler && (
                  <ProcessEwasteSection
                    wallet={wallet}
                    batches={batches}
                    onSuccess={refreshAll}
                  />
                )}

                {participant?.isRegistered && (
                  <MaterialsSection
                    wallet={wallet}
                    materials={materials}
                    materialCount={materialCount}
                    loadingMaterials={loadingMaterials}
                    participant={participant}
                  />
                )}

                {isRecycler && (
                  <CreateMaterialTransferSection
                    wallet={wallet}
                    materials={materials}
                    onSuccess={refreshAll}
                  />
                )}

                {participant?.isRegistered && (
                  <MaterialTransfersSection
                    wallet={wallet}
                    participant={participant}
                    materialTransfers={materialTransfers}
                    loadingMaterialTransfers={loadingMaterialTransfers}
                    materialTransferCount={materialTransferCount}
                    onRefresh={refreshAll}
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

                {participant?.isRegistered && (
                  <ProcessingHistorySection
                    processingRecords={processingRecords}
                    processingRecordCount={processingRecordCount}
                    loadingProcessingRecords={loadingProcessingRecords}
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
    return (
      <div style={styles.section}>
        <h2 style={styles.h2}>Create Transfer</h2>
        <p style={styles.statusText}>
          Your role ({ROLE_LABELS[participant.role]}) cannot create e-waste transfers.
        </p>
      </div>
    );
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
}: {
  wallet: { address: string; provider: BrowserProvider };
  participant: ParticipantInfo;
  transfers: TransferInfo[];
  loadingTransfers: boolean;
  transferCount: number;
  onRefresh: () => Promise<void>;
}) {
  const [actionTxStatus, setActionTxStatus] = useState<TxStatus>({ state: "idle", message: "" });

  if (loadingTransfers) {
    return (
      <div style={styles.section}>
        <h2 style={styles.h2}>Transfers</h2>
        <p style={styles.statusText}>Loading transfers...</p>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <h2 style={styles.h2}>Transfers ({transferCount})</h2>
      <TxStatusBox txStatus={actionTxStatus} />

      {transfers.length === 0 ? (
        <p style={styles.statusText}>No transfers found.</p>
      ) : (
        <div style={styles.transferList}>
          {transfers.map((transfer) => (
            <TransferCard
              key={Number(transfer.id)}
              transfer={transfer}
              wallet={wallet}
              participant={participant}
              actionTxStatus={actionTxStatus}
              setActionTxStatus={setActionTxStatus}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TransferCard({
  transfer,
  wallet,
  participant,
  actionTxStatus,
  setActionTxStatus,
  onRefresh,
}: {
  transfer: TransferInfo;
  wallet: { address: string; provider: BrowserProvider };
  participant: ParticipantInfo;
  actionTxStatus: TxStatus;
  setActionTxStatus: (s: TxStatus) => void;
  onRefresh: () => Promise<void>;
}) {
  const [receiveQtyKg, setReceiveQtyKg] = useState<string>("");

  const isSender = transfer.sender.toLowerCase() === wallet.address.toLowerCase();
  const isReceiver = transfer.receiver.toLowerCase() === wallet.address.toLowerCase();
  const status = transfer.status;
  const statusLabel = TRANSFER_STATUS_LABELS[status] ?? "Unknown";

  const canReceive = isReceiver && status === TRANSFER_STATUS.Pending;
  const canApproveSender = isSender && status === TRANSFER_STATUS.Received && !transfer.senderApproved;
  const canApproveReceiver = isReceiver && status === TRANSFER_STATUS.Received && !transfer.receiverApproved;
  const canCancel = isSender && status === TRANSFER_STATUS.Pending;

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

  return (
    <div style={styles.transferCard}>
      <div style={styles.transferHeader}>
        <span style={styles.transferId}>Transfer #{Number(transfer.id)}</span>
        <span style={statusBadgeStyle(status)}>{statusLabel}</span>
      </div>

      <div style={styles.batchRow}>
        <span style={styles.label}>Batch</span>
        <span>#{Number(transfer.batchId)}</span>
      </div>
      <div style={styles.batchRow}>
        <span style={styles.label}>Sender</span>
        <span style={styles.mono}>{shortAddr(transfer.sender)}</span>
      </div>
      <div style={styles.batchRow}>
        <span style={styles.label}>Receiver</span>
        <span style={styles.mono}>{shortAddr(transfer.receiver)}</span>
      </div>
      <div style={styles.batchRow}>
        <span style={styles.label}>Declared quantity</span>
        <span>{formatGrams(transfer.declaredQuantityGrams)}</span>
      </div>
      <div style={styles.batchRow}>
        <span style={styles.label}>Received quantity</span>
        <span>
          {transfer.receivedQuantityGrams > 0n
            ? formatGrams(transfer.receivedQuantityGrams)
            : "—"}
        </span>
      </div>
      <div style={styles.batchRow}>
        <span style={styles.label}>Created</span>
        <span>{new Date(Number(transfer.createdAt) * 1000).toLocaleString()}</span>
      </div>

      {status >= TRANSFER_STATUS.Received && status !== TRANSFER_STATUS.Cancelled && (
        <div style={styles.approvalRow}>
          <span style={styles.label}>Sender approval</span>
          <span style={transfer.senderApproved ? styles.approved : styles.pendingApproval}>
            {transfer.senderApproved ? "Approved" : "Pending"}
          </span>
        </div>
      )}
      {status >= TRANSFER_STATUS.Received && status !== TRANSFER_STATUS.Cancelled && (
        <div style={styles.approvalRow}>
          <span style={styles.label}>Receiver approval</span>
          <span style={transfer.receiverApproved ? styles.approved : styles.pendingApproval}>
            {transfer.receiverApproved ? "Approved" : "Pending"}
          </span>
        </div>
      )}

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

      {!isSender && !isReceiver && (
        <p style={styles.hint}>You are not a party to this transfer.</p>
      )}
    </div>
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

function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
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
}: {
  wallet: { address: string; provider: BrowserProvider };
  materials: RecoveredMaterialInfo[];
  materialCount: number;
  loadingMaterials: boolean;
  participant: ParticipantInfo;
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
                <span style={styles.mono}>{shortAddr(material.recycler)}</span>
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
}: {
  wallet: { address: string; provider: BrowserProvider };
  participant: ParticipantInfo;
  materialTransfers: MaterialTransferInfo[];
  loadingMaterialTransfers: boolean;
  materialTransferCount: number;
  onRefresh: () => Promise<void>;
}) {
  const [actionTxStatus, setActionTxStatus] = useState<TxStatus>({ state: "idle", message: "" });

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
      <TxStatusBox txStatus={actionTxStatus} />

      {materialTransfers.length === 0 ? (
        <p style={styles.statusText}>No material transfers found.</p>
      ) : (
        <div style={styles.transferList}>
          {materialTransfers.map((transfer) => (
            <MaterialTransferCard
              key={Number(transfer.id)}
              transfer={transfer}
              wallet={wallet}
              participant={participant}
              actionTxStatus={actionTxStatus}
              setActionTxStatus={setActionTxStatus}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MaterialTransferCard({
  transfer,
  wallet,
  actionTxStatus,
  setActionTxStatus,
  onRefresh,
}: {
  transfer: MaterialTransferInfo;
  wallet: { address: string; provider: BrowserProvider };
  participant: ParticipantInfo;
  actionTxStatus: TxStatus;
  setActionTxStatus: (s: TxStatus) => void;
  onRefresh: () => Promise<void>;
}) {
  const [receiveQtyKg, setReceiveQtyKg] = useState<string>("");

  const isSender = transfer.sender.toLowerCase() === wallet.address.toLowerCase();
  const isReceiver = transfer.receiver.toLowerCase() === wallet.address.toLowerCase();
  const status = transfer.status;
  const statusLabel = TRANSFER_STATUS_LABELS[status] ?? "Unknown";

  const canReceive = isReceiver && status === TRANSFER_STATUS.Pending;
  const canApproveSender = isSender && status === TRANSFER_STATUS.Received && !transfer.senderApproved;
  const canApproveReceiver = isReceiver && status === TRANSFER_STATUS.Received && !transfer.receiverApproved;
  const canCancel = isSender && status === TRANSFER_STATUS.Pending;

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

  return (
    <div style={styles.transferCard}>
      <div style={styles.transferHeader}>
        <span style={styles.transferId}>Material Transfer #{Number(transfer.id)}</span>
        <span style={statusBadgeStyle(status)}>{statusLabel}</span>
      </div>

      <div style={styles.batchRow}>
        <span style={styles.label}>Material</span>
        <span>#{Number(transfer.materialId)}</span>
      </div>
      <div style={styles.batchRow}>
        <span style={styles.label}>Batch</span>
        <span>#{Number(transfer.batchId)}</span>
      </div>
      <div style={styles.batchRow}>
        <span style={styles.label}>Sender</span>
        <span style={styles.mono}>{shortAddr(transfer.sender)}</span>
      </div>
      <div style={styles.batchRow}>
        <span style={styles.label}>Receiver</span>
        <span style={styles.mono}>{shortAddr(transfer.receiver)}</span>
      </div>
      <div style={styles.batchRow}>
        <span style={styles.label}>Declared quantity</span>
        <span>{formatGrams(transfer.declaredQuantityGrams)}</span>
      </div>
      <div style={styles.batchRow}>
        <span style={styles.label}>Received quantity</span>
        <span>
          {transfer.receivedQuantityGrams > 0n
            ? formatGrams(transfer.receivedQuantityGrams)
            : "—"}
        </span>
      </div>
      <div style={styles.batchRow}>
        <span style={styles.label}>Created</span>
        <span>{new Date(Number(transfer.createdAt) * 1000).toLocaleString()}</span>
      </div>

      {status >= TRANSFER_STATUS.Received && status !== TRANSFER_STATUS.Cancelled && (
        <div style={styles.approvalRow}>
          <span style={styles.label}>Sender approval</span>
          <span style={transfer.senderApproved ? styles.approved : styles.pendingApproval}>
            {transfer.senderApproved ? "Approved" : "Pending"}
          </span>
        </div>
      )}
      {status >= TRANSFER_STATUS.Received && status !== TRANSFER_STATUS.Cancelled && (
        <div style={styles.approvalRow}>
          <span style={styles.label}>Receiver approval</span>
          <span style={transfer.receiverApproved ? styles.approved : styles.pendingApproval}>
            {transfer.receiverApproved ? "Approved" : "Pending"}
          </span>
        </div>
      )}

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

      {!isSender && !isReceiver && (
        <p style={styles.hint}>You are not a party to this transfer.</p>
      )}
    </div>
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
}: {
  processingRecords: MaterialProcessingRecordInfo[];
  processingRecordCount: number;
  loadingProcessingRecords: boolean;
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
                <span style={styles.mono}>{shortAddr(record.processor)}</span>
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
  transferList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  transferCard: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 16,
    border: "1px solid #334155",
  },
  transferHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  transferId: {
    fontSize: 15,
    fontWeight: 700,
    color: "#38bdf8",
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
  approvalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 0",
    gap: 12,
  },
  approved: {
    color: "#4ade80",
    fontWeight: 600,
  },
  pendingApproval: {
    color: "#fde68a",
    fontWeight: 600,
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
};
