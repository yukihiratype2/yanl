import { loadConfig } from "../config";

export interface AIParseResult {
  name: string;
  season: number;
  episode: number;
  quality?: string;
  subgroup?: string;
}

export async function parseTorrentTitle(title: string): Promise<AIParseResult | null> {
  const config = loadConfig();
  
  if (!config.ai.api_url || !config.ai.api_token) {
    console.warn("AI config missing. Skipping AI parsing.");
    return null;
  }

  const systemPrompt = `
    You are a parser for Release Group torrent titles. 
    Analyze the given title and extract the following information in JSON format:
    - name: The series title (clean up underscores, dots, etc.)
    - season: The season number (default to 1 if not specified)
    - episode: The episode number (as a number)
    - quality: The resolution (e.g., 1080p, 4k)
    - subgroup: The release group name (usually in brackets at the start)

    Return ONLY the JSON object. No markdown formatting.
    Example Input: "[SubsPlease] One Piece - 1000 [1080p].mkv"
    Example Output: {"name": "One Piece", "season": 1, "episode": 1000, "quality": "1080p", "subgroup": "SubsPlease"}
  `;

  try {
    const response = await fetch(config.ai.api_url + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.ai.api_token}`,
      },
      body: JSON.stringify({
        model: config.ai.model || "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: title },
        ],
        temperature: 0.1, // Low temperature for deterministic output
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API failed: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) return null;

    // Clean up potential markdown code blocks
    const jsonString = content.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(jsonString) as AIParseResult;

  } catch (error) {
    console.error("Error parsing title with AI:", error);
    return null;
  }
}
