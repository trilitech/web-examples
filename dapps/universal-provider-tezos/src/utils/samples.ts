import {
    PartialTezosDelegationOperation,
    PartialTezosOriginationOperation as PartialTezosOriginationOperationOriginal,
    PartialTezosTransactionOperation,
    TezosOperationType, 
    PartialTezosIncreasePaidStorageOperation}
    from "@airgap/beacon-types";

import { ScriptedContracts } from "@taquito/rpc";

interface PartialTezosOriginationOperation
  extends Omit<PartialTezosOriginationOperationOriginal, "script"> {
  script: ScriptedContracts;
}
  
export enum SAMPLE_KINDS {
  GET_ACCOUNTS = "tezos_getAccounts",
  SEND = "tezos_send",
  SEND_TRANSACTION = "tezos_send:transaction",
  SEND_ORGINATION = "tezos_send:origination",
  SEND_CONTRACT_CALL = "tezos_send:contract_call",
  SEND_DELEGATION = "tezos_send:delegation",
  SEND_UNDELEGATION = "tezos_send:undelegation",
  SEND_STAKE = "tezos_send:stake",
  SEND_UNSTAKE = "tezos_send:unstake",
  SEND_FINALIZE = "tezos_send:finalize",
  SEND_INCREASE_PAID_STORAGE = "tezos_send:increase_paid_storage",
  SIGN = "tezos_sign",
}

const tezosTransactionOperation: PartialTezosTransactionOperation = {
  kind: TezosOperationType.TRANSACTION,
  destination: "tz3ZmB8oWUmi8YZXgeRpgAcPnEMD8VgUa4Ve", // Tezos Foundation Ghost Baker
  amount: "100000"
};

const tezosOriginationOperation: PartialTezosOriginationOperation = {
  kind: TezosOperationType.ORIGINATION,
  balance: '1',
  script: { // This contract adds the parameter to the storage value
    code: [
      { prim: "parameter", args: [{ prim: "int" }] },
      { prim: "storage", args: [{ prim: "int" }] },
      { prim: "code",
        args: [[
            { prim: "DUP" },                                // Duplicate the parameter (parameter is pushed onto the stack)
            { prim: "CAR" },                                // Access the parameter from the stack (parameter is on top)
            { prim: "DIP", args: [[{ prim: "CDR" }]] },     // Access the storage value (storage is on the stack)
            { prim: "ADD" },                                // Add the parameter to the storage value
            { prim: "NIL", args: [{ prim: "operation" }] }, // Create an empty list of operations
            { prim: "PAIR" }                                // Pair the updated storage with the empty list of operations
        ]]
      }
    ],
    storage: { int: "10" }
  },
};

const tezosContractCallOperation: PartialTezosTransactionOperation = {
  kind: TezosOperationType.TRANSACTION,
  destination: "[contract address]",
  amount: "0",
  parameters: { entrypoint: "default", value: { int: "20" } } // Add 20 to the current storage value
};

const tezosDelegationOperation: PartialTezosDelegationOperation = {
  kind: TezosOperationType.DELEGATION,
  delegate: "tz3ZmB8oWUmi8YZXgeRpgAcPnEMD8VgUa4Ve" // Tezos Foundation Ghost Baker. Cannot delegate to ourself as that would block undelegation
};

const tezosUndelegationOperation: PartialTezosDelegationOperation = {
  kind: TezosOperationType.DELEGATION
};

const tezosStakeOperation: PartialTezosTransactionOperation = {
  kind: TezosOperationType.TRANSACTION,
  destination:"[own adress]",
  amount: "1000000",
  parameters: {
    entrypoint: "stake",
    value: { prim: "Unit" },
  },
};

const tezosUnstakeOperation: PartialTezosTransactionOperation = {
  kind: TezosOperationType.TRANSACTION,
  destination:"[own adress]",
  amount: "1000000",
  parameters: {
    entrypoint: "unstake",
    value: { prim: "Unit" },
  },
};

const tezosFinalizeOperation: PartialTezosTransactionOperation = {
  kind: TezosOperationType.TRANSACTION,
  destination:"[own adress]",
  amount: "0",
  parameters: {
    entrypoint: "finalize_unstake",
    value: { prim: "Unit" },
  },
};

const TezosIncreasePaidStorageOperation: PartialTezosIncreasePaidStorageOperation = {
  kind: TezosOperationType.INCREASE_PAID_STORAGE,
  amount: "10",
  destination: "[contract address]"
};

export const SAMPLES = {
  "tezos_send:transaction": tezosTransactionOperation,
  "tezos_send:origination": tezosOriginationOperation,
  "tezos_send:contract_call": tezosContractCallOperation,
  "tezos_send:delegation": tezosDelegationOperation,
  "tezos_send:undelegation": tezosUndelegationOperation,
  "tezos_send:stake": tezosStakeOperation,
  "tezos_send:unstake": tezosUnstakeOperation,
  "tezos_send:finalize": tezosFinalizeOperation,
  "tezos_send:increase_paid_storage": TezosIncreasePaidStorageOperation,
};

export enum DEFAULT_TEZOS_EVENTS {}
