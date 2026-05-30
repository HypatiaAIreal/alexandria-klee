import { NextResponse } from "next/server";
import { getConceptGraph } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const graph = await getConceptGraph();
  return NextResponse.json(graph);
}
