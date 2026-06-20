import { fireEvent, screen, within } from "@testing-library/react";

export function chooseAutocompleteOption(
  label: string,
  optionName: string,
  root?: HTMLElement,
): void {
  const queries = root ? within(root) : screen;
  fireEvent.focus(queries.getByRole("combobox", { name: label }));
  const exactOption = screen.queryByRole("option", { name: optionName });
  if (exactOption) {
    fireEvent.click(exactOption);
    return;
  }
  const optionNamePattern = new RegExp(`^${escapeRegExp(optionName)}(?:\\s|$)`);
  const options = screen.queryAllByRole("option", { name: optionNamePattern });
  if (options.length !== 1) {
    throw new Error(`Expected one option named ${optionName}; found ${options.length}.`);
  }
  const option = options[0];
  if (!option) throw new Error(`Option not found: ${optionName}`);
  fireEvent.click(option);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
