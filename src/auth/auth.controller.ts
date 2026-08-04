import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';

type RegisterBody = {
  nome: string;
  email: string;
  senha: string;
};

type LoginBody = {
  email: string;
  senha: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() body: RegisterBody) {
    return this.authService.register(body);
  }

  @Public()
  @Post('login')
  login(@Body() body: LoginBody) {
    return this.authService.login(body);
  }

  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.authService.me(user.id);
  }
}
