// "use client";
//
// import { useKeys } from "@/contexts/KeyContext";
// import { ChatProvider, useChat } from "@/contexts/ChatContext";
// import KeyManagementPanel from "@/components/common/KeyManagementPanel";
// import ChatMessageList from "@/components/common/ChatMessageList";
// import MessageInput from "@/components/common/MessageInput";
// import { useEffect, useState } from "react";
// import ConnectingProgress from "@/components/common/ConnectingProgress";
// import { Button } from "@/components/ui/button";
//
// const ChatPage = () => {
//   const [text, setText] = useState("");
//   const [isLoggedIn, setIsLoggedIn] = useState(false);
//   const { sendMessage, lastMessage, readyState, canSendMessages, messages } =
//     useChat();
//   const { hasKeys } = useKeys();
//
//   // Check if user is already logged in
//   useEffect(() => {
//     const userId = localStorage.getItem("userId");
//     const serverId = localStorage.getItem("serverId");
//     if (userId && serverId && hasKeys) {
//       setIsLoggedIn(true);
//     }
//   }, [hasKeys]);
//
//   const handleLoginSuccess = (userId: string) => {
//     setIsLoggedIn(true);
//   };
//
//   const handleLogout = () => {
//     localStorage.removeItem("userId");
//     localStorage.removeItem("serverId");
//     setIsLoggedIn(false);
//   };
//
//   const handleSend = () => {
//     if (!text.trim() || !canSendMessages) {
//       return;
//     }
//
//     const sent = sendMessage(text);
//     if (sent) {
//       setText("");
//     }
//   };
//
//   return (
//     <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
//       {/* Header with logout */}
//       <div className="flex items-center justify-between rounded-base border-2 border-border bg-white p-4 shadow-shadow">
//         <h1 className="text-xl font-bold">Secure Chat</h1>
//         <Button variant="neutral" onClick={handleLogout}>
//           Logout
//         </Button>
//       </div>
//
//       {/* Key Management Panel */}
//       <KeyManagementPanel />
//
//       {/* Chat Interface */}
//       <ChatMessageList messages={messages} />
//       <div className="flex flex-col gap-3 rounded-base border-2 border-border bg-white p-4 shadow-shadow sm:flex-row sm:items-end">
//         <MessageInput
//           value={text}
//           onChange={setText}
//           placeholder="Type your message"
//           className="min-h-[120px] flex-1"
//           disabled={!canSendMessages}
//         />
//         <Button
//           className="sm:self-stretch"
//           onClick={handleSend}
//           disabled={!canSendMessages}
//         >
//           SEND MESSAGE
//         </Button>
//       </div>
//       {!canSendMessages && <ConnectingProgress readyState={readyState} />}
//     </div>
//   );
// };
//
// export default function Chat() {
//   return (
//     <ChatProvider>
//       <ChatPage />
//     </ChatProvider>
//   );
// }

const ChatPage = () => {
  return <div />;
};

export default ChatPage;
