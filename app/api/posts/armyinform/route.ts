import { NextResponse } from "next/server";
import { getArmyInformItems } from "@/lib/armyinform";

export async function GET() {
  const items = await getArmyInformItems(30);
  return NextResponse.json(
    { source: "armyinform", items },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120" } }
  );
}

