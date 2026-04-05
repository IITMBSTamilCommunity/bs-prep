import { readFileSync } from 'fs'
import { join } from 'path'
import { createSign } from 'crypto'

/**
 * Load Google service account credentials.
 *
 * Priority:
 *  1. GOOGLE_APPLICATION_CREDENTIALS env var (path to a JSON file)
 *  2. The bundled iitm-bs-483310-f82521e3a93c.json in the project root
 *
 * The raw multi-line JSON in GOOGLE_SERVICE_ACCOUNT_KEY cannot be parsed
 * reliably from .env.local because dotenv only reads the first line of
 * un-quoted values. We therefore fall back to reading the file directly.
 */
function loadServiceAccountKey(): {
  client_email: string
  private_key: string
  token_uri: string
} {
  // 1. Try a file-path env var first (most explicit)
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (credPath) {
    const raw = readFileSync(credPath, 'utf-8')
    return JSON.parse(raw)
  }

  // 2. Try the inline env var (only works when set as a single-line JSON)
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim()
  if (inline && inline.startsWith('{') && inline.endsWith('}')) {
    try {
      return JSON.parse(inline)
    } catch {
      // fall through to file-based fallback
    }
  }

  // 3. Fall back to the credentials JSON file in the project root
  const filePath = join(process.cwd(), 'iitm-bs-483310-f82521e3a93c.json')
  const raw = readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
}

/**
 * Obtain a short-lived Google OAuth2 access token via service-account JWT flow.
 * The private key NEVER leaves the server.
 */
export async function getGoogleAccessToken(scopes: string[]): Promise<string> {
  const key = loadServiceAccountKey()

  const tokenUri = key.token_uri ?? 'https://oauth2.googleapis.com/token'

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: key.client_email,
    sub: key.client_email,
    scope: scopes.join(' '),
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }

  const b64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')

  const toSign = `${b64url(header)}.${b64url(payload)}`

  const sign = createSign('RSA-SHA256')
  sign.update(toSign)
  const signature = sign.sign(key.private_key, 'base64url')
  const jwt = `${toSign}.${signature}`

  const tokenRes = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`Google OAuth token error: ${err}`)
  }

  const json = (await tokenRes.json()) as { access_token: string }
  return json.access_token
}
