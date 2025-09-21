import * as React from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/contexts/ChatContext";

type ChatMessageListProps = {
  messages: ChatMessage[];
};

const formatTime = (timestamp: number) => {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    return "--:--";
  }
};

const ChatMessageList = ({ messages }: ChatMessageListProps) => {
  if (!messages.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-base border-2 border-border bg-secondary-background/50 p-6 text-center text-sm text-muted-foreground shadow-shadow">
        <p>No messages yet.</p>
        <p>Say hello to start the conversation.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-base border-2 border-border bg-secondary-background p-4 shadow-shadow max-h-[360px] overflow-scroll">
      {messages.map((message) => {
        const isOutgoing = message.direction === "outgoing";

        return (
          <div
            key={message.id}
            className={cn(
              "flex w-full items-end gap-3",
              isOutgoing ? "justify-end" : "justify-start",
            )}
          >
            {!isOutgoing && (
              <Avatar className="shadow-shadow">
                <AvatarFallback>WS</AvatarFallback>
              </Avatar>
            )}

            <div
              className={cn(
                "flex max-w-[75%] flex-col gap-2",
                isOutgoing ? "items-end text-right" : "items-start text-left",
              )}
            >
              <div
                className={cn(
                  "rounded-base border-2 border-border px-3 py-2 text-sm font-base transition-colors",
                  isOutgoing
                    ? "bg-main text-main-foreground shadow-shadow"
                    : "bg-white text-foreground shadow-shadow",
                )}
              >
                <span>{message.content}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {isOutgoing ? "You" : "Server"} ·{" "}
                {formatTime(message.timestamp)}
              </span>
            </div>

            {isOutgoing && (
              <Avatar className="shadow-shadow bg-main text-main-foreground">
                <AvatarFallback>YOU</AvatarFallback>
              </Avatar>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ChatMessageList;
