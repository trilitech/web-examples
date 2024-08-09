import UniversalProvider from "@walletconnect/universal-provider";
import { WalletConnectModal } from "@walletconnect/modal";
import { useState } from "react";
import { signMessage, sendTransaction, TezosChainData, apiGetContractAddress } from "./utils/helpers";
import { DEFAULT_TEZOS_KINDS, DEFAULT_TEZOS_METHODS } from "./utils/samples";

const projectId = import.meta.env.VITE_PROJECT_ID;

const events: string[] = [];

// 1. select chains (tezos)
const chains = Object.values(TezosChainData).map(chain => chain.id); // extracting ids from TezosChainData

// 2. select methods (tezos)
const methods = ["tezos_sign", "tezos_send"];

// 3. create modal instance
const modal = new WalletConnectModal({
  projectId,
  chains,
});

// 4. create provider instance
const provider = await UniversalProvider.init({
  logger: "error",
  projectId: projectId,
  metadata: {
    name: "WalletConnect x Tezos",
    description: "Tezos integration with WalletConnect's Universal Provider",
    url: "https://walletconnect.com/",
    icons: ["https://avatars.githubusercontent.com/u/37784886"],
  },
});

const App = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [result, setResult] = useState<any>(null); // Use state for result
  const [description, setDescription] = useState<any>(null); // Use state for result
  const [contractAddress, setContractAddress] = useState("");
  // const { client, session, accounts } =
  //   useWalletConnectClient();

  // 5. get address once loaded
  const address =
    provider.session?.namespaces.tezos?.accounts[0].split(":")[2];

  // 6. handle display_uri event and open modal
  provider.on("display_uri", async (uri: string) => {
    console.log("uri", uri);
    await modal.openModal({
      uri,
    });
  });

  // 7. handle connect event
  const connect = async () => {
    try {
      await provider.connect({
        namespaces: {
          tezos: {
            methods,
            chains,
            events,
          },
        },
      });
      setIsConnected(true);
      console.log("session", provider.session);
    } catch {
      console.log("Something went wrong, request cancelled");
    }
    modal.closeModal();
  };

  // 8. handle disconnect event
  const disconnect = async () => {
    await provider.disconnect();
    setIsConnected(false);
    setResult(null); // Clear result on disconnect
  };

  // 9. handle signMessage and sendTransaction
  const handleSign = async () => {
    const res = await signMessage(
      TezosChainData["testnet"].id,
      provider,
      address!
    );
    setResult(res); // Update the result state
    console.log(res);
  };

  const handleSend = async () => {
    const res = await sendTransaction(
      TezosChainData["testnet"].id,
      provider,
      address!,
      DEFAULT_TEZOS_METHODS.TEZOS_SEND_TRANSACTION,
    );
    setResult(res); // Update the result state
    console.log(res);
  };

  const handleSendOriginate = async () => {
    const res = await sendTransaction(
      TezosChainData["testnet"].id,
      provider,
      address!,
      DEFAULT_TEZOS_METHODS.TEZOS_SEND_TRANSACTION,
    );
    setResult(res); // Update the result state
    const contractAddressList = await apiGetContractAddress(TezosChainData["testnet"].id, result.hash);
    if (contractAddressList.length > 0) {
      setContractAddress(contractAddressList[0]);
      console.log("TezosRpc stored contract: ", contractAddressList[0]);
    } else {
      console.error("TezosRpc could not find contract address in origination operation.");
    }

    console.log(res);
  };

  const describeTransaction = () => {
    setDescription(DEFAULT_TEZOS_KINDS[DEFAULT_TEZOS_METHODS.TEZOS_SEND_TRANSACTION]);
  }
  const describeOrigination = () => {
    setDescription(DEFAULT_TEZOS_KINDS[DEFAULT_TEZOS_METHODS.TEZOS_SEND_ORGINATION]);
  }
  const describeClear = () => {
    setDescription(undefined);
  }


  return (
    <div className="App">
      <h1>WalletConnect for Tezos</h1>
      <p>
        dApp prototype integrating WalletConnect's Tezos Universal Provider.
      </p>

      {isConnected ? (
        <>
          <p>
            <b>Public Key: </b>
            {address}
          </p>
          <div className="btn-container">
            <button onClick={handleSign} onMouseEnter={describeClear}>Sign</button>
            <button onClick={handleSend} onMouseEnter={describeTransaction}>Send</button>
            <button onClick={handleSendOriginate} onMouseEnter={describeOrigination}>Originate</button>
            <button onClick={disconnect} onMouseEnter={describeClear}>Disconnect</button>
          </div>
          {result && (
            <>
              <p>Result of the last operation:</p>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </>
          )}
          {description && (
            <>
              <p>Operation:</p>
              <pre>{JSON.stringify(description, null, 2)}</pre>
            </>
          )}
        </>
      ) : (
        <>
          <p>Connect your wallet to get started</p>
          <button onClick={connect}>Connect</button>
        </>
      )}
    </div>
  );
};

export default App;
