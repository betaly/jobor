export enum LogicalOperator {
  AND = 'AND',
  OR = 'OR',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export interface PaginatedList<T> {
  items: T[];
  totalItems: number;
}
