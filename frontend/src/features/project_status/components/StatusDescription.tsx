import { StatusMarkdown } from "./StatusMarkdown";

export function StatusDescription({ description }: { description: string }) {
  return (
    <div className="status-description">
      <StatusMarkdown description={description} />
    </div>
  );
}
