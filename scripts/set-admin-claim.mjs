import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

// OPTION A: UID-i burada yazin (en sade yol)
const TARGET_UID = ''

// OPTION B: E-poctu burada yazin
const TARGET_EMAIL = ''

const args = process.argv.slice(2)
const emailFlagIndex = args.findIndex((arg) => arg === '--email')
const uidFlagIndex = args.findIndex((arg) => arg === '--uid')

const emailFromCli = emailFlagIndex >= 0 ? args[emailFlagIndex + 1]?.trim() : ''
const uidFromCli = uidFlagIndex >= 0
  ? args[uidFlagIndex + 1]?.trim()
  : args.find((arg) => !arg.startsWith('--'))?.trim()
const targetEmail = emailFromCli || TARGET_EMAIL
const initialTargetUid = uidFromCli || TARGET_UID

if (!initialTargetUid && !targetEmail) {
  console.error('Xeta: Firebase UID ve ya email daxil edilmeyib.')
  console.error('Istifade variantlari:')
  console.error('1) scripts/set-admin-claim.mjs daxilinde TARGET_UID deyisenini doldurun')
  console.error('2) Komanda ile UID verin: npm run set-admin-claim -- <FIREBASE_UID>')
  console.error('3) Komanda ile email verin: npm run set-admin-claim -- --email <EMAIL>')
  process.exit(1)
}

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

if (!projectId || !clientEmail || !privateKey) {
  console.error('Xeta: Firebase Admin ucun env deyisenleri natamamdir.')
  console.error('Lazim olanlar: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY')
  process.exit(1)
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })

const auth = getAuth(app)

async function run() {
  let targetUid = initialTargetUid

  if (!targetUid && targetEmail) {
    const userByEmail = await auth.getUserByEmail(targetEmail)
    targetUid = userByEmail.uid
  }

  if (!targetUid) {
    throw new Error('UID tapilmadi.')
  }

  await auth.setCustomUserClaims(targetUid, { admin: true })

  const user = await auth.getUser(targetUid)
  const isAdmin = user.customClaims?.admin === true

  if (!isAdmin) {
    throw new Error('Admin claim teyin olunsa da yoxlama ugursuz oldu.')
  }

  console.log('Ugurlu: admin claim verildi.')
  console.log(`UID: ${targetUid}`)
  if (targetEmail) {
    console.log(`Email: ${targetEmail}`)
  }
  console.log('customClaims:', user.customClaims)
  console.log('Qeyd: Istifadeci yeni token almaq ucun hesabdan cixib yeniden daxil olmalidir.')
}

run().catch((error) => {
  console.error('Xeta:', error instanceof Error ? error.message : error)
  process.exit(1)
})
