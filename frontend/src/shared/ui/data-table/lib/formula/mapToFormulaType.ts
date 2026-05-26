export function mapToFormulaType(
  fieldType: string,
): "text" | "number" | "single_select" | "formula" | "bool" {
  switch (fieldType) {
    case "number":
      return "number";
    case "single_select":
      return "single_select";
    case "computed":
      return "formula";
    default:
      return "text";
  }
}
