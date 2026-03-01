import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id, ocr_raw_storage_path")
    .eq("id", projectId)
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

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("ocr-raw")
    .createSignedUrl(project.ocr_raw_storage_path, 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate signed URL for OCR raw" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(data.signedUrl, { status: 302 });
}
