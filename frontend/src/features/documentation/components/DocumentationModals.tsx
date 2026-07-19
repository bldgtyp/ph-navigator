import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { directionsForSection } from "../directions/content";
import type { DocumentationSection } from "../types";

export function DirectionsModal({
  section,
  onClose,
}: {
  section: DocumentationSection;
  onClose: () => void;
}) {
  const directions = directionsForSection(section);
  return (
    <ModalDialog
      title={`How to photograph - ${section.title}`}
      titleId="documentation-directions-title"
      onClose={onClose}
    >
      <div className="documentation-modal-body documentation-directions">
        {directions.map((direction) => (
          <section key={direction.key} className="documentation-direction-card">
            <div>
              <h3>{direction.title}</h3>
              <p>{direction.overview}</p>
            </div>
            {direction.exampleImageUrl ? (
              <img src={direction.exampleImageUrl} alt="" />
            ) : (
              <div className="documentation-direction-placeholder" aria-hidden="true">
                Example photo pending
              </div>
            )}
            <ul>
              {direction.shots.map((shot) => (
                <li key={shot}>{shot}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </ModalDialog>
  );
}
