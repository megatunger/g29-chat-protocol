import * as React from "react";

import { Progress } from "@/components/ui/progress";
import { ReadyState } from "react-use-websocket";

type ConnectingProgressProps = {
  readyState: ReadyState;
};

const stateCopy: Record<
  ReadyState,
  { title: string; subtitle: string; progress: number }
> = {
  [ReadyState.UNINSTANTIATED]: {
    title: "Preparing connection",
    subtitle: "Initializing client components.",
    progress: 10,
  },
  [ReadyState.CONNECTING]: {
    title: "Establishing secure channel",
    subtitle: "Negotiating handshake with server.",
    progress: 45,
  },
  [ReadyState.OPEN]: {
    title: "Connected",
    subtitle: "You can start chatting now.",
    progress: 100,
  },
  [ReadyState.CLOSING]: {
    title: "Closing connection",
    subtitle: "Wrapping up active session.",
    progress: 65,
  },
  [ReadyState.CLOSED]: {
    title: "Connection closed",
    subtitle: "Attempting to reconnect shortly.",
    progress: 25,
  },
};

const statusLabels: Record<ReadyState, string> = {
  [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  [ReadyState.CONNECTING]: "Connecting",
  [ReadyState.OPEN]: "Open",
  [ReadyState.CLOSING]: "Closing",
  [ReadyState.CLOSED]: "Closed",
};

const ConnectingProgress = ({ readyState }: ConnectingProgressProps) => {
  const target = stateCopy[readyState] ?? stateCopy[ReadyState.UNINSTANTIATED];
  const [progress, setProgress] = React.useState(target.progress);

  React.useEffect(() => {
    setProgress(target.progress);
  }, [target.progress]);

  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="space-y-1">
        <p className="text-lg font-semibold">{target.title}</p>
        <p className="text-sm text-muted-foreground">{target.subtitle}</p>
      </div>
      <Progress value={progress} className="w-[60%]" />
      <p className="text-xs text-muted-foreground">
        Current status: {statusLabels[readyState] ?? "Unknown"}
      </p>
    </div>
  );
};

export default ConnectingProgress;
