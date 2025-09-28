const fetch = (...args) => import('node-fetch').then(({default: f})=>f(...args));

/**
 * Suggest subtasks using configured provider.
 * Returns array of strings.
 */
async function suggestSubtasks(prompt) {
  const provider = (process.env.AI_PROVIDER || "groq").toLowerCase();
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error("AI_API_KEY not set");

  if (provider === "groq") {
    // NOTE: Example Groq request - adapt if the API differs.
    const res = await fetch("https://api.groq.com/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        prompt: `Break this task into 5 concise actionable subtasks:\n\n${prompt}\n\nSubtasks:`,
        max_tokens: 200
      })
    });
    const json = await res.json();
    const text = json.output || json.choices?.[0]?.text || JSON.stringify(json);
    return parseTextToLines(String(text));
  }

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "text-davinci-003",
        prompt: `Break this task into 5 concise actionable subtasks:\n\n${prompt}\n\nSubtasks:`,
        max_tokens: 200,
        temperature: 0.2
      })
    });
    const json = await res.json();
    const text = json.choices?.[0]?.text || "";
    return parseTextToLines(String(text));
  }

  throw new Error("Unsupported AI_PROVIDER");
}

function parseTextToLines(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const cleaned = lines.map(l => l.replace(/^[\-\u2022\*\d\.\) ]+/, "").trim()).filter(Boolean);
  return cleaned.slice(0, 10);
}

module.exports = { suggestSubtasks };
