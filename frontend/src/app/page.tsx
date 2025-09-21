"use client";

import Image from "next/image";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { endpoint } from "@/constants/endpoint";
import { useEffect, useState } from "react";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";

export default function Home() {
  const [text, setText] = useState("");
  const { sendMessage, lastMessage, readyState } = useWebSocket(endpoint, {
    heartbeat: true,
  });

  console.log(lastMessage, readyState);

  const send = () => {
    sendMessage(text);
  };

  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      sendMessage("hello");
    }
  }, [readyState]);

  return (
    <div>
      <Input
        type="text"
        placeholder="type something..."
        onChange={(e) => setText(e.target.value)}
      />
      <Button onClick={() => send()}>SEND MESSAGE</Button>
    </div>
  );
}
