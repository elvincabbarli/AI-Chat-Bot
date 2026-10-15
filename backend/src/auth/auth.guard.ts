import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: { id: string; email?: string };
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_PUBLISHABLE_KEY!,
);

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    request.user = { id: data.user.id, email: data.user.email };
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length);
    }

    const queryToken = request.query['access_token'];
    return typeof queryToken === 'string' ? queryToken : undefined;
  }
}
