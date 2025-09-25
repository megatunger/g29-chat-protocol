/**
 * Simple crypto wrapper using OpenPGP.js
 * Handles RSA key generation, encryption, and signing for chat
 */

import * as openpgp from 'openpgp';

export interface ChatKeyPair {
  publicKey: string;   // Armored public key
  privateKey: string;  // Armored private key
  keyId: string;       // Unique identifier
}

export class ChatCrypto {
  /**
   * Generate new RSA-4096 key pair for a user
   */
  static async generateKeyPair(
    userName: string, 
    userEmail: string
  ): Promise<ChatKeyPair> {
    try {
      const { publicKey, privateKey } = await openpgp.generateKey({
        type: 'rsa',
        rsaBits: 4096,
        userIDs: [{ name: userName, email: userEmail }],
        format: 'armored'
      });

      // Generate a simple key ID
      const keyId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        publicKey,
        privateKey, 
        keyId
      };
    } catch (error) {
      throw new Error(`Key generation failed: ${error}`);
    }
  }

  /**
   * Encrypt and sign a message
   */
  static async encryptAndSign(
    message: string,
    recipientPublicKey: string,
    senderPrivateKey: string
  ): Promise<string> {
    try {
      const publicKey = await openpgp.readKey({ armoredKey: recipientPublicKey });
      const privateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: senderPrivateKey }),
        passphrase: '' // We'll add passphrase support later
      });

      const encrypted = await openpgp.encrypt({
        message: await openpgp.createMessage({ text: message }),
        encryptionKeys: publicKey,
        signingKeys: privateKey,
        format: 'armored'
      });

      return encrypted;
    } catch (error) {
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt and verify a message
   */
  static async decryptAndVerify(
    encryptedMessage: string,
    recipientPrivateKey: string,
    senderPublicKey: string
  ): Promise<{ message: string; verified: boolean }> {
    try {
      const message = await openpgp.readMessage({ armoredMessage: encryptedMessage });
      const publicKey = await openpgp.readKey({ armoredKey: senderPublicKey });
      const privateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: recipientPrivateKey }),
        passphrase: ''
      });

      const { data: decrypted, signatures } = await openpgp.decrypt({
        message,
        decryptionKeys: privateKey,
        verificationKeys: publicKey,
        format: 'utf8'
      });

      // Check if signature is valid
      let verified = false;
      if (signatures.length > 0) {
        try {
          await signatures[0].verified;
          verified = true;
        } catch (e) {
          verified = false;
        }
      }

      return {
        message: decrypted,
        verified
      };
    } catch (error) {
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  /**
   * Extract key ID from public key
   */
  static async getKeyId(publicKey: string): Promise<string> {
    try {
      const key = await openpgp.readKey({ armoredKey: publicKey });
      return key.getKeyID().toHex();
    } catch (error) {
      throw new Error(`Failed to get key ID: ${error}`);
    }
  }

  /**
   * Validate if a key is properly formatted
   */
  static async validateKey(armoredKey: string): Promise<boolean> {
    try {
      await openpgp.readKey({ armoredKey });
      return true;
    } catch (error) {
      return false;
    }
  }
}

export class KeyStorage {
  private static readonly STORAGE_KEY = 'chat_keys';

  static saveKeys(keyPair: ChatKeyPair): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(keyPair));
    } catch (error) {
      console.error('Failed to save keys:', error);
    }
  }


  static loadKeys(): ChatKeyPair | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to load keys:', error);
      return null;
    }
  }

  static hasKeys(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }
  static clearKeys(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}