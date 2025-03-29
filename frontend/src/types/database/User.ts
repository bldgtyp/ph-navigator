export interface User {
    email: string;
    id: number;
    username: string;
    all_project_ids: number[];
}

export interface UserContextType {
    user: User | null;
    login: (token: string) => void;
    logout: () => void;
}
