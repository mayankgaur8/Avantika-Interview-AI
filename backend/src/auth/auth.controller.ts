import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register
   * Register a new user (candidate or recruiter)
   */
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'Returns access + refresh tokens',
    schema: {
      example: {
        accessToken: 'eyJhbGci...',
        refreshToken: 'eyJhbGci...',
        expiresIn: 28800,
      },
    },
  })
  register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /auth/login
   * Authenticate and receive JWT tokens
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive JWT tokens' })
  @ApiResponse({
    status: 200,
    description: 'Returns access + refresh tokens',
    schema: {
      example: {
        accessToken: 'eyJhbGci...',
        refreshToken: 'eyJhbGci...',
        expiresIn: 28800,
      },
    },
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /auth/refresh
   * Rotate refresh token and get new access token
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  refresh(@Body() dto: RefreshTokenDto & { userId: string }) {
    return this.authService.refreshTokens(dto.userId, dto.refreshToken);
  }

  /**
   * POST /auth/logout
   * Invalidate the refresh token
   */
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  logout(@Request() req: { user: { id: string } }) {
    return this.authService.logout(req.user.id);
  }

  /**
   * GET /auth/me
   * Get current authenticated user profile
   */
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@Request() req: { user: unknown }) {
    return req.user;
  }

  /**
   * POST /auth/forgot-password
   * Send a password-reset email (always returns 200 — never reveals if email exists)
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email).then(() => ({
      message: 'If that email is registered, a reset link has been sent.',
    }));
  }

  /**
   * POST /auth/reset-password
   * Validate reset token and set new password
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from email' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService
      .resetPassword(dto.email, dto.token, dto.newPassword)
      .then(() => ({ message: 'Password updated successfully. Please log in.' }));
  }
}
