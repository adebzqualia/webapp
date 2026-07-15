import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, '.', '');
    return {
        plugins: [react()],
        server: {
            port: 5173,
            host: true,
            proxy: {
                '/api': {
                    target: env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
                    changeOrigin: true,
                },
            },
        },
        test: {
            environment: 'jsdom',
            setupFiles: './src/tests/setup.ts',
        },
    };
});
