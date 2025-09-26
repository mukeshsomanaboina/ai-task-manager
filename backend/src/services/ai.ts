import fetch from "node-fetch";

/**
 * A tiny wrapper to call an external generative model.
 * Configure AI_PROVIDER and AI_API_KEY in env.
 * The function must return an array of suggestion strings.
 */

export async function suggestSubtasks(prompt: string): Promise<string[]> {
  const provider = process.env.AI_PROVIDER || "groq";
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error("AI_API_KEY not configured");

  // Minimal example for Groq-like HTTP API — adapt if you choose another provider (OpenAI, etc.)
  if (provider === "groq") {
    // Example -- Groq or similar provider may differ: this is a template you adapt.
    const res = await fetch("https://api.groq.com/v1/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        prompt: `Break the following task into 5 concise actionable subtasks:\n\n${prompt}\n\nSubtasks:`,
        max_tokens: 200
      })
    });
    const data = await res.json();
    // The response parsing depends on provider — here we attempt to parse lines.
    const text = data.output || data.choices?.[0]?.text || data.text || JSON.stringify(data);
    // naive split by newline/dash/numbered lines
    const lines = String(text).split(/\n/).map(s => s.trim()).filter(Boolean);
    // normalize lines that may start with "1." "•" "-" etc.
    const cleaned = lines.map(l => l.replace(/^[\-\u2022\*\d\.\) ]+/, "").trim()).filter(Boolean);
    return cleaned.slice(0, 10);
  }

  // default to OpenAI if selected
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "text-davinci-003",
        prompt: `Break the following task into 5 concise actionable subtasks:\n\n${prompt}\n\nSubtasks:`,
        max_tokens: 200,
        temperature: 0.2
      })
    });
    const json = await res.json();
    const text = json.choices?.[0]?.text || "";
    const lines = String(text).split(/\n/).map(s => s.trim()).filter(Boolean);
    const cleaned = lines.map(l => l.replace(/^[\-\u2022\*\d\.\) ]+/, "").trim()).filter(Boolean);
    return cleaned.slice(0, 10);
  }

  throw new Error("Unknown AI_PROVIDER");
}
