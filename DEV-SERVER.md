# Development Server Management

## 🚀 Never See "Unable to Connect" Again!

The development server now has **automatic restart** and **background mode** capabilities.

## ⚡ Quick Start (Recommended)

```bash
# Start server in background with auto-restart
npm run dev:bg
```

That's it! The server will:
- ✅ Run in the background
- ✅ Auto-restart on crashes
- ✅ Stay alive even if terminal closes
- ✅ Be available at http://localhost:3000

## 📋 All Available Commands

### Starting the Server

```bash
# Background mode with auto-restart (RECOMMENDED - currently running!)
npm run dev:bg

# Standard development server (foreground)
npm run dev

# Interactive auto-restart (shows output)
npm run dev:auto

# Managed server with logging
npm run dev:managed

# Clean start (removes cache and restarts)
npm run dev:clean
```

### Managing the Server

```bash
# Stop all dev servers
npm run stop

# Check if server is running
npm run status

# View logs (background mode)
npm run logs
```

## 🎯 Current Status

✅ **Server is running in background mode**
- **URL**: http://localhost:3000
- **Network**: http://192.168.1.108:3000
- **Mode**: Background with auto-restart
- **Logs**: `dev-server.log`

## 🔧 How It Works

### Background Mode (`npm run dev:bg`)
- Runs server as background process
- Uses `nohup` for terminal independence
- Auto-restarts on crashes
- Logs to `dev-server.log`
- PID tracked in `.dev-server.pid`

### Benefits
1. **Terminal independence**: Close terminal, server keeps running
2. **Auto-recovery**: Crashes trigger automatic restart
3. **Always available**: No more connection errors
4. **Easy monitoring**: Check logs anytime with `npm run logs`

## 🐛 Troubleshooting

### If You See "Unable to Connect"

This should never happen now, but if it does:

```bash
# Quick fix - restart background server
npm run stop && npm run dev:bg

# Or check status first
npm run status

# View recent logs
npm run logs
```

### Server Won't Start

```bash
# Clean everything and restart
npm run dev:clean
```

### Check What's Running

```bash
# See all node/vite processes
npm run status

# Or manually
ps aux | grep vite
```

## 📊 Monitoring

### View Live Logs
```bash
npm run logs
# or
tail -f dev-server.log
```

### Check Server Health
```bash
curl http://localhost:3000
# Should return HTTP 200 OK
```

## 🌐 Network Access

The server is accessible from:
- **Local**: http://localhost:3000
- **Network**: http://[YOUR-IP]:3000
- **Debug**: http://localhost:3000/__debug

Perfect for testing on mobile devices or other computers on your network.

## 💡 Pro Tips

1. **Use background mode**: `npm run dev:bg` - Set it and forget it
2. **Monitor logs**: Keep a terminal with `npm run logs` open during development
3. **Clean restarts**: Use `npm run dev:clean` if things feel weird
4. **Check status**: Quick `npm run status` to see if server is up

## 📁 Files

- `start-background.sh` - Background server launcher
- `start-dev.sh` - Interactive auto-restart wrapper
- `dev-server.sh` - Managed server with PID tracking
- `dev-server.log` - Server output and errors
- `.dev-server.pid` - Process ID for background server

## ⚠️ Remember

- **Starting**: Use `npm run dev:bg` for best experience
- **Stopping**: Always use `npm run stop` to clean up properly
- **Logs**: Check `npm run logs` if something seems wrong
- **Status**: Run `npm run status` to verify server is running
