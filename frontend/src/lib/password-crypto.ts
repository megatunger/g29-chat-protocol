import { encode, decode } from "base64url-universal";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const PASSWORD_PUBLIC_KEY_BASE64 =
  "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAvTgCzLHTQHchEgbmYmoH2VhELt+uvLK1vbmv4N8Uf1+zCMmRtqU4MMTgBMxow0RfvOo0UWxNokJtaIVf2BQQtfSLqAzl9kNm9HaH7YnYe12N86Lu3R5wP8EN7sEsuMXT2kz5E0lhKKiHppLw14fYB5BW2NqCRh82lMTh4PUjuXQbSMlNa2AFsoZV3bN3yD3eg7R6PfecLz2y1bi8keCUrYfX9AteURvvOd7BPzps1+9hpCQySCaBCdO7beYZzcLDLnxzPG0316G1Yxvy9K9B0JD7/Dqul+u3uisOfi84ZBvdicSESFallmzs4erlOEjU94dGxA18ONrjJWbwCaqNwQaKpG/lMGuif3uRwql9DQkzYndYhrGg8Mc5kEBEvkWmQTjr66NJMQn5U/NQuJiRMhw3gqvjdM9nknaBhrFg0Ald2TA/Wi9J2gQgf3i4lp4Mirn6wGeoqTzc4pG5hOGX0hClXDSezFwO/zYczQvsKWdJ6ei4UpwGwasNFN+0aCOkdKoB9DknTgRN1e+mZy13iaDul6hXshkY/aJ13QVcA92vxf+dEEDJWeY/tIs1wmbW5XETRq1xwiudaBWKwzCmqBlipEtg2qZOF82hnMh4AhN1LdPUtxnwJvF8SIQVRZB2ONHNx0VaaMQBOKh4ll2r0FR1FynaOqRAolJtgjN+Dr8CAwEAAQ==";

const PASSWORD_PRIVATE_KEY_BASE64 =
  "MIIJQQIBADANBgkqhkiG9w0BAQEFAASCCSswggknAgEAAoICAQC9OALMsdNAdyESBuZiagfZWEQu3668srW9ua/g3xR/X7MIyZG2pTgwxOAEzGjDRF+86jRRbE2iQm1ohV/YFBC19IuoDOX2Q2b0doftidh7XY3zou7dHnA/wQ3uwSy4xdPaTPkTSWEoqIemkvDXh9gHkFbY2oJGHzaUxOHg9SO5dBtIyU1rYAWyhlXds3fIPd6DtHo995wvPbLVuLyR4JSth9f0C15RG+853sE/OmzX72GkJDJIJoEJ07tt5hnNwsMufHM8bTfXobVjG/L0r0HQkPv8Oq6X67e6Kw5+LzhkG92JxIRIVqWWbOzh6uU4SNT3h0bEDXw42uMlZvAJqo3BBoqkb+Uwa6J/e5HCqX0NCTNid1iGsaDwxzmQQES+RaZBOOvro0kxCflT81C4mJEyHDeCq+N0z2eSdoGGsWDQCV3ZMD9aL0naBCB/eLiWngyKufrAZ6ipPNzikbmE4ZfSEKVcNJ7MXA7/NhzNC+wpZ0np6LhSnAbBqw0U37RoI6R0qgH0OSdOBE3V76ZnLXeJoO6XqFeyGRj9onXdBVwD3a/F/50QQMlZ5j+0izXCZtblcRNGrXHCK51oFYrDMKaoGWKkS2Dapk4XzaGcyHgCE3Ut09S3GfAm8XxIhBVFkHY40c3HRVpoxAE4qHiWXavQVHUXKdo6pECiUm2CM34OvwIDAQABAoICAB/VlpL9r/7+i+/OfWA9Woi0kvQX6fwRTQZYgUCiB37OiP6Hex5xeZyq4s2r3kxL6peMB7VTNVSBPIsDNXbTGWSjegOR9/aQrHegoYnTUTqgKMu+s9U708LGJiPvGCkWD2iA3r7h75i5kejye9anIi9Tl2jwik5l3fb1kNMaKyJ+aEC8rWvNQeghNb0Q/qwPzKn36UEXsY05IidW51Lbp+fyHOEQMJQQ0RS5Z2XN3JYPziuhc1w0Li2LE9OPjPPTOqdNhM27ylNa/3tnLl8ARWBjpCFxdgJVRBnsOIn+Q8yD66fMCj1pZn6CYPA5ZssrZbknZz6Azk96dBDM2sGlkieHcVOa5Psa+d4gX0Pk36TRs/W0VakuaF9cOUqKmkiqBi50BoB7f49ZbSBR4fKfM+rVIVfYluJVM5sN75sFQQtXbGma4lBOwwKGIWmarZ07UIdITwZS9R/bMD/csPGV9+D2zgXWvuYzoXx9J3HJwC6JKdZUdlnVFcIuNjxExGYvBiarQRRJkysiM6EexDkW7aUeJ41bMwCadhJFF7kuJj7uXfhqusqhv2oFbT7eyyyRy43Ieafan+npYK4xs6GrYTwXL9TZYnG1Ak9L5YFLzQp+38tLOl6XYwwm9XAUBOvrQQSlbHveNC9BFfY4xswW8wA9X24SNENX1/ULR36Y/NhxAoIBAQDguqGplm5fDOT/2A0DV9vrpFWL9kfSwMbvxC6uvaIugxoMvMSizfsRqqAtSangOTYsJMHy9kyjRoyaZ1f3XPZlC/dxGLltxtKlSDH++Z2JRaexGwUHe7OLJ1ePCwisLpHLI2yldbgbWWdna3oOQrc9/pubcaHM2ZqeoFTXSj/jeQqgVHTc9b+4PIkW7L6GutK+eX87Bh95l3Rx7mVq6Pq9ri4zeOj7ajvzmfIDySwczaqeCFggrqZk+DGT871XXSR3aoyTXnBjb/Gf4lg+/gktq+wL/7bSuyFrfihP0dKEd+qi5OuM/vU0h9yqi1f054dv6+MgFFsU5rW7XXS/nAQtAoIBAQDXjGwttNLcIR37zygcGklevIZXjBhrlg61l35cbr99jgly7hWKxAx636JKURB1O0k6mTU7KVzUFp2Hhw1Rw/DZTwZ+X/6rnCrGQjqHF1eaSPxefob/I0g/5I7XwZw6ZGZtAF2ASK4JFi0tGRYKG3xAyC7nhQwFp6q9qQMzuUL27sa8vVe8PDg4UI+0bYHxkw99Ep3do2Wjq2dnXrC44MjYAozGoj27vC3y2asIGLFK0pWyyG2jSfIAEpQ0XxUaRrGkA5udR2SnuchrlLR2kb2OBBZLBUxkVKetPYhrIJPfcJYCThrDjAklkosnRvvfblnhJ2BMxZrs73kTZ634PNYbAoIBACHOkbFUawgrhWujkdmV5wSc9S2YABgJXiQFrEwnRPWgTVPrNd2UBRgURgJqGX8cvDSJ1w940/CgFVjJASe6OWrcEP5XjNWh2mB46uSDoppa+y4edXQ5vLnLUlW3gDd+zfn0O0zs16Rtn6ukNHleufg+jCQnRQLvHV6NmhXFGrVaqSmTav0ujwflO25ScRsNkdSLrIMxmZyOFztodKNPpyDPyi1+G/ZuddRgrVK6ecNfgTJC6RcJjwiTecnbGfnBjlHUmo803s1msr+tqj7XsoPHYDwx3Mv40L89/Ex9sSCydX7J11GfrT2Yzq5tRe8WwX4py0IxLb6IMoCcP4rvqoUCggEACngAfQvOPfDB0wwRp6PDMn23jKL6QKduGXW9JmIenMt8O//CPhYdgQ5BhJiBUyBJAzaTtkbhAlAC4KU3iWQZ24QSDas95DnWfgCTdSI2GAE5eKFujw+4n5nLMkFuBAwCSYL+B5AAG+Le2NTiFCWXmFHgrU/x8IhfK4z84dM6pGGed2Y+z56hIGMRR7MV35TD6NAxqKUZ96QIhqW7sY8BUjR1f+Q7WVXfaW8W9nK0kay+potDf+3Eeips1kpT7Q3H7O5b7XydL+Q/DrKPPT8A1Nfv+T7NogXWivx1FrbjV7PRJVWDyUGQ5ClE5uh0rTpf1Sajb7cdOiq7V6zubyMNRwKCAQANqu7wmc9urVmd6zQFGd4sAo9L+YrdYb9fVBrZ3uYi//ycT1PFlNOUKED9bqW49m1iZcVz+Jz+A/Lvd/5OF1PzUIAlmNZDkDbqiHIBgtLXmVwBzlPLeUwyfaWR3n83T3QE2OwBNhCM1NWcQVQBk/VZhoYbam+XC3WejhHhMlgDuyBxkEiMwnbo174M9jjCFoA9HWYkHu4U+eG0Vd5AxcTqeIesQGlzuD7nEaAm5Uw7bvjPfWgucn8+iXsUFCuRn/yBoywMsUN6Qf+BcKtrqTGPP2PFTdOc9nOf3ck5A6V9Dnsp2wcgoUNdPC26q3xoDBxMJ1mhBmBxgGYtc0M1QxIF";

const ensureSubtle = (): SubtleCrypto => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("WebCrypto subtle API is not available");
  }
  return subtle;
};

const base64ToUint8Array = (value: string): Uint8Array => {
  if (typeof atob === "function") {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  return Uint8Array.from(Buffer.from(value, "base64"));
};

let cachedPublicKey: Promise<CryptoKey> | null = null;
let cachedPrivateKey: Promise<CryptoKey> | null = null;

const importPublicKey = (): Promise<CryptoKey> => {
  if (!cachedPublicKey) {
    cachedPublicKey = ensureSubtle().importKey(
      "spki",
      base64ToUint8Array(PASSWORD_PUBLIC_KEY_BASE64),
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      false,
      ["encrypt"],
    );
  }
  return cachedPublicKey;
};

const importPrivateKey = (): Promise<CryptoKey> => {
  if (!cachedPrivateKey) {
    cachedPrivateKey = ensureSubtle().importKey(
      "pkcs8",
      base64ToUint8Array(PASSWORD_PRIVATE_KEY_BASE64),
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      false,
      ["decrypt"],
    );
  }
  return cachedPrivateKey;
};

export const encryptPassword = async (password: string): Promise<string> => {
  const publicKey = await importPublicKey();
  const passwordBytes = textEncoder.encode(password);
  const ciphertext = await ensureSubtle().encrypt({ name: "RSA-OAEP" }, publicKey, passwordBytes);
  return encode(new Uint8Array(ciphertext));
};

export const decryptPassword = async (encryptedPassword: string): Promise<string> => {
  const privateKey = await importPrivateKey();
  const ciphertext = decode(encryptedPassword);
  const decrypted = await ensureSubtle().decrypt(
    {
      name: "RSA-OAEP",
    },
    privateKey,
    ciphertext,
  );
  return textDecoder.decode(decrypted);
};
