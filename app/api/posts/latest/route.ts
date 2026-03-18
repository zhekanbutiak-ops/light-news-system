import { NextResponse } from "next/server";
import { getAllPostsMeta } from "@/lib/posts";

export async function GET() {
  const posts = await getAllPostsMeta();
  const latest = posts[0] ?? null;
  return NextResponse.json(
    { post: latest },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
  );
}

