"use client";

import { useNetwork } from "@/contexts/NetworkContext";
import ConnectingProgress from "@/components/common/ConnectingProgress";
import { useEffect } from "react";
import { ReadyState } from "react-use-websocket";
import { useRouter } from "next/navigation";
import { useAuthentication } from "@/contexts/AuthenticationContext";

const HomePage = () => {
  const { readyState } = useNetwork();
  const { isLoggedIn } = useAuthentication();
  const { push } = useRouter();

  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      if (isLoggedIn) {
        setTimeout(() => {
          push("/chat");
        }, 1000);
      }
      if (!isLoggedIn) {
        setTimeout(() => {
          push("/login");
        }, 1000);
      }
    }
  }, [readyState]);

  return (
    <div>
      <ConnectingProgress readyState={readyState} />
    </div>
  );
};

export default HomePage;
