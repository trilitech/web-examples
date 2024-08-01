import { ParamsWithKind, TezosToolkit } from '@taquito/taquito';
import { InMemorySigner } from '@taquito/signer'

import { Wallet } from 'ethers/'

/**
 * Constants
 */
const DEFAULT_PATH = "m/44'/1729'/0'/0'"
const DEFAULT_CURVE = 'ed25519'

/**
 * Types
 */
interface IInitArguments {
  mnemonic?: string
  path?: string
  curve?: 'ed25519' | 'secp256k1'
}

/**
 * Library
 */
export default class TezosLib {
  tezos: TezosToolkit
  signer: InMemorySigner
  mnemonic: string
  secretKey: string
  publicKey: string
  address: string
  curve: 'ed25519' | 'secp256k1'

  constructor(
    tezos: TezosToolkit,
    mnemonic: string,
    signer: InMemorySigner,
    secretKey: string,
    publicKey: string,
    address: string,
    curve: 'ed25519' | 'secp256k1'
  ) {
    this.tezos = tezos
    this.mnemonic = mnemonic
    this.signer = signer
    this.secretKey = secretKey
    this.publicKey = publicKey
    this.address = address
    this.curve = curve
  }

  static async init({ mnemonic, path, curve }: IInitArguments) {
    const params = {
      mnemonic: mnemonic ?? Wallet.createRandom().mnemonic.phrase,
      derivationPath: path ?? DEFAULT_PATH,
      curve: curve ?? DEFAULT_CURVE
    }

    // TODO: https://github.com/trilitech/web-examples/issues/2
    // Hardcoded Tezos to use testnet
    // Tezos should be able to switch between testnets and mainnet
    const Tezos = new TezosToolkit('https://rpc.ghostnet.teztnets.com')

    const signer = InMemorySigner.fromMnemonic(params)

    Tezos.setSignerProvider(signer)

    const secretKey = await signer.secretKey()
    const publicKey = await signer.publicKey()
    const address = await signer.publicKeyHash()

    return new TezosLib(Tezos, params.mnemonic, signer, secretKey, publicKey, address, params.curve)
  }

  public getMnemonic() {
    return this.mnemonic
  }

  public getPublicKey() {
    return this.publicKey
  }

  public getCurve() {
    return this.curve
  }

  public getAddress() {
    return this.address
  }

  public async signTransaction(transaction: any) {
    // Map the transactions and prepare the batch
    console.log(`Wallet: handling transaction: `, transaction);
    const batchTransactions: ParamsWithKind[] = transaction.map((tx: any) => {
      switch (tx.kind) {
        case 'delegation':
          return {
            ...tx,
            source: tx.source ?? this.address
          }
        default:
          return tx as ParamsWithKind;
      }
    });

    // Prepare the batch
    console.log(`Wallet: prepared batchTransactions `, batchTransactions);
    const batch = this.tezos.contract.batch(batchTransactions);

    // Send the batch and wait for the operation hash
    console.log(`Wallet: sending batch `, batch);
    const operation = await batch.send();

    // Wait for confirmation
    await operation.confirmation();

    console.log('Wallet: operation confirmed:', operation);
    return operation.hash;
  }

  public async signPayload(payload: any) {
    return await this.signer.sign(payload)
  }
}
