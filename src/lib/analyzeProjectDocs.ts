import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type Part,
} from "@google/generative-ai";

export type ProjectAnalysisRequestDocument = {
  name: string;
  mimeType: string;
  data: string;
};

export type ProjectAnalysisResult = {
  projectName: string;
  date: string;
  fundsRaised: string;
  attendees: string;
  summary: string;
};

const MODEL_NAME = "gemini-2.0-flash-exp";

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/plain",
]);

function inferMimeType(name: string, provided?: string) {
  if (provided && SUPPORTED_MIME_TYPES.has(provided)) {
    return provided;
  }

  const extension = name.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "txt":
      return "text/plain";
    default:
      return provided;
  }
}

function ensureValue(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  return fallback;
}

function extractJsonPayload(raw: string): string {
  if (!raw) {
    return raw;
  }

  const fencedMatch = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const genericFence = raw.match(/```\s*([\s\S]*?)```/);
  if (genericFence?.[1]) {
    return genericFence[1].trim();
  }

  return raw.trim();
}

export async function analyzeProjectDocs(
  documents: ProjectAnalysisRequestDocument[],
  talkingPoints?: string,
): Promise<ProjectAnalysisResult> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  if (!documents.length) {
    throw new Error("At least one document is required for analysis.");
  }

  const normalizedDocuments = documents.map((document) => {
    const mimeType = inferMimeType(document.name, document.mimeType);
    if (!mimeType || !SUPPORTED_MIME_TYPES.has(mimeType)) {
      throw new Error(
        `The file "${document.name}" is not a supported format. Please upload PDF, PNG/JPEG, or plain text files.`,
      );
    }
    return { ...document, mimeType };
  });

  const guidance = talkingPoints?.trim();

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: MODEL_NAME });

  const instruction = [
    "You are assisting Round Table Lilongwe 32 with generating a Projects Report.",
    "Review the provided documents and extract the key project details.",
    "Return a single JSON object with the following fields:",
    '{"projectName": "...", "date": "...", "fundsRaised": "...", "attendees": "...", "summary": "..."}',
    "Populate each field with concise information gleaned from the documents.",
    "If any detail is missing, set it to \"Not specified\".",
    "The summary should be a professional paragraph (120-180 words) written in UK English.",
    "Do not add any additional commentary outside the JSON object.",
  ].join(" ");

  const parts: Part[] = [];

  parts.push({ text: instruction });

  if (guidance) {
    parts.push({
      text: [
        "Incorporate the following talking points when drafting the summary. Treat them as high-priority context and mention them if they fit naturally:",
        guidance,
      ].join("\n\n"),
    });
  }

  for (const document of normalizedDocuments) {
    parts.push({
      inlineData: {
        mimeType: document.mimeType || "application/octet-stream",
        data: document.data,
      },
    });
  }

  const request: GenerateContentRequest = {
    contents: [
      {
        role: "user",
        parts,
      },
    ],
  };

  const result = await model.generateContent(request);

  const text = result?.response?.text();

  if (!text) {
    throw new Error("Analysis did not return any content.");
  }

  const payload = extractJsonPayload(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch (parseError) {
    throw new Error("Unable to parse analysis response.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Analysis response was not an object.");
  }

  const output = parsed as Record<string, unknown>;

  return {
    projectName: ensureValue(output.projectName, "Not specified"),
    date: ensureValue(output.date, "Not specified"),
    fundsRaised: ensureValue(output.fundsRaised, "Not specified"),
    attendees: ensureValue(output.attendees, "Not specified"),
    summary: ensureValue(output.summary, ""),
  };
}


