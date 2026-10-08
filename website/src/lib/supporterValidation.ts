export type SupporterAuthMode = 'login' | 'register'

export type SupporterAuthFields = {
  email: string
  password: string
  display_name: string
  phone: string
  accept_terms: boolean
  accept_privacy: boolean
}

export type SupporterAuthErrors = Partial<Record<keyof SupporterAuthFields, string>>

export const SUPPORTER_PASSWORD_MIN = 12
export const SUPPORTER_PASSWORD_MAX = 128

// Match the API's character counts, including passwords containing emoji.
const characterCount = (value: string) => Array.from(value).length

export function validateSupporterAuth(mode: SupporterAuthMode, fields: SupporterAuthFields): SupporterAuthErrors {
  const errors: SupporterAuthErrors = {}
  const email = fields.email.trim()
  if (characterCount(email) < 3 || !/^[^@\s]+@[^@\s]+$/.test(email)) {
    errors.email = 'Enter a valid email address.'
  } else if (characterCount(email) > 255) {
    errors.email = 'Email address must contain no more than 255 characters.'
  }

  // Never trim or otherwise alter a password.
  const passwordLength = characterCount(fields.password)
  if (passwordLength < (mode === 'register' ? SUPPORTER_PASSWORD_MIN : 1)) {
    errors.password = mode === 'register'
      ? `Password must contain at least ${SUPPORTER_PASSWORD_MIN} characters.`
      : 'Enter your password.'
  } else if (passwordLength > SUPPORTER_PASSWORD_MAX) {
    errors.password = `Password must contain no more than ${SUPPORTER_PASSWORD_MAX} characters.`
  }

  if (mode === 'register') {
    const nameLength = characterCount(fields.display_name.trim())
    if (!nameLength) errors.display_name = 'Enter your display name.'
    else if (nameLength > 255) errors.display_name = 'Display name must contain no more than 255 characters.'

    const phoneLength = characterCount(fields.phone.trim())
    if (phoneLength < 7 || phoneLength > 32) {
      errors.phone = 'Enter a phone number containing 7 to 32 characters.'
    }
    if (!fields.accept_terms) errors.accept_terms = 'Please accept the Terms to create an account.'
    if (!fields.accept_privacy) errors.accept_privacy = 'Please acknowledge the Privacy Policy to create an account.'
  }
  return errors
}

const fieldLabels: Record<string, string> = {
  email: 'Email address',
  password: 'Password',
  display_name: 'Display name',
  phone: 'Phone number',
  accept_terms: 'Terms',
  accept_privacy: 'Privacy Policy',
  policy_version: 'Policy version',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function supporterApiMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback
  const detail = payload.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (isRecord(detail) && typeof detail.message === 'string' && detail.message.trim()) return detail.message
  if (Array.isArray(detail)) {
    // FastAPI validation errors are a list, not a detail.message object.
    // Read only field locations and messages, never input values or ctx.
    const messages = detail.flatMap((item: unknown) => {
      if (!isRecord(item) || typeof item.msg !== 'string' || !item.msg.trim()) return []
      const location: unknown[] = Array.isArray(item.loc) ? item.loc : []
      const field = location.filter((part): part is string => (
        typeof part === 'string' && !['body', 'query', 'path'].includes(part)
      )).at(-1)
      const label = field ? (Object.hasOwn(fieldLabels, field) ? fieldLabels[field] : field.replaceAll('_', ' ')) : ''
      const message = item.msg.replace(/^Value error,\s*/, '')
      return [label ? `${label}: ${message}` : message]
    })
    if (messages.length) return [...new Set(messages)].join(' ')
  }
  return fallback
}
