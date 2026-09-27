import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',fullyParallel:false,workers:1,reporter:'list',use:{baseURL:process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:3001',viewport:{width:1440,height:1050},launchOptions:{executablePath:process.env.CHROMIUM_EXECUTABLE||undefined}},timeout:30000});
