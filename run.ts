// run.ts
import { spawn, type Subprocess } from 'bun'

const spawnOptions: any = {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env }
}



const run = async () => {
    console.log("\n🚀 Starting DwellPass development environment")
    console.log("ENV:", process.env.NODE_ENV)
    console.log("PORT:", process.env.PORT || "not set")
    console.log("\n📋 Starting services...")
    
    // Track processes for cleanup
    const processes: Subprocess[] = []
    
    // Start Vite dev server
    console.log("  → Starting Vite dev server (default port: 5173)")
    const viteProcess = spawn(["bun", "--bun", "vite"], spawnOptions)
    processes.push(viteProcess)
    
    // Start Hono backend with watch mode
    console.log("  → Starting Hono backend server (server.ts, port:", process.env.PORT || "3000", ")")
    const honoProcess = spawn(["bun", "--watch", "server.ts"], spawnOptions)
    processes.push(honoProcess)
    // Cleanup function
    const cleanup = async () => {
        console.log("\n🧹 Shutting down servers...")
        // Kill all spawned processes
        for (const proc of processes) {
            proc.kill()
        }
        // Optional: Run cleanup tasks
        // spawn(["bun", "run", "db:down"], spawnOptions)
        process.exit(0)
    }

    // Handle shutdown signals
    process.on("SIGINT", cleanup)  // Ctrl+C
    process.on("SIGTERM", cleanup) // Kill command

    // Handle process exits
    viteProcess.exited.then(() => {
        console.log("⚠️  Vite process exited")
    })

    honoProcess.exited.then(() => {
        console.log("⚠️  Hono process exited")
    })
}

run()