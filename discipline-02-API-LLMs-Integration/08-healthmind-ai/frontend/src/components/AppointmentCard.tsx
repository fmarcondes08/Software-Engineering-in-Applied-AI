type AppointmentCardProps = {
  doctor?: string;
  date?: string;
  reason?: string;
  action?: 'schedule' | 'cancel';
  confirmed?: boolean;
};

export function AppointmentCard({ doctor, date, reason, action, confirmed }: AppointmentCardProps) {
  if (!confirmed) return null;

  const isCancel = action === 'cancel';
  const borderColor = isCancel ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50';
  const badgeColor = isCancel ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700';
  const label = isCancel ? 'Appointment Cancelled' : 'Appointment Confirmed';

  return (
    <div className={`mt-3 rounded-xl border-2 ${borderColor} p-4`}>
      <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mb-3 ${badgeColor}`}>
        {isCancel ? '✗' : '✓'} {label}
      </div>
      <div className="space-y-1 text-sm text-slate-700">
        {doctor && (
          <div className="flex gap-2">
            <span className="font-medium w-20 shrink-0">Doctor:</span>
            <span>{doctor}</span>
          </div>
        )}
        {date && (
          <div className="flex gap-2">
            <span className="font-medium w-20 shrink-0">Date:</span>
            <span>{date}</span>
          </div>
        )}
        {reason && (
          <div className="flex gap-2">
            <span className="font-medium w-20 shrink-0">Reason:</span>
            <span>{reason}</span>
          </div>
        )}
      </div>
    </div>
  );
}
