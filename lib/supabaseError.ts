type SupabaseErrorShape = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  status?: unknown;
  error?: unknown;
};

function asText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

export function getSupabaseErrorInfo(error: unknown) {
  const shaped = error as SupabaseErrorShape | null;
  const nested = shaped?.error as SupabaseErrorShape | null | undefined;
  const serialized = safeJson(error);

  return {
    name: asText(shaped?.name) ?? asText(nested?.name),
    message: asText(shaped?.message) ?? asText(nested?.message) ?? asText(shaped?.error),
    code: asText(shaped?.code) ?? asText(nested?.code),
    details: asText(shaped?.details) ?? asText(nested?.details),
    hint: asText(shaped?.hint) ?? asText(nested?.hint),
    status: asText(shaped?.status) ?? asText(nested?.status),
    serialized: serialized && serialized !== "{}" ? serialized : undefined,
  };
}

export function getSupabaseErrorText(error: unknown) {
  const info = getSupabaseErrorInfo(error);
  return [info.message, info.code, info.details, info.hint, info.status, info.serialized]
    .filter(Boolean)
    .join(" ");
}

export function formatSupabaseError(context: string, error: unknown) {
  const info = getSupabaseErrorInfo(error);
  return `${context} message=${info.message ?? "-"} code=${info.code ?? "-"} details=${info.details ?? "-"} hint=${info.hint ?? "-"} status=${info.status ?? "-"} name=${info.name ?? "-"} serialized=${info.serialized ?? "-"}`;
}

export function logSupabaseError(context: string, error: unknown) {
  console.error(formatSupabaseError(context, error));
}
