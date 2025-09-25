"use client";

import { ReactNode } from "react";
import { withAuthentication } from "@/contexts/AuthenticationContext";

const Layout = ({ children }: { children: ReactNode }) => {
  return children;
};

export default withAuthentication(Layout);
