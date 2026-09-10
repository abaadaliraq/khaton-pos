"use client";

import { BotMessageSquare, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  answer?: string;
  usedTools?: string[];
  period?: string;
  error?: string;
};

const suggestedQuestions = [
  "شنو أهم المشاكل اليوم؟",
  "شنو وضع المخزون؟",
  "أي طاولة أداؤها انخفض؟",
  "وين عدنا تأخير بالخدمة؟",
];

function splitSourceLine(content: string) {
  const lines = content.trim().split(/\r?\n/);
  const sourceIndex = lines.findIndex((line) => /^(المصدر|مصدر البيانات|source)\s*[:：]/i.test(line.trim()));
  if (sourceIndex === -1) return { body: content.trim(), source: "" };
  return {
    body: [...lines.slice(0, sourceIndex), ...lines.slice(sourceIndex + 1)].join("\n").trim(),
    source: lines[sourceIndex].replace(/^(المصدر|مصدر البيانات|source)\s*[:：]\s*/i, "").trim(),
  };
}

function renderInlineMarkdown(text: string) {
  const nodes: React.ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`bold-${match.index}`} className="font-bold text-[#1f1713]">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code key={`code-${match.index}`} className="rounded bg-[#f5eee6] px-1 py-0.5 font-mono text-[0.92em] text-[#7b3f32]">
          {token.slice(1, -1)}
        </code>,
      );
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function cleanMarkdownLine(line: string) {
  return line.replace(/^#{1,6}\s+/, "").trimEnd();
}

function AssistantMarkdown({ content }: { content: string }) {
  const { body, source } = splitSourceLine(content);
  const blocks: React.ReactNode[] = [];
  const lines = body.split(/\r?\n/);
  let paragraph: string[] = [];
  let list: string[] = [];

  function flushParagraph(key: string) {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={key} className="whitespace-pre-line leading-7">
        {paragraph.map((line, index) => (
          <Fragment key={`${key}-line-${index}`}>
            {index > 0 ? <br /> : null}
            {renderInlineMarkdown(cleanMarkdownLine(line))}
          </Fragment>
        ))}
      </p>,
    );
    paragraph = [];
  }

  function flushList(key: string) {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key} className="space-y-1 pr-4">
        {list.map((item, index) => (
          <li key={`${key}-item-${index}`} className="list-disc leading-7 marker:text-[#a65f3f]">
            {renderInlineMarkdown(cleanMarkdownLine(item))}
          </li>
        ))}
      </ul>,
    );
    list = [];
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph(`p-${index}`);
      flushList(`ul-${index}`);
      return;
    }
    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      flushParagraph(`p-${index}`);
      list.push(listMatch[1]);
      return;
    }
    flushList(`ul-${index}`);
    paragraph.push(trimmed);
  });
  flushParagraph("p-last");
  flushList("ul-last");

  return (
    <div className="space-y-2 text-right">
      {blocks}
      {source ? <p className="border-t border-[#eee4d8] pt-2 text-[11px] font-semibold leading-5 text-[#8a7567]">مصدر البيانات: {source}</p> : null}
    </div>
  );
}

export function AskKhatounOwnerChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [meta, setMeta] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [isOpen, messages, isLoading]);

  async function sendQuestion(question?: string) {
    const content = (question ?? input).trim();
    if (!content || isLoading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setMeta("");

    try {
      const response = await fetch("/api/ai/owner-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const payload = (await response.json().catch(() => null)) as ChatResponse | null;
      const answer = payload?.answer ?? payload?.error ?? "تعذر تشغيل اسأل خاتون حالياً.";
      setMessages([...nextMessages, { role: "assistant", content: answer }]);
      if (payload?.usedTools?.length) setMeta(`تم استخدام: ${payload.usedTools.join("، ")} / الفترة: ${payload.period ?? "-"}`);
    } catch {
      setMessages([...nextMessages, { role: "assistant", content: "تعذر الاتصال بخدمة اسأل خاتون." }]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3 print:hidden">
      {isOpen ? (
        <section className="flex max-h-[min(600px,calc(100vh-7rem))] w-[min(410px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-[#e4d8c8] bg-[#fffdfa] text-right shadow-2xl shadow-black/20">
          <header className="flex items-center justify-between gap-3 border-b border-[#8f4e34] bg-[#a65f3f] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles size={17} />
              <div>
                <h2 className="text-sm font-bold">اسأل خاتون</h2>
                <p className="text-[11px] text-white/80">مساعد المالك التشغيلي</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-md text-white hover:bg-white/15"
              aria-label="إغلاق اسأل خاتون"
            >
              <X size={17} />
            </button>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#fbfaf7] p-3">
            <div className="flex justify-end">
              <div className="max-w-[88%] rounded-md border border-[#eadfd3] bg-white px-3 py-2 text-sm leading-7 text-[#2f211c]">
                أهلاً، شنو تحب تعرف عن تشغيل خاتون؟
              </div>
            </div>

            {messages.length === 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void sendQuestion(question)}
                    disabled={isLoading}
                    className="rounded-md border border-[#eadfd3] bg-[#fffdfa] px-3 py-2 text-right text-xs font-semibold text-[#4a3b34] hover:bg-[#f5eee6] disabled:opacity-60"
                  >
                    {question}
                  </button>
                ))}
              </div>
            ) : null}

            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-start" : "justify-end"}`}>
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[86%] rounded-md bg-[#a65f3f] px-3 py-2 text-sm leading-7 text-white"
                      : "max-w-[92%] rounded-md border border-[#e4d8c8] bg-white px-3 py-2 text-sm leading-7 text-[#2f211c]"
                  }
                >
                  {message.role === "assistant" ? <AssistantMarkdown content={message.content} /> : message.content}
                </div>
              </div>
            ))}

            {isLoading ? <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">خاتون يقرأ البيانات الآن...</p> : null}
          </div>

          {meta ? <p className="border-t border-[#eee4d8] bg-[#fffdfa] px-3 py-2 text-[11px] font-semibold text-[#7c6b60]">{meta}</p> : null}

          <form
            className="flex gap-2 border-t border-[#eee4d8] bg-white p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void sendQuestion();
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="اكتب سؤالك..."
              className="h-10 min-w-0 flex-1 rounded-md border border-[#e4d8c8] bg-white px-3 text-sm text-[#2f211c] outline-none focus:border-[#a65f3f]"
            />
            <button
              type="submit"
              disabled={isLoading || input.trim().length === 0}
              className="grid h-10 w-10 place-items-center rounded-md bg-[#a65f3f] text-white hover:bg-[#8f4e34] disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="إرسال"
            >
              <Send size={16} />
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="grid h-12 w-12 place-items-center rounded-full border border-[#b67556] bg-[#a65f3f] text-white shadow-lg shadow-black/20 transition hover:bg-[#8f4e34]"
        aria-label="فتح اسأل خاتون"
      >
        {isOpen ? <BotMessageSquare size={21} /> : <MessageCircle size={21} />}
      </button>
    </div>
  );
}
