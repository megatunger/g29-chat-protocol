"use client";

import { useChat } from "@/contexts/ChatContext";
import { Button } from "@/components/ui/button";
import MessageInput from "@/components/common/MessageInput";
import ChatMessageList from "@/components/common/ChatMessageList";
import { useAuthStore } from "@/stores/auth.store";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useNewKey } from "@/contexts/NewKeyContext";
import { useNetwork } from "@/contexts/NetworkContext";

const ChatPage = () => {
  const [text, setText] = useState("");
  const { sendMessage, messages } = useChat();
  const { logout } = useAuthStore();
  const { replace } = useRouter();
  const { storedKey } = useNewKey();
  const { serverHost } = useNetwork();

  const chatIdentityLabel = storedKey?.keyId ?? "Unknown user";

  const handleLogout = () => {
    logout();
    replace("/");
  };

  const handleSend = () => {
    if (!text.trim()) {
      return;
    }

    const sent = sendMessage(text);
    if (sent) {
      setText("");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      {/* Header with logout */}
      <Card className="w-full px-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold">🔐 Secure Chat</h1>
            <span className="text-sm text-muted-foreground">
              You are chatting as{" "}
              <b className="text-red-400">{chatIdentityLabel}</b> at server{" "}
              <b className="text-red-400">{serverHost}</b>
            </span>
          </div>
          <Button variant="neutral" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        {/* Chat Interface */}
        <ChatMessageList messages={messages} />
      </Card>

      {/* Key Management Panel */}
      {/*<KeyManagementPanel />*/}
      <div className="flex flex-col gap-3 rounded-base border-2 border-border bg-white p-4 shadow-shadow sm:flex-row sm:items-end">
        <MessageInput
          value={text}
          onChange={setText}
          placeholder="Type your message"
          className="min-h-[120px] flex-1"
        />
        <Button className="sm:self-stretch" onClick={handleSend}>
          SEND MESSAGE
        </Button>
      </div>
    </div>
  );
};

export default ChatPage;
