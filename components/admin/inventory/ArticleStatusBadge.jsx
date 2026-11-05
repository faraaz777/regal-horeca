import {
  ARTICLE_MAINTAINED,
  ARTICLE_NON_MAINTAINED,
  ARTICLE_STATUS_LABELS,
  articleStatusFromRule,
} from '@/lib/shared/maintainedArticle';

/**
 * Same label the inventory list filters on.
 * Pass a stock rule, or min/max while those fields are being edited.
 */
export default function ArticleStatusBadge({ rule, status }) {
  const resolved = status || articleStatusFromRule(rule);
  const maintained = resolved === ARTICLE_MAINTAINED;
  return (
    <span
      className={`inline-flex px-1.5 py-px rounded text-[10px] font-semibold leading-tight ${
        maintained
          ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200'
          : 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200'
      }`}
    >
      {ARTICLE_STATUS_LABELS[resolved] || ARTICLE_STATUS_LABELS[ARTICLE_NON_MAINTAINED]}
    </span>
  );
}
