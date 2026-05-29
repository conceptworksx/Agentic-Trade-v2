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
  children,
}: {
  title: string;
  ticker: string;
  status: string;
  content: string;
  accent?: string;
  filenameBase: string;
  children?: React.ReactNode;
}) {
  const canDownload = Boolean(content.trim());

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
          <DownloadBtn
            disabled={!canDownload}
            onClick={() => downloadPdf(`${filenameBase}`, content)}
          >
            ↓ PDF
          </DownloadBtn>
          <DownloadBtn
            disabled={!canDownload}
            onClick={() => downloadMarkdown(filenameBase, content)}
          >
            ↓ MD
          </DownloadBtn>
        </div>
      </div>
      <div className="h-px w-full bg-[var(--border)]" />
      <p className="mt-2 font-mono text-[12px] text-[var(--muted-foreground)] mb-6">
        {ticker.split(".")[0]} · Report generated · {status}
      </p>

      <div className="mt-6 border border-[var(--border)] bg-white p-8 rounded-xl shadow-sm mb-6">
        {content.trim() ? <Markdown content={content} /> : <ReportSkeleton />}
      </div>

      {content.trim() ? children : null}
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
  disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-zinc-50/50 px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--muted-foreground)] transition-all hover:bg-zinc-100 hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40 shadow-xs"
    >
      {children}
    </button>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-200" />
      <div className="space-y-3">
        <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-zinc-100" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-100" />
      </div>
      <div className="space-y-3">
        <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
        <div className="h-3 w-10/12 animate-pulse rounded bg-zinc-100" />
      </div>
    </div>
  );
}
