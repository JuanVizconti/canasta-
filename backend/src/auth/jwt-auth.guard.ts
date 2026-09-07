import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthErrorCode } from './auth-error-code.enum';
import { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
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

  private extractTokenFromHeader(request: AuthenticatedRequest) {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return undefined;
    }

    const [type, token, ...extra] = authorization.split(' ');

    return type === 'Bearer' && token && extra.length === 0 ? token : undefined;
  }

  private invalidSessionException() {
    return new UnauthorizedException({
      statusCode: HttpStatus.UNAUTHORIZED,
      code: AuthErrorCode.INVALID_SESSION,
      message: 'Unauthorized',
    });
  }
}
