const { constants, createPublicKey, createSign, createVerify } = require("crypto");
const { decode } = require("base64url-universal");

const fromBase64Url = (value) => Buffer.from(decode(value));
const toBase64Url = (buffer) =>
  Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");

function normalizePayload(payload) {
  if (payload === undefined || payload === null) {
    return "";
  }

  if (typeof payload === "string") {
    return payload;
  }

  try {
    return JSON.stringify(payload);
  } catch (_error) {
    return "";
  }
}

function signPayload({ privateKey, payload }) {
  if (!privateKey) {
    return "";
  }

  const payloadString = normalizePayload(payload);
  if (!payloadString) {
    return "";
  }

  try {
    const signer = createSign("sha256");
    signer.update(Buffer.from(payloadString, "utf8"));
    signer.end();

    const signature = signer.sign({
      key: privateKey,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
    });

    return toBase64Url(signature);
  } catch (_error) {
    return "";
  }
}

/**
 * Verify an RSASSA-PSS (SHA-256) signature produced by the frontend ChatCrypto helper.
 *
 * @param {Object} params
 * @param {string} params.publicKey base64url encoded DER (SPKI) public key
 * @param {string} params.payload UTF-8 payload string that was signed
 * @param {string} params.signature base64url encoded RSASSA-PSS signature
 * @returns {boolean} true when the signature matches the payload for the supplied key
 */
function verifyPayloadSignature({ publicKey, payload, signature }) {
  if (!publicKey || !payload || !signature) {
    return false;
  }

  try {
    const publicKeyObject = createPublicKey({
      key: fromBase64Url(publicKey),
      format: "der",
      type: "spki",
    });

    const verifier = createVerify("sha256");
    verifier.update(Buffer.from(payload, "utf8"));
    verifier.end();

    return verifier.verify(
      {
        key: publicKeyObject,
        padding: constants.RSA_PKCS1_PSS_PADDING,
        saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
      },
      fromBase64Url(signature),
    );
  } catch {
    return false;
  }
}

module.exports = {
  verifyPayloadSignature,
  signPayload,
};
