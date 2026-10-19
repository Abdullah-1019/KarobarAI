import type { ReactNode } from 'react';
import './ChatMarkdown.css';

// A deliberately small Markdown subset. React escapes all model text; raw HTML is never rendered.
export function ChatMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) { index += 1; continue; }
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index]?.startsWith('```')) code.push(lines[index++] ?? '');
      if (index < lines.length) index += 1;
      blocks.push(<pre key={blocks.length}><code data-language={language || undefined}>{code.join('\n')}</code></pre>);
      continue;
    }
    const list = /^(?:\s*[-*]\s+|\s*\d+\.\s+)/.exec(line);
    if (list) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (index < lines.length && /^(?:\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[index] ?? '')) {
        items.push((lines[index++] ?? '').replace(/^(?:\s*[-*]\s+|\s*\d+\.\s+)/, ''));
      }
      const children = items.map((item, position) => <li key={position}>{item}</li>);
      blocks.push(ordered ? <ol key={blocks.length}>{children}</ol> : <ul key={blocks.length}>{children}</ul>);
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index]?.trim() && !lines[index]?.startsWith('```')
      && !/^(?:\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[index] ?? '')) paragraph.push(lines[index++] ?? '');
    blocks.push(<p key={blocks.length}>{paragraph.join('\n')}</p>);
  }
  return <div className="ai-chat-markdown">{blocks}</div>;
}
