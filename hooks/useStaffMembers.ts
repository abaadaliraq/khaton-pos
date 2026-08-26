"use client";

import { useEffect, useMemo, useState } from "react";
import { logSupabaseError } from "@/lib/supabaseError";
import { getStaffMembers, getStaffStatistics } from "@/services/staffService";
import type { StaffMember } from "@/types/staff";

export function useStaffMembers() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setIsLoading(true);
    setError("");
    try {
      const members = await getStaffMembers();
      setStaff(members);
    } catch (loadError) {
      logSupabaseError("Failed to load staff members", loadError);
      setError("تعذر تحميل بيانات العمال");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialStaff() {
      try {
        const members = await getStaffMembers();
        if (!isMounted) return;
        setStaff(members);
        setError("");
      } catch (loadError) {
        if (!isMounted) return;
        logSupabaseError("Failed to load staff members", loadError);
        setError("تعذر تحميل بيانات العمال");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadInitialStaff();
    return () => { isMounted = false; };
  }, []);

  const statistics = useMemo(() => getStaffStatistics(staff), [staff]);
  return { staff, statistics, isLoading, error, refresh, setStaff };
}
