import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGcpIdentityToken } from "@/lib/gcp-auth";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { project_id } = await request.json().catch(() => ({}));
  if (!project_id || typeof project_id !== "string") {
    return NextResponse.json({ error: "Missing project_id" }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id, ocr_raw_storage_path")
    .eq("id", project_id)
    .eq("user_id", user.id)
    .single();

  if (projectError) {
    return NextResponse.json(
      { error: `Failed to load project metadata: ${projectError.message}` },
      { status: 500 }
    );
  }

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.ocr_raw_storage_path) {
    return NextResponse.json({ error: "OCR raw file not found for this project" }, { status: 404 });
  }

  const cloudFunctionUrl = process.env.CLOUD_FUNCTION_ANALYZE_URL;
  const cloudFunctionSecret = process.env.CLOUD_FUNCTION_SECRET;
  if (!cloudFunctionUrl) {
    return NextResponse.json({ error: "Cloud Function URL is not configured" }, { status: 500 });
  }

  try {
    const admin = createAdminClient();
    const downloadResult = await admin.storage
      .from("ocr-raw")
      .download(project.ocr_raw_storage_path);

    if (downloadResult.error || !downloadResult.data) {
      return NextResponse.json(
        { error: downloadResult.error?.message || "Failed to download OCR raw file" },
        { status: 500 }
      );
    }

    const rawText = await downloadResult.data.text();
    const rawPayload = JSON.parse(rawText);

    const identityToken = await getGcpIdentityToken(cloudFunctionUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    let response: Response;
    try {
      response = await fetch(cloudFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${identityToken}`,
          ...(cloudFunctionSecret ? { "X-Function-Secret": cloudFunctionSecret } : {}),
        },
        body: JSON.stringify({
          mode: "classify_ocr_payload",
          project_id: project_id,
          raw_ocr_payload: rawPayload,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      return NextResponse.json(
        { error: payload?.error || `Cloud Function returned ${response.status}` },
        { status: response.status >= 400 ? response.status : 500 }
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "OCR classification timed out. Please try again." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run OCR classification" },
      { status: 500 }
    );
  }
}
