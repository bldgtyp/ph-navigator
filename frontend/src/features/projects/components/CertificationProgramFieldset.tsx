import type { CertificationProgram } from "../types";

const CERTIFICATION_PROGRAM_OPTIONS: { value: CertificationProgram; label: string }[] = [
  { value: "phi", label: "PHI" },
  { value: "phius", label: "Phius" },
];

export function CertificationProgramFieldset({
  value,
  onChange,
}: {
  value: CertificationProgram[];
  onChange: (next: CertificationProgram[]) => void;
}) {
  const toggleProgram = (program: CertificationProgram) => {
    onChange(
      value.includes(program)
        ? value.filter((current) => current !== program)
        : [...value, program],
    );
  };

  return (
    <fieldset>
      <legend>Certification programs</legend>
      {CERTIFICATION_PROGRAM_OPTIONS.map((option) => (
        <label className="checkbox-row" key={option.value}>
          <input
            type="checkbox"
            checked={value.includes(option.value)}
            onChange={() => toggleProgram(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
