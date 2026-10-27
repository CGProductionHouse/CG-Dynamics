// Only the public query operations used by the shared fact/post writers. Legacy
// ESM and worker JSR clients both implement this structural port. No SDK imports,
// casts between protected class members or changes to runtime dependencies.
type DatabaseError = { message: string; code?: string }
type Result<T = unknown> = { data: T; error: DatabaseError | null }

export interface MetaDatabaseClient {
  rpc(name: string, parameters: Record<string, unknown>): PromiseLike<Result>
  from(table: string): {
    insert(value: Record<string, unknown>): {
      select(columns: string): { single(): PromiseLike<Result<Record<string, unknown> | null>> }
    }
    update(value: Record<string, unknown>): {
      eq(column: string, value: string): PromiseLike<Result>
    }
  }
}
