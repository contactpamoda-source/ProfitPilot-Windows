# ProfitPilot Windows — TryDesigns

Electron desktop finance management application. GitHub Actions compiles a Windows NSIS Setup.exe installer.

This repository requires the full application sources (`index.html`, `main.js`, `preload.js`, `package.json`) at repository root, and `.github/workflows/windows-installer.yml`. The installer workflow deliberately fails if the application files are missing or the NSIS installer was not produced.

Security: Keep all financial backups out of the repository. Do not commit client financial records, OAuth secrets or tokens.
