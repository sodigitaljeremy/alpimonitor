// AI layer — extension C5 (ADR-012 §« Cadrage détaillé extension C »). DTOs for the
// public chat endpoint POST /api/v1/ask. The request is a single grounded question;
// the response is the model's prose answer plus an honest trace of WHICH whitelisted
// tools ran and what they returned — observability the UI can surface verbatim.

// One whitelisted tool the chat loop invoked, with the raw args the model emitted
// and a compact summary of the result (count / absence / error). Mirrors the
// chat service's ChatToolUse.
export interface AskToolUse {
  tool: string;
  args: string;
  resultSummary: string;
}

export interface AskRequestDTO {
  question: string;
  // BCP-47-ish hint (e.g. 'fr'); the service defaults to 'fr' when omitted.
  language?: string;
}

export interface AskResponseDTO {
  answer: string;
  used: AskToolUse[];
  language: string;
  generatedAt: string; // ISO
}
