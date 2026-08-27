"use client";

import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { askErpAssistant, type AiMessage } from "@/lib/platform/ai";

const SUGGESTIONS = [
  "Show overdue invoices",
  "Find contracts with DALIAN HAIQING",
  "Show containers arriving this week",
  "Calculate profit for Business Case BC-001",
  "Generate commercial offer",
  "Prepare invoice from contract",
  "Summarize today's operations",
];

export function AiAssistantView() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      role: "assistant",
      content:
        "I can read live SKY ERP data across business cases, contracts, logistics, warehouse, and finance. Ask an operations question.",
    },
  ]);

  async function submit(question: string) {
    const prompt = question.trim();
    if (!prompt || loading) return;

    setLoading(true);
    setError(null);
    setMessages((current) => [...current, { role: "user", content: prompt }]);
    setInput("");

    const result = await askErpAssistant(prompt);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setMessages((current) => [
      ...current,
      { role: "assistant", content: result.answer },
    ]);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground">
          Ask questions across contracts, shipments, invoices, warehouse, and
          business cases.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => void submit(suggestion)}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div className="min-h-[420px] space-y-3 rounded-lg border border-card-border bg-card p-4">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
              message.role === "user"
                ? "ml-8 bg-accent text-foreground"
                : "mr-8 bg-accent/30 text-foreground"
            }`}
          >
            {message.content}
          </div>
        ))}
        {loading ? (
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Querying ERP data...
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask SKY ERP..."
          className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-3.5 py-2 text-xs font-medium text-background disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          Ask
        </button>
      </form>
    </div>
  );
}
