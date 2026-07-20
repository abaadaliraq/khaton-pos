"use client";

import { useEffect, useState } from "react";
import { getStaffMemberById } from "@/services/staffService";
import type { StaffMember } from "@/types/staff";

export function useStaffMember(id: string) {
  const [staffMember, setStaffMember] = useState<StaffMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setIsLoading(true);
    setError("");
    try {
      const member = await getStaffMemberById(id);
      setStaffMember(member);
      if (!member) setError("لم يتم العثور على العامل");
    } catch (loadError) {
      console.error("Failed to load staff member", loadError);
      setError("تعذر تحميل بيانات العامل");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialStaffMember() {
      try {
        const member = await getStaffMemberById(id);
        if (!isMounted) return;
        setStaffMember(member);
        setError(member ? "" : "لم يتم العثور على العامل");
      } catch (loadError) {
        if (!isMounted) return;
        console.error("Failed to load staff member", loadError);
        setError("تعذر تحميل بيانات العامل");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadInitialStaffMember();
    return () => { isMounted = false; };
  }, [id]);

  return { staffMember, setStaffMember, isLoading, error, refresh };
}
