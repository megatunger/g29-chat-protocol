import * as React from "react";

import { Textarea } from "@/components/ui/textarea";

type MessageInputProps = Omit<
  React.ComponentProps<typeof Textarea>,
  "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
};

const MessageInput = ({ value, onChange, ...props }: MessageInputProps) => {
  return (
    <Textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...props}
    />
  );
};

export default MessageInput;
