import { and, eq, gt } from "drizzle-orm";

import { getDb } from "@/db";
import { authRateLimits, authSessions, members } from "@/db/schema";

const SESSION_DAYS = 30;
const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;
// Keep password derivation within the CPU budget of Cloudflare Workers Free.
// Every password still receives a unique 128-bit salt and a 256-bit digest.
const PBKDF2_ITERATIONS = 100_000;
const SESSION_COOKIE = "globeledger_session";
const SECURE_SESSION_COOKIE = "__Host-globeledger_session";

export type AuthMember = {
  id: string;
  email: string;
  displayName: string;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(digest));
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
  ) {
    return null;
  }
  return email;
}

export function validPassword(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 10 &&
    value.length <= 128 &&
    /[A-Za-z]/u.test(value) &&
    /\d/u.test(value)
  );
}

export function normalizeDisplayName(value: unknown) {
  if (typeof value !== "string") return null;
  const displayName = value.trim().replace(/\s+/gu, " ");
  return displayName.length >= 1 && displayName.length <= 80
    ? displayName
    : null;
}

export async function hashNewPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePassword(password, salt, PBKDF2_ITERATIONS);
  return {
    passwordHash: bytesToBase64(derived),
    passwordSalt: bytesToBase64(salt),
    passwordIterations: PBKDF2_ITERATIONS,
  };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string,
  iterations: number,
) {
  try {
    const expected = base64ToBytes(storedHash);
    const actual = await derivePassword(
      password,
      base64ToBytes(storedSalt),
      iterations,
    );
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function verifyPasswordOrDummy(
  password: string,
  stored:
    | { passwordHash: string; passwordSalt: string; passwordIterations: number }
    | undefined,
) {
  return verifyPassword(
    password,
    stored?.passwordHash ?? "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    stored?.passwordSalt ?? "AAAAAAAAAAAAAAAAAAAAAA==",
    stored?.passwordIterations ?? PBKDF2_ITERATIONS,
  );
}

function cookiesFromHeader(cookieHeader: string | null) {
  const values = new Map<string, string>();
  for (const cookie of (cookieHeader ?? "").split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 1) continue;
    try {
      values.set(
        cookie.slice(0, separator).trim(),
        decodeURIComponent(cookie.slice(separator + 1).trim()),
      );
    } catch {
      continue;
    }
  }
  return values;
}

export function sessionTokenFromCookies(cookieHeader: string | null) {
  const cookies = cookiesFromHeader(cookieHeader);
  return (
    cookies.get(SECURE_SESSION_COOKIE) ?? cookies.get(SESSION_COOKIE) ?? null
  );
}

export async function memberFromCookieHeader(cookieHeader: string | null) {
  const token = sessionTokenFromCookies(cookieHeader);
  if (!token || token.length < 32 || token.length > 128) return null;
  const tokenHash = await sha256(token);
  const now = Date.now();
  const rows = await getDb()
    .select({
      id: members.id,
      email: members.email,
      displayName: members.displayName,
    })
    .from(authSessions)
    .innerJoin(members, eq(authSessions.memberId, members.id))
    .where(
      and(
        eq(authSessions.tokenHash, tokenHash),
        gt(authSessions.expiresAtMs, now),
      ),
    )
    .limit(1);
  return rows[0] satisfies AuthMember | undefined;
}

export async function memberFromRequest(request: Request) {
  return memberFromCookieHeader(request.headers.get("cookie"));
}

export async function createSession(memberId: string, requestUrl: string) {
  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)))
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
  const now = Date.now();
  await getDb().insert(authSessions).values({
    id: crypto.randomUUID(),
    memberId,
    tokenHash: await sha256(token),
    createdAtMs: now,
    lastSeenAtMs: now,
    expiresAtMs: now + SESSION_MAX_AGE_SECONDS * 1000,
  });
  return sessionCookie(token, requestUrl);
}

export async function deleteSession(cookieHeader: string | null) {
  const token = sessionTokenFromCookies(cookieHeader);
  if (!token) return;
  await getDb()
    .delete(authSessions)
    .where(eq(authSessions.tokenHash, await sha256(token)));
}

export function sessionCookie(token: string, requestUrl: string) {
  const secure = new URL(requestUrl).protocol === "https:";
  const name = secure ? SECURE_SESSION_COOKIE : SESSION_COOKIE;
  return `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure ? "; Secure" : ""}`;
}

export function expiredSessionCookies(requestUrl: string) {
  const secure = new URL(requestUrl).protocol === "https:";
  return [
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${SECURE_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`,
  ];
}

export async function authRateLimitKey(request: Request, email: string) {
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  return sha256(`${ip}\n${email}`);
}

export async function isAuthRateLimited(keyHash: string) {
  const rows = await getDb()
    .select()
    .from(authRateLimits)
    .where(eq(authRateLimits.keyHash, keyHash))
    .limit(1);
  return Boolean(rows[0]?.blockedUntilMs && rows[0].blockedUntilMs > Date.now());
}

export async function recordAuthFailure(keyHash: string) {
  const db = getDb();
  const now = Date.now();
  const rows = await db
    .select()
    .from(authRateLimits)
    .where(eq(authRateLimits.keyHash, keyHash))
    .limit(1);
  const existing = rows[0];
  const withinWindow =
    existing && now - existing.windowStartedAtMs < 15 * 60 * 1000;
  const attempts = withinWindow ? existing.attempts + 1 : 1;
  const windowStartedAtMs = withinWindow ? existing.windowStartedAtMs : now;
  await db
    .insert(authRateLimits)
    .values({
      keyHash,
      attempts,
      windowStartedAtMs,
      blockedUntilMs: attempts >= 8 ? now + 15 * 60 * 1000 : null,
      updatedAtMs: now,
    })
    .onConflictDoUpdate({
      target: authRateLimits.keyHash,
      set: {
        attempts,
        windowStartedAtMs,
        blockedUntilMs: attempts >= 8 ? now + 15 * 60 * 1000 : null,
        updatedAtMs: now,
      },
    });
}

export async function clearAuthFailures(keyHash: string) {
  await getDb()
    .delete(authRateLimits)
    .where(eq(authRateLimits.keyHash, keyHash));
}
