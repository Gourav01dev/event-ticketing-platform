import type { NextFunction, Request, Response } from "express";

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: ErrorCode,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const asyncRoute =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
