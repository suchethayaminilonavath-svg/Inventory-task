import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const norm = status?.toUpperCase() || '';

  const getStyle = () => {
    switch (norm) {
      // General Positive
      case 'RECEIVED':
      case 'APPROVED':
      case 'ACTIVE':
      case 'IN_STOCK':
      case 'YES':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';

      // Neutral / In Progress
      case 'SUBMITTED':
      case 'REQUESTED':
      case 'IN_TRANSIT':
      case 'IN_PROGRESS':
      case 'PARTIALLY_RECEIVED':
        return 'bg-sky-100 text-sky-800 border-sky-200';

      // Draft / Pending
      case 'DRAFT':
        return 'bg-slate-100 text-slate-700 border-slate-200';

      // Warning / Low Stock
      case 'LOW_STOCK':
        return 'bg-amber-100 text-amber-800 border-amber-200';

      // Negative / Alert
      case 'REJECTED':
      case 'CANCELLED':
      case 'OUT_OF_STOCK':
      case 'INACTIVE':
      case 'ARCHIVED':
      case 'NO':
        return 'bg-rose-100 text-rose-800 border-rose-200';

      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatText = (text: string) => {
    return text.replace(/_/g, ' ');
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStyle()}`}
    >
      {formatText(norm)}
    </span>
  );
};
