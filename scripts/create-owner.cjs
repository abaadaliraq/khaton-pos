/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env.local");

const owner = {
  email: "owner@khatoun.local",
  password: "11223344",
  metadata: {
    username: "owner",
    full_name: "مالك المطعم",
    role: "owner",
  },
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^["']|["']$/g, "");
    process.env[key] ||= value;
  }
}

async function listAllUsers(supabase) {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 100) return users;
    page += 1;
  }
}

async function waitForOwnerProfile(supabase, userId) {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, role, status")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return null;
}

async function verifyNoStaffMember(supabase, profileId) {
  const { data, error } = await supabase
    .from("staff_members")
    .select("id, employee_number, full_name")
    .eq("profile_id", profileId);

  if (error) throw error;
  return data ?? [];
}

function assertOwnerProfile(profile) {
  if (!profile) {
    throw new Error("Auth user exists, but profiles row was not created by trigger.");
  }

  if (profile.username !== owner.metadata.username || profile.role !== owner.metadata.role) {
    throw new Error(
      `profiles validation failed. username=${profile.username ?? "-"} role=${profile.role ?? "-"} expected username=owner role=owner.`,
    );
  }
}

function isMissingOwnerRoleError(error) {
  const text = JSON.stringify(error).toLowerCase();
  return text.includes("invalid user role") || text.includes("profiles_role_check") || text.includes("violates check constraint");
}

async function main() {
  loadEnvFile(envPath);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const existingUsers = await listAllUsers(supabase);
  const existing = existingUsers.find((user) => user.email?.toLowerCase() === owner.email);

  if (existing) {
    console.log(`Owner Auth user already exists: ${owner.email}`);
    const profile = await waitForOwnerProfile(supabase, existing.id);
    assertOwnerProfile(profile);
    const staffMembers = await verifyNoStaffMember(supabase, existing.id);
    if (staffMembers.length > 0) {
      throw new Error(`Owner profile is linked to ${staffMembers.length} staff_members row(s). This should be fixed manually.`);
    }
    console.log("Verified existing profile: username=owner role=owner");
    console.log("Verified no staff_members row is linked to owner.");
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: owner.email,
    password: owner.password,
    email_confirm: true,
    user_metadata: owner.metadata,
  });

  if (error) {
    if (isMissingOwnerRoleError(error)) {
      throw new Error("Owner role is not accepted by the database yet. Apply supabase/migrations/20260827_owner_role.sql first, then rerun this script.");
    }
    throw error;
  }

  if (!data.user?.id) {
    throw new Error("Supabase Admin API did not return a created user id.");
  }

  console.log(`Created Owner Auth user: ${owner.email}`);
  const profile = await waitForOwnerProfile(supabase, data.user.id);
  assertOwnerProfile(profile);
  console.log("Verified profile: username=owner role=owner");

  const staffMembers = await verifyNoStaffMember(supabase, data.user.id);
  if (staffMembers.length > 0) {
    throw new Error(`Owner profile is linked to ${staffMembers.length} staff_members row(s). This should be fixed manually.`);
  }

  console.log("Verified no staff_members row was created.");
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exitCode = 1;
});
