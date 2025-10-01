"use client";

import { useNetwork } from "@/contexts/NetworkContext";
import ConnectingProgress from "@/components/common/ConnectingProgress";
import { useEffect } from "react";
import { ReadyState } from "react-use-websocket";
import { useRouter } from "next/navigation";
import { useAuthentication } from "@/contexts/AuthenticationContext";
import { useAuthStore } from "@/stores/auth.store";

const HomePage = () => {
  const { readyState } = useNetwork();
  const { isLoggedIn } = useAuthentication();
  const hasEncryptedKey = useAuthStore((state) => !!state.encryptedKey);
  const { push } = useRouter();

  useEffect(() => {
    if (readyState !== ReadyState.OPEN) {
      return;
    }

    const redirect = () => {
      if (isLoggedIn) {
        push("/chat");
        return;
      }
      if (hasEncryptedKey) {
        push("/decrypt");
        return;
      }
      push("/login");
    };

    const timer = setTimeout(redirect, 1_000);
    return () => clearTimeout(timer);
  }, [readyState, isLoggedIn, hasEncryptedKey, push]);

  return (
    <div>
      <ConnectingProgress readyState={readyState} />
    </div>
  );
};

export default HomePage;
