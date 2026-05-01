export const toTitleCase = (value: string): string =>
  value
    .replace(/[-_]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

export const classNames = (...classes: Array<string | false | undefined>): string =>
  classes.filter(Boolean).join(' ')
