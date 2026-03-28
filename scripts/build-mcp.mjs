import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')
const outdir = path.join(projectRoot, 'dist', 'mcp')

await mkdir(outdir, { recursive: true })

await build({
  entryPoints: [path.join(projectRoot, 'src', 'mcp', 'todoMcpServerCli.ts')],
  outdir,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: false,
  packages: 'external',
  logLevel: 'info',
})
