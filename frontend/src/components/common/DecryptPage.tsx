"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useNewKey } from "@/contexts/NewKeyContext";
import { useAuthStore } from "@/stores/auth.store";

const DecryptPage = () => {
  const { push } = useRouter();
  const encryptedKey = useAuthStore((state) => state.encryptedKey);
  const { loadKey, isProcessing, error: keyError } = useNewKey();

  const form = useForm({
    defaultValues: {
      password: "",
    },
  });

  useEffect(() => {
    if (!encryptedKey) {
      push("/login");
    }
  }, [encryptedKey, push]);

  const onSubmit = async (values: { password: string }) => {
    if (!encryptedKey) {
      push("/login");
      return;
    }

    const password = values.password?.toString() ?? "";
    if (!password) {
      form.setError("password", {
        type: "manual",
        message: "Password is required",
      });
      return;
    }

    const unlocked = await loadKey(password, encryptedKey.keyId);
    if (unlocked) {
      push("/chat");
      return;
    }

    form.setError("password", {
      type: "manual",
      message: "Incorrect password",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>
              <h2 className="text-3xl">🔓 Unlock Key</h2>
            </CardTitle>
            <CardDescription>
              {encryptedKey ? `Enter the password for ${encryptedKey.keyId}` : "No key found"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isProcessing}>
                  {isProcessing ? "Decrypting..." : "Unlock"}
                </Button>
                {keyError && <div className="text-red-700">{keyError}</div>}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DecryptPage;
