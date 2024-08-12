import UniversalProvider from "@walletconnect/universal-provider";
import { WalletConnectModal } from "@walletconnect/modal";
import { useState } from "react";
import { signMessage, sendTransaction, TezosChainData, apiGetContractAddress } from "./utils/helpers";
import { DEFAULT_TEZOS_KINDS, DEFAULT_TEZOS_METHODS } from "./utils/samples";

const projectId = import.meta.env.VITE_PROJECT_ID;

const events: string[] = [];
// const events = ["display_uri", "chainChanged", "accountsChanged", "disconnect"];
// const rpcMap = {
//   "tezos:mainnet": "https://mainnet.smartpy.io",
//   "tezos:testnet": "https://testnet.smartpy.io"
// }

// 1. select chains (tezos)
const chains = ["tezos:mainnet", "tezos:testnet"];

// 2. select methods (tezos)
const methods = ["tezos_sign", "tezos_send"];

// 3. create modal instance
const modal = new WalletConnectModal({
  projectId,
  chains,
});

// 4. create provider instance
const provider = await UniversalProvider.init({
  logger: "debug",
  // relayUrl: "wss://relay.walletconnect.com",
  projectId: projectId,
  metadata: {
    name: "WalletConnect x Tezos",
    description: "Tezos integration with WalletConnect's Universal Provider",
    url: "https://walletconnect.com/",
    icons: ["https://avatars.githubusercontent.com/u/37784886"],
  },
  // client: undefined, // optional instance of @walletconnect/sign-client
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
    console.log("event display_uri", uri);
    await modal.openModal({
      uri,
    });
  });

  provider.on("session_ping", ({ id, topic }: { id: string; topic: string }) => {
    console.log("Session Ping:", id, topic);
  });

  provider.on("session_event", ({ event, chainId }: { event: any; chainId: string }) => {
    console.log("Session Event:", event, chainId);
  });

  provider.on("session_update", ({ topic, params }: { topic: string; params: any }) => {
    console.log("Session Update:", topic, params);
  });

  provider.on("session_delete", ({ id, topic }: { id: string; topic: string }) => {
    console.log("Session Delete:", id, topic);
  });

  // 7. handle connect event
  const connect = async () => {
    try {
      await provider.connect({
        namespaces: {
          tezos: {
            methods,
            chains,
            events:[],
            // rpcMap
          },
        },
      });
      setIsConnected(true);
      console.log("Connected successfully. Session", provider.session);

      // provider.setDefaultChain(`tezos:testnet`);
    } catch (error) {
      console.error("Connection error:", error);
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
