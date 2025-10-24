const { verifyPayloadSignature } = require("./crypto");

/**
 * Verify a stored user's signature for a given payload.
 *
 * @param {Object} params
 * @param {import("../generated/prisma").PrismaClient} params.prismaClient
 * @param {string} params.userId
 * @param {Object} params.payload
 * @param {string} params.signature
 * @returns {Promise<{valid: boolean, user: Object|null}>}
 */
async function verifyStoredUserSignature({
  prismaClient,
  userId,
  payload,
  signature,
}) {
  if (!signature) {
    return { valid: false, user: null };
  }

  const user = await prismaClient.client.findFirst({
    where: {
      userID: userId,
    },
  });

  if (!user) {
    throw new Error("Missing userID in 'from' field");
  }

  const isValid = verifyPayloadSignature({
    publicKey: user.pubkey,
    payload: JSON.stringify(payload),
    signature,
  });

  return { valid: isValid, user };
}

module.exports = {
  verifyStoredUserSignature,
};
