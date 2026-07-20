import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import type { SystemRole } from "@/types/staff";

const allowedRoles: SystemRole[] = ["captain", "cashier", "kitchen", "admin"];

function serverError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isSystemRole(value: unknown): value is SystemRole {
  return typeof value === "string" && allowedRoles.includes(value as SystemRole);
}

export async function POST(request: NextRequest) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return serverError("إنشاء حساب النظام غير متاح حاليًا. راجع إعدادات الخادم.", 503);
  }

  const body = (await request.json()) as { staffId?: unknown; username?: unknown; password?: unknown; systemRole?: unknown };
  const staffId = typeof body.staffId === "string" ? body.staffId : "";
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!staffId) return serverError("معرف العامل مطلوب");
  if (!/^[a-z0-9_]+$/.test(username)) return serverError("اسم المستخدم يجب أن يحتوي أحرفًا إنجليزية وأرقامًا وشرطة سفلية فقط");
  if (password.length < 8) return serverError("كلمة المرور يجب ألا تقل عن 8 أحرف");
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

  const admin = createAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: staff, error: staffError } = await supabase
    .from("staff_members" as never)
    .select("id, profile_id, full_name")
    .eq("id", staffId)
    .maybeSingle();

  const staffRow = staff as unknown as { id: string; profile_id: string | null; full_name: string } | null;
  if (staffError || !staffRow) return serverError("العامل غير موجود", 404);
  if (staffRow.profile_id) return serverError("العامل لديه حساب نظام مسبقًا");

  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
  if (existingProfile) return serverError("اسم المستخدم مستخدم مسبقًا");

  const email = username + "@khatoun.local";
  const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) return serverError("تعذر التحقق من مستخدمي النظام", 500);
  if (usersPage.users.some((user) => user.email === email)) return serverError("اسم المستخدم مستخدم مسبقًا");

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: staffRow.full_name, role: body.systemRole },
  });

  if (createError || !created.user) return serverError(createError?.message ?? "تعذر إنشاء حساب النظام", 500);

  try {
    let profileId: string | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: profile } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
      const createdProfile = profile as unknown as { id: string } | null;
      if (createdProfile?.id) {
        profileId = createdProfile.id;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    if (!profileId) throw new Error("لم يتم إنشاء profile للحساب الجديد");

    const { data: updatedStaff, error: updateError } = await admin
      .from("staff_members" as never)
      .update({ profile_id: profileId, has_system_access: true, updated_by: authData.user.id } as never)
      .eq("id", staffId)
      .select("id, employee_number, profile_id, full_name, phone, secondary_phone, job_title, department, employment_type, shift_type, hire_date, birth_date, salary, address, emergency_contact_name, emergency_contact_phone, notes, status, has_system_access, created_at, updated_at, profile:profiles(username, role, status)")
      .single();

    if (updateError || !updatedStaff) throw updateError ?? new Error("تعذر ربط العامل بالحساب");

    await admin.from("audit_logs" as never).insert({
      user_id: authData.user.id,
      action: "create_staff_system_account",
      entity_type: "staff_members",
      entity_id: staffId,
      new_data: { username, role: body.systemRole },
    } as never);

    return NextResponse.json({ staff: updatedStaff });
  } catch (linkError) {
    await admin.auth.admin.deleteUser(created.user.id);
    console.error("Failed to link staff system account", linkError);
    return serverError("تم إلغاء إنشاء الحساب لأن ربطه بالعامل فشل", 500);
  }
}
