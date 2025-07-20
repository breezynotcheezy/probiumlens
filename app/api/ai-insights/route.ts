import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI API key not set." }, { status: 500 });
  }

  const { scanData, userPrompt } = await req.json();

  // --- Begin extension/type mismatch logic ---
  function getExtension(filename: string) {
    const match = filename.match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1].toLowerCase() : null;
  }
  function getTypeFromMime(mime: string) {
    if (!mime) return null;
    if (mime.includes("pdf")) return "pdf";
    if (mime.includes("csv")) return "csv";
    if (mime.includes("zip")) return "zip";
    if (mime.includes("msword") || mime.includes("doc")) return "doc";
    if (mime.includes("excel") || mime.includes("xls")) return "xls";
    if (mime.includes("ppt")) return "ppt";
    if (mime.includes("image")) return "image";
    if (mime.includes("text")) return "txt";
    return mime.split("/").pop();
  }
  const fileName = scanData?.fileName || scanData?.filename || "";
  const fileType = scanData?.fileType || scanData?.mime_type || scanData?.detected_type || "";
  const ext = getExtension(fileName);
  const detected = getTypeFromMime(fileType);
  let mismatchWarning = "";
  if (ext && detected && ext !== detected) {
    mismatchWarning = `WARNING: The file extension (.${ext}) does not match the detected file type (${fileType}). This is a common technique used to disguise malicious files. Advise the user to take extreme caution when handling this file.`;
  }
  // --- End extension/type mismatch logic ---

  let prompt;
  if (userPrompt && userPrompt.trim()) {
    // Chat mode: act as a normal chatbot, but with context of the scan
    prompt = `You are a helpful security assistant. You have access to the following file scan data. Answer the user's question conversationally, using the scan data as context.\n\nScan Data: ${JSON.stringify(scanData, null, 2)}\n${mismatchWarning ? '\n' + mismatchWarning : ''}\n\nUser Question: ${userPrompt}`;
  } else {
    // Summary mode: no Recommendations section
    prompt = `You are a security analyst. Given the following scan data, provide a concise, professional summary for a security dashboard. Do NOT use markdown, do NOT use chatbot language, do NOT include greetings or closings. Use clear section headings (Summary, Notable Findings) and plain text. Use bullet points for findings. Do not say 'as an AI' or 'feel free to ask'.\n\nScan Data: ${JSON.stringify(scanData, null, 2)}${mismatchWarning ? '\n' + mismatchWarning : ''}`;
  }

  // Call OpenAI API (or similar)
  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful AI security assistant." },
        { role: "user", content: prompt },
      ],
      max_tokens: 400,
      temperature: 0.6,
    }),
  });

  if (!aiRes.ok) {
    const error = await aiRes.text();
    return NextResponse.json({ error }, { status: 500 });
  }

  const aiJson = await aiRes.json();
  const aiText = aiJson.choices?.[0]?.message?.content || "No insights available.";

  return NextResponse.json({ insights: aiText });
} 