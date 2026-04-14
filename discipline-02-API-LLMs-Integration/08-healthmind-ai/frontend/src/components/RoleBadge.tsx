import type { UserRole } from '@/lib/api';

const ROLE_STYLES: Record<UserRole, string> = {
  patient: 'bg-blue-100 text-blue-700',
  doctor: 'bg-green-100 text-green-700',
  admin: 'bg-purple-100 text-purple-700',
};

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[role]}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}
