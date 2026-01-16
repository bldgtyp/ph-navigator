import { ApertureType } from '../../types';

// Mock aperture data for testing
export const mockApertures: ApertureType[] = [
    {
        id: 1,
        name: 'Window Type A',
        column_widths_mm: [500],
        row_heights_mm: [1000],
        elements: [],
    },
    {
        id: 2,
        name: 'Window Type B',
        column_widths_mm: [600],
        row_heights_mm: [1200],
        elements: [],
    },
    {
        id: 3,
        name: 'Door Type C',
        column_widths_mm: [900],
        row_heights_mm: [2100],
        elements: [],
    },
];

// Mock user for authenticated state
export const mockUser = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
};

// Factory function for creating mock AperturesContext values
export const createMockAperturesContext = (overrides = {}) => ({
    isLoadingApertures: false,
    setIsLoadingApertures: jest.fn(),
    apertures: mockApertures,
    setApertures: jest.fn(),
    selectedApertureId: 1,
    activeAperture: mockApertures[0],
    setSelectedApertureId: jest.fn(),
    handleSetActiveApertureById: jest.fn(),
    handleSetActiveAperture: jest.fn(),
    handleNameChange: jest.fn(),
    handleAddAperture: jest.fn(),
    handleDeleteAperture: jest.fn(),
    handleDuplicateAperture: jest.fn(),
    handleUpdateAperture: jest.fn(),
    handleAddRow: jest.fn(),
    handleDeleteRow: jest.fn(),
    handleAddColumn: jest.fn(),
    handleDeleteColumn: jest.fn(),
    getCellSize: jest.fn(() => ({ width: 100, height: 100 })),
    updateColumnWidth: jest.fn(),
    updateRowHeight: jest.fn(),
    selectedApertureElementIds: [],
    toggleApertureElementSelection: jest.fn(),
    clearApertureElementIdSelection: jest.fn(),
    mergeSelectedApertureElements: jest.fn(),
    splitSelectedApertureElement: jest.fn(),
    handleUpdateApertureElementFrameType: jest.fn(),
    updateApertureElementName: jest.fn(),
    handleUpdateApertureElementGlazing: jest.fn(),
    ...overrides,
});

// Factory function for creating mock ApertureSidebarContext values
export const createMockSidebarContext = (overrides = {}) => ({
    nameChangeModal: {
        isOpen: false,
        apertureId: 0,
        apertureName: '',
    },
    setNameChangeModal: jest.fn(),
    openNameChangeModal: jest.fn(),
    closeNameChangeModal: jest.fn(),
    handleNameSubmit: jest.fn(),
    isSidebarOpen: true,
    toggleSidebar: jest.fn(),
    ...overrides,
});

// Dummy test to prevent "Your test suite must contain at least one test" error
test('testUtils module loads correctly', () => {
    expect(mockApertures).toHaveLength(3);
});
