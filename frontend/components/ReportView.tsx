import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { downloadMarkdown, downloadPdf } from "@/lib/download";

export function ReportView({
  title,
  ticker,
  status,
  content,
  accent,
  filenameBase,
}: {
  title: string;
  ticker: string;
  status: string;
  content: string;
  accent?: string;
  filenameBase: string;
}) {
  return (
    <div className="mx-auto max-w-[920px]">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-3 text-[18px] font-medium text-[var(--foreground)]">
          {accent && (
            <span
              className="inline-block h-2.5 w-2.5"
              style={{ background: accent }}
            />
          )}
          {title}
        </h2>
        <div className="flex items-center gap-4">
          <DownloadBtn onClick={() => downloadPdf(`${filenameBase}`, content)}>
            ↓ PDF
          </DownloadBtn>
          <DownloadBtn
            onClick={() => downloadMarkdown(filenameBase, content)}
          >
            ↓ MD
          </DownloadBtn>
        </div>
      </div>
      <div className="h-px w-full bg-[var(--border)]" />
      <p className="mt-2 font-mono text-[12px] text-[var(--muted-foreground)]">
        {ticker.split(".")[0]} · Report generated · {status}
      </p>

      <div className="mt-6 border border-[var(--border)] bg-white p-8 rounded-xl shadow-sm">
        <Markdown content={content} />
      </div>
    </div>
  );
}

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function DownloadBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="font-mono text-[12px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
    >
      {children}
    </button>
  );
}
