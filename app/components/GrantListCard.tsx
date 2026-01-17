import { Grant, formatCurrency, formatDeadline } from "../lib/types";

export default function GrantListCard({ grant }: { grant: Grant }) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <h2 className="text-lg font-bold text-gray-800">
        {grant.title}
      </h2>
      <p className="text-sm text-gray-500 mb-3">
        {grant.organization}
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {grant.issueAreas.map((area, i) => (
          <span
            key={i}
            className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"
          >
            {area}
          </span>
        ))}
      </div>

      <p className="text-sm text-gray-600 mb-4 line-clamp-3">
        {grant.description}
      </p>

      <div className="flex justify-between text-sm gap-4">
        <span className="text-green-700 font-semibold flex-1">
          {grant.fundingMax > 0 ? (
            grant.fundingMin > 0 
              ? `${formatCurrency(grant.fundingMin)} – ${formatCurrency(grant.fundingMax)}`
              : `Up to ${formatCurrency(grant.fundingMax)}`
          ) : (
            <span className="text-xs text-gray-600 line-clamp-2">
              {grant.fundingRaw || 'Funding details in application'}
            </span>
          )}
        </span>
        <span className="text-orange-600 flex-shrink-0">
          {formatDeadline(grant.deadline)}
        </span>
      </div>
    </div>
  );
}
