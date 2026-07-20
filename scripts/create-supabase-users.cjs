/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env.local");
const allowedRoles = new Set(["captain", "cashier", "kitchen", "admin"]);
const resetExistingPasswords =
  process.argv.includes("--reset-passwords") || process.env.KHATOUN_RESET_EXISTING_PASSWORDS === "true";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^["']|["']$/g, "");
    process.env[key] ||= value;
  }
}

function getPassword(username) {
  const envName = `KHATOUN_${username.toUpperCase()}_PASSWORD`;
  const password = process.env[envName] || process.env.KHATOUN_DEFAULT_USER_PASSWORD;

  if (!password || password.length < 8) {
    throw new Error(`${envName} or KHATOUN_DEFAULT_USER_PASSWORD must be at least 8 characters.`);
  }

  return password;
}

function assertValidUser(user) {
  if (!user.username || !/^[a-z][a-z0-9_-]*$/.test(user.username)) {
    throw new Error(`Invalid username: ${user.username}`);
  }

  if (!allowedRoles.has(user.role)) {
    throw new Error(`Invalid role for ${user.username}: ${user.role}`);
  }
}

async function listAllUsers(supabase) {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });

    if (error) {
      throw error;
    }

    users.push(...data.users);

    if (data.users.length < 100) {
      return users;
    }

    page += 1;
  }
}

loadEnvFile(envPath);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
}

const users = [
  { username: "captain", role: "captain", full_name: "الكابتن علي" },
  { username: "cashier", role: "cashier", full_name: "المحاسب علي" },
  { username: "kitchen", role: "kitchen", full_name: "الشيف علي" },
  { username: "admin", role: "admin", full_name: "مدير النظام" },
];

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function upsertProfile(userId, user) {
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    status: "active",
  });

  if (error) {
    throw error;
  }
}

async function ensureUser(user, existingUsers) {
  assertValidUser(user);

  const email = `${user.username}@khatoun.local`;
  const existing = existingUsers.find((candidate) => candidate.email === email);
  const metadata = {
    username: user.username,
    full_name: user.full_name,
    role: user.role,
  };

  if (!existing) {
    const password = getPassword(user.username);
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error) {
      throw error;
    }

    await upsertProfile(data.user.id, user);
    console.log(`Created ${user.username}: ${data.user.id}`);
    return;
  }

  const updatePayload = {
    email_confirm: true,
    user_metadata: metadata,
  };

  if (resetExistingPasswords) {
    updatePayload.password = getPassword(user.username);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, updatePayload);

  if (updateError) {
    throw updateError;
  }

  await upsertProfile(existing.id, user);
  console.log(`Updated profile for ${user.username}: ${existing.id}`);
}

async function main() {
  const existingUsers = await listAllUsers(supabase);

  for (const user of users) {
    await ensureUser(user, existingUsers);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
