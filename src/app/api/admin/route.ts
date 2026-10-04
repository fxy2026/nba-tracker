import { NextRequest } from "next/server";
import { adminPasswordMatches, privateAdminJson, readAdminJson } from "@/lib/admin-auth";

// Simple password-based admin auth
export async function POST(request: NextRequest) {
  const body = await readAdminJson(request);
  if (!body.ok) return privateAdminJson({ success: false, error: body.error }, body.status);
  if (Object.keys(body.value).some(key => key !== "password") || typeof body.value.password !== "string" || !body.value.password || Buffer.byteLength(body.value.password, "utf8") > 4096) {
    return privateAdminJson({ success: false, error: "Invalid request" }, 400);
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return privateAdminJson({ success: false, error: "Admin not configured" }, 503);
  }

  if (adminPasswordMatches(body.value.password)) {
    return privateAdminJson({ success: true });
  }
  return privateAdminJson({ success: false, error: "Wrong password" }, 401);
}
