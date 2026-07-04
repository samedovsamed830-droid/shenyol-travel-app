import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const args = process.argv.slice(2)
const inputPath = args[0]

if (!inputPath) {
  console.error('Istifade: npm run setup-admin-env -- <service-account-json-path>')
  process.exit(1)
}

const resolvedInputPath = path.resolve(process.cwd(), inputPath)
const envPath = path.resolve(process.cwd(), '.env.local')

function upsertEnvLine(content, key, value) {
  const escaped = String(value).replace(/\r?\n/g, '\\n')
  const line = `${key}=${escaped}`
  const regex = new RegExp(`^${key}=.*$`, 'm')

  if (regex.test(content)) {
    return content.replace(regex, line)
  }

  return content.endsWith('\n') ? `${content}${line}\n` : `${content}\n${line}\n`
}

async function run() {
  const raw = await readFile(resolvedInputPath, 'utf8')
  const json = JSON.parse(raw)

  const projectId = json.project_id
  const clientEmail = json.client_email
  const privateKey = json.private_key

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('JSON daxilinde project_id, client_email veya private_key tapilmadi.')
  }

  let envContent = ''
  try {
    envContent = await readFile(envPath, 'utf8')
  } catch {
    envContent = ''
  }

  envContent = upsertEnvLine(envContent, 'FIREBASE_PROJECT_ID', projectId)
  envContent = upsertEnvLine(envContent, 'FIREBASE_CLIENT_EMAIL', clientEmail)
  envContent = upsertEnvLine(envContent, 'FIREBASE_PRIVATE_KEY', privateKey)

  if (!/^IMGBB_API_KEY=/m.test(envContent)) {
    envContent = upsertEnvLine(envContent, 'IMGBB_API_KEY', 'YOUR_IMGBB_API_KEY_HERE')
  }

  await writeFile(envPath, envContent, 'utf8')

  console.log('.env.local ugurla yenilendi: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY')
  console.log('Qeyd: IMGBB_API_KEY yox idise placeholder elave edildi.')
}

run().catch((error) => {
  console.error('Xeta:', error instanceof Error ? error.message : error)
  process.exit(1)
})
