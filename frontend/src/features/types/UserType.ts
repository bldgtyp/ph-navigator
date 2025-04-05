export interface UserType {
    email: string;
    id: number;
    username: string;
    all_project_ids: number[];
}

export interface UserContextType {
    user: UserType | null;
    login: (token: string) => void;
    logout: () => void;
}
