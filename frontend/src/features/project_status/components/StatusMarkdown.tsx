import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

const STATUS_MARKDOWN_ELEMENTS = ["p", "br", "strong", "em", "code", "a"];
const STATUS_MARKDOWN_PROTOCOLS = ["http", "https"];
const STATUS_EXTERNAL_HREF_PATTERN = new RegExp(
  `^(${STATUS_MARKDOWN_PROTOCOLS.join("|")}):\\/\\/`,
  "i",
);

export function StatusMarkdown({ description }: { description: string }) {
  return (
    <ReactMarkdown
      skipHtml
      unwrapDisallowed
      allowedElements={STATUS_MARKDOWN_ELEMENTS}
      rehypePlugins={[[rehypeSanitize, statusMarkdownSchema]]}
      components={{
        a: StatusExternalLink,
      }}
    >
      {description}
    </ReactMarkdown>
  );
}

const statusMarkdownSchema = {
  // Keep this allow-list fully explicit; status descriptions are shared to public viewers.
  tagNames: STATUS_MARKDOWN_ELEMENTS,
  attributes: {
    a: ["href", "title"],
  },
  protocols: {
    href: STATUS_MARKDOWN_PROTOCOLS,
  },
};

function StatusExternalLink({ href, children, ...props }: ComponentPropsWithoutRef<"a">) {
  if (!href || !STATUS_EXTERNAL_HREF_PATTERN.test(href)) {
    return <>{children}</>;
  }
  return (
    <a {...props} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
