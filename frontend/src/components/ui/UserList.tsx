import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";

type User = {
  userID: string;
  ts?: string | number;
  isActive?: boolean;
  isOnline?: boolean;
  version?: string;
  pubkey?: string | null;
};

export default function UserList({ users = [] as User[] }) {
  const [onlyActive, setOnlyActive] = useState(false);

  const total = users.length;
  const totalActive = users.filter((u) => Boolean(u.isActive)).length;
  const totalDisabled = users.filter((u) => !u.isActive).length;

  const visible = useMemo(
    () =>
      users
        .slice()
        .sort((a, b) => +new Date(b.ts || 0) - +new Date(a.ts || 0))
        .filter((u) => !onlyActive || Boolean(u.isActive)),
    [users, onlyActive],
  );

  const formatWhen = (ts?: string | number) => {
    if (!ts) return "";
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    const m = Math.round(diff / 60000);
    if (m < 1) return "less than a minute ago";
    if (m < 60) return `${m} minutes ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} hours ago`;
    return d.toLocaleString();
  };

  return (
    <div>
      <div
        style={{
          border: "4px solid #000",
          borderRadius: 8,
          padding: 12,
          display: "inline-block",
          background: "#fff",
          minWidth: 320,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>
            Found {totalActive} active users and {totalDisabled} disabled users (total {total})
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ fontSize: 13 }}>Show only active</span>
          </label>
        </div>

        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {visible.map((u) => (
            <li
              key={u.userID}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 8,
                borderRadius: 6,
                marginBottom: 8,
                background: "#fff",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{u.userID}</div>
                <div style={{ fontSize: 12, color: "#666" }}>{formatWhen(u.ts)}</div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Badge variant={u.isActive ? "active" : "disabled"}>
                  {u.isActive ? "Active" : "Disabled"}
                </Badge>

                <Badge variant={u.isOnline ? "active" : "neutral"}>
                  {u.isOnline ? "Online" : "Offline"}
                </Badge>
              </div>
            </li>
          ))}

          {visible.length === 0 && <li style={{ color: "#666", padding: 8 }}>No users to show</li>}
        </ul>
      </div>
    </div>
  );
}