import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const args = process.argv.slice(2)
const projectId = args[0]?.trim() || 'shenyol-travel'
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

async function runCommand(command, commandArgs) {
  const { stdout } = await execFileAsync(command, commandArgs, { windowsHide: true })
  return stdout.trim()
}

async function assertGcloudInstalled() {
  try {
    await runCommand('gcloud', ['--version'])
  } catch {
    throw new Error(
      'gcloud CLI tapilmadi. Qurasdirin: winget install Google.CloudSDK sonra yeni terminal acin.',
    )
  }
}

async function ensureAuthenticated() {
  const activeAccount = await runCommand('gcloud', [
    'auth',
    'list',
    '--filter=status:ACTIVE',
    '--format=value(account)',
  ])

  if (!activeAccount) {
    throw new Error(
      'gcloud auth yoxdur. Bir defe giris edin: gcloud auth login sonra tekrar yoxlayin.',
    )
  }
}

async function resolveServiceAccountEmail(currentProjectId) {
  const raw = await runCommand('gcloud', [
    'iam',
    'service-accounts',
    'list',
    '--project',
    currentProjectId,
    '--format=json',
  ])

  const accounts = JSON.parse(raw)
  if (Array.isArray(accounts) && accounts.length > 0) {
    const firebaseAdminSdk = accounts.find((item) =>
      String(item.email ?? '').includes('firebase-adminsdk'),
    )

    if (firebaseAdminSdk?.email) {
      return String(firebaseAdminSdk.email)
    }

    const appspot = accounts.find(
      (item) => String(item.email ?? '') === `${currentProjectId}@appspot.gserviceaccount.com`,
    )

    if (appspot?.email) {
      return String(appspot.email)
    }

    if (accounts[0]?.email) {
      return String(accounts[0].email)
    }
  }

  const name = 'shenyol-admin-sdk'
  await runCommand('gcloud', [
    'iam',
    'service-accounts',
    'create',
    name,
    '--project',
    currentProjectId,
    '--display-name',
    'Shenyol Admin SDK',
  ])

  return `${name}@${currentProjectId}.iam.gserviceaccount.com`
}

async function run() {
  await assertGcloudInstalled()
  await ensureAuthenticated()

  await runCommand('gcloud', ['config', 'set', 'project', projectId])

  const serviceAccountEmail = await resolveServiceAccountEmail(projectId)
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'shenyol-admin-key-'))
  const keyPath = path.join(tempDir, 'service-account.json')

  try {
    await runCommand('gcloud', [
      'iam',
      'service-accounts',
      'keys',
      'create',
      keyPath,
      '--iam-account',
      serviceAccountEmail,
      '--project',
      projectId,
      '--quiet',
    ])

    const rawJson = await readFile(keyPath, 'utf8')
    const json = JSON.parse(rawJson)

    const resolvedProjectId = json.project_id
    const clientEmail = json.client_email
    const privateKey = json.private_key

    if (!resolvedProjectId || !clientEmail || !privateKey) {
      throw new Error('Service account key faylinda lazimi saheler yoxdur.')
    }

    let envContent = ''
    try {
      envContent = await readFile(envPath, 'utf8')
    } catch {
      envContent = ''
    }

    envContent = upsertEnvLine(envContent, 'FIREBASE_PROJECT_ID', resolvedProjectId)
    envContent = upsertEnvLine(envContent, 'FIREBASE_CLIENT_EMAIL', clientEmail)
    envContent = upsertEnvLine(envContent, 'FIREBASE_PRIVATE_KEY', privateKey)

    if (!/^IMGBB_API_KEY=/m.test(envContent)) {
      envContent = upsertEnvLine(envContent, 'IMGBB_API_KEY', 'YOUR_IMGBB_API_KEY_HERE')
    }

    await writeFile(envPath, envContent, 'utf8')

    console.log('.env.local yenilendi: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY')
    console.log(`Service account: ${serviceAccountEmail}`)
    console.log('Qeyd: bu emeliyyat yeni service-account key yaradir. Istifade etmediklerinizi sonradan deaktiv edin.')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

run().catch((error) => {
  console.error('Xeta:', error instanceof Error ? error.message : error)
  process.exit(1)
})
