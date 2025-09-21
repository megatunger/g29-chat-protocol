"use client";

import { useState } from "react";
import ChatMessageList from "@/components/common/ChatMessageList";
import ConnectingProgress from "@/components/common/ConnectingProgress";
import MessageInput from "@/components/common/MessageInput";
import { Button } from "@/components/ui/button";
import { ChatProvider, useChat } from "@/contexts/ChatContext";

const HomeContent = () => {
  const [text, setText] = useState("");
  const { sendMessage, lastMessage, readyState, canSendMessages, messages } =
    useChat();

  const handleSend = () => {
    if (!text.trim() || !canSendMessages) {
      return;
    }

    const sent = sendMessage(text);
    if (sent) {
      setText("");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <ChatMessageList messages={messages} />
      <div className="flex flex-col gap-3 rounded-base border-2 border-border bg-white p-4 shadow-shadow sm:flex-row sm:items-end">
        <MessageInput
          value={text}
          onChange={setText}
          placeholder="Type your message"
          className="min-h-[120px] flex-1"
          disabled={!canSendMessages}
        />
        <Button
          className="sm:self-stretch"
          onClick={handleSend}
          disabled={!canSendMessages}
        >
          SEND MESSAGE
        </Button>
      </div>
      {!canSendMessages && <ConnectingProgress readyState={readyState} />}
    </div>
  );
};

export default function Home() {
  return (
    <ChatProvider>
      <HomeContent />
    </ChatProvider>
  );
}
