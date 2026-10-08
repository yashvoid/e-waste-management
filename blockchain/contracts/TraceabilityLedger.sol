// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title TraceabilityLedger
/// @notice Main smart contract for the E-Waste Management Tracking System.
///         Acts as a shared, tamper-resistant traceability and rule-enforcement
///         layer between independent participants (Generators, Collectors,
///         Transporters, Recyclers, and Material Processors).
///
/// @dev    No admin, owner, or central authority exists in this system.
///         Organizations register themselves decentralised via their own wallet.
contract TraceabilityLedger {

    // -------------------------------------------------------------------------
    // Enums
    // -------------------------------------------------------------------------

    /// @notice Roles that an organization can register as.
    /// @dev    Each role has specific permissions enforced by the contract.
    enum Role {
        Generator,
        Collector,
        Transporter,
        Recycler,
        MaterialProcessor
    }

    /// @notice Lifecycle status of an e-waste batch.
    /// @dev    Active = batch is in progress; Completed = batch lifecycle ended (Phase 5+).
    enum BatchStatus {
        Active,
        Completed
    }

    /// @notice Lifecycle status of a custody transfer.
    /// @dev    Pending → Received → Confirmed, or Pending → Cancelled.
    enum TransferStatus {
        Pending,
        Received,
        Confirmed,
        Cancelled
    }

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    /// @notice A registered participant organization.
    struct Participant {
        string name;
        Role role;
        bool isRegistered;
        uint256 registeredAt;
    }

    /// @notice An e-waste batch created by a Generator.
    /// @dev    availableQuantity represents the quantity the current custodian
    ///         can still transfer. pendingQuantity is reserved for future
    ///         transfer logic (Phase 3+ transfers) and is zero at creation.
    struct Batch {
        uint256 id;
        address generator;
        uint256 originalQuantityGrams;
        uint256 availableQuantityGrams;
        uint256 pendingQuantityGrams;
        uint256 createdAt;
        BatchStatus status;
        bool exists;
    }

    /// @notice A custody transfer of e-waste between two participants.
    /// @dev    Created by the sender, received by the receiver, and confirmed
    ///         only after both parties approve.
    struct Transfer {
        uint256 id;
        uint256 batchId;
        address sender;
        address receiver;
        uint256 declaredQuantityGrams;
        uint256 receivedQuantityGrams;
        TransferStatus status;
        bool senderApproved;
        bool receiverApproved;
        uint256 createdAt;
        uint256 receivedAt;
        uint256 confirmedAt;
        bool exists;
    }

    /// @notice A recovered material produced by a Recycler from processing e-waste.
    /// @dev    Each material is linked to its originating batch and the Recycler
    ///         who produced it. availableQuantityGrams tracks the remaining
    ///         quantity that has not yet been transferred to a Material Processor.
    struct RecoveredMaterial {
        uint256 id;
        uint256 batchId;
        address recycler;
        string materialType;
        uint256 producedQuantityGrams;
        uint256 availableQuantityGrams;
        uint256 processingEventId;
        uint256 createdAt;
        bool exists;
    }

    /// @notice A processing event where a Recycler converts e-waste into recovered materials.
    /// @dev    Records the input e-waste quantity and the residual (unrecoverable portion)
    ///         so that Input = sum(recovered materials) + residual can be verified.
    struct ProcessingEvent {
        uint256 id;
        uint256 batchId;
        address recycler;
        uint256 inputQuantityGrams;
        uint256 residualGrams;
        uint256 processedAt;
        bool exists;
    }

    /// @notice A custody transfer of a recovered material from a Recycler to a Material Processor.
    /// @dev    Follows the same Pending → Received → Confirmed / Cancelled lifecycle
    ///         as e-waste transfers. Discrepancy (declared != received) is preserved
    ///         implicitly — the difference remains with the sender after confirmation.
    struct MaterialTransfer {
        uint256 id;
        uint256 materialId;
        uint256 batchId;
        address sender;
        address receiver;
        uint256 declaredQuantityGrams;
        uint256 receivedQuantityGrams;
        TransferStatus status;
        bool senderApproved;
        bool receiverApproved;
        uint256 createdAt;
        uint256 receivedAt;
        uint256 confirmedAt;
        bool exists;
    }

    /// @notice A record of a Material Processor processing recovered material.
/// @dev    Each record links back to the recovered material and the original batch,
///         preserving the full provenance chain: Batch → ProcessingEvent → RecoveredMaterial
///         → MaterialTransfer → MaterialProcessor custody → MaterialProcessing.
    struct MaterialProcessingRecord {
        uint256 id;
        uint256 materialId;
        uint256 batchId;
        address processor;
        uint256 inputQuantityGrams;
        uint256 processedAt;
        bool exists;
    }

    // -------------------------------------------------------------------------
    // State Variables
    // -------------------------------------------------------------------------

    mapping(address => Participant) private participants;
    address[] public participantAddresses;

    mapping(uint256 => Batch) private batches;
    uint256 public batchCount;

    /// @dev    Per-batch, per-wallet confirmed custody in grams.
    mapping(uint256 => mapping(address => uint256)) private confirmedCustody;

    /// @dev    Per-batch, per-wallet pending outgoing quantity in grams.
    mapping(uint256 => mapping(address => uint256)) private pendingOutgoing;

    mapping(uint256 => Transfer) private transfers;
    uint256 public transferCount;

    mapping(uint256 => RecoveredMaterial) private materials;
    uint256 public materialCount;

    mapping(uint256 => ProcessingEvent) private processingEvents;
    uint256 public processingEventCount;

    /// @dev    Per-material, per-wallet confirmed custody in grams.
    ///         For a Recycler this is initialized to producedQuantityGrams when the
    ///         material is created by processEwaste. For a Material Processor this is
    ///         credited when a material transfer is confirmed.
    mapping(uint256 => mapping(address => uint256)) private materialConfirmedCustody;

    /// @dev    Per-material, per-wallet pending outgoing quantity in grams.
    ///         Prevents double-spending: a Recycler cannot transfer more material than
    ///         they have confirmed minus what is already reserved in pending transfers.
    mapping(uint256 => mapping(address => uint256)) private materialPendingOutgoing;

    mapping(uint256 => MaterialTransfer) private materialTransfers;
    uint256 public materialTransferCount;

    mapping(uint256 => MaterialProcessingRecord) private materialProcessingRecords;
    uint256 public materialProcessingRecordCount;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event ParticipantRegistered(address indexed wallet, string name, Role role, uint256 timestamp);

    event BatchCreated(uint256 indexed batchId, address indexed generator, uint256 quantityGrams, uint256 timestamp);

    event TransferCreated(uint256 indexed transferId, uint256 indexed batchId, address indexed sender, address receiver, uint256 declaredQuantityGrams, uint256 timestamp);
    event QuantityReceived(uint256 indexed transferId, uint256 receivedQuantityGrams, uint256 timestamp);
    event TransferConfirmed(uint256 indexed transferId, uint256 confirmedAt);
    event TransferCancelled(uint256 indexed transferId, uint256 cancelledAt);

    event EwasteProcessed(uint256 indexed processingEventId, uint256 indexed batchId, address indexed recycler, uint256 inputQuantityGrams, uint256 residualGrams, uint256 timestamp);
    event MaterialRecovered(uint256 indexed materialId, uint256 indexed processingEventId, uint256 indexed batchId, address recycler, string materialType, uint256 quantityGrams, uint256 timestamp);

    event MaterialTransferCreated(uint256 indexed transferId, uint256 indexed materialId, uint256 indexed batchId, address sender, address receiver, uint256 declaredQuantityGrams, uint256 timestamp);
    event MaterialQuantityReceived(uint256 indexed transferId, uint256 receivedQuantityGrams, uint256 timestamp);
    event MaterialTransferConfirmed(uint256 indexed transferId, uint256 confirmedAt);
    event MaterialTransferCancelled(uint256 indexed transferId, uint256 cancelledAt);

    event MaterialProcessed(uint256 indexed processingRecordId, uint256 indexed materialId, uint256 indexed batchId, address processor, uint256 inputQuantityGrams, uint256 timestamp);

    event BatchCompleted(uint256 indexed batchId, address indexed processor, uint256 completedAt);

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyRegistered() {
        require(participants[msg.sender].isRegistered, "TraceabilityLedger: caller is not registered");
        _;
    }

    modifier onlyRole(Role _role) {
        require(participants[msg.sender].isRegistered, "TraceabilityLedger: caller is not registered");
        require(participants[msg.sender].role == _role, "TraceabilityLedger: caller does not have the required role");
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @notice No privileged accounts are set in the constructor.
    ///         The system has no admin or owner. Organizations register
    ///         themselves decentralised via their own wallet.
    constructor() {
        // Intentionally empty — no admin, no owner, no pre-set participants.
    }

    // -------------------------------------------------------------------------
    // Participant Registration
    // -------------------------------------------------------------------------

    /// @notice Registers the calling wallet as a participant organization.
    /// @dev    Identity is derived from msg.sender. The caller cannot register
    ///         another wallet. A wallet may only register once.
    /// @param  _name  The organization name (cannot be empty).
    /// @param  _role  One of the five valid roles (0–4).
    function registerParticipant(string memory _name, Role _role) external {
        require(!participants[msg.sender].isRegistered, "TraceabilityLedger: wallet already registered");
        require(bytes(_name).length > 0, "TraceabilityLedger: organization name cannot be empty");
        require(uint8(_role) <= uint8(Role.MaterialProcessor), "TraceabilityLedger: invalid role");

        participants[msg.sender] = Participant({
            name: _name,
            role: _role,
            isRegistered: true,
            registeredAt: block.timestamp
        });

        participantAddresses.push(msg.sender);

        emit ParticipantRegistered(msg.sender, _name, _role, block.timestamp);
    }

    /// @notice Returns the participant record for a given wallet.
    /// @param  _wallet  The wallet address to query.
    /// @return name           Organization name.
    /// @return role           Registered role.
    /// @return isRegistered   Whether the wallet is registered.
    /// @return registeredAt   Block timestamp of registration.
    function getParticipant(address _wallet)
        external
        view
        returns (string memory name, Role role, bool isRegistered, uint256 registeredAt)
    {
        Participant memory p = participants[_wallet];
        return (p.name, p.role, p.isRegistered, p.registeredAt);
    }

    /// @notice Returns the total number of registered participants.
    function getParticipantCount() external view returns (uint256) {
        return participantAddresses.length;
    }

    /// @notice Returns the wallet address at a given index in the participant list.
    /// @param  _index  The index in the participant list.
    function getParticipantAddress(uint256 _index) external view returns (address) {
        require(_index < participantAddresses.length, "TraceabilityLedger: index out of bounds");
        return participantAddresses[_index];
    }

    // -------------------------------------------------------------------------
    // E-Waste Batch Management (Phase 3)
    // -------------------------------------------------------------------------

    /// @notice Creates a new e-waste batch with the caller as the Generator.
    /// @dev    Only a registered Generator may call this. The batch ID is
    ///         assigned sequentially starting at 1, guaranteeing uniqueness.
    ///         The Generator becomes the initial custodian with full available
    ///         quantity. pendingQuantity is zero — no transfers exist yet.
    /// @param  _quantityGrams  The e-waste quantity in grams (must be > 0).
    /// @return batchId         The unique ID assigned to the new batch.
    function createBatch(uint256 _quantityGrams) external onlyRole(Role.Generator) returns (uint256) {
        require(_quantityGrams > 0, "TraceabilityLedger: quantity must be greater than zero");

        batchCount += 1;
        uint256 newBatchId = batchCount;

        batches[newBatchId] = Batch({
            id: newBatchId,
            generator: msg.sender,
            originalQuantityGrams: _quantityGrams,
            availableQuantityGrams: _quantityGrams,
            pendingQuantityGrams: 0,
            createdAt: block.timestamp,
            status: BatchStatus.Active,
            exists: true
        });

        confirmedCustody[newBatchId][msg.sender] = _quantityGrams;

        emit BatchCreated(newBatchId, msg.sender, _quantityGrams, block.timestamp);

        return newBatchId;
    }

    /// @notice Returns full batch information by ID.
    /// @param  _batchId  The batch ID to query.
    /// @return id                    The batch ID.
    /// @return generator             The Generator's wallet address.
    /// @return originalQuantityGrams The original quantity in grams.
    /// @return availableQuantityGrams The quantity currently available for transfer.
    /// @return pendingQuantityGrams  The quantity reserved in pending transfers.
    /// @return createdAt             Block timestamp of batch creation.
    /// @return status                The current batch status.
    /// @return exists                Whether the batch exists.
    function getBatch(uint256 _batchId)
        external
        view
        returns (
            uint256 id,
            address generator,
            uint256 originalQuantityGrams,
            uint256 availableQuantityGrams,
            uint256 pendingQuantityGrams,
            uint256 createdAt,
            BatchStatus status,
            bool exists
        )
    {
        Batch memory b = batches[_batchId];
        return (
            b.id,
            b.generator,
            b.originalQuantityGrams,
            b.availableQuantityGrams,
            b.pendingQuantityGrams,
            b.createdAt,
            b.status,
            b.exists
        );
    }

    /// @notice Returns whether a batch with the given ID exists.
    /// @param  _batchId  The batch ID to check.
    function batchExists(uint256 _batchId) external view returns (bool) {
        return batches[_batchId].exists;
    }

    /// @notice Returns the total number of batches created.
    function getBatchCount() external view returns (uint256) {
        return batchCount;
    }

    /// @notice Returns the batch ID at a given index (1-based enumeration).
    /// @dev    Batch IDs are sequential starting at 1, so index 0 = batch ID 1.
    /// @param  _index  The zero-based index into the batch list.
    function getBatchIdByIndex(uint256 _index) external view returns (uint256) {
        require(_index < batchCount, "TraceabilityLedger: index out of bounds");
        return _index + 1;
    }

    // -------------------------------------------------------------------------
    // E-Waste Transfers (Phase 4+)
    // -------------------------------------------------------------------------

    /// @dev    Internal check for a valid e-waste custody role transition.
    ///         Only Generator→Collector, Collector→Transporter, and
    ///         Transporter→Recycler are permitted.
    function _isValidEwasteTransition(Role _from, Role _to) private pure returns (bool) {
        if (_from == Role.Generator && _to == Role.Collector) return true;
        if (_from == Role.Collector && _to == Role.Transporter) return true;
        if (_from == Role.Transporter && _to == Role.Recycler) return true;
        return false;
    }

    /// @notice Creates a new e-waste custody transfer from the caller to a receiver.
    /// @dev    The sender is always msg.sender. Only valid e-waste role transitions
    ///         are allowed. The declared quantity is reserved as pending outgoing
    ///         and cannot be reused for another transfer until the lifecycle resolves.
    /// @param  _batchId        The batch to transfer from.
    /// @param  _receiver       The registered receiver's wallet address.
    /// @param  _quantityGrams  The declared quantity in grams (must be > 0 and <= available custody).
    /// @return transferId      The unique ID assigned to the new transfer.
    function createTransfer(uint256 _batchId, address _receiver, uint256 _quantityGrams)
        external
        onlyRegistered
        returns (uint256)
    {
        require(batches[_batchId].exists, "TraceabilityLedger: batch does not exist");
        require(batches[_batchId].status == BatchStatus.Active, "TraceabilityLedger: batch is not active");
        require(participants[_receiver].isRegistered, "TraceabilityLedger: receiver is not registered");
        require(_receiver != msg.sender, "TraceabilityLedger: sender and receiver must differ");
        require(
            _isValidEwasteTransition(participants[msg.sender].role, participants[_receiver].role),
            "TraceabilityLedger: invalid role transition"
        );
        require(_quantityGrams > 0, "TraceabilityLedger: quantity must be greater than zero");

        uint256 available = confirmedCustody[_batchId][msg.sender] - pendingOutgoing[_batchId][msg.sender];
        require(_quantityGrams <= available, "TraceabilityLedger: quantity exceeds available custody");

        transferCount += 1;
        uint256 newTransferId = transferCount;

        transfers[newTransferId] = Transfer({
            id: newTransferId,
            batchId: _batchId,
            sender: msg.sender,
            receiver: _receiver,
            declaredQuantityGrams: _quantityGrams,
            receivedQuantityGrams: 0,
            status: TransferStatus.Pending,
            senderApproved: false,
            receiverApproved: false,
            createdAt: block.timestamp,
            receivedAt: 0,
            confirmedAt: 0,
            exists: true
        });

        pendingOutgoing[_batchId][msg.sender] += _quantityGrams;
        batches[_batchId].pendingQuantityGrams += _quantityGrams;
        batches[_batchId].availableQuantityGrams -= _quantityGrams;

        emit TransferCreated(newTransferId, _batchId, msg.sender, _receiver, _quantityGrams, block.timestamp);

        return newTransferId;
    }

    /// @notice Allows the receiver of a pending transfer to record the actual received quantity.
    /// @dev    Only the transfer's receiver may call this. The transfer must be in Pending
    ///         status. The received quantity must be > 0 and <= the declared quantity.
    ///         No custody movement occurs in this phase — the receiver only reports what
    ///         physically arrived. Custody moves during confirmation (Phase 4.4).
    /// @param  _transferId           The transfer to receive.
    /// @param  _receivedQuantityGrams The actual quantity received in grams.
    function receiveTransfer(uint256 _transferId, uint256 _receivedQuantityGrams) external {
        Transfer storage transfer = transfers[_transferId];
        require(transfer.exists, "TraceabilityLedger: transfer does not exist");
        require(transfer.status == TransferStatus.Pending, "TraceabilityLedger: transfer is not pending");
        require(msg.sender == transfer.receiver, "TraceabilityLedger: caller is not the receiver");
        require(_receivedQuantityGrams > 0, "TraceabilityLedger: received quantity must be greater than zero");
        require(
            _receivedQuantityGrams <= transfer.declaredQuantityGrams,
            "TraceabilityLedger: received quantity exceeds declared quantity"
        );

        transfer.receivedQuantityGrams = _receivedQuantityGrams;
        transfer.status = TransferStatus.Received;
        transfer.receivedAt = block.timestamp;

        emit QuantityReceived(_transferId, _receivedQuantityGrams, block.timestamp);
    }

    /// @notice Allows the sender or receiver of a Received transfer to record their approval.
    /// @dev    The caller is determined from msg.sender. If the caller is the sender, only
    ///         senderApproved is set; if the caller is the receiver, only receiverApproved is
    ///         set. A caller who is neither is rejected. Approval is one-way — a participant
    ///         who has already approved cannot approve again. When both approvals become true,
    ///         the transfer automatically transitions to Confirmed and custody is moved:
    ///         the received quantity R moves from sender to receiver, and the full declared
    ///         reservation D is released.
    /// @param  _transferId  The transfer to approve.
    function approveTransfer(uint256 _transferId) external {
        Transfer storage transfer = transfers[_transferId];
        require(transfer.exists, "TraceabilityLedger: transfer does not exist");
        require(transfer.status == TransferStatus.Received, "TraceabilityLedger: transfer is not received");

        if (msg.sender == transfer.sender) {
            require(!transfer.senderApproved, "TraceabilityLedger: sender already approved");
            transfer.senderApproved = true;
        } else if (msg.sender == transfer.receiver) {
            require(!transfer.receiverApproved, "TraceabilityLedger: receiver already approved");
            transfer.receiverApproved = true;
        } else {
            revert("TraceabilityLedger: caller is not the sender or receiver");
        }

        if (transfer.senderApproved && transfer.receiverApproved) {
            transfer.status = TransferStatus.Confirmed;
            transfer.confirmedAt = block.timestamp;

            uint256 batchId = transfer.batchId;
            uint256 declared = transfer.declaredQuantityGrams;
            uint256 received = transfer.receivedQuantityGrams;

            confirmedCustody[batchId][transfer.sender] -= received;
            confirmedCustody[batchId][transfer.receiver] += received;
            pendingOutgoing[batchId][transfer.sender] -= declared;
            batches[batchId].pendingQuantityGrams -= declared;
            batches[batchId].availableQuantityGrams += declared;

            emit TransferConfirmed(_transferId, block.timestamp);
        }
    }

    /// @notice Allows the sender to cancel a Pending transfer, releasing its reservation.
    /// @dev    Only the transfer's sender may cancel, and only while the transfer is still
    ///         Pending. Once the receiver has recorded receipt (Received) or the transfer
    ///         has been confirmed or cancelled, cancellation is impossible. The full declared
    ///         quantity D is released from pendingOutgoing and the batch-level reservation.
    ///         No custody moves — confirmedCustody is untouched. The transfer record remains
    ///         permanently stored as Cancelled.
    /// @param  _transferId  The transfer to cancel.
    function cancelTransfer(uint256 _transferId) external {
        Transfer storage transfer = transfers[_transferId];
        require(transfer.exists, "TraceabilityLedger: transfer does not exist");
        require(transfer.status == TransferStatus.Pending, "TraceabilityLedger: transfer is not pending");
        require(msg.sender == transfer.sender, "TraceabilityLedger: caller is not the sender");

        transfer.status = TransferStatus.Cancelled;

        uint256 batchId = transfer.batchId;
        uint256 declared = transfer.declaredQuantityGrams;

        pendingOutgoing[batchId][transfer.sender] -= declared;
        batches[batchId].pendingQuantityGrams -= declared;
        batches[batchId].availableQuantityGrams += declared;

        emit TransferCancelled(_transferId, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // Custody & Transfer Read Functions (Phase 4.1)
    // -------------------------------------------------------------------------

    /// @notice Returns the confirmed custody for a wallet in a given batch.
    /// @param  _batchId  The batch ID.
    /// @param  _wallet   The wallet address to query.
    function getConfirmedCustody(uint256 _batchId, address _wallet) external view returns (uint256) {
        return confirmedCustody[_batchId][_wallet];
    }

    /// @notice Returns the pending outgoing quantity for a wallet in a given batch.
    /// @param  _batchId  The batch ID.
    /// @param  _wallet   The wallet address to query.
    function getPendingOutgoing(uint256 _batchId, address _wallet) external view returns (uint256) {
        return pendingOutgoing[_batchId][_wallet];
    }

    /// @notice Returns the available custody for a wallet in a given batch.
    /// @dev    Available custody = confirmedCustody - pendingOutgoing.
    /// @param  _batchId  The batch ID.
    /// @param  _wallet   The wallet address to query.
    function getAvailableCustody(uint256 _batchId, address _wallet) external view returns (uint256) {
        return confirmedCustody[_batchId][_wallet] - pendingOutgoing[_batchId][_wallet];
    }

    /// @notice Returns full transfer information by ID.
    /// @param  _transferId  The transfer ID to query.
    /// @return id                    The transfer ID.
    /// @return batchId               The associated batch ID.
    /// @return sender                The sender's wallet address.
    /// @return receiver              The receiver's wallet address.
    /// @return declaredQuantityGrams The quantity declared by the sender.
    /// @return receivedQuantityGrams The quantity recorded by the receiver.
    /// @return status                The current transfer status.
    /// @return senderApproved        Whether the sender has approved.
    /// @return receiverApproved      Whether the receiver has approved.
    /// @return createdAt             Block timestamp of transfer creation.
    /// @return receivedAt            Block timestamp of quantity receipt.
    /// @return confirmedAt           Block timestamp of confirmation.
    /// @return exists                Whether the transfer exists.
    function getTransfer(uint256 _transferId)
        external
        view
        returns (
            uint256 id,
            uint256 batchId,
            address sender,
            address receiver,
            uint256 declaredQuantityGrams,
            uint256 receivedQuantityGrams,
            TransferStatus status,
            bool senderApproved,
            bool receiverApproved,
            uint256 createdAt,
            uint256 receivedAt,
            uint256 confirmedAt,
            bool exists
        )
    {
        Transfer memory t = transfers[_transferId];
        return (
            t.id,
            t.batchId,
            t.sender,
            t.receiver,
            t.declaredQuantityGrams,
            t.receivedQuantityGrams,
            t.status,
            t.senderApproved,
            t.receiverApproved,
            t.createdAt,
            t.receivedAt,
            t.confirmedAt,
            t.exists
        );
    }

    /// @notice Returns whether a transfer with the given ID exists.
    /// @param  _transferId  The transfer ID to check.
    function transferExists(uint256 _transferId) external view returns (bool) {
        return transfers[_transferId].exists;
    }

    /// @notice Returns the total number of transfers created.
    function getTransferCount() external view returns (uint256) {
        return transferCount;
    }

    // -------------------------------------------------------------------------
    // Recovered Material Processing (Phase 5.1)
    // -------------------------------------------------------------------------

    /// @notice Processes a quantity of e-waste into recovered materials.
    /// @dev    Only a registered Recycler may call this. The input quantity is
    ///         deducted from the Recycler's confirmed custody. The sum of all
    ///         output material quantities plus the residual must exactly equal
    ///         the input quantity. Each output material type must have a positive
    ///         quantity. Zero-quantity outputs are not allowed. Material types
    ///         must be unique within a single processing call.
    /// @param  _batchId             The source e-waste batch.
    /// @param  _inputQuantityGrams  The e-waste quantity to process in grams.
    /// @param  _materialTypes       Array of recovered material type names.
    /// @param  _materialQuantities  Array of produced quantities in grams, parallel to _materialTypes.
    /// @param  _residualGrams       The unrecoverable residual quantity in grams.
    /// @return processingEventId    The unique ID of the processing event record.
    function processEwaste(
        uint256 _batchId,
        uint256 _inputQuantityGrams,
        string[] calldata _materialTypes,
        uint256[] calldata _materialQuantities,
        uint256 _residualGrams
    ) external onlyRole(Role.Recycler) returns (uint256) {
        require(batches[_batchId].exists, "TraceabilityLedger: batch does not exist");
        require(batches[_batchId].status == BatchStatus.Active, "TraceabilityLedger: batch is not active");
        require(_inputQuantityGrams > 0, "TraceabilityLedger: input quantity must be greater than zero");
        require(_materialTypes.length > 0, "TraceabilityLedger: at least one material type is required");
        require(_materialTypes.length <= 20, "TraceabilityLedger: too many material types");
        require(_materialTypes.length == _materialQuantities.length, "TraceabilityLedger: material types and quantities length mismatch");

        uint256 available = confirmedCustody[_batchId][msg.sender] - pendingOutgoing[_batchId][msg.sender];
        require(_inputQuantityGrams <= available, "TraceabilityLedger: input quantity exceeds available custody");

        uint256 outputTotal = _residualGrams;
        for (uint256 i = 0; i < _materialQuantities.length; i++) {
            require(_materialQuantities[i] > 0, "TraceabilityLedger: material quantity must be greater than zero");
            require(bytes(_materialTypes[i]).length > 0, "TraceabilityLedger: material type cannot be empty");
            outputTotal += _materialQuantities[i];
        }
        require(outputTotal == _inputQuantityGrams, "TraceabilityLedger: output quantities do not equal input quantity");

        // Check for duplicate material types within this call
        for (uint256 i = 0; i < _materialTypes.length; i++) {
            for (uint256 j = i + 1; j < _materialTypes.length; j++) {
                require(
                    keccak256(bytes(_materialTypes[i])) != keccak256(bytes(_materialTypes[j])),
                    "TraceabilityLedger: duplicate material type"
                );
            }
        }

        confirmedCustody[_batchId][msg.sender] -= _inputQuantityGrams;
        batches[_batchId].availableQuantityGrams -= _inputQuantityGrams;

        processingEventCount += 1;
        uint256 newEventId = processingEventCount;

        processingEvents[newEventId] = ProcessingEvent({
            id: newEventId,
            batchId: _batchId,
            recycler: msg.sender,
            inputQuantityGrams: _inputQuantityGrams,
            residualGrams: _residualGrams,
            processedAt: block.timestamp,
            exists: true
        });

        for (uint256 i = 0; i < _materialTypes.length; i++) {
            materialCount += 1;
            uint256 newMaterialId = materialCount;

            materials[newMaterialId] = RecoveredMaterial({
                id: newMaterialId,
                batchId: _batchId,
                recycler: msg.sender,
                materialType: _materialTypes[i],
                producedQuantityGrams: _materialQuantities[i],
                availableQuantityGrams: _materialQuantities[i],
                processingEventId: newEventId,
                createdAt: block.timestamp,
                exists: true
            });

            materialConfirmedCustody[newMaterialId][msg.sender] = _materialQuantities[i];

            emit MaterialRecovered(newMaterialId, newEventId, _batchId, msg.sender, _materialTypes[i], _materialQuantities[i], block.timestamp);
        }

        emit EwasteProcessed(newEventId, _batchId, msg.sender, _inputQuantityGrams, _residualGrams, block.timestamp);

        return newEventId;
    }

    /// @notice Returns full recovered material information by ID.
    /// @param  _materialId  The material ID to query.
    /// @return id                       The material ID.
    /// @return batchId                  The originating e-waste batch ID.
    /// @return recycler                 The Recycler's wallet address.
    /// @return materialType             The material type name.
    /// @return producedQuantityGrams    The total produced quantity in grams.
    /// @return availableQuantityGrams   The currently available quantity in grams.
    /// @return processingEventId        The processing event that produced this material.
    /// @return createdAt                Block timestamp of material creation.
    /// @return exists                   Whether the material exists.
    function getMaterial(uint256 _materialId)
        external
        view
        returns (
            uint256 id,
            uint256 batchId,
            address recycler,
            string memory materialType,
            uint256 producedQuantityGrams,
            uint256 availableQuantityGrams,
            uint256 processingEventId,
            uint256 createdAt,
            bool exists
        )
    {
        RecoveredMaterial memory m = materials[_materialId];
        return (
            m.id,
            m.batchId,
            m.recycler,
            m.materialType,
            m.producedQuantityGrams,
            m.availableQuantityGrams,
            m.processingEventId,
            m.createdAt,
            m.exists
        );
    }

    /// @notice Returns whether a recovered material with the given ID exists.
    /// @param  _materialId  The material ID to check.
    function materialExists(uint256 _materialId) external view returns (bool) {
        return materials[_materialId].exists;
    }

    /// @notice Returns the total number of recovered materials created.
    function getMaterialCount() external view returns (uint256) {
        return materialCount;
    }

    /// @notice Returns the material ID at a given index (1-based enumeration).
    /// @dev    Material IDs are sequential starting at 1, so index 0 = material ID 1.
    /// @param  _index  The zero-based index into the material list.
    function getMaterialIdByIndex(uint256 _index) external view returns (uint256) {
        require(_index < materialCount, "TraceabilityLedger: index out of bounds");
        return _index + 1;
    }

    /// @notice Returns full processing event information by ID.
    /// @param  _processingEventId  The processing event ID to query.
    /// @return id                    The processing event ID.
    /// @return batchId               The source e-waste batch ID.
    /// @return recycler              The Recycler's wallet address.
    /// @return inputQuantityGrams    The e-waste input quantity in grams.
    /// @return residualGrams         The residual quantity in grams.
    /// @return processedAt           Block timestamp of processing.
    /// @return exists                Whether the processing event exists.
    function getProcessingEvent(uint256 _processingEventId)
        external
        view
        returns (
            uint256 id,
            uint256 batchId,
            address recycler,
            uint256 inputQuantityGrams,
            uint256 residualGrams,
            uint256 processedAt,
            bool exists
        )
    {
        ProcessingEvent memory pe = processingEvents[_processingEventId];
        return (
            pe.id,
            pe.batchId,
            pe.recycler,
            pe.inputQuantityGrams,
            pe.residualGrams,
            pe.processedAt,
            pe.exists
        );
    }

    /// @notice Returns whether a processing event with the given ID exists.
    /// @param  _processingEventId  The processing event ID to check.
    function processingEventExists(uint256 _processingEventId) external view returns (bool) {
        return processingEvents[_processingEventId].exists;
    }

    /// @notice Returns the total number of processing events.
    function getProcessingEventCount() external view returns (uint256) {
        return processingEventCount;
    }

    // -------------------------------------------------------------------------
    // Material Transfers (Phase 5.2)
    // -------------------------------------------------------------------------

    /// @notice Creates a material transfer from a Recycler to a Material Processor.
    /// @dev    Only the Recycler who owns the material can initiate a transfer.
    ///         The declared quantity is reserved as pending outgoing and cannot be
    ///         reused for another transfer until the lifecycle resolves.
    /// @param  _materialId     The recovered material to transfer.
    /// @param  _receiver       The registered Material Processor's wallet address.
    /// @param  _quantityGrams  The declared quantity in grams (must be > 0 and <= available material custody).
    /// @return transferId      The unique ID assigned to the new material transfer.
    function createMaterialTransfer(uint256 _materialId, address _receiver, uint256 _quantityGrams)
        external
        onlyRole(Role.Recycler)
        returns (uint256)
    {
        require(materials[_materialId].exists, "TraceabilityLedger: material does not exist");
        require(
            materials[_materialId].recycler == msg.sender,
            "TraceabilityLedger: caller is not the material owner"
        );
        uint256 batchId = materials[_materialId].batchId;
        require(batches[batchId].exists, "TraceabilityLedger: batch does not exist");
        require(batches[batchId].status == BatchStatus.Active, "TraceabilityLedger: batch is not active");
        require(participants[_receiver].isRegistered, "TraceabilityLedger: receiver is not registered");
        require(_receiver != msg.sender, "TraceabilityLedger: sender and receiver must differ");
        require(
            participants[_receiver].role == Role.MaterialProcessor,
            "TraceabilityLedger: receiver is not a Material Processor"
        );
        require(_quantityGrams > 0, "TraceabilityLedger: quantity must be greater than zero");

        uint256 available = materialConfirmedCustody[_materialId][msg.sender] - materialPendingOutgoing[_materialId][msg.sender];
        require(_quantityGrams <= available, "TraceabilityLedger: quantity exceeds available material custody");

        materialTransferCount += 1;
        uint256 newTransferId = materialTransferCount;

        materialTransfers[newTransferId] = MaterialTransfer({
            id: newTransferId,
            materialId: _materialId,
            batchId: batchId,
            sender: msg.sender,
            receiver: _receiver,
            declaredQuantityGrams: _quantityGrams,
            receivedQuantityGrams: 0,
            status: TransferStatus.Pending,
            senderApproved: false,
            receiverApproved: false,
            createdAt: block.timestamp,
            receivedAt: 0,
            confirmedAt: 0,
            exists: true
        });

        materialPendingOutgoing[_materialId][msg.sender] += _quantityGrams;
        materials[_materialId].availableQuantityGrams -= _quantityGrams;

        emit MaterialTransferCreated(newTransferId, _materialId, batchId, msg.sender, _receiver, _quantityGrams, block.timestamp);

        return newTransferId;
    }

    /// @notice Allows the receiver of a pending material transfer to record the actual received quantity.
    /// @dev    Only the transfer's receiver may call this. The transfer must be in Pending
    ///         status. The received quantity must be > 0 and <= the declared quantity.
    ///         No custody movement occurs here — custody moves during confirmation.
    /// @param  _transferId            The material transfer to receive.
    /// @param  _receivedQuantityGrams The actual quantity received in grams.
    function receiveMaterialTransfer(uint256 _transferId, uint256 _receivedQuantityGrams) external {
        MaterialTransfer storage transfer = materialTransfers[_transferId];
        require(transfer.exists, "TraceabilityLedger: material transfer does not exist");
        require(transfer.status == TransferStatus.Pending, "TraceabilityLedger: material transfer is not pending");
        require(msg.sender == transfer.receiver, "TraceabilityLedger: caller is not the receiver");
        require(_receivedQuantityGrams > 0, "TraceabilityLedger: received quantity must be greater than zero");
        require(
            _receivedQuantityGrams <= transfer.declaredQuantityGrams,
            "TraceabilityLedger: received quantity exceeds declared quantity"
        );

        transfer.receivedQuantityGrams = _receivedQuantityGrams;
        transfer.status = TransferStatus.Received;
        transfer.receivedAt = block.timestamp;

        emit MaterialQuantityReceived(_transferId, _receivedQuantityGrams, block.timestamp);
    }

    /// @notice Allows the sender or receiver of a Received material transfer to record their approval.
    /// @dev    When both approvals become true, the transfer automatically transitions to
    ///         Confirmed and custody is moved: the received quantity R moves from sender to
    ///         receiver, and the full declared reservation D is released. The difference
    ///         (D - R) stays with the sender as confirmed custody — the discrepancy is preserved.
    /// @param  _transferId  The material transfer to approve.
    function approveMaterialTransfer(uint256 _transferId) external {
        MaterialTransfer storage transfer = materialTransfers[_transferId];
        require(transfer.exists, "TraceabilityLedger: material transfer does not exist");
        require(transfer.status == TransferStatus.Received, "TraceabilityLedger: material transfer is not received");

        if (msg.sender == transfer.sender) {
            require(!transfer.senderApproved, "TraceabilityLedger: sender already approved");
            transfer.senderApproved = true;
        } else if (msg.sender == transfer.receiver) {
            require(!transfer.receiverApproved, "TraceabilityLedger: receiver already approved");
            transfer.receiverApproved = true;
        } else {
            revert("TraceabilityLedger: caller is not the sender or receiver");
        }

        if (transfer.senderApproved && transfer.receiverApproved) {
            transfer.status = TransferStatus.Confirmed;
            transfer.confirmedAt = block.timestamp;

            uint256 materialId = transfer.materialId;
            uint256 declared = transfer.declaredQuantityGrams;
            uint256 received = transfer.receivedQuantityGrams;

            materialConfirmedCustody[materialId][transfer.sender] -= received;
            materialConfirmedCustody[materialId][transfer.receiver] += received;
            materialPendingOutgoing[materialId][transfer.sender] -= declared;
            materials[materialId].availableQuantityGrams += (declared - received);

            emit MaterialTransferConfirmed(_transferId, block.timestamp);
        }
    }

    /// @notice Allows the sender to cancel a Pending material transfer, releasing its reservation.
    /// @dev    Only the transfer's sender may cancel, and only while the transfer is still Pending.
    ///         Once the receiver has recorded receipt (Received) or the transfer has been
    ///         confirmed or cancelled, cancellation is impossible. The full declared quantity
    ///         is released from materialPendingOutgoing and the material's available quantity.
    ///         No custody moves — materialConfirmedCustody is untouched.
    /// @param  _transferId  The material transfer to cancel.
    function cancelMaterialTransfer(uint256 _transferId) external {
        MaterialTransfer storage transfer = materialTransfers[_transferId];
        require(transfer.exists, "TraceabilityLedger: material transfer does not exist");
        require(transfer.status == TransferStatus.Pending, "TraceabilityLedger: material transfer is not pending");
        require(msg.sender == transfer.sender, "TraceabilityLedger: caller is not the sender");

        transfer.status = TransferStatus.Cancelled;

        uint256 materialId = transfer.materialId;
        uint256 declared = transfer.declaredQuantityGrams;

        materialPendingOutgoing[materialId][transfer.sender] -= declared;
        materials[materialId].availableQuantityGrams += declared;

        emit MaterialTransferCancelled(_transferId, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // Material Custody & Transfer Read Functions (Phase 5.2)
    // -------------------------------------------------------------------------

    /// @notice Returns the confirmed material custody for a wallet in a given material.
    /// @param  _materialId  The material ID.
    /// @param  _wallet      The wallet address to query.
    function getMaterialConfirmedCustody(uint256 _materialId, address _wallet) external view returns (uint256) {
        return materialConfirmedCustody[_materialId][_wallet];
    }

    /// @notice Returns the pending outgoing material quantity for a wallet in a given material.
    /// @param  _materialId  The material ID.
    /// @param  _wallet      The wallet address to query.
    function getMaterialPendingOutgoing(uint256 _materialId, address _wallet) external view returns (uint256) {
        return materialPendingOutgoing[_materialId][_wallet];
    }

    /// @notice Returns the available material custody for a wallet in a given material.
    /// @dev    Available custody = materialConfirmedCustody - materialPendingOutgoing.
    /// @param  _materialId  The material ID.
    /// @param  _wallet      The wallet address to query.
    function getMaterialAvailableCustody(uint256 _materialId, address _wallet) external view returns (uint256) {
        return materialConfirmedCustody[_materialId][_wallet] - materialPendingOutgoing[_materialId][_wallet];
    }

    /// @notice Returns full material transfer information by ID.
    /// @param  _transferId  The material transfer ID to query.
    function getMaterialTransfer(uint256 _transferId)
        external
        view
        returns (
            uint256 id,
            uint256 materialId,
            uint256 batchId,
            address sender,
            address receiver,
            uint256 declaredQuantityGrams,
            uint256 receivedQuantityGrams,
            TransferStatus status,
            bool senderApproved,
            bool receiverApproved,
            uint256 createdAt,
            uint256 receivedAt,
            uint256 confirmedAt,
            bool exists
        )
    {
        MaterialTransfer memory mt = materialTransfers[_transferId];
        return (
            mt.id,
            mt.materialId,
            mt.batchId,
            mt.sender,
            mt.receiver,
            mt.declaredQuantityGrams,
            mt.receivedQuantityGrams,
            mt.status,
            mt.senderApproved,
            mt.receiverApproved,
            mt.createdAt,
            mt.receivedAt,
            mt.confirmedAt,
            mt.exists
        );
    }

    /// @notice Returns whether a material transfer with the given ID exists.
    /// @param  _transferId  The material transfer ID to check.
    function materialTransferExists(uint256 _transferId) external view returns (bool) {
        return materialTransfers[_transferId].exists;
    }

    /// @notice Returns the total number of material transfers created.
    function getMaterialTransferCount() external view returns (uint256) {
        return materialTransferCount;
    }

    /// @notice Returns the material transfer ID at a given index (1-based enumeration).
    /// @dev    Transfer IDs are sequential starting at 1, so index 0 = transfer ID 1.
    /// @param  _index  The zero-based index into the material transfer list.
    function getMaterialTransferIdByIndex(uint256 _index) external view returns (uint256) {
        require(_index < materialTransferCount, "TraceabilityLedger: index out of bounds");
        return _index + 1;
    }

    // -------------------------------------------------------------------------
    // Material Processing by Material Processor (Phase 5.3)
    // -------------------------------------------------------------------------

    /// @notice Processes a quantity of recovered material by the calling Material Processor.
    /// @dev    Only a registered Material Processor who has confirmed custody of the material
    ///         can call this. The quantity is consumed from the processor's confirmed custody.
    ///         Partial processing is supported — the processor can process the same material
    ///         multiple times as long as custody remains. This does NOT touch
    ///         RecoveredMaterial.availableQuantityGrams (which tracks the recycler's
    ///         transferable quantity) — it only decrements the processor's materialConfirmedCustody.
    /// @param  _materialId       The recovered material to process.
    /// @param  _quantityGrams    The quantity to process in grams (must be > 0 and <= available custody).
    /// @return processingRecordId The unique ID assigned to the new material processing record.
    function processMaterial(uint256 _materialId, uint256 _quantityGrams)
        external
        onlyRole(Role.MaterialProcessor)
        returns (uint256)
    {
        require(materials[_materialId].exists, "TraceabilityLedger: material does not exist");
        require(
            batches[materials[_materialId].batchId].status == BatchStatus.Active,
            "TraceabilityLedger: batch is not active"
        );
        require(_quantityGrams > 0, "TraceabilityLedger: quantity must be greater than zero");

        uint256 available = materialConfirmedCustody[_materialId][msg.sender] - materialPendingOutgoing[_materialId][msg.sender];
        require(_quantityGrams <= available, "TraceabilityLedger: quantity exceeds available material custody");

        materialConfirmedCustody[_materialId][msg.sender] -= _quantityGrams;

        materialProcessingRecordCount += 1;
        uint256 newRecordId = materialProcessingRecordCount;

        materialProcessingRecords[newRecordId] = MaterialProcessingRecord({
            id: newRecordId,
            materialId: _materialId,
            batchId: materials[_materialId].batchId,
            processor: msg.sender,
            inputQuantityGrams: _quantityGrams,
            processedAt: block.timestamp,
            exists: true
        });

        emit MaterialProcessed(newRecordId, _materialId, materials[_materialId].batchId, msg.sender, _quantityGrams, block.timestamp);

        _tryCompleteBatch(materials[_materialId].batchId);

        return newRecordId;
    }

    /// @notice Returns full material processing record information by ID.
    /// @param  _recordId  The material processing record ID to query.
    /// @return id                    The processing record ID.
    /// @return materialId            The recovered material that was processed.
    /// @return batchId               The originating e-waste batch ID.
    /// @return processor             The Material Processor's wallet address.
    /// @return inputQuantityGrams    The quantity processed in grams.
    /// @return processedAt           Block timestamp of processing.
    /// @return exists                Whether the processing record exists.
    function getMaterialProcessingRecord(uint256 _recordId)
        external
        view
        returns (
            uint256 id,
            uint256 materialId,
            uint256 batchId,
            address processor,
            uint256 inputQuantityGrams,
            uint256 processedAt,
            bool exists
        )
    {
        MaterialProcessingRecord memory r = materialProcessingRecords[_recordId];
        return (
            r.id,
            r.materialId,
            r.batchId,
            r.processor,
            r.inputQuantityGrams,
            r.processedAt,
            r.exists
        );
    }

    /// @notice Returns whether a material processing record with the given ID exists.
    /// @param  _recordId  The processing record ID to check.
    function materialProcessingRecordExists(uint256 _recordId) external view returns (bool) {
        return materialProcessingRecords[_recordId].exists;
    }

    /// @notice Returns the total number of material processing records.
    function getMaterialProcessingRecordCount() external view returns (uint256) {
        return materialProcessingRecordCount;
    }

    /// @notice Returns the material processing record ID at a given index (1-based enumeration).
    /// @dev    Record IDs are sequential starting at 1, so index 0 = record ID 1.
    /// @param  _index  The zero-based index into the processing record list.
    function getMaterialProcessingRecordIdByIndex(uint256 _index) external view returns (uint256) {
        require(_index < materialProcessingRecordCount, "TraceabilityLedger: index out of bounds");
        return _index + 1;
    }

    // -------------------------------------------------------------------------
    // Batch Completion (Phase 5.4 — automatic)
    // -------------------------------------------------------------------------

    /// @dev    Checks whether a batch satisfies all five completion conditions and,
    ///         if so, automatically transitions it to Completed. Called internally
    ///         after every material processing operation. No external caller can
    ///         trigger completion directly — it happens only as a side effect of
    ///         the final processMaterial call that satisfies all conditions.
    ///
    ///         Conditions:
    ///         1. availableQuantityGrams == 0 && pendingQuantityGrams == 0
    ///         2. No e-waste transfer for this batch is Pending or Received
    ///         3. At least one recovered material exists for the batch
    ///         4. No material transfer for this batch is Pending or Received
    ///         5. Every material has zero confirmed custody across all participants
    function _tryCompleteBatch(uint256 _batchId) internal {
        if (batches[_batchId].status != BatchStatus.Active) return;

        // Condition 1
        if (batches[_batchId].availableQuantityGrams != 0 || batches[_batchId].pendingQuantityGrams != 0) return;

        // Condition 2
        for (uint256 i = 1; i <= transferCount; i++) {
            if (transfers[i].batchId == _batchId) {
                if (transfers[i].status != TransferStatus.Confirmed && transfers[i].status != TransferStatus.Cancelled) return;
            }
        }

        // Condition 3
        bool hasMaterial = false;
        for (uint256 i = 1; i <= materialCount; i++) {
            if (materials[i].batchId == _batchId && materials[i].exists) {
                hasMaterial = true;
                break;
            }
        }
        if (!hasMaterial) return;

        // Condition 4
        for (uint256 i = 1; i <= materialTransferCount; i++) {
            if (materialTransfers[i].batchId == _batchId) {
                if (materialTransfers[i].status != TransferStatus.Confirmed && materialTransfers[i].status != TransferStatus.Cancelled) return;
            }
        }

        // Condition 5
        for (uint256 i = 1; i <= materialCount; i++) {
            if (materials[i].batchId == _batchId && materials[i].exists) {
                uint256 materialId = materials[i].id;
                for (uint256 j = 0; j < participantAddresses.length; j++) {
                    if (materialConfirmedCustody[materialId][participantAddresses[j]] != 0) return;
                }
            }
        }

        batches[_batchId].status = BatchStatus.Completed;

        emit BatchCompleted(_batchId, msg.sender, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // View / Query Functions (Phase 2+)
    // -------------------------------------------------------------------------

    // TODO: function getBatchTraceability(uint256 _batchId) external view returns (...) { ... }
    // TODO: function getTransferHistory(uint256 _batchId) external view returns (...) { ... }
}
