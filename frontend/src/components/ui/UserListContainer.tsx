import React, { useEffect, useState } from "react";
import useList, { useListResponse } from "@/services/useList";
import UserList from "@/components/ui/UserList";

export default function UserListContainer() {
  const [users, setUsers] = useState<any[]>([]);
  const list = useList();

  useEffect(() => {
    let mounted = true;
    list
      .mutateAsync({ options: {} })
      .then((res: useListResponse) => {
        if (!mounted) return;
        const payloadUsers = res.payload?.users || [];
        setUsers(payloadUsers);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      mounted = false;
    };
  }, []);

  return <UserList users={users} />;
}