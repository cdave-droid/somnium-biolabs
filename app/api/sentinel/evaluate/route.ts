import { NextRequest, NextResponse } from "next/server";
import { join } from "node:path";
import { Engine, loadContent, type ContentHandle } from "@/sentinel/engine-ts/dist/src/index.js";

// The engine reads content from disk and must run on the Node runtime.
export const runtime = "nodejs";

// DEMO ONLY: the demo package's thresholds and signatures are placeholders
// that have NOT been SME-reviewed (see sentinel/GAPS.md B1). Every response
// carries the content_unsigned flag for the same reason.
let contentHandle: ContentHandle | null = null;

function getContent(): ContentHandle {
  if (contentHandle === null) {
    contentHandle = loadContent(join(process.cwd(), "sentinel", "content", "packages", "demo-2026.07.0"));
  }
  return contentHandle;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "request body must be JSON" }, { status: 400 });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "request body must be a JSON object" }, { status: 400 });
  }
  const { unit_profile, observations, context, reference_time } = body as Record<string, unknown>;
  if (!Array.isArray(observations)) {
    return NextResponse.json({ error: "observations must be an array" }, { status: 400 });
  }
  // The engine itself never throws — it fails toward caution (M8).
  const engine = new Engine(getContent());
  const output = engine.evaluate(
    unit_profile ?? {},
    observations,
    context ?? null,
    typeof reference_time === "string" ? reference_time : null,
  );
  return NextResponse.json({
    demo_notice:
      "SENTINEL demo content — thresholds and signatures are NOT SME-reviewed placeholders; not for operational use.",
    output,
  });
}
