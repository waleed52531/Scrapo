import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { map, type Observable } from "rxjs";
import { PaginatedResult } from "./paginated-result";

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((value) => {
        if (value instanceof PaginatedResult) {
          return {
            success: true,
            data: value.items,
            pagination: value.pagination,
          };
        }
        return { success: true, data: value ?? null };
      }),
    );
  }
}
