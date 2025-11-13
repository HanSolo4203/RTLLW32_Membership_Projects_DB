import Anthropic from "@anthropic-ai/sdk";

import type { MembershipStats } from "@/hooks/useMembershipStats";

function getAnthropicClient() {
  const apiKey =
    process.env.ANTHROPIC_API_KEY ?? process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY ?? "";

  if (!apiKey) {
    console.warn(
      "Anthropic client initialization skipped. ANTHROPIC_API_KEY present:",
      Boolean(process.env.ANTHROPIC_API_KEY),
      "NEXT_PUBLIC_ANTHROPIC_API_KEY present:",
      Boolean(process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY),
    );
    return null;
  }

  return new Anthropic({ apiKey });
}

export async function generateAISummary(
  stats: MembershipStats,
  userGuidance?: string | null,
): Promise<string> {
  const anthropic = getAnthropicClient();

  if (!anthropic) {
    console.warn("Anthropic API key is not configured. Returning empty summary.");
    return "";
  }

  const trimmedGuidance = userGuidance?.trim();
  const hasGuidance = Boolean(trimmedGuidance?.length);

  const guidanceBlock = hasGuidance
    ? `\nAdditional guidance from the Vice Chairman:\n${trimmedGuidance}\n\nWeave these ideas naturally into the remarks without sounding robotic or repetitive.\n`
    : "";

const prompt = `Write a professional membership report summary for Round Table Lilongwe 32.

Stats for ${stats.monthName} ${stats.year}:
- Active members: ${stats.activeMembers}
- Members who attended last business meeting: ${stats.attendedLastMeeting}
- Attendance rate for the month: ${stats.attendanceRate}%
- Yearly average attendance (members only): ${stats.yearlyAverage}%
- Pipeliners (prospective members): ${stats.pipeliners}
- Pipeliners present this month: ${stats.pipelinerPresentCount}
- Pipeliner attendance rate (month): ${stats.pipelinerAttendanceRate}%

${guidanceBlock}

Write 2-3 flowing paragraphs that:
1. Reference the reporting period naturally without formal salutations.
2. Report the attendance figures naturally.
3. Compare current attendance to the yearly average (be positive if above, encouraging if below).
4. If there are pipeliners, mention their progress and potential growth.

Avoid using the phrases "Mr. Chairman, Association Council, Honourable Sergeant at Arms, Fellow Tablers, 41'ers and Guests" and "Yours in Round Table".

Use professional but warm tone. Write in first person as the Vice Chairman.

Do not include any closing, signature, or adoption statement—those will be added separately.

NO bullet points - just natural flowing paragraphs that could be read aloud at a meeting.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    });

    return message.content[0].type === "text" ? message.content[0].text : "";
  } catch (error) {
    console.error("Error generating AI summary:", error);
    throw error;
  }
}


