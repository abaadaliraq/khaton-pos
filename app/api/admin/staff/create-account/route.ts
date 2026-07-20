import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import type { SystemRole } from "@/types/staff";

const allowedRoles: SystemRole[] = ["captain", "cashier", "kitchen", "admin"];
const staffSelect = "id, employee_number, profile_id, full_name, phone, secondary_phone, job_title, department, employment_type, shift_type, hire_date, birth_date, salary, address, emergency_contact_name, emergency_contact_phone, notes, status, has_system_access, created_at, updated_at, profile:profiles(username, role, status)";

type RequestBody = { staffId?: unknown; username?: unknown; password?: unknown; systemRole?: unknown };
type StaffAccountCandidate = {
  id: string;
  profile_id: string | null;
  full_name: string;
  status: string;
  has_system_access: boolean;
};

function serverError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isSystemRole(value: unknown): value is SystemRole {
  return typeof value === "string" && allowedRoles.includes(value as SystemRole);
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

async function readJsonBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { body: null, error: serverError("نوع الطلب غير صحيح", 415) };
  }

  try {
    return { body: (await request.json()) as RequestBody, error: null };
  } catch (parseError) {
    console.error("Invalid create staff account JSON body", parseError);
    return { body: null, error: serverError("بيانات الطلب غير صحيحة", 400) };
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return serverError("طلب غير مسموح", 403);

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return serverError("إنشاء حساب النظام غير متاح حاليًا. راجع إعدادات الخادم.", 503);
  }

  const parsed = await readJsonBody(request);
  if (parsed.error) return parsed.error;
  const body = parsed.body;
  if (!body) return serverError("بيانات الطلب غير صحيحة", 400);

  const staffId = typeof body.staffId === "string" ? body.staffId : "";
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!staffId) return serverError("معرف العامل مطلوب");
  if (!/^[a-z0-9_]{3,32}$/.test(username)) return serverError("اسم المستخدم يجب أن يكون بين 3 و32 حرفًا ويحتوي أحرفًا إنجليزية وأرقامًا وشرطة سفلية فقط");
  if (password.length < 8 || password.length > 128) return serverError("كلمة المرور يجب أن تكون بين 8 و128 حرفًا");
  if (!isSystemRole(body.systemRole)) return serverError("الدور غير صحيح");

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return serverError("غير مصرح", 401);

  const { data: currentProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, status")
    .eq("id", authData.user.id)
    .maybeSingle();
  const adminProfile = currentProfile as unknown as { id: string; role: string; status: string } | null;

  if (profileError || !adminProfile || adminProfile.role !== "admin" || adminProfile.status !== "active") {
    return serverError("هذه العملية متاحة للإدارة فقط", 403);
  }

  const { data: staff, error: staffError } = await supabase
    .from("staff_members")
    .select("id, profile_id, full_name, status, has_system_access")
    .eq("id", staffId)
    .maybeSingle();
  const staffRow = staff as unknown as StaffAccountCandidate | null;

  if (staffError || !staffRow) return serverError("العامل غير موجود", 404);
  if (staffRow.status !== "active") return serverError("لا يمكن إنشاء حساب إلا لعامل نشط");
  if (staffRow.profile_id || staffRow.has_system_access) return serverError("العامل لديه حساب نظام مسبقًا");

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existingProfileError) {
    console.error("Failed to check existing profile before creating staff account", existingProfileError);
    return serverError("تعذر التحقق من اسم المستخدم", 500);
  }
  if (existingProfile) return serverError("اسم المستخدم مستخدم مسبقًا");

  const admin = createAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = username + "@khatoun.local";
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: staffRow.full_name, role: body.systemRole },
  });

  if (createError || !created.user) {
    console.error("Failed to create Supabase Auth user for staff account", createError);
    return serverError("تعذر إنشاء حساب النظام. تحقق من اسم المستخدم وحاول مرة أخرى.", 500);
  }

  try {
    let profileId: string | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { data: profile, error: waitError } = await admin
        .from("profiles")
        .select("id, username, role")
        .eq("id", created.user.id)
        .maybeSingle();
      if (waitError) console.error("Failed while waiting for created staff profile", waitError);
      const createdProfile = profile as unknown as { id: string; username: string; role: string } | null;
      if (createdProfile?.id && createdProfile.username === username && createdProfile.role === body.systemRole) {
        profileId = createdProfile.id;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    if (!profileId) throw new Error("Created auth user profile was not available for linking");

    const { data: linkedStaff, error: linkError } = await supabase.rpc("link_staff_system_profile" as never, {
      p_staff_id: staffId,
      p_profile_id: profileId,
      p_username: username,
      p_role: body.systemRole,
    } as never);
    if (linkError || !linkedStaff) throw linkError ?? new Error("Staff profile link RPC returned no row");

    const { data: updatedStaff, error: loadError } = await supabase
      .from("staff_members")
      .select(staffSelect)
      .eq("id", staffId)
      .single();
    if (loadError || !updatedStaff) throw loadError ?? new Error("Linked staff row could not be loaded");

    return NextResponse.json({ staff: updatedStaff });
  } catch (linkError) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(created.user.id);
    if (deleteError) console.error("Failed to delete orphaned staff auth user after link failure", deleteError);
    console.error("Failed to link staff system account", linkError);
    return serverError("تم إلغاء إنشاء الحساب لأن ربطه بالعامل فشل", 500);
  }
}


