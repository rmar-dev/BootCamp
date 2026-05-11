import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ExplanationBlock({ markdown }: { markdown: string }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
