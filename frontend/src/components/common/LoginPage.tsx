"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useNewKey } from "@/contexts/NewKeyContext";
import useUserHello from "@/services/useUserHello";
import { generateUserID } from "@/services/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { DEFAULT_SERVER_HOST } from "@/constants/endpoint";

type LoginFormValues = {
  userID: string;
  password: string;
  serverHost: string;
};

export default function LoginPage() {
  const { push } = useRouter();
  const { encryptedKey, serverHost, setServerHost } = useAuthStore((state) => ({
    encryptedKey: state.encryptedKey,
    serverHost: state.serverHost ?? DEFAULT_SERVER_HOST,
    setServerHost: state.setServerHost,
  }));
  const hasStoredKey = !!encryptedKey;
  const form = useForm<LoginFormValues>({
    defaultValues: {
      userID: encryptedKey?.keyId ?? "",
      password: "",
      serverHost: serverHost ?? DEFAULT_SERVER_HOST,
    },
  });
  const {
    generateKey,
    isProcessing,
    saveKey,
    loadKey,
    error: keyError,
  } = useNewKey();
  const {
    mutateAsync: sendUserHello,
    isPending,
    error: userHelloError,
  } = useUserHello();

  useEffect(() => {
    if (encryptedKey?.keyId) {
      form.setValue("userID", encryptedKey.keyId);
    }
  }, [encryptedKey, form]);

  useEffect(() => {
    form.setValue("serverHost", serverHost ?? DEFAULT_SERVER_HOST);
  }, [form, serverHost]);

  const onSubmit = async (values: LoginFormValues) => {
    const rawUserId = values.userID?.toString().trim();
    if (!rawUserId && !hasStoredKey) {
      form.setError("userID", {
        type: "manual",
        message: "User ID is required",
      });
      return;
    }

    const userId =
      hasStoredKey && encryptedKey?.keyId
        ? encryptedKey.keyId
        : generateUserID(rawUserId ?? "");
    const password = values.password?.toString() ?? "";
    const inputServerHost = values.serverHost?.toString().trim();

    if (!password) {
      form.setError("password", {
        type: "manual",
        message: "Password is required to protect your private key",
      });
      return;
    }

    const normalizedServerHost =
      inputServerHost && inputServerHost.length > 0
        ? inputServerHost
        : DEFAULT_SERVER_HOST;
    setServerHost(normalizedServerHost);

    let key = await loadKey(password, userId);

    if (!key) {
      if (hasStoredKey) {
        form.setError("password", {
          type: "manual",
          message: "Incorrect password",
        });
        return;
      }

      key = await generateKey(userId);
      if (!key) {
        throw Error("Cannot generate key!");
      }
      await saveKey(key, password);
      key = await loadKey(password, userId);
      if (!key) {
        form.setError("password", {
          type: "manual",
          message: "Unable to unlock the generated key. Please try again.",
        });
        return;
      }
    }

    await sendUserHello({
      userID: userId,
      pubkey: key.publicKey,
    });

    push("/chat");
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>
              <h2 className="text-3xl">🔐Secure Chat</h2>
            </CardTitle>
            <CardDescription>
              Enter your credentials to join the secure chat network
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mt-8 space-y-6">
              <div className="space-y-4">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-8"
                  >
                    <FormField
                      control={form.control}
                      name="serverHost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Server Host</FormLabel>
                          <FormControl>
                            <Input placeholder="localhost:3000" {...field} />
                          </FormControl>
                          <FormDescription>
                            Enter the host and port of the SOCP server you want
                            to connect to.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="userID"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>User ID</FormLabel>
                          <FormControl>
                            <Input placeholder="megatunger" {...field} />
                          </FormControl>
                          <FormDescription>
                            This is your public display name. This is unique on
                            the server
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="••••••••"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Use a strong passphrase to protect your key
                            material.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full">
                      {isPending ? "Creating..." : "Secure Login"}
                    </Button>
                  </form>
                </Form>
              </div>

              {isProcessing && (
                <div className="text-center text-sm text-gray-600">
                  <p>🔐 Automatically generating RSA-4096 keys...</p>
                  <p>This may take a moment for security purposes.</p>
                </div>
              )}

              {keyError && <div className="text-red-700">{keyError}</div>}
              {userHelloError && (
                <div className="text-red-700">{userHelloError?.toString()}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
