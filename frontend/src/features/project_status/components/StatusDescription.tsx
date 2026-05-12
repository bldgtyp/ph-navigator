import type { ReactNode } from "react";

export function StatusDescription({ description }: { description: string }) {
  return <p className="status-description">{renderDescription(description)}</p>;
}

function renderDescription(description: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let lastIndex = 0;
  for (const match of description.matchAll(linkPattern)) {
    if (match.index > lastIndex) {
      parts.push(description.slice(lastIndex, match.index));
    }
    parts.push(
      <a
        key={`${match[2]}-${match.index}`}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
      >
        {match[1]}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < description.length) {
    parts.push(description.slice(lastIndex));
  }
  return parts;
}
