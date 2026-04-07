import { execSync } from 'child_process';
import { mkdirSync } from 'fs';

// Create temp directory
mkdirSync('/vercel/share/v0-project/temp-luma', { recursive: true });

// Run shadcn CLI to generate base-luma components
console.log('Generating Luma components...');
execSync('bunx --bun shadcn@latest init --preset b1VlIttI --base base --template vite', {
  cwd: '/vercel/share/v0-project/temp-luma',
  stdio: 'inherit'
});

console.log('Done! Components generated in temp-luma folder');
