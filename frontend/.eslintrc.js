module.exports = {
    settings: {
        react: {
            version: 'detect', // Automatically detect the react version
        },
    },
    env: {
        browser: true,
        es2021: true,
    },
    extends: ['prettier', 'eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react/recommended'],
    overrides: [
        {
            env: {
                node: true,
            },
            files: ['.eslintrc.{js,cjs}'],
            parserOptions: {
                sourceType: 'script',
            },
        },
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    plugins: ['prettier', '@typescript-eslint', 'react', 'react-hooks'],
    rules: {
        'react/react-in-jsx-scope': 'off',
        'react-hooks/exhaustive-deps': 'error',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-inferrable-types': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'react/prop-types': 'off',
        'prettier/prettier': 'error',
    },
};
