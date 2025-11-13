import { NextRequest, NextResponse } from "next/server";

import { analyzeProjectDocs } from "@/lib/analyzeProjectDocs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files");
    const talkingPointsEntry = formData.get("talkingPoints");
    const talkingPoints = typeof talkingPointsEntry === "string" ? talkingPointsEntry : "";

    if (!files.length) {
      return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
    }

    const documents = await Promise.all(
      files.map(async (entry) => {
        if (!(entry instanceof File)) {
          throw new Error("Received invalid file input.");
        }

        const arrayBuffer = await entry.arrayBuffer();
        const data = Buffer.from(arrayBuffer).toString("base64");

        return {
          name: entry.name,
          mimeType: entry.type || "application/octet-stream",
          data,
        };
      }),
    );

    const analysis = await analyzeProjectDocs(documents, talkingPoints);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Failed to analyze project documents", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Unexpected error occurred." }, { status: 500 });
  }
}


