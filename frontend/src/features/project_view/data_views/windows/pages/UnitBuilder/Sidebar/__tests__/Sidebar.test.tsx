import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { UserContext } from '../../../../../../../auth/_contexts/UserContext';
import ApertureTypesSidebar from '../Sidebar';
import ApertureListItemContent from '../Sidebar.ListItemContent';
import ApertureListHeader from '../Sidebar.ListHeader';
import { ApertureSidebarProvider } from '../Sidebar.Context';
import { mockApertures, mockUser, createMockAperturesContext, createMockSidebarContext } from './testUtils';

// Mock the context modules
jest.mock('../../../../_contexts/Aperture.Context', () => ({
    useApertures: jest.fn(),
}));

jest.mock('../Sidebar.Context', () => ({
    ...jest.requireActual('../Sidebar.Context'),
    useApertureSidebar: jest.fn(),
}));

// Import the mocked modules
import { useApertures } from '../../../../_contexts/Aperture.Context';
import { useApertureSidebar } from '../Sidebar.Context';

const mockUseApertures = useApertures as jest.MockedFunction<typeof useApertures>;
const mockUseApertureSidebar = useApertureSidebar as jest.MockedFunction<typeof useApertureSidebar>;

describe('ApertureTypesSidebar', () => {
    beforeEach(() => {
        mockUseApertures.mockReturnValue(createMockAperturesContext() as any);
        mockUseApertureSidebar.mockReturnValue(createMockSidebarContext() as any);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders the aperture list sorted alphabetically', () => {
            render(
                <UserContext.Provider value={{ user: mockUser, setUser: jest.fn() }}>
                    <ApertureSidebarProvider>
                        <ApertureTypesSidebar />
                    </ApertureSidebarProvider>
                </UserContext.Provider>
            );

            // Get all aperture names from the list
            const doorC = screen.getByText('Door Type C');
            const windowA = screen.getByText('Window Type A');
            const windowB = screen.getByText('Window Type B');

            // They should all be in the document
            expect(doorC).toBeInTheDocument();
            expect(windowA).toBeInTheDocument();
            expect(windowB).toBeInTheDocument();

            // Verify sorting by comparing their position in the DOM
            // Door Type C should come before Window Type A (alphabetically)
            const allTexts = screen.getAllByText(/Type/);
            const textContents = allTexts.map(el => el.textContent);
            expect(textContents).toEqual(['Door Type C', 'Window Type A', 'Window Type B']);
        });

        it('renders all apertures from the context', () => {
            render(
                <UserContext.Provider value={{ user: mockUser, setUser: jest.fn() }}>
                    <ApertureSidebarProvider>
                        <ApertureTypesSidebar />
                    </ApertureSidebarProvider>
                </UserContext.Provider>
            );

            expect(screen.getByText('Window Type A')).toBeInTheDocument();
            expect(screen.getByText('Window Type B')).toBeInTheDocument();
            expect(screen.getByText('Door Type C')).toBeInTheDocument();
        });

        it('renders empty list when no apertures exist', () => {
            mockUseApertures.mockReturnValue(
                createMockAperturesContext({
                    apertures: [],
                    selectedApertureId: null,
                    activeAperture: null,
                }) as any
            );

            render(
                <UserContext.Provider value={{ user: mockUser, setUser: jest.fn() }}>
                    <ApertureSidebarProvider>
                        <ApertureTypesSidebar />
                    </ApertureSidebarProvider>
                </UserContext.Provider>
            );

            // Only the Add button should be visible
            const listItems = screen.queryAllByRole('listitem');
            expect(listItems).toHaveLength(0);
        });
    });
});

describe('ApertureListHeader', () => {
    it('renders Add New Aperture button for logged-in users', () => {
        const onAddAperture = jest.fn();

        render(
            <UserContext.Provider value={{ user: mockUser, setUser: jest.fn() }}>
                <ApertureListHeader onAddAperture={onAddAperture} />
            </UserContext.Provider>
        );

        expect(screen.getByText('+ Add New Aperture')).toBeInTheDocument();
    });

    it('does not render Add New Aperture button for logged-out users', () => {
        const onAddAperture = jest.fn();

        render(
            <UserContext.Provider value={{ user: null, setUser: jest.fn() }}>
                <ApertureListHeader onAddAperture={onAddAperture} />
            </UserContext.Provider>
        );

        expect(screen.queryByText('+ Add New Aperture')).not.toBeInTheDocument();
    });

    it('calls onAddAperture when button is clicked', () => {
        const onAddAperture = jest.fn();

        render(
            <UserContext.Provider value={{ user: mockUser, setUser: jest.fn() }}>
                <ApertureListHeader onAddAperture={onAddAperture} />
            </UserContext.Provider>
        );

        fireEvent.click(screen.getByText('+ Add New Aperture'));
        expect(onAddAperture).toHaveBeenCalledTimes(1);
    });
});

describe('ApertureListItemContent', () => {
    beforeEach(() => {
        mockUseApertures.mockReturnValue(createMockAperturesContext() as any);
        mockUseApertureSidebar.mockReturnValue(createMockSidebarContext() as any);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const aperture = mockApertures[0];

    describe('Selection', () => {
        it('highlights selected item', () => {
            render(
                <UserContext.Provider value={{ user: mockUser, setUser: jest.fn() }}>
                    <ApertureListItemContent aperture={aperture} isSelected={true} />
                </UserContext.Provider>
            );

            // Find the main list item button (the one containing the aperture name)
            const listItemButton = screen.getByText(aperture.name).closest('[role="button"]');
            expect(listItemButton).toHaveClass('Mui-selected');
        });

        it('does not highlight non-selected item', () => {
            render(
                <UserContext.Provider value={{ user: mockUser, setUser: jest.fn() }}>
                    <ApertureListItemContent aperture={aperture} isSelected={false} />
                </UserContext.Provider>
            );

            const listItemButton = screen.getByText(aperture.name).closest('[role="button"]');
            expect(listItemButton).not.toHaveClass('Mui-selected');
        });

        it('calls handleSetActiveApertureById when item is clicked', () => {
            const mockContext = createMockAperturesContext();
            mockUseApertures.mockReturnValue(mockContext as any);

            render(
                <UserContext.Provider value={{ user: mockUser, setUser: jest.fn() }}>
                    <ApertureListItemContent aperture={aperture} isSelected={false} />
                </UserContext.Provider>
            );

            const listItemButton = screen.getByText(aperture.name).closest('[role="button"]');
            fireEvent.click(listItemButton!);
            expect(mockContext.handleSetActiveApertureById).toHaveBeenCalledWith(aperture.id);
        });
    });

    describe('Action Buttons', () => {
        it('renders edit, duplicate, and delete buttons for logged-in users', () => {
            render(
                <UserContext.Provider value={{ user: mockUser, setUser: jest.fn() }}>
                    <ApertureListItemContent aperture={aperture} isSelected={false} />
                </UserContext.Provider>
            );

            // Check for icon buttons (edit, duplicate, delete)
            const iconButtons = screen.getAllByRole('button');
            // Main button + 3 action buttons
            expect(iconButtons.length).toBeGreaterThanOrEqual(3);
        });

        it('does not render action buttons for logged-out users', () => {
            render(
                <UserContext.Provider value={{ user: null, setUser: jest.fn() }}>
                    <ApertureListItemContent aperture={aperture} isSelected={false} />
                </UserContext.Provider>
            );

            // Only the main list item button should exist
            const buttons = screen.getAllByRole('button');
            expect(buttons).toHaveLength(1);
        });

        it('calls openNameChangeModal when edit button is clicked', () => {
            const mockSidebarContext = createMockSidebarContext();
            mockUseApertureSidebar.mockReturnValue(mockSidebarContext as any);

            render(
                <UserContext.Provider value={{ user: mockUser, setUser: jest.fn() }}>
                    <ApertureListItemContent aperture={aperture} isSelected={false} />
                </UserContext.Provider>
            );

            // Find the edit button (first icon button after the main button)
            const editButton = document.querySelector('.edit-aperture-name-button button');
            expect(editButton).toBeInTheDocument();

            fireEvent.click(editButton!);
            expect(mockSidebarContext.openNameChangeModal).toHaveBeenCalledWith(aperture.id, aperture.name);
        });

        it('calls handleDuplicateAperture when duplicate button is clicked', () => {
            const mockContext = createMockAperturesContext();
            mockUseApertures.mockReturnValue(mockContext as any);

            render(
                <UserContext.Provider value={{ user: mockUser, setUser: jest.fn() }}>
                    <ApertureListItemContent aperture={aperture} isSelected={false} />
                </UserContext.Provider>
            );

            const duplicateButton = document.querySelector('.duplicate-aperture-button button');
            expect(duplicateButton).toBeInTheDocument();

            fireEvent.click(duplicateButton!);
            expect(mockContext.handleDuplicateAperture).toHaveBeenCalledWith(aperture.id);
        });

        it('calls handleDeleteAperture when delete button is clicked', () => {
            const mockContext = createMockAperturesContext();
            mockUseApertures.mockReturnValue(mockContext as any);

            render(
                <UserContext.Provider value={{ user: mockUser, setUser: jest.fn() }}>
                    <ApertureListItemContent aperture={aperture} isSelected={false} />
                </UserContext.Provider>
            );

            const deleteButton = document.querySelector('.delete-aperture-button button');
            expect(deleteButton).toBeInTheDocument();

            fireEvent.click(deleteButton!);
            expect(mockContext.handleDeleteAperture).toHaveBeenCalledWith(aperture.id);
        });
    });
});
