import csvtojson from 'csvtojson';
import type { CustomerInput, ImportResult } from '../domain/types.ts';
import type { GrowthRepository } from '../repositories/growthRepository.ts';

function parseInterests(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
}

export async function importCustomersFromCsv(
  repository: GrowthRepository,
  csvText: string,
): Promise<ImportResult> {
  const rows = await csvtojson().fromString(csvText);
  const customers = [];
  const errors = [];
  let skipped = 0;

  for (const [index, row] of rows.entries()) {
    const input: CustomerInput = {
      name: row.name?.trim(),
      phone: row.phone?.trim(),
      email: row.email?.trim() || undefined,
      segment: row.segment?.trim() || undefined,
      interests: parseInterests(row.interests),
    };

    if (!input.name || !input.phone) {
      skipped += 1;
      errors.push(`Row ${index + 2}: name and phone are required`);
      continue;
    }

    customers.push(await repository.createCustomer(input));
  }

  return { inserted: customers.length, skipped, customers, errors };
}
