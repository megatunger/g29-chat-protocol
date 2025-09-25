import * as React from "react";
import { useRef } from "react";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type MessageInputProps = Omit<
  React.ComponentProps<typeof Textarea>,
  "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
};

const MessageInput = ({ value, onChange, ...props }: MessageInputProps) => {
  const ref = useRef(null);

  return (
    <div className="w-full d-flex flex-col">
      <Textarea
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
      <div className="flex flex-row gap-2 mt-2">
        <Button
          onClick={() => {
            onChange("/list");
          }}
        >
          /list
        </Button>
        <Button
          onClick={() => {
            onChange("/tell <user> <text>");
          }}
        >
          /tell {`<user> <text>`}
        </Button>
        <Button
          onClick={() => {
            onChange("/all <text>");
          }}
        >
          /all {`<text>`}
        </Button>
        <Button
          onClick={() => {
            onChange("/file <user> <path>");
          }}
        >
          /file {`<user> <path>`}
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;
