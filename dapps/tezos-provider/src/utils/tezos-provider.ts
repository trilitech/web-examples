import { UniversalProvider, Metadata } from "@walletconnect/universal-provider";
import { KeyValueStorageOptions } from "@walletconnect/keyvaluestorage";
import { Logger } from "@walletconnect/logger";
import { TezosToolkit } from "@taquito/taquito";
import { DEFAULT_TEZOS_METHODS } from "./samples";
import { 
  PartialTezosDelegationOperation, 
  PartialTezosOperation as PartialTezosOperationOriginal, 
  PartialTezosOriginationOperation as PartialTezosOriginationOperationOriginal,
  PartialTezosTransactionOperation, 
  TezosBallotOperation, 
  TezosOperationType 
} from "@airgap/beacon-types";

import { ScriptedContracts } from "@taquito/rpc";

interface PartialTezosOriginationOperation extends Omit<PartialTezosOriginationOperationOriginal, "script"> {
  script: ScriptedContracts;
}

type PartialTezosOperation =
  | Exclude<PartialTezosOperationOriginal, PartialTezosOriginationOperationOriginal>
  | PartialTezosOriginationOperation;

// response types are defined in https://docs.walletconnect.com/advanced/multichain/rpc-reference/tezos-rpc
export interface TezosGetAccountsData {
  algo: string;
  address: string;
  pubkey: string;
}
export type TezosGetAccountResponse = TezosGetAccountsData[];
export interface TezosSignResponse {
  signature: string;
}
export interface TezosSendResponse {
  hash: string;
}

export interface ChainData {
  name: string;
  id: string;
  rpc: string[];
  slip44: number;
  testnet: boolean;
  api?: string;
}

export const TezosChainDataMainnet: ChainData = {
  name: "Tezos",
  id: "tezos:mainnet",
  rpc: ["https://rpc.tzbeta.net"],
  api: "https://api.tzkt.io/v1",
  slip44: 1729,
  testnet: false,
}

export const TezosChainDataTestnet: ChainData =   {
  name: "Tezos Testnet",
  id: "tezos:testnet",
  rpc: ["https://rpc.ghostnet.teztnets.com"],
  api: "https://api.ghostnet.tzkt.io/v1",
  slip44: 1729,
  testnet: true,
}

export interface ChainsMap {
  [reference: string]: ChainData;
}
export const TezosChainMap: ChainsMap = {
  "tezos:mainnet": TezosChainDataMainnet,
  "tezos:testnet": TezosChainDataTestnet,
};

export interface AssetData {
  symbol: string;
  name: string;
  balance: number;
}

export function getChainId(chain: string): string {
  return chain.includes(":") ? chain.split(":")[1] : chain;
}
export function formatTezosBalance(asset: AssetData): string {
  const formattedBalance = (asset.balance / 1_000_000).toFixed(6);
  return `${asset.name}: ${formattedBalance} ${asset.symbol}`;
}

export interface TezosProviderOpts {
  projectId: string;
  metadata: Metadata;
  relayUrl?: string;
  storageOptions?: KeyValueStorageOptions;
  disableProviderPing?: boolean;
  logger?: string | Logger; // default: "info"
}

export interface TezosConnectOpts {
  chains?: ChainData[]; // default: TezosChainData. Will connect to the first in the list
  methods?: TezosMethod[]; // default: DefaultTezosMethods
  events?: TezosEvent[];
  optionalEvents?: string[];
}

export enum TezosMethod {
  GET_ACCOUNTS = "tezos_getAccounts",
  SEND = "tezos_sign",
  SIGN = "tezos_send"
}

export enum TezosEvent { 
  CHAIN_CHANGED = "chain_changed",
  ACCOUNTS_CHANGED = "accountsChanged",
  REQUEST_ACKNOWLEDGED = "requestAcknowledged"
}

export const DefaultTezosMethods: TezosMethod[] = [TezosMethod.GET_ACCOUNTS, TezosMethod.SIGN, TezosMethod.SEND];

class TezosProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TezosProviderError";
  }
}

class TezosConnectionError extends TezosProviderError {
  constructor() {
    super("Provider not connected. Click 'Connect' button.");
    this.name = "TezosConnectionError";
  }
}

class TezosInitializationError extends TezosProviderError {
  constructor() {
    super("Provider not initialized. Reload page.");
    this.name = "TezosInitializationError";
  }
}
class TezosProvider {
  public namespace: string = "tezos";
  public signer?: InstanceType<typeof UniversalProvider> = undefined;
  private tezosToolkit?: TezosToolkit;
  public address?: string;
  public isConnected: boolean = false;
  public config?: TezosProviderOpts;
  public chainId: string = "";
  public chainMap: ChainsMap = TezosChainMap;
  public accounts: string[] = [];

  constructor() {}

  static async init(opts: TezosProviderOpts): Promise<TezosProvider> {
    const provider = new TezosProvider();
    await provider.initialize(opts);
    return provider;
  }

  protected async initialize(opts: TezosProviderOpts = {
    projectId: "",
    metadata: {} as Metadata,
    relayUrl: "wss://relay.walletconnect.org", // default relay
    storageOptions: {} as KeyValueStorageOptions,
    disableProviderPing: false, // default is to enable ping
    logger: "info", // default log level
  }): Promise<void> {
    console.log("Initializing TezosProvider");

    this.config = {
      ...opts,
    };
    this.signer = await UniversalProvider.init({
      ...opts,
    });

    this.signer.on("connect", () => {
      this.isConnected = true;
    });
    this.signer.on("disconnect", () => {
      this.isConnected = false;
    });
  }

  // Override connect method
  public async connect(opts: TezosConnectOpts = {
    chains: [TezosChainDataTestnet, TezosChainDataMainnet],
    methods: DefaultTezosMethods,
    events: [],
  }): Promise<any> {
    if (!this.signer || !this.config) {
      throw new TezosInitializationError();
    }
    if (!opts.chains || !opts.chains.length) {
      throw new TezosProviderError("No chains provided");
    }

    this.chainId = opts.chains[0].id;

    // convert chain data to map with chain id as a key
    this.chainMap = opts.chains.reduce((acc, chain) => {
      acc[chain.id] = chain;
      return acc;
    }, {} as ChainsMap);
    
    let res = await this.signer.connect({
      namespaces: {
        tezos: {
          chains: opts.chains.map((chain) => chain.id),
          methods: opts.methods ?? DefaultTezosMethods,
          events: opts.events ?? [],
        },
      },
    });
    this.isConnected = true;
    console.log("Connected to chain:", this.chainId);
  
    const rpcUrl = this.chainMap[this.chainId].rpc[0];
    this.tezosToolkit = new TezosToolkit(rpcUrl);
  
    // Set the address if the session exists
    if (this.signer.session) {
      let accounts = this.signer.session.namespaces.tezos?.accounts.map((account) => account.split(":")[2]) ?? [];
      if (!accounts.length) {
        throw new TezosProviderError("No accounts found in session");
      }
      // Ensure accounts array is unique
      this.accounts = [...new Set(accounts)];
      this.setAddress(this.accounts[0]);
    }
    return res;
  }

  public setAddress(address: string): void {
    if (!this.accounts.includes(address)) {
      throw new TezosProviderError(`Address ${address} not found in accounts ${this.accounts}. Get Accounts first.`);
    }
    this.address = address;
  }

  public getChainId(): string | undefined { 
    if (!this.config) {
      throw new TezosInitializationError();
    }
    return this.chainId;
  }

  // Method to get account balance
  public async getBalance(): Promise<AssetData> {
    if (!this.address) {
      throw new TezosConnectionError();
    }
    if (!this.tezosToolkit) {
      throw new TezosProviderError("tezosToolkit is not initialized");
    }
    const balance = await this.tezosToolkit.tz.getBalance(this.address);
    const balanceInTez = balance.toNumber();
    console.log(`Got balance: ${balanceInTez} ꜩ`);
    return {
      balance: balanceInTez,
      symbol: "ꜩ",
      name: "XTZ",
    };
  }

  public async getFormattedBalance(): Promise<string> {
    const balance = await this.getBalance();
    return `${balance.balance.toFixed(6)} ꜩ`; 
  }

  public async getContractAddress(
    hash: string
  ): Promise<string[]> {
    if (!hash) {
      throw new TezosProviderError(`No hash provided`);
    }
  
    const api = this.chainMap[this.chainId].api;
    const path = `${api}/operations/${hash}`;
    console.log(`Fetching contract address from: ${path}`);
  
    return fetch(path)
      .then((response) => response.json())
      .then((data) => {
        return data
          .map((op: any) => {
            const address = op?.status === 'applied' && op?.originatedContract?.kind === "smart_contract" ? op.originatedContract.address : '';
            if (address) {
              console.log('Got contract address:', address);
            }
            return address;
          })
          .filter((address: string) => address.length);
      });
  }

  public async getCurrentProposal(): Promise<string | null> {
    if (!this.tezosToolkit) {
      throw new TezosProviderError("tezosToolkit is not initialized");
    }
    const currentProposal = await this.tezosToolkit.rpc.getCurrentProposal();
    console.log(`Current proposal: ${currentProposal}`);
    return currentProposal;
  }

  public async checkConnection(): Promise<boolean> {
    if (!this.isConnected) {
      throw new TezosConnectionError();
    }
    return true;
  }
  
  // Requests using the WalletConnect connection
  
  public async tezosGetAccounts(): Promise<TezosGetAccountResponse> {
    if (!this.signer) {
      throw new TezosInitializationError();
    }
    await this.checkConnection();
  
    const result = await this.signer.request<TezosGetAccountResponse>({
      method: DEFAULT_TEZOS_METHODS.TEZOS_GET_ACCOUNTS,
      params: {},
    }, this.chainId);
    this.accounts = result.map((account) => account.address);
  
    return result;
  }

  // Method to sign a message
  public async tezosSign(payload: string): Promise<TezosSignResponse> {
    if (!this.signer) {
      throw new TezosInitializationError();
    }
    await this.checkConnection();
    
    const result = await this.signer.request<TezosSignResponse>({
      method: DEFAULT_TEZOS_METHODS.TEZOS_SIGN,
      params: {
        account: this.address,
        payload,
      },
    }, this.chainId);

    return result;
  }

  // Method to send operations
  public async tezosSend(op: PartialTezosOperation): Promise<TezosSendResponse> {
    if (!this.signer) {
      throw new TezosInitializationError();
    }
    await this.checkConnection();
    
    const result = await this.signer.request<TezosSendResponse>({
      method: DEFAULT_TEZOS_METHODS.TEZOS_SEND,
      params: {
        account: this.address,
        operations: [op],
      },
    }, this.chainId);

    return result;
  }

  // Method to send a transaction
  public async tezosSendTransaction(op: PartialTezosTransactionOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  // Method to send a delegation
  public async tezosSendDelegation(op: PartialTezosDelegationOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  // Method to send an undelegation
  public async tezosSendUndelegation(): Promise<TezosSendResponse> {
    const op: PartialTezosDelegationOperation = { kind: TezosOperationType.DELEGATION };
    return this.tezosSend(op);
  }

  // Method to originate a contract
  public async tezosSendOrigination(op: PartialTezosOriginationOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  // Method to call a smart contract: destination is the contract address, entrypoint as defined in the contract
  public async tezosSendContractCall(op: PartialTezosTransactionOperation): Promise<TezosSendResponse> {
    return this.tezosSend(op);
  }

  // Prepare a staking operation: Transaction with destination set to own address, unit as a parameter and specific entrypoint
  private createStakingOperation(
    entrypoint: string, 
    op: PartialTezosTransactionOperation
  ): PartialTezosTransactionOperation {
    if (!this.address) {
      throw new TezosConnectionError();
    }
    return {
      ...op,
      kind: TezosOperationType.TRANSACTION,
      destination: this.address,
      parameters: {
        entrypoint,
        value: { prim: "Unit" },
      },
    };
  }

  public async tezosSendStake(op: PartialTezosTransactionOperation = {
    kind: TezosOperationType.TRANSACTION,
    destination: this.address ?? "[initiate provider first]",
    amount: "1",
    parameters: {
      entrypoint: "stake",
      value: { prim: "Unit" },
    },
  }): Promise<TezosSendResponse> {
    return this.tezosSend(this.createStakingOperation("stake", op));
  }

  public async tezosSendUnstake(op: PartialTezosTransactionOperation = {
    kind: TezosOperationType.TRANSACTION,
    destination: this.address ?? "[initiate provider first]",
    amount: "1",
    parameters: {
      entrypoint: "unstake",
      value: { prim: "Unit" },
    },
  }): Promise<TezosSendResponse> {
    return this.tezosSend(this.createStakingOperation("unstake", op));
  }

  public async tezosSendFinalizeUnstake(op: PartialTezosTransactionOperation = {
    kind: TezosOperationType.TRANSACTION,
    destination: this.address ?? "[initiate provider first]",
    amount: "0",
    parameters: {
      entrypoint: "finalize_unstake",
      value: { prim: "Unit" },
    },
  }): Promise<TezosSendResponse> {
    return this.tezosSend(this.createStakingOperation("finalize_unstake", op));
  }

  public async tezosSendBallot(op: TezosBallotOperation): Promise<TezosSendResponse> {
    if (!this.address) {
      throw new TezosConnectionError();
    }
    return this.tezosSend({...op, source: this.address});
  }

}

export default TezosProvider;
