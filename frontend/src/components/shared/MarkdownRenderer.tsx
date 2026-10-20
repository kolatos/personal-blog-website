import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Komponen bersama untuk merender Markdown dengan dukungan LaTeX (KaTeX).
 * Gunakan komponen ini untuk semua konten Markdown di seluruh aplikasi.
 * KaTeX CSS harus diimpor sekali di main.tsx.
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const proseClasses = [
    'text-foreground leading-relaxed',
    // Headings
    '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-3',
    '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-7 [&_h2]:mb-3',
    '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2',
    '[&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-5 [&_h4]:mb-2',
    // Paragraphs
    '[&_p]:mb-4',
    // Lists
    '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4',
    '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4',
    '[&_li]:mb-1',
    // Blockquote
    '[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-4',
    // Code
    '[&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:my-4 [&_pre]:text-sm',
    '[&_code]:bg-muted [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:font-mono',
    '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
    // Links
    '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:opacity-80',
    // Images
    '[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-4',
    // Horizontal rule
    '[&_hr]:border-border [&_hr]:my-6',
    // Strong / em
    '[&_strong]:font-semibold',
    '[&_em]:italic',
    // KaTeX display math
    '[&_.katex-display]:overflow-x-auto [&_.katex-display]:py-2',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={[proseClasses, className].filter(Boolean).join(' ')}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
