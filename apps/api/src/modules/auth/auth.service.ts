import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { Role } from '@ledgerly/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface LoginResult {
  token: string;
  user: AuthenticatedUser;
}

/** What goes inside the JWT payload. Kept minimal on purpose: it's re-verified against the DB on every request via JwtStrategy, so the token itself only needs to say who to look up. */
export interface JwtPayload {
  sub: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const payload: JwtPayload = { sub: user.id, role: user.role as Role };
    const token = await this.jwtService.signAsync(payload);

    // The LOGIN audit event is written by AuditService elsewhere --
    // login itself must not depend on the audit chain.

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role as Role },
    };
  }

  async findById(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name, role: user.role as Role };
  }
}
