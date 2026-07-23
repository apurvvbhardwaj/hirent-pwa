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
        freelancerDashboard: resolve(__dirname, 'freelancer-dashboard.html'),
        search:            resolve(__dirname, 'search.html'),
        notifications:     resolve(__dirname, 'notifications.html'),
        profile:           resolve(__dirname, 'profile.html'),
        vault:             resolve(__dirname, 'vault.html'),
        explore:           resolve(__dirname, 'explore.html'),
        applications:      resolve(__dirname, 'applications.html'),
        pitch:             resolve(__dirname, 'pitch.html'),
        resume:            resolve(__dirname, 'resume.html'),
        portfolio:         resolve(__dirname, 'portfolio.html'),
        more:              resolve(__dirname, 'more.html'),
        hirentScore:       resolve(__dirname, 'hirent-score.html'),
        confidenceScore:   resolve(__dirname, 'confidence-score.html'),
        level:             resolve(__dirname, 'level.html'),
        badges:            resolve(__dirname, 'badges.html'),
        rating:            resolve(__dirname, 'rating.html'),
        referral:          resolve(__dirname, 'referral.html'),
        support:           resolve(__dirname, 'support.html'),
        messages:          resolve(__dirname, 'messages.html'),
        pricing:           resolve(__dirname, 'pricing.html'),
        playbook:          resolve(__dirname, 'playbook.html'),
        drawer:            resolve(__dirname, 'drawer.html'),
      },
    },
  },
});
