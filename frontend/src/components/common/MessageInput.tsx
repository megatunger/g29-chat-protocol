import * as React from "react";
import { useEffect, useRef } from "react";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  getBlobUrlForFile,
  revokeBlobUrl,
} from "@/lib/file-blob-registry";

type MessageInputProps = Omit<
  React.ComponentProps<typeof Textarea>,
  "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
};

const MessageInput = ({ value, onChange, ...props }: MessageInputProps) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastBlobUrlRef = useRef<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    const [file] = Array.from(files);

    if (!file) {
      return;
    }

    if (lastBlobUrlRef.current) {
      revokeBlobUrl(lastBlobUrlRef.current);
    }

    const blobUrl = getBlobUrlForFile(file);
    lastBlobUrlRef.current = blobUrl;

    onChange(`/file <user> ${blobUrl}`);

    // Reset the input to allow selecting the same file again later.
    event.target.value = "";
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  useEffect(() => {
    return () => {
      if (lastBlobUrlRef.current) {
        revokeBlobUrl(lastBlobUrlRef.current);
        lastBlobUrlRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full d-flex flex-col">
      <Textarea
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
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
          onClick={handleFileButtonClick}
        >
          /file {`<user> <path>`}
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;
