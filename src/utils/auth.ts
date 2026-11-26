// 工具：用户认证、PBKDF2 密码哈希（兼容旧版平滑升级）与 HS256 JWT 签发/校验
const FALLBACK_DEV_SECRET = "novel-studio-secret-key-2026";
const PBKDF2_PREFIX = "pbkdf2";
const PBKDF2_ITERATIONS = 100000;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret && secret.length >= 16) {
    return secret;
  }
  return FALLBACK_DEV_SECRET;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const len = Math.floor(hex.length / 2);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function legacySha256Hash(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}:${getJwtSecret()}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

async function derivePbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as unknown as BufferSource,
      iterations,
    },
    keyMaterial,
    256
  );
  return new Uint8Array(derived);
}

export function isLegacyPasswordHash(hash: string): boolean {
  return !hash.startsWith(`${PBKDF2_PREFIX}$`);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const derived = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(derived)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;
  if (storedHash.startsWith(`${PBKDF2_PREFIX}$`)) {
    const parts = storedHash.split("$");
    if (parts.length !== 4) return false;
    const iterations = Number(parts[1]);
    if (!Number.isFinite(iterations) || iterations < 10000) return false;
    const salt = hexToBytes(parts[2]);
    const expected = hexToBytes(parts[3]);
    const actual = await derivePbkdf2(password, salt, iterations);
    return timingSafeEqual(actual, expected);
  }
  // 兼容存量旧版无盐 SHA-256 哈希，登录成功后由 /api/login 自动升级为 PBKDF2
  const legacyActual = hexToBytes(await legacySha256Hash(password));
  const legacyExpected = hexToBytes(storedHash);
  return timingSafeEqual(legacyActual, legacyExpected);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function utf8ToBase64Url(str: string): string {
  return bytesToBase64Url(new TextEncoder().encode(str));
}

function base64UrlToUtf8(str: string): string {
  return new TextDecoder().decode(base64UrlToBytes(str));
}

export interface JWTPayload {
  userId: string;
  username: string;
  name?: string;
  exp: number;
  iat: number;
}

export async function signToken(
  payload: Omit<JWTPayload, "exp" | "iat">,
  expiresInSeconds: number = 7 * 24 * 3600
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = utf8ToBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = utf8ToBase64Url(JSON.stringify(fullPayload));
  const message = `${encodedHeader}.${encodedPayload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getJwtSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return `${message}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const message = `${encodedHeader}.${encodedPayload}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(getJwtSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBytes = base64UrlToBytes(encodedSignature);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes as unknown as BufferSource,
      encoder.encode(message)
    );
    if (!isValid) return null;

    const payload: JWTPayload = JSON.parse(base64UrlToUtf8(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    // 强制校验过期时间与 userId，拒绝无 exp 的永久 Token
    if (typeof payload.exp !== "number" || payload.exp < now || !payload.userId) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
