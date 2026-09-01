import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../common/public.decorator';
import { WorkspaceContextService } from './workspace-context.service';

const DEMO_AUTH_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(WorkspaceContextService) private readonly workspaceContext: WorkspaceContextService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header('authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
    if (!token) throw new UnauthorizedException({ code: 'AUTH_TOKEN_MISSING', message: 'A bearer access token is required.' });

    let identity: { externalAuthId: string; email: string };
    if (token === 'demo-token' && this.isDemoAuthAllowed()) {
      identity = { externalAuthId: DEMO_AUTH_ID, email: 'demo@scrapo.local' };
    } else {
      identity = await this.verifySupabaseToken(token);
    }

    const workspace = await this.workspaceContext.resolve(identity, request.header('x-workspace-id'));
    request.auth = { ...identity, ...workspace };
    return true;
  }

  private isDemoAuthAllowed() {
    return this.config.get('DEMO_AUTH_ENABLED') === 'true' && this.config.get('NODE_ENV') !== 'production';
  }

  private async verifySupabaseToken(token: string) {
    const { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } = await import('jose');
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const legacySecret = this.config.get<string>('SUPABASE_JWT_SECRET');
    if (!supabaseUrl) {
      throw new UnauthorizedException({ code: 'AUTH_NOT_CONFIGURED', message: 'Supabase authentication is not configured.' });
    }

    try {
      const header = decodeProtectedHeader(token);
      const key = header.alg?.startsWith('HS')
        ? new TextEncoder().encode(legacySecret)
        : createRemoteJWKSet(new URL(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`));
      if (header.alg?.startsWith('HS') && !legacySecret) throw new Error('Legacy JWT secret is not configured.');
      const { payload } = await jwtVerify(token, key, {
        issuer: `${supabaseUrl.replace(/\/$/, '')}/auth/v1`,
        audience: 'authenticated',
      });
      if (!payload.sub) throw new Error('Token subject is missing.');
      return {
        externalAuthId: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : `${payload.sub}@supabase.local`,
      };
    } catch {
      throw new UnauthorizedException({ code: 'AUTH_TOKEN_INVALID', message: 'The Supabase access token is invalid or expired.' });
    }
  }
}
