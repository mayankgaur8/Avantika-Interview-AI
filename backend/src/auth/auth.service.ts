import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/auth.dto';
import { PanelMailService } from '../panel/panel-mail.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: PanelMailService,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<AuthTokens> {
    const user = await this.usersService.create(createUserDto);
    return this.generateTokens(user);
  }

  async login(loginDto: LoginDto): Promise<AuthTokens> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user || !(await user.validatePassword(loginDto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }
    return this.generateTokens(user);
  }

  async refreshTokens(
    userId: string,
    refreshToken: string,
  ): Promise<AuthTokens> {
    const user = await this.usersService.findById(userId);
    if (!user.refreshTokenHash) throw new UnauthorizedException();
    const match = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!match) throw new UnauthorizedException('Refresh token invalid');
    return this.generateTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshToken(userId, null);
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshSecret =
      this.configService.get<string>('jwt.refreshSecret') ?? 'refresh-secret';
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn:
        refreshExpiresIn as import('@nestjs/jwt').JwtSignOptions['expiresIn'],
    });
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(user.id, refreshTokenHash);
    return {
      accessToken,
      refreshToken,
      expiresIn: 8 * 60 * 60,
    };
  }

  async validateJwtPayload(payload: JwtPayload): Promise<User> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException();
    return user;
  }

  /** Send a password-reset email with a 1-hour token */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    // Always respond OK — never reveal whether email exists
    if (!user) return;

    const token = crypto.randomBytes(32).toString('hex');
    await this.usersService.setResetToken(user.id, token);

    const frontendUrl = this.configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?email=${encodeURIComponent(email)}&token=${token}`;

    await this.mailService.sendPasswordReset(
      email,
      `${user.firstName} ${user.lastName}`,
      resetUrl,
    );
  }

  /** Validate token and set new password */
  async resetPassword(email: string, token: string, newPassword: string): Promise<void> {
    const user = await this.usersService.validateResetToken(email, token);
    if (!user) throw new BadRequestException('Invalid or expired reset token');
    await this.usersService.resetPassword(user.id, newPassword);
  }
}
