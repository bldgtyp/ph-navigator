import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: 1,
            refetchOnWindowFocus: false,
        },
        mutations: {
            onError: (error: Error) => {
                console.error('Mutation error:', error.message);
                alert(error.message);
            },
        },
    },
});
