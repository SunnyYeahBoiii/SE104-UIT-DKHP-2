/** TT-01: one increasing receipt number per term, padded like the seeded PT-20262-00012. */
export function nextReceiptNumber(termCode: string, used: string[]): string {
  const prefix = `PT-${termCode}-`
  let last = 0
  for (const number of used) {
    if (!number.startsWith(prefix)) continue
    const value = Number(number.slice(prefix.length))
    if (Number.isSafeInteger(value)) last = Math.max(last, value)
  }
  return `${prefix}${String(last + 1).padStart(5, '0')}`
}
