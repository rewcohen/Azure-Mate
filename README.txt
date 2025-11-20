# Azure Architect Mate - Local Setup Instructions

This application has been configured to run locally on your Windows PC using Vite (React) and Ollama (AI).

## Prerequisites

1. **Node.js**: Required to run the web server.
   - Download: https://nodejs.org/ (LTS version recommended)

2. **Ollama**: Required for local AI generation and troubleshooting.
   - Download: https://ollama.com/
   - Ensure the Ollama app is running in the background (check your system tray).

## How to Run

1. Open the folder containing these files.
2. Double-click `launch.bat`.

The script will automatically:
1. Check if Node.js and Ollama are installed.
2. Install necessary web dependencies (`npm install`) if needed.
3. Check if the `llama3` AI model is present; if not, it will download it.
4. Start the web application at http://localhost:3000.

## Troubleshooting

- **"Node.js/Ollama not recognized"**:
  Ensure you have installed them and restarted your computer or terminal so they are added to your PATH.

- **AI not responding?**
  Ensure the Ollama icon is visible in your Windows taskbar/system tray. The app connects to http://localhost:11434.
  
- **Port 3000 in use?**
  If the app fails to start because port 3000 is busy, open `package.json` and change the "dev" script to: `"vite --port 3001"`.
