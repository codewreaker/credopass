#!/bin/bash
cd /vercel/share/v0-project
mkdir -p temp-luma
cd temp-luma
bunx --bun shadcn@latest init --preset b1VlIttI --base base --template vite --yes
