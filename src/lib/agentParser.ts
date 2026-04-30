import { AgentAction, AgentMode, AgentPlan, AgentRisk } from "./types";

type ParsedEnvelope = {
  plan: AgentPlan | null;
  explanation: string;
  error?: string;
};

const JSON_OPEN = "<agent_json>";
const JSON_CLOSE = "</agent_json>";

function extractBetween(input: string, start: string, end: string): string | null {
  const startIndex = input.indexOf(start);
  const endIndex = input.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }
  return input.slice(startIndex + start.length, endIndex).trim();
}

function extractFirstJsonObject(input: string): string | null {
  const start = input.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, i + 1).trim();
      }
    }
  }
  return null;
}

function toMode(value: unknown): AgentMode {
  return value === "clarify" || value === "explain" ? value : "command";
}

function toRisk(value: unknown): AgentRisk {
  return value === "caution" || value === "dangerous" ? value : "safe";
}

function normalizeAction(value: unknown, index: number): AgentAction | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const command = typeof raw.command === "string" ? raw.command.trim() : "";
  if (!command) return null;
  const shell = raw.shell === "powershell" ? "powershell" : "powershell";
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : `step_${index + 1}`;
  return {
    id,
    shell,
    command,
    cwd: typeof raw.cwd === "string" ? raw.cwd : null,
    risk: toRisk(raw.risk),
    requiresConfirmation: Boolean(raw.requires_confirmation ?? raw.requiresConfirmation),
    reason: typeof raw.reason === "string" ? raw.reason : "No reason provided.",
    status: "planned",
  };
}

function normalizePlan(jsonText: string): AgentPlan {
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const commandsRaw = Array.isArray(parsed.commands) ? parsed.commands : [];
  const commands = commandsRaw
    .map((entry, index) => normalizeAction(entry, index))
    .filter((entry): entry is AgentAction => entry !== null);
  return {
    mode: toMode(parsed.mode),
    summary: typeof parsed.summary === "string" ? parsed.summary : "No summary provided.",
    commands,
    validation: Array.isArray(parsed.validation)
      ? parsed.validation.filter((v): v is string => typeof v === "string")
      : [],
    questions: Array.isArray(parsed.questions)
      ? parsed.questions.filter((v): v is string => typeof v === "string")
      : [],
    explanation: "",
    rawJson: jsonText,
  };
}

export function parseAgentResponse(input: string): ParsedEnvelope {
  const text = input.trim();
  if (!text) {
    return {
      plan: null,
      explanation: "",
      error: "AI returned an empty response.",
    };
  }

  const taggedJson = extractBetween(text, JSON_OPEN, JSON_CLOSE);
  const fallbackJson = extractFirstJsonObject(text);
  const jsonText = taggedJson ?? fallbackJson;
  let explanation = "";

  if (!jsonText) {
    return {
      plan: null,
      explanation,
      error: "No parseable agent JSON payload was found.",
    };
  }

  try {
    const plan = normalizePlan(jsonText);
    explanation = plan.summary;
    plan.explanation = explanation;
    return { plan, explanation };
  } catch (error) {
    return {
      plan: null,
      explanation,
      error: `Failed to parse agent JSON payload: ${String(error)}`,
    };
  }
}
