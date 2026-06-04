import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

class AcceptInviteDto {
  @IsString()
  @MinLength(1)
  token: string;

  @IsString()
  @MinLength(8)
  password: string;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const secure = isProduction();

  res.cookie('bc.access', accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('bc.refresh', refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie('bc.access', { path: '/' });
  res.clearCookie('bc.refresh', { path: '/api/auth/refresh' });
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('accept-invite')
  @HttpCode(201)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async acceptInvite(@Body() dto: AcceptInviteDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.acceptInvite(dto.token, dto.password);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('login')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto.email, dto.password);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    clearAuthCookies(res);
    return {};
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.['bc.refresh'];
    const result = await this.authService.refresh(token);
    res.cookie('bc.access', result.accessToken, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    return { user: result.user };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() currentUser: any) {
    const user = await this.authService.findById(currentUser.userId);
    return { user };
  }

  @Get('providers')
  providers() {
    return { google: false };
  }
}
