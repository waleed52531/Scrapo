export class PaginatedResult<T> {
  constructor(
    public readonly items: T[],
    public readonly pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    },
  ) {}
}
