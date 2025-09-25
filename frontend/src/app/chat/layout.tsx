"use client";

import { ReactNode } from "react";
import { withAuthentication } from "@/contexts/AuthenticationContext";
import { ChatProvider } from "@/contexts/ChatContext";

const Layout = ({ children }: { children: ReactNode }) => {
  return <ChatProvider>{children}</ChatProvider>;
};

export default withAuthentication(Layout);
