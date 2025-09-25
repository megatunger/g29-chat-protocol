"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useNewKey } from "@/contexts/NewKeyContext";
import useUserHello from "@/services/useUserHello";
import { generateUserID } from "@/services/constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { push } = useRouter();
  const form = useForm({
    defaultValues: {
      userID: "",
      password: "",
    },
  });
  const { generateKey, isProcessing, saveKey, loadKey } = useNewKey();
  const { mutateAsync: sendUserHello, isPending, error } = useUserHello();

  const onSubmit = async (values) => {
    const userId = generateUserID(values.userID);
    const key = await generateKey(userId);
    if (!key) throw Error("Cannot generate key!");
    await sendUserHello({
      userID: userId,
      pubkey: key.publicKey.toString(),
    });
    saveKey(key);
    loadKey();
    push("/chat");
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>
              <h2 className="text-3xl">Secure Chat</h2>
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

              {error && <div className="text-red-700">{error?.toString()}</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
