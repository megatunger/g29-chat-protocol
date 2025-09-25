"use client";

import { useNetwork } from "@/contexts/NetworkContext";
import ConnectingProgress from "@/components/common/ConnectingProgress";
import { useEffect } from "react";
import { ReadyState } from "react-use-websocket";
import { useRouter } from "next/navigation";

const HomePage = () => {
  const { readyState } = useNetwork();
  const { replace } = useRouter();

  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      setTimeout(() => {
        replace("/login");
      }, 1000);
    }
  }, [readyState]);

  return (
    <div>
      <ConnectingProgress readyState={readyState} />
    </div>
  );
};

export default HomePage;
