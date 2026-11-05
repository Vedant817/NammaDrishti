import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'REACT_APP_');
  // Explicit allowlist: Admin credentials and provider secrets can never enter the bundle.
  const names = ['REACT_APP_API_URL','REACT_APP_SOCKET_URL','REACT_APP_SOCKET_PATH','REACT_APP_REALTIME_TRANSPORT','REACT_APP_FIREBASE_PROJECT_ID','REACT_APP_FIREBASE_API_KEY','REACT_APP_FIREBASE_AUTH_DOMAIN','REACT_APP_FIREBASE_APP_ID'];
  const define = Object.fromEntries(names.map(name => [`process.env.${name}`, JSON.stringify(mode === 'test' ? '' : (env[name] || ''))]));
  define['process.env.PUBLIC_URL'] = JSON.stringify('');
  return {plugins:[react()],define,build:{outDir:'build',manifest:true,emptyOutDir:true},test:{environment:'jsdom',globals:true,setupFiles:['./src/setupTests.jsx'],include:['src/**/*.test.{js,jsx}'],restoreMocks:true}};
});
