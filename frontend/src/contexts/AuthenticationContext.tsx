"use client";

import { useRouter } from "next/navigation";
import {
  ComponentType,
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useNewKey } from "@/contexts/NewKeyContext";
import useUserHello from "@/services/useUserHello";
import { useAuthStore } from "@/stores/auth.store";

export type AuthenticationContextValue = {
  isLoggedIn: boolean;
};

const AuthenticationContext = createContext<AuthenticationContextValue | null>(
  null,
);

const AuthenticationProvider = ({ children }: PropsWithChildren) => {
  const { storedKey } = useNewKey();
  const { replace } = useRouter();
  const { mutateAsync: sendUserHello } = useUserHello();

  const isLoggedIn = !!storedKey;

  useEffect(() => {
    if (isLoggedIn && storedKey) {
      sendUserHello({
        userID: storedKey.keyId,
        pubkey: storedKey.publicKey,
      }).catch(() => {
        replace("/logout");
        console.log("Invalid key, logging out");
      });
    }
  }, [isLoggedIn, storedKey, sendUserHello, replace]);

  const value = useMemo<AuthenticationContextValue>(
    () => ({
      isLoggedIn,
    }),
    [isLoggedIn],
  );

  return (
    <AuthenticationContext.Provider value={value}>
      {children}
    </AuthenticationContext.Provider>
  );
};

const useAuthentication = () => {
  const context = useContext(AuthenticationContext);
  if (!context) {
    throw new Error(
      "useAuthentication must be used within an AuthenticationProvider",
    );
  }
  return context;
};

const withAuthentication = <P extends object>(
  WrappedComponent: ComponentType<P>,
) => {
  const WithAuthentication = (props: P) => {
    const router = useRouter();
    const { isLoggedIn } = useAuthentication();
    const hasEncryptedKey = useAuthStore((state) => !!state.encryptedKey);

    useEffect(() => {
      if (isLoggedIn) {
        return;
      }

      if (hasEncryptedKey) {
        router.replace("/decrypt");
      } else {
        router.replace("/");
      }
    }, [isLoggedIn, hasEncryptedKey, router]);

    if (!isLoggedIn) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };

  WithAuthentication.displayName = `withAuthentication(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;

  return WithAuthentication;
};

export { AuthenticationProvider, useAuthentication, withAuthentication };
