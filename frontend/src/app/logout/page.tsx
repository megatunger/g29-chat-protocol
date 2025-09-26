"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";

const LogoutPage = () => {
  const { logout } = useAuthStore();
  const { replace } = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>
              <h2 className="text-3xl">😢 Oops...!</h2>
            </CardTitle>
            <CardDescription>
              <h4>Your key is no longer valid</h4>
              <Button
                variant="neutral"
                onClick={() => {
                  logout();
                  replace("/");
                }}
                className="mt-4"
              >
                Logout
              </Button>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};

export default LogoutPage;
