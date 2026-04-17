import { NextRequest } from "next/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const MODEL = "minimax/minimax-m2.5";

const SYSTEM_PROMPT = `You are Frequencii Agent, an expert AI prediction market analyst embedded in the Frequencii platform — a privacy-first social layer on Solana.

Your role:
- Analyze prediction markets from Jupiter Prediction API data (aggregating markets across sources)
- Provide clear, structured reasoning about market outcomes
- Assess risk, probability, and market sentiment
- Help users understand what drives market odds
- Never give direct financial advice — frame everything as analysis and probability assessment

Your analysis style:
- Start with a brief summary of the market
- Break down YES/NO probabilities and what they imply
- Identify key factors that could shift the outcome
- Provide a confidence assessment (Low / Medium / High)
- Mention relevant risks or unknowns
- Keep responses concise but thorough (200-400 words typical)

Format:
- Use markdown for structure (bold, lists)
- Include numerical odds when available
- If market data is provided in context, reference specific numbers

Important:
- You are NOT a financial advisor. Always include a brief disclaimer when recommending positions.
- Be objective — acknowledge both sides of any prediction.
- If you lack information to make a strong analysis, say so honestly.`;

function buildMessages(
  userMessage: string,
  marketContext: any | null,
  history: any[]
) {
  const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }];

  // Add conversation history (last 10 messages max to stay within context limits)
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    if (msg.role === "user") {
      messages.push({ role: "user", content: msg.content });
    } else if (msg.role === "agent") {
      messages.push({ role: "assistant", content: msg.content });
    }
  }

  // Build user message with market context
  let fullMessage = userMessage;

  if (marketContext) {
    const market = marketContext.markets?.[0];
    const contextBlock = `
[MARKET CONTEXT — Jupiter Prediction API]
Title: ${marketContext.title}
Category: ${marketContext.category}
Description: ${marketContext.description}
Total Volume: $${(marketContext.volume || 0).toLocaleString()}
24h Volume: $${(marketContext.volume24hr || 0).toLocaleString()}
End Date: ${marketContext.endDate || "N/A"}
Status: ${marketContext.active ? "Active" : "Closed"}
${
  market
    ? `
Outcomes: ${market.outcomes?.join(" / ")}
Current Odds: ${market.outcomePrices?.map((p: number) => `${(p * 100).toFixed(1)}%`).join(" / ")}
`
    : ""
}
[END MARKET CONTEXT]
`;
    fullMessage = contextBlock + "\n\n" + userMessage;
  }

  messages.push({ role: "user", content: fullMessage });

  return messages;
}

export async function POST(request: NextRequest) {
  if (!OPENROUTER_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await request.json();
    const { message, marketContext, history } = body;

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const messages = buildMessages(
      message,
      marketContext || null,
      Array.isArray(history) ? history : []
    );

    // Call OpenRouter with streaming
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://frequencii.world",
        "X-Title": "Frequencii Prediction Agent",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service error", details: errorText }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Stream the response back to the client
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;

              const data = trimmed.slice(6);
              if (data === "[DONE]") {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
                );
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content =
                  parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ content, done: false })}\n\n`
                    )
                  );
                }
              } catch {
                // Skip malformed chunks
              }
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
        } finally {
          controller.close();
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Agent API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
