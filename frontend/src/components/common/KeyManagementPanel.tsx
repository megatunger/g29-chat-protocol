"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useKeys, type KeyStatus } from "@/contexts/KeyContext";

const KeyManagementPanel = () => {
  const {
    keyStatus,
    userInfo,
    error,
    hasKeys,
    getPublicKey,
  } = useKeys();

  const [showPublicKey, setShowPublicKey] = useState(false);

  const copyPublicKey = () => {
    const publicKey = getPublicKey();
    if (publicKey) {
      navigator.clipboard.writeText(publicKey);
      alert("Public key copied to clipboard!");
    }
  };

  const getStatusIcon = () => {
    switch (keyStatus) {
      case "ready":
        return "✅";
      case "generating":
        return "⏳";
      case "error":
        return "❌";
      default:
        return "🔐";
    }
  };

  const getStatusText = () => {
    switch (keyStatus) {
      case "ready":
        return "Keys Ready";
      case "generating":
        return "Generating Keys...";
      case "error":
        return "Error";
      case "none":
        return "No Keys";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="rounded-base border-2 border-border bg-white p-4 shadow-shadow">
      <h3 className="mb-4 text-lg font-bold">
        {getStatusIcon()} Encryption Status
      </h3>

      {/* Status Display */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span className="font-medium">Status:</span>
          <span className={`${keyStatus === 'ready' ? 'text-green-600' : 
                           keyStatus === 'error' ? 'text-red-600' : 
                           keyStatus === 'generating' ? 'text-yellow-600' : 'text-gray-600'}`}>
            {getStatusText()}
          </span>
        </div>
        
        {userInfo && (
          <div className="mt-2 text-sm text-gray-600">
            User: {userInfo.name}
          </div>
        )}
        
        {error && (
          <div className="mt-2 text-sm text-red-600">
            Error: {error}
          </div>
        )}
      </div>

      {/* Key Display Actions - Only when keys are ready */}
      {hasKeys && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setShowPublicKey(!showPublicKey)}
              variant="neutral"
            >
              {showPublicKey ? "Hide" : "Show"} Public Key
            </Button>
            
            <Button
              onClick={copyPublicKey}
            >
              Copy Public Key
            </Button>
          </div>

          {/* Public Key Display */}
          {showPublicKey && (
            <div className="mt-3">
              <h4 className="mb-2 font-medium">Your Public Key (Share this with others):</h4>
              <div className="relative">
                <textarea
                  readOnly
                  value={getPublicKey() || ""}
                  className="w-full rounded border p-2 text-xs font-mono"
                  rows={6}
                />
                <button
                  onClick={copyPublicKey}
                  className="absolute right-2 top-2 rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
                >
                  Copy
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                📤 Share this public key with people you want to chat with securely.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Key Generation Status */}
      {keyStatus === "generating" && (
        <div className="mt-4 rounded bg-yellow-50 p-3 text-sm">
          <h4 className="font-medium text-yellow-800">🔐 Generating RSA-4096 Keys...</h4>
          <p className="mt-1 text-yellow-700">
            Your encryption keys are being generated automatically. This process ensures 
            secure communication with other users on the network.
          </p>
        </div>
      )}

      {/* No Keys Status */}
      {keyStatus === "none" && (
        <div className="mt-4 rounded bg-blue-50 p-3 text-sm">
          <h4 className="font-medium text-blue-800">🔐 Ready for Secure Chat</h4>
          <p className="mt-1 text-blue-700">
            Your encryption keys will be generated automatically when you log in.
            Keys use RSA-4096 encryption for maximum security.
          </p>
        </div>
      )}

      {/* Error Status */}
      {keyStatus === "error" && (
        <div className="mt-4 rounded bg-red-50 p-3 text-sm">
          <h4 className="font-medium text-red-800">❌ Key Generation Error</h4>
          <p className="mt-1 text-red-700">
            There was an issue generating your encryption keys. Please try logging in again.
          </p>
        </div>
      )}
    </div>
  );
};

export default KeyManagementPanel;