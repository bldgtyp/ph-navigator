/**
 * Represents an input value that can be updated, tracking both its current and new values.
 * 
 * @typeParam T - The type of the input value.
 * 
 * @property currentValue - The current value of the input.
 * @property setCurrentValue - Function to update the current value.
 * @property newValue - The new value to be set for the input.
 * @property setNewValue - Function to update the new value.
 * 
 * @method hasChanged - Determines if the new value is different from the current value.
 */
export class UpdatableInput<T, U> {

    constructor(
        public currentValue: T,
        public setCurrentValue: (value: T) => void,
        public newValue: T,
        public setNewValue: (args: U) => void,
    ) {
        this.currentValue = currentValue;
        this.setCurrentValue = setCurrentValue;
        this.newValue = newValue;
        this.setNewValue = setNewValue;
    }

    hasChanged = (): boolean => {
        return this.currentValue !== this.newValue;
    }
}