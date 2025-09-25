import { useNetwork } from "@/contexts/NetworkContext";

function useSendServerHelloJoin() {
  const { serverUUID, sendJsonMessage } = useNetwork();

  return (
    clientName: string,
    clientAddress: string,
    port: number,
    pubkey: string,
  ) => {
    return sendJsonMessage({
      type: "SERVER_HELLO_JOIN",
      from: clientName,
      to: serverUUID,
      payload: {
        host: clientAddress,
        port: port,
        pubkey: pubkey,
      },
      sig: "",
    });
  };
}

export default useSendServerHelloJoin;
