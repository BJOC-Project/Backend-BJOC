const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface PaginationInput {
  page?: string | number;
  limit?: string | number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  offset: number;
}

export function resolvePagination(input: PaginationInput): PaginationResult {
  const rawPage = Number(input.page || DEFAULT_PAGE);
  const rawLimit = Number(input.limit || DEFAULT_LIMIT);
  const page = Number.isNaN(rawPage) || rawPage < 1 ? DEFAULT_PAGE : rawPage;
  const safeLimit = Number.isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_LIMIT : rawLimit;
  const limit = Math.min(safeLimit, MAX_LIMIT);

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

export function buildPaginationMeta(
  total: number,
  pagination: PaginationResult,
) {
  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / pagination.limit),
    hasNextPage: pagination.offset + pagination.limit < total,
    hasPreviousPage: pagination.page > 1,
  };
}
