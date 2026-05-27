export function EnvelopeLoadingState() {
  return (
    <section className="tab-panel envelope-panel" aria-label="Envelope">
      <p>Loading envelope...</p>
    </section>
  );
}

export function EnvelopeEmptyState() {
  return (
    <div className="envelope-empty" role="status">
      <h2>No assemblies yet</h2>
      <p>Envelope assemblies will appear here after they are added to this project draft.</p>
    </div>
  );
}

export function EnvelopeErrorState({ message }: { message: string }) {
  return (
    <section className="tab-panel envelope-panel" aria-label="Envelope">
      <p className="form-error" role="alert">
        {message}
      </p>
    </section>
  );
}
