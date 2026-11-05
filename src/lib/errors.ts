export class HttpError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (msg: string) => new HttpError(msg, 400);
export const forbidden = (msg: string) => new HttpError(msg, 403);
export const notFound = (what: string) => new HttpError(`${what} not found`, 404);
