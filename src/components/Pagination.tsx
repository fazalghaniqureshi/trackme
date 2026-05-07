interface PaginationProps {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}

const Pagination = ({ page, totalPages, onPage }: PaginationProps) => {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const visible = pages.filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2
  );

  return (
    <div className="pagination-bar">
      <button
        className="pagination-btn"
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
      >
        &lsaquo;
      </button>

      {visible.map((p, i) => {
        const prev = visible[i - 1];
        const showEllipsis = prev && p - prev > 1;
        return (
          <span key={p} className="d-contents">
            {showEllipsis && <span className="pagination-ellipsis">&#8230;</span>}
            <button
              className={`pagination-btn${p === page ? ' active' : ''}`}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          </span>
        );
      })}

      <button
        className="pagination-btn"
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
      >
        &rsaquo;
      </button>
    </div>
  );
};

export default Pagination;
