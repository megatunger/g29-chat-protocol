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

export type AuthenticationContextValue = {
  isLoggedIn: boolean;
};

const AuthenticationContext = createContext<AuthenticationContextValue | null>(
  null,
);

const AuthenticationProvider = ({ children }: PropsWithChildren) => {
  const { storedKey } = useNewKey();

  const isLoggedIn = !!storedKey;

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

    useEffect(() => {
      if (!isLoggedIn) {
        router.replace("/");
      }
    }, [isLoggedIn, router]);

    if (!isLoggedIn) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };

  WithAuthentication.displayName = `withAuthentication(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;

  return WithAuthentication;
};

export { AuthenticationProvider, useAuthentication, withAuthentication };
