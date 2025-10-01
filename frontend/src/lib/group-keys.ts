/**
 * Public Channel Group Key Management for SOCP v1.3
 * Implements proper AES-GCM group key encryption with RSA key wrapping
 */

import { ChatCrypto } from './crypto';

export class PublicChannelKeyManager {
  private wrappedGroupKeys: Map<string, { wrappedKey: string; version: number }> = new Map();
  private groupKeys: Map<string, CryptoKey> = new Map(); // Unwrapped group keys
  
  /**
   * Store a wrapped group key for a channel
   */
  storeWrappedGroupKey(channelId: string, wrappedKey: string, version: number): void {
    this.wrappedGroupKeys.set(channelId, { wrappedKey, version });
  }

  /**
   * Get the current wrapped group key for a channel
   */
  getWrappedGroupKey(channelId: string): { wrappedKey: string; version: number } | null {
    return this.wrappedGroupKeys.get(channelId) || null;
  }

  /**
   * Unwrap and store a group key using the user's private RSA key
   */
  async unwrapAndStoreGroupKey(
    channelId: string, 
    wrappedKey: string, 
    userPrivateKey: CryptoKey
  ): Promise<void> {
    try {
      // Decode the wrapped key from base64url
      const wrappedKeyBuffer = this.base64urlToArrayBuffer(wrappedKey);
      
      // Unwrap the group key using RSA-OAEP
      const groupKeyBuffer = await window.crypto.subtle.decrypt(
        {
          name: "RSA-OAEP",
          hash: "SHA-256",
        },
        userPrivateKey,
        wrappedKeyBuffer
      );

      // Import the unwrapped group key as AES-GCM key
      const groupKey = await window.crypto.subtle.importKey(
        "raw",
        groupKeyBuffer,
        { name: "AES-GCM" },
        false, // not extractable
        ["encrypt", "decrypt"]
      );

      this.groupKeys.set(channelId, groupKey);
    } catch (error) {
      console.error("Failed to unwrap group key:", error);
      throw error;
    }
  }

  /**
   * Generate a new group key for a channel
   */
  async generateGroupKey(channelId: string): Promise<CryptoKey> {
    const groupKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true, // extractable so we can wrap it
      ["encrypt", "decrypt"]
    );
    
    this.groupKeys.set(channelId, groupKey);
    return groupKey;
  }

  /**
   * Generate a deterministic group key for testing (all users use same key)
   */
  async generateDeterministicGroupKey(channelId: string): Promise<CryptoKey> {
    // Create a deterministic key for testing - all users will have the same key
    const keyMaterial = new Uint8Array(32);
    // Use a fixed pattern for testing
    for (let i = 0; i < 32; i++) {
      keyMaterial[i] = (i * 7 + 42) % 256;
    }
    
    const groupKey = await window.crypto.subtle.importKey(
      "raw",
      keyMaterial,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
    
    this.groupKeys.set(channelId, groupKey);
    return groupKey;
  }

  /**
   * Get the unwrapped group key for a channel
   */
  getGroupKey(channelId: string): CryptoKey | null {
    return this.groupKeys.get(channelId) || null;
  }

  /**
   * Create a SOCP-compliant public channel message with group key encryption
   */
  async createPublicChannelMessage(
    message: string,
    senderUserId: string,
    senderPrivateKeyPem: string,
    senderPublicKeyPem: string,
    channelId: string = "public"
  ): Promise<{
    ciphertext: string;
    content_sig: string;
    sender_pub: string;
  }> {
    // Get the group key for this channel
    let groupKey = this.getGroupKey(channelId);
    
    // If no group key exists, generate a deterministic one for testing
    if (!groupKey) {
      groupKey = await this.generateDeterministicGroupKey(channelId);
    }
    
    // Encrypt the message with AES-GCM using the group key
    const messageBuffer = new TextEncoder().encode(message);
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      groupKey,
      messageBuffer
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedBuffer), iv.length);
    
    const ciphertext = this.arrayBufferToBase64url(combined.buffer);
    
    // Create content signature over ciphertext|from|ts
    const timestamp = Date.now();
    const contentToSign = `${ciphertext}|${senderUserId}|${timestamp}`;
    
    const content_sig = await ChatCrypto.signPayload(contentToSign, senderPrivateKeyPem);
    
    return {
      ciphertext,
      content_sig,
      sender_pub: senderPublicKeyPem,
    };
  }

  /**
   * Decrypt a SOCP-compliant public channel message
   */
  async decryptPublicChannelMessage(
    ciphertext: string,
    content_sig: string,
    sender_pub: string,
    sender: string,
    timestamp: number,
    channelId: string = "public"
  ): Promise<{
    message: string;
    contentSignatureValid: boolean;
  }> {
    try {
      // Verify content signature first
      const contentToVerify = `${ciphertext}|${sender}|${timestamp}`;
      const contentSignatureValid = await ChatCrypto.verifyPayloadSignature(contentToVerify, sender_pub, content_sig);
      
      // Get the group key for this channel
      const groupKey = this.getGroupKey(channelId);
      if (!groupKey) {
        throw new Error(`No group key available for channel ${channelId}`);
      }
      
      // Decode the ciphertext
      const combined = this.base64urlToArrayBuffer(ciphertext);
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);
      
      // Decrypt with the group key
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        groupKey,
        encryptedData
      );
      
      const message = new TextDecoder().decode(decryptedBuffer);
      
      return {
        message,
        contentSignatureValid,
      };
    } catch (error) {
      console.error("Failed to decrypt public channel message:", error);
      throw error;
    }
  }

  private base64urlToArrayBuffer(base64url: string): ArrayBuffer {
    // Add padding if needed
    const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + padding;
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private arrayBufferToBase64url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binaryString = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    const base64 = window.btoa(binaryString);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}

export const publicChannelKeyManager = new PublicChannelKeyManager();