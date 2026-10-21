import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthErrorCode } from './interfaces/auth-error-code.enum';
import { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);

    if (token === null) {
      throw this.nullSessionException();
    }

    if (token === undefined) {
      throw this.invalidSessionException();
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      if (typeof payload.sub !== 'number') {
        throw this.invalidSessionException();
      }

      request.user = { id: payload.sub };
      return true;
    } catch {
      throw this.invalidSessionException();
    }
  }

  private extractTokenFromHeader(
    request: AuthenticatedRequest,
  ): string | null | undefined {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return null;
    }

    const normalizedAuthorization = authorization.trim();

    if (!normalizedAuthorization) {
      return null;
    }

    const [type, token, ...extra] = normalizedAuthorization.split(/\s+/);

    if (type === 'Bearer' && !token) {
      return null;
    }

    return type === 'Bearer' && token && extra.length === 0 ? token : undefined;
  }

  private nullSessionException() {
    return new UnauthorizedException({
      statusCode: HttpStatus.UNAUTHORIZED,
      code: AuthErrorCode.NULL_SESSION,
      message: 'Unauthorized',
    });
  }

  private invalidSessionException() {
    return new UnauthorizedException({
      statusCode: HttpStatus.UNAUTHORIZED,
      code: AuthErrorCode.INVALID_SESSION,
      message: 'Unauthorized',
    });
  }
}
