import { startTodoMcpServer } from './todoMcpServer.js'

async function main(): Promise<void> {
  const workspacePath = process.argv[2]?.trim()

  if (!workspacePath) {
    throw new Error('缺少工作区路径参数。用法：node todoMcpServerCli.js <workspacePath>')
  }

  await startTodoMcpServer(workspacePath)
}

main().catch(error => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exit(1)
})
