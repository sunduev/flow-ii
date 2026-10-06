const pluralRules = new Intl.PluralRules('ru');

/** Формы: один турнир, два турнира, пять турниров. */
export function countLabel(count: number, forms: readonly [string, string, string]): string {
  const category = pluralRules.select(count);
  return `${count} ${forms[category === 'one' ? 0 : category === 'few' ? 1 : 2]}`;
}
