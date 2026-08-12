import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import { Roles } from './roles.decorator';
import { Role } from './roles';
import {
  CreateUserDto,
  LoginDto,
  RegisterDto,
  ChangePasswordDto,
} from './auth.dto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuditActor } from '../auditoria/auditoria.types';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() body: RegisterDto) {
    const result = await this.authService.register(body);
    await this.auditoria.registrar({
      acao: 'CRIAR',
      entidade: 'USUARIO',
      entidadeId: result.user.id,
      resumo: `Usuário ${result.user.nome} (${result.user.email})`,
      ator: result.user,
    });
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.authService.me(user.id);
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: { id: string },
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.id,
      body.senhaAtual,
      body.novaSenha,
    );
  }

  @Roles(Role.ADMIN, Role.ADVOGADO, Role.ASSISTENTE)
  @Post('logout')
  logout() {
    // JWT é stateless; o cliente limpa o cookie/sessão. Endpoint para contrato explícito.
    return { ok: true };
  }

  @Roles(Role.ADMIN)
  @Get('usuarios')
  listUsers() {
    return this.authService.listUsers();
  }

  @Roles(Role.ADMIN)
  @Post('usuarios')
  async createUser(
    @Body() body: CreateUserDto,
    @CurrentUser() ator: AuditActor,
  ) {
    const result = await this.authService.createUserByAdmin(body);
    await this.auditoria.registrar({
      acao: 'CRIAR',
      entidade: 'USUARIO',
      entidadeId: result.user.id,
      resumo: `Usuário ${result.user.nome} (${result.user.email})`,
      ator,
    });
    return result;
  }
}
