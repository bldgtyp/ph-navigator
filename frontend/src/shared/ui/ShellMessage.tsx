export function ShellMessage({ title, message }: { title: string; message: string }) {
  return (
    <main className="auth-page">
      <section className="auth-panel" aria-live="polite">
        <p className="eyebrow">{title}</p>
        <h1>{message}</h1>
      </section>
    </main>
  );
}
