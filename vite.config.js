import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main:              resolve(__dirname, 'index.html'),
        onboarding:        resolve(__dirname, 'onboarding.html'),
        login:             resolve(__dirname, 'login.html'),
        signup:            resolve(__dirname, 'signup.html'),
        dashboardManager:  resolve(__dirname, 'dashboard-manager.html'),
      },
    },
  },
});
