#!/usr/bin/env bun
// run.ts - Development environment runner for CredoPass
import { spawn, type Subprocess } from 'bun'

interface ProcessInfo {
  name: string
  process: Subprocess
  command: string[]
  cwd: string
}

class DevRunner {
  private processes: ProcessInfo[] = []
  private isShuttingDown = false

  private log(service: string, message: string, type: 'info' | 'error' | 'success' = 'info') {
    const timestamp = new Date().toLocaleTimeString()
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'
    console.log(`[${timestamp}] ${prefix} [${service}] ${message}`)
  }

  private async startProcess(name: string, command: string[], cwd: string): Promise<void> {
    try {
      this.log(name, `Starting: ${command.join(' ')}`, 'info')
      
      const proc = spawn(command, {
        cwd,
        env: { ...process.env },
        stdout: 'pipe',
        stderr: 'pipe',
        stdin: 'inherit',
      })

      this.processes.push({ name, process: proc, command, cwd })

      // Stream stdout with service prefix
      if (proc.stdout) {
        const reader = proc.stdout.getReader()
        this.streamOutput(reader, name, 'stdout')
      }

      // Stream stderr with service prefix
      if (proc.stderr) {
        const reader = proc.stderr.getReader()
        this.streamOutput(reader, name, 'stderr')
      }

      // Monitor process exit
      proc.exited.then((code) => {
        if (!this.isShuttingDown) {
          this.log(name, `Process exited with code ${code}`, code === 0 ? 'info' : 'error')
        }
      }).catch((err) => {
        if (!this.isShuttingDown) {
          this.log(name, `Process error: ${err.message}`, 'error')
        }
      })

      this.log(name, 'Started successfully', 'success')
    } catch (error) {
      this.log(name, `Failed to start: ${error}`, 'error')
      throw error
    }
  }

  private async streamOutput(reader: ReadableStreamDefaultReader<Uint8Array>, service: string, stream: 'stdout' | 'stderr') {
    const decoder = new TextDecoder()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n')
        
        for (const line of lines) {
          if (line.trim()) {
            const timestamp = new Date().toLocaleTimeString()
            const prefix = stream === 'stderr' ? '⚠️' : '📝'
            console.log(`[${timestamp}] ${prefix} [${service}] ${line}`)
          }
        }
      }
    } catch (error) {
      // Stream closed or error occurred
    } finally {
      reader.releaseLock()
    }
  }

  private async cleanup() {
    if (this.isShuttingDown) return
    this.isShuttingDown = true

    console.log('\n')
    this.log('SYSTEM', 'Shutting down all services...', 'info')

    // Kill all processes
    for (const { name, process } of this.processes) {
      try {
        this.log(name, 'Stopping...', 'info')
        process.kill()
        await process.exited
        this.log(name, 'Stopped', 'success')
      } catch (error) {
        this.log(name, `Error stopping: ${error}`, 'error')
      }
    }

    this.log('SYSTEM', 'All services stopped', 'success')
    process.exit(0)
  }

  async run() {
    console.log('\n🚀 Starting CredoPass Development Environment')
    console.log('═'.repeat(60))
    console.log(`📅 Date: ${new Date().toLocaleString()}`)
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`📂 Working Directory: ${process.cwd()}`)
    console.log('═'.repeat(60))
    console.log()

    // Setup cleanup handlers
    process.on('SIGINT', () => this.cleanup())   // Ctrl+C
    process.on('SIGTERM', () => this.cleanup())  // kill command
    process.on('exit', () => this.cleanup())     // process exit

    try {
      // Start Web UI (Vite)
      await this.startProcess(
        'WEB',
        ['bun', 'vite'],
        'apps/web'
      )

      // Small delay to stagger startup
      await Bun.sleep(500)

      // Start API Backend
      await this.startProcess(
        'API',
        ['bun', '--watch', '--no-clear-screen', 'src/index.ts'],
        'services/api'
      )

      console.log('\n' + '═'.repeat(60))
      this.log('SYSTEM', 'All services started successfully!', 'success')
      this.log('SYSTEM', 'Web UI: http://localhost:5173', 'info')
      this.log('SYSTEM', 'API: http://localhost:3000', 'info')
      this.log('SYSTEM', 'Press Ctrl+C to stop all services', 'info')
      console.log('═'.repeat(60) + '\n')

      // Keep the script running
      await new Promise(() => {})
    } catch (error) {
      this.log('SYSTEM', `Startup failed: ${error}`, 'error')
      await this.cleanup()
      process.exit(1)
    }
  }
}

// Run the development environment
const runner = new DevRunner()
runner.run().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})